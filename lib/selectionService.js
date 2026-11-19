const store = require("./store");
const analytics = require("./analytics");
const audit = require("./audit");
const validate = require("./validate");

const STATUS_LABELS = {
  queued: "排队中",
  running: "执行中",
  completed: "已完成",
  failed: "失败"
};

function defaultParams() {
  const settings = store.db.settings;
  return {
    alpha: settings.alpha,
    beta: settings.beta,
    gamma: settings.gamma,
    redOceanThreshold: settings.redOceanThreshold,
    minProfitMargin: settings.minProfitMargin
  };
}

function listTasks(ctx) {
  const query = ctx.query;
  const status = query.get("status") || "";
  const keyword = (query.get("keyword") || "").trim();
  let rows = store.db.tasks.slice();
  if (status) rows = rows.filter(function (item) { return item.status === status; });
  if (keyword) rows = rows.filter(function (item) { return (item.name + item.category).indexOf(keyword) >= 0; });
  rows.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  const page = Math.max(1, Number(query.get("page") || 1));
  const size = Math.min(50, Math.max(5, Number(query.get("size") || 10)));
  const total = rows.length;
  ctx.ok({
    total: total,
    page: page,
    size: size,
    rows: rows.slice((page - 1) * size, page * size).map(function (item) {
      return Object.assign({}, item, { statusLabel: STATUS_LABELS[item.status] || item.status });
    }),
    summary: {
      queued: store.db.tasks.filter(function (item) { return item.status === "queued"; }).length,
      running: store.db.tasks.filter(function (item) { return item.status === "running"; }).length,
      completed: store.db.tasks.filter(function (item) { return item.status === "completed"; }).length,
      failed: store.db.tasks.filter(function (item) { return item.status === "failed"; }).length
    }
  });
}

function validateTask(body) {
  const errors = [];
  const name = String(body.name || "").trim();
  const category = String(body.category || "").trim();
  const alpha = Number(body.alpha);
  const beta = Number(body.beta);
  const gamma = Number(body.gamma);
  const threshold = Number(body.redOceanThreshold);
  const minMargin = Number(body.minProfitMargin);
  if (name.length < 2 || name.length > 40) errors.push({ field: "name", message: "任务名称长度应为2到40个字符" });
  if (!category) errors.push({ field: "category", message: "请选择目标类目" });
  if (!Number.isFinite(alpha) || alpha < 0.2 || alpha > 0.4) errors.push({ field: "alpha", message: "热点权重应在0.20到0.40之间" });
  if (!Number.isFinite(beta) || beta < 0.3 || beta > 0.5) errors.push({ field: "beta", message: "销量权重应在0.30到0.50之间" });
  if (!Number.isFinite(gamma) || gamma < 0.1 || gamma > 0.5) errors.push({ field: "gamma", message: "竞争惩罚系数应在0.10到0.50之间" });
  if (alpha + beta > 0.95) errors.push({ field: "alpha", message: "热点权重与销量权重之和不能超过0.95" });
  if (!Number.isFinite(threshold) || threshold < 60 || threshold > 95) errors.push({ field: "redOceanThreshold", message: "红海阈值应在60到95之间" });
  if (!Number.isFinite(minMargin) || minMargin < 0 || minMargin > 0.6) errors.push({ field: "minProfitMargin", message: "最低利润率应在0到0.60之间" });
  return errors;
}

function createTask(ctx) {
  const body = ctx.body || {};
  const errors = validateTask(body);
  if (errors.length) {
    ctx.send(400, { code: 400, message: errors[0].message, errors: errors });
    return;
  }
  const today = new Date();
  const windowDays = Math.min(90, Math.max(7, Number(body.windowDays || 30)));
  const dateTo = validate.normalizeDate(body.dateTo || today.toISOString().slice(0, 10));
  let dateFrom = validate.normalizeDate(body.dateFrom || "");
  if (!dateFrom) {
    const start = new Date(today.getTime() - (windowDays - 1) * 86400000);
    dateFrom = start.toISOString().slice(0, 10);
  }
  if (!validate.isDate(dateFrom) || !validate.isDate(dateTo) || dateFrom > dateTo) {
    ctx.fail(400, "时间范围不正确");
    return;
  }
  const task = {
    id: store.id("TASK"),
    name: String(body.name).trim(),
    category: String(body.category).trim(),
    platform: String(body.platform || "全部平台").trim(),
    windowDays: windowDays,
    dateFrom: dateFrom,
    dateTo: dateTo,
    alpha: validate.round(Number(body.alpha), 2),
    beta: validate.round(Number(body.beta), 2),
    gamma: validate.round(Number(body.gamma), 2),
    redOceanThreshold: validate.round(Number(body.redOceanThreshold), 1),
    minProfitMargin: validate.round(Number(body.minProfitMargin), 2),
    status: "queued",
    progress: 0,
    logs: [{ time: store.now(), message: "任务已创建，等待计算资源" }],
    result: [],
    reportId: "",
    createdBy: ctx.user.id,
    createdByName: ctx.user.name,
    createdAt: store.now(),
    startedAt: "",
    finishedAt: ""
  };
  store.db.tasks.unshift(task);
  store.save();
  audit.write(ctx.user, "智能选品", "创建选品任务", task.name, "类目" + task.category + "，权重" + task.alpha + "/" + task.beta + "/" + task.gamma, ctx.req);
  ctx.ok({ task: task });
  setTimeout(function () {
    runTask(task.id);
  }, 900);
}

function log(task, message) {
  task.logs.push({ time: store.now(), message: message });
}

function runTask(taskId) {
  const task = store.db.tasks.find(function (item) { return item.id === taskId; });
  if (!task || task.status !== "queued") return;
  task.status = "running";
  task.progress = 15;
  task.startedAt = store.now();
  log(task, "开始校验数据窗口与类目数据");
  store.save();
  setTimeout(function () {
    try {
      const topics = store.db.topics.filter(function (item) {
        if (task.platform && task.platform !== "全部平台" && item.platform !== task.platform) return false;
        return analytics.inRange(item.publishDate, task.dateFrom, task.dateTo);
      });
      const products = store.db.products.filter(function (item) {
        if (task.platform && task.platform !== "全部平台" && item.platform !== task.platform) return false;
        return analytics.inRange(item.recordDate, task.dateFrom, task.dateTo);
      });
      task.progress = 45;
      log(task, "读取话题" + topics.length + "条、商品" + products.length + "条");
      store.save();
      const rows = analytics.potentialRows({
        topics: topics,
        products: products,
        category: task.category,
        dateFrom: task.dateFrom,
        dateTo: task.dateTo,
        alpha: task.alpha,
        beta: task.beta,
        gamma: task.gamma,
        redOceanThreshold: task.redOceanThreshold,
        minProfitMargin: task.minProfitMargin
      });
      if (!rows.length) {
        task.status = "failed";
        task.progress = 100;
        task.finishedAt = store.now();
        log(task, "失败：所选类目在时间窗口内没有可用商品数据");
        store.save();
        return;
      }
      task.progress = 75;
      log(task, "完成热度、销量与竞争惩罚计算，共" + rows.length + "个类目");
      store.save();
      const report = buildReport(task, rows, topics, products);
      task.result = rows;
      task.reportId = report.id;
      task.progress = 100;
      task.status = "completed";
      task.finishedAt = store.now();
      log(task, "选品报告已生成，等待审核");
      store.db.reports.unshift(report);
      store.save();
    } catch (error) {
      task.status = "failed";
      task.progress = 100;
      task.finishedAt = store.now();
      log(task, "失败：计算过程异常 " + error.message);
      store.save();
    }
  }, 1200);
}

function buildReport(task, rows, topics, products) {
  const top = rows.slice(0, 3);
  const redOceanCount = rows.filter(function (item) { return item.redOcean; }).length;
  const references = [];
  topics.forEach(function (item) { if (item.batchId && references.indexOf(item.batchId) < 0) references.push(item.batchId); });
  products.forEach(function (item) { if (item.batchId && references.indexOf(item.batchId) < 0) references.push(item.batchId); });
  const summary = "本次任务覆盖" + rows.length + "个类目，潜力分最高为" + top[0].category + "（" + top[0].potentialScore.toFixed(2) + "分）。" +
    "红海类目" + redOceanCount + "个。" + (redOceanCount ? "建议优先关注未触发红海预警且综合分靠前的类目。" : "当前窗口内未发现达到红海阈值的类目。");
  const recommendation = top.map(function (item, index) {
    return (index + 1) + ". " + item.category + "：综合潜力" + item.potentialScore.toFixed(2) +
      "，热度" + item.heatScore.toFixed(2) + "，销量" + item.salesScore.toFixed(2) +
      "，竞争惩罚" + item.competitionPenalty.toFixed(2) + (item.redOcean ? "（红海预警）" : "");
  }).join("\n");
  return {
    id: store.id("RPT"),
    taskId: task.id,
    taskName: task.name,
    title: task.name + "选品建议报告",
    category: task.category,
    summary: summary,
    recommendation: recommendation,
    params: {
      alpha: task.alpha,
      beta: task.beta,
      gamma: task.gamma,
      redOceanThreshold: task.redOceanThreshold,
      minProfitMargin: task.minProfitMargin,
      windowDays: task.windowDays,
      dateFrom: task.dateFrom,
      dateTo: task.dateTo,
      platform: task.platform
    },
    rows: rows,
    references: references,
    topicCount: topics.length,
    productCount: products.length,
    status: "pending",
    reviewComment: "",
    reviewer: "",
    reviewedAt: "",
    generatedAt: store.now(),
    createdBy: task.createdBy,
    createdByName: task.createdByName
  };
}

function taskDetail(ctx) {
  const task = store.db.tasks.find(function (item) { return item.id === ctx.params[0]; });
  if (!task) {
    ctx.fail(404, "任务不存在");
    return;
  }
  const report = task.reportId ? store.db.reports.find(function (item) { return item.id === task.reportId; }) : null;
  ctx.ok({
    task: Object.assign({}, task, { statusLabel: STATUS_LABELS[task.status] || task.status }),
    report: report ? Object.assign({}, report, { rows: report.rows }) : null
  });
}

function retryTask(ctx) {
  const task = store.db.tasks.find(function (item) { return item.id === ctx.params[0]; });
  if (!task) {
    ctx.fail(404, "任务不存在");
    return;
  }
  if (task.status !== "failed") {
    ctx.fail(409, "只有失败任务可以重新提交");
    return;
  }
  task.status = "queued";
  task.progress = 0;
  task.logs.push({ time: store.now(), message: "用户重新提交任务" });
  task.finishedAt = "";
  store.save();
  audit.write(ctx.user, "智能选品", "重新提交任务", task.name, "", ctx.req);
  ctx.ok({ task: task });
  setTimeout(function () { runTask(task.id); }, 600);
}

function dashboardResult() {
  const topics = store.db.topics;
  const products = store.db.products;
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const params = defaultParams();
  const rows = analytics.potentialRows({
    topics: topics,
    products: products,
    category: "全部类目",
    dateFrom: from,
    dateTo: today,
    alpha: params.alpha,
    beta: params.beta,
    gamma: params.gamma,
    redOceanThreshold: params.redOceanThreshold,
    minProfitMargin: params.minProfitMargin
  });
  return rows;
}

module.exports = {
  STATUS_LABELS: STATUS_LABELS,
  defaultParams: defaultParams,
  listTasks: listTasks,
  createTask: createTask,
  runTask: runTask,
  taskDetail: taskDetail,
  retryTask: retryTask,
  dashboardResult: dashboardResult
};

