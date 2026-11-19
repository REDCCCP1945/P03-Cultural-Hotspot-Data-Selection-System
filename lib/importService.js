const fs = require("fs");
const path = require("path");
const store = require("./store");
const text = require("./text");
const audit = require("./audit");
const validate = require("./validate");

const TEMPLATES = {
  topic: "标题,平台,类目,阅读量,讨论量,转发量,发布日期,关键词,正文\n宋韵纹样手账本走红,小红书,文具手账,128000,3600,820,2026-11-10,宋韵|手账|纹样,宋代审美相关讨论持续升温\n",
  product: "商品名称,平台,类目,价格,月销量,销售额,利润率,店铺,记录日期\n宋韵纹样手账本,淘宝,文具手账,69,1800,124200,0.32,汴京文创旗舰店,2026-11-10\n",
  comment: "评论内容,类目,商品名称,评论日期\n包装很用心，本子质感好，宋韵纹样好看,文具手账,宋韵纹样手账本,2026-11-11\n"
};

const TYPE_NAMES = { topic: "热点话题", product: "电商商品", comment: "评论" };

function template(ctx) {
  const type = ctx.query.get("type") || "topic";
  if (!TEMPLATES[type]) {
    ctx.fail(400, "未知模板类型");
    return;
  }
  const content = "\ufeff" + TEMPLATES[type];
  ctx.res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": "attachment; filename=\"" + encodeURIComponent(TYPE_NAMES[type] + "导入模板.csv") + "\"",
    "Content-Length": Buffer.byteLength(content)
  });
  ctx.res.end(content);
}

function parseCsv(content) {
  let source = String(content || "").replace(/^\ufeff/, "");
  if (source.trim().startsWith("[")) {
    const rows = JSON.parse(source);
    if (!Array.isArray(rows)) throw new Error("JSON内容必须为数组");
    const keys = [];
    rows.forEach(function (row) {
      Object.keys(row).forEach(function (key) {
        if (keys.indexOf(key) < 0) keys.push(key);
      });
    });
    return [keys].concat(rows.map(function (row) {
      return keys.map(function (key) { return row[key]; });
    }));
  }
  const delimiter = source.indexOf("\t") >= 0 && source.indexOf(",") < 0 ? "\t" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        i += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      if (row.some(function (item) { return item !== ""; })) rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(function (item) { return item !== ""; })) rows.push(row);
  if (!rows.length) throw new Error("文件为空");
  return rows;
}

const FIELDS = {
  topic: {
    title: ["标题", "话题", "话题名称"],
    platform: ["平台", "平台来源"],
    category: ["类目", "所属类目", "所属一级类目"],
    readCount: ["阅读量", "热度", "浏览量"],
    discussCount: ["讨论量", "评论量"],
    shareCount: ["转发量", "分享量"],
    publishDate: ["发布日期", "数据统计日期", "日期"],
    keywords: ["关键词"],
    content: ["正文", "内容", "话题正文"]
  },
  product: {
    name: ["商品名称", "名称"],
    platform: ["平台", "平台来源"],
    category: ["类目", "所属类目", "所属一级类目"],
    price: ["价格", "销售价格", "标价"],
    monthlySales: ["月销量", "销量", "近30天销量"],
    revenue: ["销售额", "成交额"],
    profitMargin: ["利润率", "毛利率"],
    shopName: ["店铺", "店铺名称"],
    recordDate: ["记录日期", "数据统计日期", "日期"]
  },
  comment: {
    text: ["评论内容", "评论", "内容"],
    category: ["类目", "所属类目"],
    productName: ["商品名称", "所属商品"],
    productId: ["商品ID"],
    commentDate: ["评论日期", "数据统计日期", "日期"]
  }
};

function mapHeaders(headers, type) {
  const mapping = {};
  const spec = FIELDS[type];
  Object.keys(spec).forEach(function (field) {
    const aliases = spec[field];
    const index = headers.findIndex(function (header) {
      return aliases.indexOf(String(header).trim()) >= 0;
    });
    mapping[field] = index;
  });
  return mapping;
}

function cell(row, mapping, field) {
  const index = mapping[field];
  if (index === undefined || index < 0) return "";
  return row[index] === undefined ? "" : String(row[index]).trim();
}

function splitKeywords(value) {
  return String(value || "").split(/[|,，、;；\s]+/).map(function (item) {
    return item.trim();
  }).filter(function (item) { return item.length >= 2; });
}

function batchNo(type) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const seq = String(store.db.batches.filter(function (item) { return item.type === type; }).length + 1).padStart(3, "0");
  return "BT-" + type.toUpperCase() + "-" + stamp + "-" + seq;
}

function importBatch(ctx) {
  const body = ctx.body || {};
  const type = String(body.type || "");
  if (!TYPE_NAMES[type]) {
    ctx.fail(400, "导入类型必须为topic、product或comment");
    return;
  }
  const sourceName = String(body.sourceName || "").trim();
  const sourceType = String(body.sourceType || "").trim();
  const acquiredDate = validate.normalizeDate(body.acquiredDate || "");
  const fileName = String(body.fileName || "import.csv").trim();
  const content = String(body.content || "");
  if (!sourceName) {
    ctx.fail(400, "请填写数据来源名称", "sourceName");
    return;
  }
  if (!sourceType) {
    ctx.fail(400, "请选择来源类型", "sourceType");
    return;
  }
  if (!validate.isDate(acquiredDate)) {
    ctx.fail(400, "取得日期格式应为YYYY-MM-DD", "acquiredDate");
    return;
  }
  if (!content.trim()) {
    ctx.fail(400, "导入文件内容为空", "content");
    return;
  }
  let rows;
  try {
    rows = parseCsv(content);
  } catch (e) {
    ctx.fail(400, "文件解析失败：" + e.message);
    return;
  }
  if (rows.length < 2) {
    ctx.fail(400, "文件没有数据行");
    return;
  }
  const headers = rows[0];
  const mapping = mapHeaders(headers, type);
  const missing = Object.keys(FIELDS[type]).filter(function (field) {
    const required = ["keywords", "content", "revenue", "productName", "productId", "commentDate", "recordDate"].indexOf(field) < 0;
    return required && mapping[field] < 0;
  });
  if (missing.length) {
    ctx.fail(400, "缺少必填列：" + missing.join("、"));
    return;
  }
  const now = store.now();
  const batch = {
    id: store.id("BAT"),
    batchNo: batchNo(type),
    type: type,
    typeName: TYPE_NAMES[type],
    sourceName: sourceName,
    sourceType: sourceType,
    acquiredDate: acquiredDate,
    fileName: fileName,
    fileSize: Buffer.byteLength(content),
    totalRows: rows.length - 1,
    importedRows: 0,
    duplicateRows: 0,
    invalidRows: 0,
    status: "processing",
    createdBy: ctx.user.id,
    createdByName: ctx.user.name,
    createdAt: now
  };
  const errors = [];
  const records = [];
  const seen = [];
  const uploadDir = path.join(store.dataPath(), "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, batch.id + "_" + fileName.replace(/[\\/:*?"<>|]/g, "_")), content, "utf8");
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const line = index + 1;
    if (type === "topic") {
      const title = cell(row, mapping, "title");
      const platform = cell(row, mapping, "platform");
      const category = cell(row, mapping, "category");
      const readCount = validate.toNumber(cell(row, mapping, "readCount"));
      const discussCount = validate.toNumber(cell(row, mapping, "discussCount"));
      const shareCount = validate.toNumber(cell(row, mapping, "shareCount"));
      const publishDate = validate.normalizeDate(cell(row, mapping, "publishDate"));
      if (!title) { errors.push({ row: line, field: "标题", value: "", message: "标题不能为空" }); continue; }
      if (title.length > 120) { errors.push({ row: line, field: "标题", value: title, message: "标题超过120字符" }); continue; }
      if (!platform) { errors.push({ row: line, field: "平台", value: "", message: "平台不能为空" }); continue; }
      if (!category) { errors.push({ row: line, field: "类目", value: "", message: "类目不能为空" }); continue; }
      if (!Number.isFinite(readCount) || readCount < 0 || !Number.isFinite(discussCount) || discussCount < 0 || !Number.isFinite(shareCount) || shareCount < 0) {
        errors.push({ row: line, field: "阅读量/讨论量/转发量", value: "", message: "必须为非负数字" });
        continue;
      }
      if (!validate.isDate(publishDate)) { errors.push({ row: line, field: "发布日期", value: publishDate, message: "日期格式应为YYYY-MM-DD" }); continue; }
      if (!validate.notFuture(publishDate)) { errors.push({ row: line, field: "发布日期", value: publishDate, message: "日期不能晚于当前日期" }); continue; }
      const keywords = splitKeywords(cell(row, mapping, "keywords"));
      const contentText = text.maskText(text.cleanText(cell(row, mapping, "content")));
      const signature = text.simhashText(title + " " + keywords.join(" ") + " " + contentText);
      const duplicate = seen.find(function (item) { return text.hamming(item, signature) <= 3; });
      if (duplicate) { batch.duplicateRows += 1; continue; }
      seen.push(signature);
      records.push({
        id: store.id("TOP"),
        batchId: batch.id,
        title: title,
        platform: platform,
        category: category,
        readCount: Math.round(readCount),
        discussCount: Math.round(discussCount),
        shareCount: Math.round(shareCount),
        publishDate: publishDate,
        keywords: keywords.length ? keywords : text.tokenize(title).slice(0, 6),
        content: contentText,
        simhash: signature,
        sourceUrl: "",
        importedAt: now
      });
    } else if (type === "product") {
      const name = cell(row, mapping, "name");
      const platform = cell(row, mapping, "platform");
      const category = cell(row, mapping, "category");
      const price = validate.toNumber(cell(row, mapping, "price"));
      const monthlySales = validate.toNumber(cell(row, mapping, "monthlySales"));
      const revenueRaw = cell(row, mapping, "revenue");
      const revenue = revenueRaw ? validate.toNumber(revenueRaw) : price * monthlySales;
      const profitMargin = validate.toNumber(cell(row, mapping, "profitMargin"));
      const shopName = cell(row, mapping, "shopName");
      const recordDate = validate.normalizeDate(cell(row, mapping, "recordDate") || acquiredDate);
      if (!name) { errors.push({ row: line, field: "商品名称", value: "", message: "商品名称不能为空" }); continue; }
      if (!platform || !category) { errors.push({ row: line, field: "平台/类目", value: "", message: "平台与类目不能为空" }); continue; }
      if (!Number.isFinite(price) || price < 0) { errors.push({ row: line, field: "价格", value: "", message: "价格必须为非负数字" }); continue; }
      if (!Number.isFinite(monthlySales) || monthlySales < 0) { errors.push({ row: line, field: "月销量", value: "", message: "月销量必须为非负整数" }); continue; }
      if (!Number.isFinite(revenue) || revenue < 0) { errors.push({ row: line, field: "销售额", value: "", message: "销售额必须为非负数字" }); continue; }
      if (!Number.isFinite(profitMargin) || profitMargin < 0 || profitMargin > 1) { errors.push({ row: line, field: "利润率", value: "", message: "利润率必须在0到1之间" }); continue; }
      if (!shopName) { errors.push({ row: line, field: "店铺", value: "", message: "店铺不能为空" }); continue; }
      if (!validate.isDate(recordDate) || !validate.notFuture(recordDate)) { errors.push({ row: line, field: "记录日期", value: recordDate, message: "日期格式应为YYYY-MM-DD且不晚于当前日期" }); continue; }
      const duplicate = records.find(function (item) {
        return item.name === name && item.platform === platform && item.category === category;
      });
      if (duplicate) { batch.duplicateRows += 1; continue; }
      records.push({
        id: store.id("PRD"),
        batchId: batch.id,
        name: name,
        platform: platform,
        category: category,
        price: validate.round(price, 2),
        monthlySales: Math.round(monthlySales),
        revenue: validate.round(revenue, 2),
        profitMargin: validate.round(profitMargin, 4),
        shopName: shopName,
        recordDate: recordDate,
        importedAt: now
      });
    } else {
      const raw = cell(row, mapping, "text");
      const category = cell(row, mapping, "category");
      const productName = cell(row, mapping, "productName");
      const productId = cell(row, mapping, "productId");
      let commentDate = validate.normalizeDate(cell(row, mapping, "commentDate") || acquiredDate);
      if (!raw) { errors.push({ row: line, field: "评论内容", value: "", message: "评论内容不能为空" }); continue; }
      if (raw.length > 500) { errors.push({ row: line, field: "评论内容", value: "", message: "评论超过500字符" }); continue; }
      if (!category) { errors.push({ row: line, field: "类目", value: "", message: "类目不能为空" }); continue; }
      if (!validate.isDate(commentDate) || !validate.notFuture(commentDate)) { errors.push({ row: line, field: "评论日期", value: commentDate, message: "日期格式应为YYYY-MM-DD且不晚于当前日期" }); continue; }
      const clean = text.maskText(text.cleanText(raw));
      const signature = text.simhashText(clean);
      const duplicate = seen.find(function (item) { return text.hamming(item, signature) <= 3; });
      if (duplicate) { batch.duplicateRows += 1; continue; }
      seen.push(signature);
      const sentiment = text.sentiment(clean);
      records.push({
        id: store.id("CMT"),
        batchId: batch.id,
        text: clean,
        category: category,
        productName: productName,
        productId: productId,
        commentDate: commentDate,
        sentimentScore: sentiment.score,
        polarity: sentiment.polarity,
        aspects: text.aspectScores(clean),
        tags: text.tokenize(clean).slice(0, 8),
        simhash: signature,
        importedAt: now
      });
    }
  }
  if (type === "topic") store.db.topics.push.apply(store.db.topics, records);
  if (type === "product") store.db.products.push.apply(store.db.products, records);
  if (type === "comment") store.db.comments.push.apply(store.db.comments, records);
  errors.forEach(function (error) {
    error.id = store.id("ERR");
    error.batchId = batch.id;
  });
  store.db.importErrors.push.apply(store.db.importErrors, errors);
  batch.importedRows = records.length;
  batch.invalidRows = errors.length;
  batch.status = errors.length && !records.length ? "failed" : "completed";
  batch.finishedAt = store.now();
  store.db.batches.unshift(batch);
  store.save();
  audit.write(ctx.user, "数据导入", "导入" + TYPE_NAMES[type], batch.batchNo, "成功" + batch.importedRows + "条，重复" + batch.duplicateRows + "条，错误" + batch.invalidRows + "条", ctx.req);
  ctx.ok({ batch: batch, errors: errors.slice(0, 50) });
}

function listBatches(ctx) {
  const query = ctx.query;
  const type = query.get("type") || "";
  const status = query.get("status") || "";
  const keyword = (query.get("keyword") || "").trim();
  let rows = store.db.batches.slice();
  if (type) rows = rows.filter(function (item) { return item.type === type; });
  if (status) rows = rows.filter(function (item) { return item.status === status; });
  if (keyword) {
    rows = rows.filter(function (item) {
      return (item.batchNo + item.sourceName + item.fileName).indexOf(keyword) >= 0;
    });
  }
  const page = Math.max(1, Number(query.get("page") || 1));
  const size = Math.min(50, Math.max(5, Number(query.get("size") || 10)));
  const total = rows.length;
  ctx.ok({ total: total, page: page, size: size, rows: rows.slice((page - 1) * size, page * size) });
}

function batchDetail(ctx) {
  const batch = store.db.batches.find(function (item) { return item.id === ctx.params[0]; });
  if (!batch) {
    ctx.fail(404, "批次不存在");
    return;
  }
  const errors = store.db.importErrors.filter(function (item) { return item.batchId === batch.id; });
  ctx.ok({ batch: batch, errors: errors, errorCount: errors.length });
}

function downloadErrors(ctx) {
  const batch = store.db.batches.find(function (item) { return item.id === ctx.params[0]; });
  if (!batch) {
    ctx.fail(404, "批次不存在");
    return;
  }
  const errors = store.db.importErrors.filter(function (item) { return item.batchId === batch.id; });
  const lines = ["行号,字段,原始值,错误原因"];
  errors.forEach(function (item) {
    lines.push([item.row, item.field, String(item.value || "").replace(/"/g, "\"\""), item.message].map(function (value) {
      return "\"" + String(value).replace(/"/g, "\"\"") + "\"";
    }).join(","));
  });
  const content = "\ufeff" + lines.join("\r\n");
  ctx.res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": "attachment; filename=\"" + encodeURIComponent(batch.batchNo + "_错误明细.csv") + "\"",
    "Content-Length": Buffer.byteLength(content)
  });
  ctx.res.end(content);
}

function refreshLexicon() {
  const words = store.db.keywords.filter(function (item) { return item.enabled; }).map(function (item) { return item.word; });
  text.setDynamicWords(words);
}

module.exports = {
  TYPE_NAMES: TYPE_NAMES,
  template: template,
  parseCsv: parseCsv,
  importBatch: importBatch,
  listBatches: listBatches,
  batchDetail: batchDetail,
  downloadErrors: downloadErrors,
  refreshLexicon: refreshLexicon
};

