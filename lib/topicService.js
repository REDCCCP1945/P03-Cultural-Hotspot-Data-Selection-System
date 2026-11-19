const store = require("./store");
const analytics = require("./analytics");
const text = require("./text");
const audit = require("./audit");
const validate = require("./validate");

function dateRange(query) {
  const today = new Date();
  const to = query.get("dateTo") || today.toISOString().slice(0, 10);
  let from = query.get("dateFrom") || "";
  if (!from) {
    const windowDays = Number(query.get("windowDays") || 30);
    const start = new Date(today.getTime() - (Math.max(1, windowDays) - 1) * 86400000);
    from = start.toISOString().slice(0, 10);
  }
  return { from: from, to: to };
}

function list(ctx) {
  const query = ctx.query;
  const range = dateRange(query);
  const platform = query.get("platform") || "";
  const category = query.get("category") || "";
  const keyword = (query.get("keyword") || "").trim();
  const sort = query.get("sort") || "heat";
  const order = query.get("order") === "asc" ? 1 : -1;
  const page = Math.max(1, Number(query.get("page") || 1));
  const size = Math.min(50, Math.max(5, Number(query.get("size") || 10)));
  let rows = store.db.topics.filter(function (item) {
    return analytics.inRange(item.publishDate, range.from, range.to);
  });
  if (platform) rows = rows.filter(function (item) { return item.platform === platform; });
  if (category) rows = rows.filter(function (item) { return item.category === category; });
  if (keyword) {
    rows = rows.filter(function (item) {
      return (item.title + " " + (item.keywords || []).join(" ") + " " + (item.content || "")).indexOf(keyword) >= 0;
    });
  }
  const heat = analytics.heatMap(rows, range.to);
  rows = rows.map(function (item) {
    const score = heat[item.id] || { heat: 0, decay: 0, days: 0 };
    return Object.assign({}, item, {
      heatIndex: score.heat,
      decayFactor: score.decay,
      daysSincePublish: score.days
    });
  });
  rows.sort(function (a, b) {
    let left = a.heatIndex;
    let right = b.heatIndex;
    if (sort === "read") { left = a.readCount; right = b.readCount; }
    if (sort === "discuss") { left = a.discussCount; right = b.discussCount; }
    if (sort === "publishDate") { left = a.publishDate; right = b.publishDate; }
    if (left === right) return 0;
    return left > right ? order : -order;
  });
  const total = rows.length;
  const pageRows = rows.slice((page - 1) * size, page * size);
  ctx.ok({
    total: total,
    page: page,
    size: size,
    range: range,
    rows: pageRows,
    summary: {
      topicCount: total,
      readTotal: rows.reduce(function (sum, item) { return sum + item.readCount; }, 0),
      discussTotal: rows.reduce(function (sum, item) { return sum + item.discussCount; }, 0),
      shareTotal: rows.reduce(function (sum, item) { return sum + item.shareCount; }, 0)
    }
  });
}

function detail(ctx) {
  const topic = store.db.topics.find(function (item) { return item.id === ctx.params[0]; });
  if (!topic) {
    ctx.fail(404, "话题不存在");
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const categoryTopics = store.db.topics.filter(function (item) {
    return item.category === topic.category && analytics.inRange(item.publishDate, "1970-01-01", today);
  });
  const heat = analytics.heatMap(categoryTopics, today);
  const related = categoryTopics.slice().sort(function (a, b) {
    return (heat[b.id] || { heat: 0 }).heat - (heat[a.id] || { heat: 0 }).heat;
  }).slice(0, 8).map(function (item) {
    return {
      id: item.id,
      title: item.title,
      platform: item.platform,
      publishDate: item.publishDate,
      heatIndex: (heat[item.id] || { heat: 0 }).heat
    };
  });
  ctx.ok({
    topic: Object.assign({}, topic, { heatIndex: (heat[topic.id] || { heat: 0 }).heat }),
    trend: analytics.trend(categoryTopics, today, topic.category),
    platforms: analytics.platformDistribution(categoryTopics),
    wordCloud: analytics.tagCloud(categoryTopics, 40),
    related: related
  });
}

function meta(ctx) {
  const platforms = [];
  const categories = [];
  store.db.topics.forEach(function (item) {
    if (platforms.indexOf(item.platform) < 0) platforms.push(item.platform);
    if (categories.indexOf(item.category) < 0) categories.push(item.category);
  });
  store.db.products.forEach(function (item) {
    if (categories.indexOf(item.category) < 0) categories.push(item.category);
  });
  ctx.ok({
    platforms: platforms.sort(),
    categories: categories.sort(),
    dictPlatforms: (store.db.dicts.platforms || []).map(function (item) { return item.name; }),
    dictCategories: (store.db.dicts.categories || []).map(function (item) { return item.name; }),
    dictSourceTypes: (store.db.dicts.sourceTypes || []).map(function (item) { return item.name; }),
    keywords: store.db.keywords.slice(),
    batchCount: store.db.batches.length
  });
}

function keywordList(ctx) {
  const query = ctx.query;
  const keyword = (query.get("keyword") || "").trim();
  const category = query.get("category") || "";
  const enabled = query.get("enabled");
  let rows = store.db.keywords.slice();
  if (keyword) rows = rows.filter(function (item) { return item.word.indexOf(keyword) >= 0; });
  if (category) rows = rows.filter(function (item) { return item.category === category; });
  if (enabled === "true" || enabled === "false") {
    rows = rows.filter(function (item) { return String(item.enabled) === enabled; });
  }
  rows.sort(function (a, b) { return b.weight - a.weight; });
  ctx.ok({ total: rows.length, rows: rows });
}

function keywordSave(ctx) {
  const body = ctx.body || {};
  const word = String(body.word || "").trim();
  const category = String(body.category || "").trim();
  const weight = Number(body.weight);
  const id = body.id || "";
  if (word.length < 2 || word.length > 20) {
    ctx.fail(400, "关键词长度应为2到20个字符", "word");
    return;
  }
  if (!category) {
    ctx.fail(400, "请选择关键词所属类目", "category");
    return;
  }
  if (!Number.isFinite(weight) || weight < 0.1 || weight > 10) {
    ctx.fail(400, "权重必须在0.1到10之间", "weight");
    return;
  }
  const exists = store.db.keywords.find(function (item) {
    return item.word === word && item.id !== id;
  });
  if (exists) {
    ctx.fail(409, "关键词已存在", "word");
    return;
  }
  if (id) {
    const item = store.db.keywords.find(function (entry) { return entry.id === id; });
    if (!item) {
      ctx.fail(404, "关键词不存在");
      return;
    }
    item.word = word;
    item.category = category;
    item.weight = validate.round(weight, 2);
    item.updatedAt = store.now();
    audit.write(ctx.user, "关键词库", "修改关键词", word, "类目" + category + "，权重" + item.weight, ctx.req);
  } else {
    store.db.keywords.push({
      id: store.id("KW"),
      word: word,
      category: category,
      weight: validate.round(weight, 2),
      enabled: true,
      createdAt: store.now()
    });
    audit.write(ctx.user, "关键词库", "新增关键词", word, "类目" + category, ctx.req);
  }
  store.save();
  require("./importService").refreshLexicon();
  ctx.ok({});
}

function keywordToggle(ctx) {
  const item = store.db.keywords.find(function (entry) { return entry.id === ctx.params[0]; });
  if (!item) {
    ctx.fail(404, "关键词不存在");
    return;
  }
  item.enabled = !item.enabled;
  store.save();
  require("./importService").refreshLexicon();
  audit.write(ctx.user, "关键词库", item.enabled ? "启用关键词" : "停用关键词", item.word, "", ctx.req);
  ctx.ok({ item: item });
}

function keywordRemove(ctx) {
  const item = store.db.keywords.find(function (entry) { return entry.id === ctx.params[0]; });
  if (!item) {
    ctx.fail(404, "关键词不存在");
    return;
  }
  store.db.keywords = store.db.keywords.filter(function (entry) { return entry.id !== item.id; });
  store.save();
  require("./importService").refreshLexicon();
  audit.write(ctx.user, "关键词库", "删除关键词", item.word, "", ctx.req);
  ctx.ok({});
}

module.exports = {
  list: list,
  detail: detail,
  meta: meta,
  keywordList: keywordList,
  keywordSave: keywordSave,
  keywordToggle: keywordToggle,
  keywordRemove: keywordRemove,
  refreshLexicon: function () {
    require("./importService").refreshLexicon();
  }
};

