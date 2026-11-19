const store = require("./store");
const analytics = require("./analytics");
const validate = require("./validate");

function filtered(query) {
  let rows = store.db.products.slice();
  const category = query.get("category") || "";
  const platform = query.get("platform") || "";
  const batchId = query.get("batchId") || "";
  const keyword = (query.get("keyword") || "").trim();
  const priceMin = query.get("priceMin");
  const priceMax = query.get("priceMax");
  const dateFrom = query.get("dateFrom") || "";
  const dateTo = query.get("dateTo") || "";
  if (category) rows = rows.filter(function (item) { return item.category === category; });
  if (platform) rows = rows.filter(function (item) { return item.platform === platform; });
  if (batchId) rows = rows.filter(function (item) { return item.batchId === batchId; });
  if (keyword) rows = rows.filter(function (item) { return (item.name + item.shopName).indexOf(keyword) >= 0; });
  if (priceMin !== null && priceMin !== "") rows = rows.filter(function (item) { return item.price >= Number(priceMin); });
  if (priceMax !== null && priceMax !== "") rows = rows.filter(function (item) { return item.price <= Number(priceMax); });
  if (dateFrom || dateTo) rows = rows.filter(function (item) { return analytics.inRange(item.recordDate, dateFrom, dateTo); });
  return rows;
}

function list(ctx) {
  const query = ctx.query;
  const rows = filtered(query);
  const sort = query.get("sort") || "sales";
  const order = query.get("order") === "asc" ? 1 : -1;
  rows.sort(function (a, b) {
    let left = a.monthlySales;
    let right = b.monthlySales;
    if (sort === "revenue") { left = a.revenue; right = b.revenue; }
    if (sort === "price") { left = a.price; right = b.price; }
    if (sort === "margin") { left = a.profitMargin; right = b.profitMargin; }
    if (left === right) return 0;
    return left > right ? order : -order;
  });
  const page = Math.max(1, Number(query.get("page") || 1));
  const size = Math.min(50, Math.max(5, Number(query.get("size") || 10)));
  const total = rows.length;
  ctx.ok({
    total: total,
    page: page,
    size: size,
    rows: rows.slice((page - 1) * size, page * size),
    summary: {
      itemCount: total,
      salesTotal: rows.reduce(function (sum, item) { return sum + item.monthlySales; }, 0),
      revenueTotal: validate.round(rows.reduce(function (sum, item) { return sum + item.revenue; }, 0), 2),
      avgPrice: total === 0 ? 0 : validate.round(rows.reduce(function (sum, item) { return sum + item.price; }, 0) / total, 2),
      avgMargin: total === 0 ? 0 : validate.round(rows.reduce(function (sum, item) { return sum + item.profitMargin; }, 0) / total, 4)
    }
  });
}

function categories(ctx) {
  const rows = filtered(ctx.query);
  ctx.ok({ rows: analytics.categoryStats(rows), total: rows.length });
}

function histogram(ctx) {
  const rows = filtered(ctx.query);
  ctx.ok({ rows: analytics.priceHistogram(rows), total: rows.length });
}

function compare(ctx) {
  const ids = String(ctx.query.get("ids") || "").split(",").map(function (item) { return item.trim(); }).filter(Boolean);
  if (ids.length < 2 || ids.length > 4) {
    ctx.fail(400, "请选择2到4个商品进行对比");
    return;
  }
  const rows = ids.map(function (id) {
    return store.db.products.find(function (item) { return item.id === id; });
  }).filter(Boolean);
  if (rows.length !== ids.length) {
    ctx.fail(404, "存在无效商品ID");
    return;
  }
  ctx.ok({ rows: rows });
}

function detail(ctx) {
  const product = store.db.products.find(function (item) { return item.id === ctx.params[0]; });
  if (!product) {
    ctx.fail(404, "商品不存在");
    return;
  }
  const comments = store.db.comments.filter(function (item) {
    return (item.productId && item.productId === product.id) || (item.productName && item.productName === product.name);
  }).slice(0, 20);
  ctx.ok({
    product: product,
    comments: comments,
    categoryStats: analytics.categoryStats(store.db.products.filter(function (item) { return item.category === product.category; }))[0] || null
  });
}

module.exports = {
  list: list,
  categories: categories,
  histogram: histogram,
  compare: compare,
  detail: detail
};

