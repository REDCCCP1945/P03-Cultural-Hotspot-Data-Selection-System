const store = require("./store");
const analytics = require("./analytics");
const selectionService = require("./selectionService");

function summary(ctx) {
  const today = new Date();
  const todayText = today.toISOString().slice(0, 10);
  const from = new Date(today.getTime() - 29 * 86400000).toISOString().slice(0, 10);
  const topics = store.db.topics.filter(function (item) { return analytics.inRange(item.publishDate, from, todayText); });
  const products = store.db.products.filter(function (item) { return analytics.inRange(item.recordDate, from, todayText); });
  const heat = analytics.heatMap(topics, todayText);
  const topTopics = topics.map(function (item) {
    return {
      id: item.id,
      title: item.title,
      platform: item.platform,
      category: item.category,
      publishDate: item.publishDate,
      heatIndex: (heat[item.id] || { heat: 0 }).heat,
      readCount: item.readCount,
      discussCount: item.discussCount
    };
  }).sort(function (a, b) { return b.heatIndex - a.heatIndex; }).slice(0, 8);
  const allCategories = selectionService.dashboardResult();
  const topCategories = allCategories.slice(0, 5);
  const latestReports = store.db.reports.slice().sort(function (a, b) {
    return a.generatedAt < b.generatedAt ? 1 : -1;
  }).slice(0, 5).map(function (item) {
    return {
      id: item.id,
      title: item.title,
      status: item.status,
      generatedAt: item.generatedAt,
      category: item.category
    };
  });
  const categories = {};
  products.forEach(function (item) { categories[item.category] = true; });
  ctx.ok({
    metrics: {
      topicCount: topics.length,
      productCount: products.length,
      commentCount: store.db.comments.length,
      categoryCount: Object.keys(categories).length,
      batchCount: store.db.batches.length,
      pendingReports: store.db.reports.filter(function (item) { return item.status === "pending"; }).length,
      runningTasks: store.db.tasks.filter(function (item) { return item.status === "running" || item.status === "queued"; }).length,
      redOceanCount: allCategories.filter(function (item) { return item.redOcean; }).length
    },
    topTopics: topTopics,
    topCategories: topCategories,
    latestReports: latestReports,
    trend: analytics.trend(store.db.topics, todayText, "").slice(-14),
    platforms: analytics.platformDistribution(products),
    recentBatches: store.db.batches.slice(0, 4)
  });
}

module.exports = {
  summary: summary
};

