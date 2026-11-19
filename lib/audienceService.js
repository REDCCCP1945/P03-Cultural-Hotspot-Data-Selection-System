const store = require("./store");
const analytics = require("./analytics");
const validate = require("./validate");

function summary(ctx) {
  const query = ctx.query;
  const category = query.get("category") || "";
  const productName = query.get("productName") || "";
  const dateFrom = query.get("dateFrom") || "";
  const dateTo = query.get("dateTo") || "";
  let comments = store.db.comments.slice();
  if (category) comments = comments.filter(function (item) { return item.category === category; });
  if (productName) comments = comments.filter(function (item) { return item.productName === productName; });
  if (dateFrom || dateTo) comments = comments.filter(function (item) { return analytics.inRange(item.commentDate, dateFrom, dateTo); });
  const summaryData = analytics.sentimentSummary(comments);
  const trends = {};
  comments.forEach(function (item) {
    const date = String(item.commentDate || "").slice(0, 10);
    if (!date) return;
    if (!trends[date]) trends[date] = { date: date, total: 0, positive: 0, negative: 0, scoreSum: 0 };
    trends[date].total += 1;
    trends[date].scoreSum += Number(item.sentimentScore || 0);
    if (item.polarity === "positive") trends[date].positive += 1;
    if (item.polarity === "negative") trends[date].negative += 1;
  });
  const trendRows = Object.keys(trends).sort().map(function (date) {
    const item = trends[date];
    return {
      date: date,
      total: item.total,
      averageScore: validate.round(item.scoreSum / item.total, 3),
      positiveRatio: validate.round((item.positive / item.total) * 100, 2),
      negativeRatio: validate.round((item.negative / item.total) * 100, 2)
    };
  });
  const samples = comments.slice().sort(function (a, b) {
    return a.sentimentScore < b.sentimentScore ? -1 : 1;
  });
  const negativeSamples = samples.slice(0, 4);
  const positiveSamples = samples.slice(-4).reverse();
  const products = [];
  store.db.products.forEach(function (item) {
    if (category && item.category !== category) return;
    if (products.indexOf(item.name) < 0) products.push(item.name);
  });
  ctx.ok({
    summary: summaryData,
    tags: analytics.tagCloud(comments, 40),
    trend: trendRows,
    samples: positiveSamples.concat(negativeSamples).slice(0, 8),
    categories: (store.db.dicts.categories || []).map(function (item) { return item.name; }),
    products: products,
    total: comments.length
  });
}

module.exports = {
  summary: summary
};

