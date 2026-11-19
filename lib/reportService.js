const store = require("./store");
const audit = require("./audit");
const validate = require("./validate");

const SOFTWARE = "基于全网大数据的文创热点分析与智能选品系统";
const VERSION = "V1.0";

function list(ctx) {
  const query = ctx.query;
  const status = query.get("status") || "";
  const keyword = (query.get("keyword") || "").trim();
  let rows = store.db.reports.slice();
  if (status) rows = rows.filter(function (item) { return item.status === status; });
  if (keyword) rows = rows.filter(function (item) { return (item.title + item.category).indexOf(keyword) >= 0; });
  rows.sort(function (a, b) { return a.generatedAt < b.generatedAt ? 1 : -1; });
  const page = Math.max(1, Number(query.get("page") || 1));
  const size = Math.min(50, Math.max(5, Number(query.get("size") || 10)));
  const total = rows.length;
  ctx.ok({
    total: total,
    page: page,
    size: size,
    rows: rows.slice((page - 1) * size, page * size).map(function (item) {
      return {
        id: item.id,
        taskId: item.taskId,
        taskName: item.taskName,
        title: item.title,
        category: item.category,
        summary: item.summary,
        status: item.status,
        reviewer: item.reviewer,
        reviewComment: item.reviewComment,
        generatedAt: item.generatedAt
      };
    }),
    summary: {
      pending: store.db.reports.filter(function (item) { return item.status === "pending"; }).length,
      approved: store.db.reports.filter(function (item) { return item.status === "approved"; }).length,
      rejected: store.db.reports.filter(function (item) { return item.status === "rejected"; }).length
    }
  });
}

function detail(ctx) {
  const report = store.db.reports.find(function (item) { return item.id === ctx.params[0]; });
  if (!report) {
    ctx.fail(404, "报告不存在");
    return;
  }
  ctx.ok({ report: report });
}

function review(ctx) {
  const report = store.db.reports.find(function (item) { return item.id === ctx.params[0]; });
  if (!report) {
    ctx.fail(404, "报告不存在");
    return;
  }
  if (report.status !== "pending") {
    ctx.fail(409, "该报告已审核，不能重复处理");
    return;
  }
  const body = ctx.body || {};
  const action = String(body.action || "");
  const comment = String(body.comment || "").trim();
  if (action !== "approve" && action !== "reject") {
    ctx.fail(400, "审核动作必须为approve或reject");
    return;
  }
  if (action === "reject" && comment.length < 2) {
    ctx.fail(400, "驳回时必须填写审核意见", "comment");
    return;
  }
  report.status = action === "approve" ? "approved" : "rejected";
  report.reviewComment = comment;
  report.reviewer = ctx.user.name;
  report.reviewedAt = store.now();
  store.save();
  audit.write(ctx.user, "报告审核", action === "approve" ? "通过报告" : "驳回报告", report.title, comment, ctx.req);
  ctx.ok({ report: report });
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(report) {
  const generated = new Date(report.generatedAt);
  const stamp = generated.toLocaleString("zh-CN", { hour12: false });
  const rows = report.rows.map(function (item, index) {
    return "<tr><td>" + (index + 1) + "</td><td>" + escapeHtml(item.category) + "</td><td>" + item.heatScore.toFixed(2) +
      "</td><td>" + item.salesScore.toFixed(2) + "</td><td>" + item.competitionPenalty.toFixed(2) +
      "</td><td><strong>" + item.potentialScore.toFixed(2) + "</strong></td><td>" + (item.redOcean ? "是" : "否") +
      "</td><td>" + escapeHtml(item.riskWarning || "无") + "</td></tr>";
  }).join("");
  const bars = report.rows.map(function (item) {
    return '<div class="bar-row"><span class="bar-name">' + escapeHtml(item.category) + '</span><span class="bar-track"><span class="bar-fill" style="width:' +
      Math.max(2, item.potentialScore) + '%"></span></span><span class="bar-value">' + item.potentialScore.toFixed(2) + "</span></div>";
  }).join("");
  const params = report.params;
  return "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<title>" + escapeHtml(report.title) +
    "</title>\n<style>\n@page{size:A4;margin:18mm}\nbody{font-family:SimSun,serif;color:#1f2d33;font-size:11pt;line-height:1.8;margin:0}\n" +
    "header{border-bottom:2px solid #1f5f8b;padding-bottom:8mm;margin-bottom:8mm}\nheader .soft{font-family:SimHei,sans-serif;color:#1f5f8b;font-size:10pt;letter-spacing:2px}\n" +
    "header h1{font-family:SimHei,sans-serif;font-size:20pt;margin:3mm 0 2mm}\nheader .meta{color:#52666e;font-size:10pt}\nh2{font-family:SimHei,sans-serif;font-size:14pt;color:#1f5f8b;margin:8mm 0 3mm;border-left:4px solid #1f5f8b;padding-left:3mm}\n" +
    "table{width:100%;border-collapse:collapse;font-size:10pt;margin:3mm 0}\nth,td{border:1px solid #b9c9d1;padding:2mm 2.5mm;text-align:left;vertical-align:top}\nth{background:#eaf1f5;font-family:SimHei,sans-serif}\n" +
    ".kv td:first-child{width:32%;background:#f3f7f9}\n.note{background:#f4f8f5;border:1px solid #cfe0d5;padding:3mm;font-size:10pt;color:#33523f}\n.warn{color:#a33a2a}\n" +
    ".bar-row{display:flex;align-items:center;gap:3mm;margin:1.5mm 0;font-size:10pt}\n.bar-name{width:28mm;text-align:right;color:#40545c}\n.bar-track{flex:1;height:5mm;background:#edf2f4;border-radius:2mm;overflow:hidden}\n.bar-fill{display:block;height:100%;background:#1f5f8b}\n.bar-value{width:16mm;text-align:right;font-family:SimHei,sans-serif}\n" +
    "footer{margin-top:12mm;border-top:1px solid #b9c9d1;padding-top:4mm;color:#6b7d84;font-size:9pt}\n@media print{.no-print{display:none}}\n</style>\n</head>\n<body>\n" +
    "<header><div class=\"soft\">陕西理工大学 · 文创数据决策</div><h1>" + escapeHtml(report.title) +
    "</h1><div class=\"meta\">软件：" + SOFTWARE + " " + VERSION + "&nbsp;&nbsp;|&nbsp;&nbsp;生成时间：" + escapeHtml(stamp) +
    "&nbsp;&nbsp;|&nbsp;&nbsp;生成人：" + escapeHtml(report.createdByName) + "</div></header>\n" +
    "<h2>一、结论摘要</h2><p>" + escapeHtml(report.summary) + "</p><div class=\"note\">" +
    escapeHtml(report.recommendation).replace(/\n/g, "<br>") + "</div>\n" +
    "<h2>二、任务参数快照</h2><table class=\"kv\"><tr><td>目标类目</td><td>" + escapeHtml(report.category) +
    "</td><td>平台范围</td><td>" + escapeHtml(params.platform) + "</td></tr><tr><td>数据窗口</td><td>" + params.dateFrom + " 至 " + params.dateTo +
    "（" + params.windowDays + "天）</td><td>红海阈值</td><td>" + params.redOceanThreshold + "</td></tr><tr><td>热点权重 α</td><td>" + params.alpha +
    "</td><td>销量权重 β</td><td>" + params.beta + "</td></tr><tr><td>竞争惩罚系数 γ</td><td>" + params.gamma +
    "</td><td>最低利润率</td><td>" + params.minProfitMargin + "</td></tr></table>\n" +
    "<h2>三、类目潜力排名</h2><table><thead><tr><th>序号</th><th>类目</th><th>热度分</th><th>销量分</th><th>竞争惩罚</th><th>综合潜力</th><th>红海</th><th>风险提示</th></tr></thead><tbody>" +
    rows + "</tbody></table>\n" +
    "<h2>四、潜力对比</h2>" + bars + "\n" +
    "<h2>五、数据来源与可追溯信息</h2><table class=\"kv\"><tr><td>数据批次</td><td colspan=\"3\">" +
    escapeHtml((report.references || []).join("、") || "无") + "</td></tr><tr><td>话题样本</td><td>" +
    escapeHtml(String(report.topicCount || "")) + "</td><td>商品样本</td><td>" + escapeHtml(String(report.productCount || "")) + "</td></tr></table>\n" +
    "<p class=\"note\">本报告由系统算法基于使用单位导入的公开数据自动生成，参数与数据批次均已记录，结论仅供选品决策参考。报告中的图表与排名为算法输出，不含人工修改。</p>\n" +
    "<footer>著作权人：陕西理工大学&nbsp;&nbsp;|&nbsp;&nbsp;经办人：李果&nbsp;&nbsp;|&nbsp;&nbsp;材料修订日期：2026年11月18日<br>报告编号：" +
    escapeHtml(report.id) + "&nbsp;&nbsp;|&nbsp;&nbsp;任务编号：" + escapeHtml(report.taskId) + "</footer>\n" +
    "<p class=\"no-print\" style=\"margin-top:6mm\"><button onclick=\"window.print()\" style=\"padding:3mm 8mm;font-size:11pt\">打印或另存为PDF</button></p>\n" +
    "</body>\n</html>";
}

function downloadHtml(ctx) {
  const report = store.db.reports.find(function (item) { return item.id === ctx.params[0]; });
  if (!report) {
    ctx.fail(404, "报告不存在");
    return;
  }
  if (report.status !== "approved") {
    ctx.fail(409, "报告尚未审核通过，不能下载");
    return;
  }
  const content = buildHtml(report);
  store.db.reports = store.db.reports.map(function (item) {
    if (item.id === report.id) item.downloadCount = (item.downloadCount || 0) + 1;
    return item;
  });
  store.save();
  audit.write(ctx.user, "报告导出", "下载HTML报告", report.title, "报告编号" + report.id, ctx.req);
  ctx.res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Disposition": "attachment; filename=\"" + encodeURIComponent(validate.isBlank(report.title) ? "report.html" : report.title + ".html") + "\"",
    "Content-Length": Buffer.byteLength(content)
  });
  ctx.res.end(content);
}

function downloadCsv(ctx) {
  const report = store.db.reports.find(function (item) { return item.id === ctx.params[0]; });
  if (!report) {
    ctx.fail(404, "报告不存在");
    return;
  }
  if (report.status !== "approved") {
    ctx.fail(409, "报告尚未审核通过，不能下载");
    return;
  }
  const header = ["类目", "热度分", "销量分", "竞争惩罚", "综合潜力", "红海", "商品数", "店铺数", "销售额", "TOP10份额", "竞争饱和度", "风险提示"];
  const lines = [header.join(",")];
  report.rows.forEach(function (item) {
    lines.push([item.category, item.heatScore, item.salesScore, item.competitionPenalty, item.potentialScore,
      item.redOcean ? "是" : "否", item.itemCount, item.sellerCount, item.revenue, item.top10Share,
      item.saturation, item.riskWarning || ""].map(function (value) {
      return "\"" + String(value).replace(/"/g, "\"\"") + "\"";
    }).join(","));
  });
  const content = "\ufeff" + lines.join("\r\n");
  store.save();
  audit.write(ctx.user, "报告导出", "下载CSV明细", report.title, "报告编号" + report.id, ctx.req);
  ctx.res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": "attachment; filename=\"" + encodeURIComponent(report.title + "_明细.csv") + "\"",
    "Content-Length": Buffer.byteLength(content)
  });
  ctx.res.end(content);
}

module.exports = {
  list: list,
  detail: detail,
  review: review,
  buildHtml: buildHtml,
  downloadHtml: downloadHtml,
  downloadCsv: downloadCsv
};

