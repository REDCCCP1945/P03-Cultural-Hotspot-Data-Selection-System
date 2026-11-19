const store = require("./store");
const audit = require("./audit");
const text = require("./text");
const validate = require("./validate");
const importService = require("./importService");

const DICT_TYPES = ["categories", "platforms", "sourceTypes"];


function defaults() {
  return {
    alpha: 0.4,
    beta: 0.4,
    gamma: 0.2,
    redOceanThreshold: 85,
    minProfitMargin: 0.15,
    windowDays: 30,
    softwareName: "基于全网大数据的文创热点分析与智能选品系统",
    softwareVersion: "V1.0",
    dataPolicy: "本系统不采集网络数据，分析数据由使用单位按合规途径取得后导入。",
    aiNotice: "报告中的排名与图表由算法基于导入数据自动生成，结论仅供决策参考。"
  };
}

function get(ctx) {
  ctx.ok({
    settings: store.db.settings,
    roleMenus: store.db.settings.roleMenus,
    dicts: store.db.dicts,
    roleNames: require("./userService").ROLE_NAMES
  });
}

function save(ctx) {
  const body = ctx.body || {};
  const settings = store.db.settings;
  const alpha = Number(body.alpha);
  const beta = Number(body.beta);
  const gamma = Number(body.gamma);
  const threshold = Number(body.redOceanThreshold);
  const minMargin = Number(body.minProfitMargin);
  const windowDays = Number(body.windowDays);
  if (!Number.isFinite(alpha) || alpha < 0.2 || alpha > 0.4) { ctx.fail(400, "热点权重应在0.20到0.40之间", "alpha"); return; }
  if (!Number.isFinite(beta) || beta < 0.3 || beta > 0.5) { ctx.fail(400, "销量权重应在0.30到0.50之间", "beta"); return; }
  if (!Number.isFinite(gamma) || gamma < 0.1 || gamma > 0.5) { ctx.fail(400, "竞争惩罚系数应在0.10到0.50之间", "gamma"); return; }
  if (alpha + beta > 0.95) { ctx.fail(400, "热点权重与销量权重之和不能超过0.95", "alpha"); return; }
  if (!Number.isFinite(threshold) || threshold < 60 || threshold > 95) { ctx.fail(400, "红海阈值应在60到95之间", "redOceanThreshold"); return; }
  if (!Number.isFinite(minMargin) || minMargin < 0 || minMargin > 0.6) { ctx.fail(400, "最低利润率应在0到0.60之间", "minProfitMargin"); return; }
  if (!Number.isFinite(windowDays) || windowDays < 7 || windowDays > 90) { ctx.fail(400, "默认时间窗口应在7到90天之间", "windowDays"); return; }
  const before = JSON.stringify({
    alpha: settings.alpha, beta: settings.beta, gamma: settings.gamma,
    redOceanThreshold: settings.redOceanThreshold, minProfitMargin: settings.minProfitMargin, windowDays: settings.windowDays
  });
  settings.alpha = validate.round(alpha, 2);
  settings.beta = validate.round(beta, 2);
  settings.gamma = validate.round(gamma, 2);
  settings.redOceanThreshold = validate.round(threshold, 1);
  settings.minProfitMargin = validate.round(minMargin, 2);
  settings.windowDays = Math.round(windowDays);
  if (typeof body.dataPolicy === "string" && body.dataPolicy.trim()) settings.dataPolicy = body.dataPolicy.trim().slice(0, 500);
  if (typeof body.aiNotice === "string" && body.aiNotice.trim()) settings.aiNotice = body.aiNotice.trim().slice(0, 500);
  store.save();
  audit.write(ctx.user, "系统设置", "保存系统参数", "算法默认参数", before + " -> " + JSON.stringify({
    alpha: settings.alpha, beta: settings.beta, gamma: settings.gamma,
    redOceanThreshold: settings.redOceanThreshold, minProfitMargin: settings.minProfitMargin, windowDays: settings.windowDays
  }), ctx.req);
  ctx.ok({ settings: settings });
}

function dictList(ctx) {
  const type = ctx.params[0];
  if (DICT_TYPES.indexOf(type) < 0) {
    ctx.fail(404, "字典类型不存在");
    return;
  }
  ctx.ok({ type: type, rows: store.db.dicts[type] || [] });
}

function dictSave(ctx) {
  const type = ctx.params[0];
  if (DICT_TYPES.indexOf(type) < 0) {
    ctx.fail(404, "字典类型不存在");
    return;
  }
  const body = ctx.body || {};
  const name = String(body.name || "").trim();
  const code = String(body.code || "").trim();
  const id = body.id || "";
  if (name.length < 2 || name.length > 30) {
    ctx.fail(400, "名称长度应为2到30个字符", "name");
    return;
  }
  const list = store.db.dicts[type] || [];
  const duplicate = list.find(function (item) { return item.name === name && item.id !== id; });
  if (duplicate) {
    ctx.fail(409, "该名称已存在", "name");
    return;
  }
  if (id) {
    const item = list.find(function (entry) { return entry.id === id; });
    if (!item) {
      ctx.fail(404, "字典项不存在");
      return;
    }
    item.name = name;
    item.code = code;
    audit.write(ctx.user, "数据字典", "修改字典项", name, type, ctx.req);
  } else {
    list.push({ id: store.id("DICT"), name: name, code: code, enabled: true, createdAt: store.now() });
    audit.write(ctx.user, "数据字典", "新增字典项", name, type, ctx.req);
  }
  store.save();
  ctx.ok({ rows: list });
}

function dictRemove(ctx) {
  const type = ctx.params[0];
  if (DICT_TYPES.indexOf(type) < 0) {
    ctx.fail(404, "字典类型不存在");
    return;
  }
  const id = ctx.params[1];
  const list = store.db.dicts[type] || [];
  const item = list.find(function (entry) { return entry.id === id; });
  if (!item) {
    ctx.fail(404, "字典项不存在");
    return;
  }
  let used = 0;
  if (type === "categories") {
    used = store.db.topics.filter(function (topic) { return topic.category === item.name; }).length +
      store.db.products.filter(function (product) { return product.category === item.name; }).length +
      store.db.comments.filter(function (comment) { return comment.category === item.name; }).length +
      store.db.tasks.filter(function (task) { return task.category === item.name; }).length;
  } else if (type === "platforms") {
    used = store.db.topics.filter(function (topic) { return topic.platform === item.name; }).length +
      store.db.products.filter(function (product) { return product.platform === item.name; }).length;
  } else {
    used = store.db.batches.filter(function (batch) { return batch.sourceType === item.name; }).length;
  }
  if (used > 0) {
    ctx.fail(409, "该字典项已被" + used + "条业务数据引用，不能删除");
    return;
  }
  store.db.dicts[type] = list.filter(function (entry) { return entry.id !== id; });
  store.save();
  audit.write(ctx.user, "数据字典", "删除字典项", item.name, type, ctx.req);
  ctx.ok({ rows: store.db.dicts[type] });
}

function cleaningRules(ctx) {
  ctx.ok({ rows: store.db.cleaningRules });
}

function cleaningToggle(ctx) {
  const rule = store.db.cleaningRules.find(function (item) { return item.id === ctx.params[0]; });
  if (!rule) {
    ctx.fail(404, "规则不存在");
    return;
  }
  if (rule.builtin) {
    ctx.fail(409, "内置规则不能停用");
    return;
  }
  rule.enabled = !rule.enabled;
  store.save();
  audit.write(ctx.user, "清洗规则", rule.enabled ? "启用规则" : "停用规则", rule.name, "", ctx.req);
  ctx.ok({ rule: rule });
}

function cleaningTest(ctx) {
  const body = ctx.body || {};
  const sample = String(body.text || "");
  if (!sample.trim()) {
    ctx.fail(400, "请输入校验文本", "text");
    return;
  }
  const cleaned = text.cleanText(sample);
  const masked = text.maskText(cleaned);
  const signature = text.simhashText(masked);
  ctx.ok({
    original: sample,
    cleaned: cleaned,
    masked: masked,
    tokens: text.tokenize(masked),
    simhash: signature,
    sentiment: text.sentiment(masked),
    aspects: text.aspectScores(masked)
  });
}

function dedupRecords(ctx) {
  const query = ctx.query;
  const batchId = query.get("batchId") || "";
  let rows = store.db.batches.slice();
  if (batchId) rows = rows.filter(function (item) { return item.id === batchId; });
  rows = rows.filter(function (item) { return item.duplicateRows > 0 || item.importedRows > 0; });
  ctx.ok({
    total: rows.length,
    rows: rows.slice(0, 30).map(function (item) {
      return {
        id: item.id,
        batchNo: item.batchNo,
        typeName: item.typeName,
        sourceName: item.sourceName,
        totalRows: item.totalRows,
        importedRows: item.importedRows,
        duplicateRows: item.duplicateRows,
        invalidRows: item.invalidRows,
        duplicateRatio: item.totalRows === 0 ? 0 : validate.round((item.duplicateRows / item.totalRows) * 100, 2),
        createdAt: item.createdAt
      };
    }),
    totalDuplicate: store.db.batches.reduce(function (sum, item) { return sum + (item.duplicateRows || 0); }, 0)
  });
}

function roleMenu(ctx) {
  ctx.ok({ roleMenus: store.db.settings.roleMenus, roleNames: require("./userService").ROLE_NAMES });
}

function roleMenuSave(ctx) {
  const body = ctx.body || {};
  const role = String(body.role || "");
  const menus = Array.isArray(body.menus) ? body.menus : null;
  const roleNames = require("./userService").ROLE_NAMES;
  if (!roleNames[role]) {
    ctx.fail(400, "角色无效", "role");
    return;
  }
  if (!menus) {
    ctx.fail(400, "菜单列表无效", "menus");
    return;
  }
  if (role === "ADMIN") {
    ctx.fail(409, "内置管理员菜单不能修改");
    return;
  }
  store.db.settings.roleMenus[role] = menus.slice();
  store.save();
  audit.write(ctx.user, "权限管理", "调整角色菜单", roleNames[role], menus.join("、"), ctx.req);
  ctx.ok({ roleMenus: store.db.settings.roleMenus });
}

module.exports = {
  DICT_TYPES: DICT_TYPES,
  defaults: defaults,
  get: get,
  save: save,
  dictList: dictList,
  dictSave: dictSave,
  dictRemove: dictRemove,
  cleaningRules: cleaningRules,
  cleaningToggle: cleaningToggle,
  cleaningTest: cleaningTest,
  dedupRecords: dedupRecords,
  roleMenu: roleMenu,
  roleMenuSave: roleMenuSave
};

