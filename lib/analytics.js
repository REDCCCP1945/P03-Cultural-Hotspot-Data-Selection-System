const text = require("./text");
const validate = require("./validate");

const DECAY_LAMBDA = 0.1;

function dayDiff(from, to) {
  const start = new Date(String(from).slice(0, 10) + "T00:00:00");
  const end = new Date(String(to).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function inRange(dateText, from, to) {
  const value = String(dateText || "").slice(0, 10);
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

function heatScores(topics, refDate) {
  const reference = refDate || new Date().toISOString().slice(0, 10);
  const rows = topics.map(function (topic) {
    const days = dayDiff(topic.publishDate, reference);
    const base = Number(topic.readCount || 0) * 0.5 + Number(topic.discussCount || 0) * 0.3 + Number(topic.shareCount || 0) * 0.2;
    const decay = Math.exp(-DECAY_LAMBDA * days);
    return {
      id: topic.id,
      category: topic.category,
      raw: base * decay,
      base: base,
      decay: decay,
      days: days
    };
  });
  if (!rows.length) return [];
  const values = rows.map(function (row) { return row.raw; });
  const mean = values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
  const variance = values.reduce(function (sum, value) { return sum + Math.pow(value - mean, 2); }, 0) / values.length;
  const std = Math.sqrt(variance);
  return rows.map(function (row) {
    let heat;
    if (std === 0) {
      heat = 50;
    } else {
      const z = (row.raw - mean) / std;
      heat = 100 / (1 + Math.exp(-z));
    }
    return {
      id: row.id,
      category: row.category,
      raw: validate.round(row.raw, 2),
      base: validate.round(row.base, 2),
      decay: validate.round(row.decay, 4),
      days: row.days,
      heat: validate.round(heat, 2)
    };
  });
}

function heatMap(topics, refDate) {
  const map = {};
  heatScores(topics, refDate).forEach(function (row) { map[row.id] = row; });
  return map;
}

function categoryHeat(topics, refDate) {
  const scores = heatScores(topics, refDate);
  const groups = {};
  scores.forEach(function (row) {
    if (!groups[row.category]) groups[row.category] = [];
    groups[row.category].push(row.heat);
  });
  const result = {};
  Object.keys(groups).forEach(function (category) {
    const list = groups[category];
    result[category] = validate.round(list.reduce(function (sum, value) { return sum + value; }, 0) / list.length, 2);
  });
  return result;
}

function trend(topics, refDate, category) {
  const reference = refDate || new Date().toISOString().slice(0, 10);
  const map = new Map();
  topics.forEach(function (topic) {
    if (category && topic.category !== category) return;
    const date = String(topic.publishDate || "").slice(0, 10);
    if (!date) return;
    const base = Number(topic.readCount || 0) * 0.5 + Number(topic.discussCount || 0) * 0.3 + Number(topic.shareCount || 0) * 0.2;
    const decayed = base * Math.exp(-DECAY_LAMBDA * dayDiff(date, reference));
    const current = map.get(date) || { date: date, raw: 0, count: 0 };
    current.raw += decayed;
    current.count += 1;
    map.set(date, current);
  });
  const rows = Array.from(map.values()).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  const max = rows.reduce(function (value, row) { return Math.max(value, row.raw); }, 0);
  return rows.map(function (row) {
    return {
      date: row.date,
      value: max === 0 ? 0 : validate.round((row.raw / max) * 100, 2),
      count: row.count
    };
  });
}

function platformDistribution(items, key) {
  const map = {};
  items.forEach(function (item) {
    const name = item[key || "platform"] || "未标注";
    map[name] = (map[name] || 0) + 1;
  });
  return Object.keys(map).map(function (name) {
    return { name: name, count: map[name] };
  }).sort(function (a, b) { return b.count - a.count; });
}

function priceBuckets() {
  return [
    { label: "0-50元", min: 0, max: 50 },
    { label: "50-100元", min: 50, max: 100 },
    { label: "100-200元", min: 100, max: 200 },
    { label: "200-300元", min: 200, max: 300 },
    { label: "300-500元", min: 300, max: 500 },
    { label: "500元以上", min: 500, max: Infinity }
  ];
}

function priceHistogram(products) {
  const buckets = priceBuckets().map(function (bucket) {
    return { label: bucket.label, min: bucket.min, max: bucket.max, count: 0, sales: 0, revenue: 0 };
  });
  products.forEach(function (product) {
    const price = Number(product.price || 0);
    const bucket = buckets.find(function (item) { return price >= item.min && price < item.max; });
    if (!bucket) return;
    bucket.count += 1;
    bucket.sales += Number(product.monthlySales || 0);
    bucket.revenue += Number(product.revenue || 0);
  });
  return buckets.map(function (bucket) {
    return {
      label: bucket.label,
      count: bucket.count,
      sales: bucket.sales,
      revenue: validate.round(bucket.revenue, 2)
    };
  });
}

function categoryStats(products) {
  const groups = {};
  products.forEach(function (product) {
    const category = product.category || "未分类";
    if (!groups[category]) groups[category] = [];
    groups[category].push(product);
  });
  return Object.keys(groups).map(function (category) {
    const list = groups[category];
    const revenue = list.reduce(function (sum, item) { return sum + Number(item.revenue || 0); }, 0);
    const sellers = new Set(list.map(function (item) { return item.shopName || "未知店铺"; }));
    const sorted = list.slice().sort(function (a, b) { return Number(b.revenue || 0) - Number(a.revenue || 0); });
    const top = sorted.slice(0, 10);
    const topRevenue = top.reduce(function (sum, item) { return sum + Number(item.revenue || 0); }, 0);
    const top10Share = revenue === 0 ? 0 : topRevenue / revenue;
    const saturation = list.length === 0 ? 0 : (sellers.size / list.length) * 100;
    const hhiProxy = top10Share * 100;
    const penalty = Math.min(100, hhiProxy * 0.7 + saturation * 0.3);
    return {
      category: category,
      itemCount: list.length,
      sellerCount: sellers.size,
      revenue: validate.round(revenue, 2),
      top10Share: validate.round(top10Share, 4),
      hhiProxy: validate.round(hhiProxy, 2),
      saturation: validate.round(saturation, 2),
      penalty: validate.round(penalty, 2),
      avgPrice: validate.round(list.reduce(function (sum, item) { return sum + Number(item.price || 0); }, 0) / list.length, 2)
    };
  }).sort(function (a, b) { return b.revenue - a.revenue; });
}

function salesScore(products, minMargin) {
  const margin = Number.isFinite(Number(minMargin)) ? Number(minMargin) : 0.15;
  const valid = products.filter(function (item) { return Number(item.profitMargin || 0) >= margin; });
  if (!valid.length) return { score: 0, medianSales: 0, meanRevenue: 0, validCount: 0 };
  const sales = valid.map(function (item) { return Number(item.monthlySales || 0); }).sort(function (a, b) { return a - b; });
  const middle = Math.floor(sales.length / 2);
  const median = sales.length % 2 === 0 ? (sales[middle - 1] + sales[middle]) / 2 : sales[middle];
  const meanRevenue = valid.reduce(function (sum, item) { return sum + Number(item.revenue || 0); }, 0) / valid.length;
  const raw = (Math.log1p(median) * 0.6 + Math.log1p(meanRevenue) * 0.4) * 10;
  return {
    score: validate.round(Math.min(100, raw), 2),
    medianSales: validate.round(median, 2),
    meanRevenue: validate.round(meanRevenue, 2),
    validCount: valid.length
  };
}

function competitionPenalty(stats) {
  return validate.round(stats.penalty, 2);
}

function potentialRows(options) {
  const topics = options.topics || [];
  const products = options.products || [];
  const from = options.dateFrom || "";
  const to = options.dateTo || "";
  const alpha = Number(options.alpha);
  const beta = Number(options.beta);
  const gamma = Number(options.gamma);
  const threshold = Number(options.redOceanThreshold);
  const minMargin = Number(options.minProfitMargin);
  const ref = to || new Date().toISOString().slice(0, 10);
  const windowTopics = topics.filter(function (topic) { return inRange(topic.publishDate, from, to); });
  const windowProducts = products.filter(function (product) { return inRange(product.recordDate, from, to); });
  const heatByCategory = categoryHeat(windowTopics, ref);
  const stats = categoryStats(windowProducts);
  const wanted = options.category && options.category !== "全部类目" ? options.category : "";
  const rows = [];
  stats.forEach(function (item) {
    if (wanted && item.category !== wanted) return;
    const categoryProducts = windowProducts.filter(function (product) { return product.category === item.category; });
    const heat = heatByCategory[item.category] === undefined ? 0 : heatByCategory[item.category];
    const sales = salesScore(categoryProducts, minMargin);
    const penalty = competitionPenalty(item);
    const potential = validate.round(validate.clamp(heat * alpha + sales.score * beta - penalty * gamma, 0, 100), 2);
    const redOcean = penalty >= threshold;
    let riskWarning = "";
    if (redOcean) {
      riskWarning = "红海预警：该类目市场集中度与竞争饱和度达" + penalty.toFixed(1) + "，建议谨慎进入";
    } else if (sales.score < 30) {
      riskWarning = "销量转化偏低：合格商品样本不足或销售额偏低，建议补充数据";
    } else if (heat < 35) {
      riskWarning = "热度偏低：近期公开讨论不足，建议延长观察窗口";
    }
    rows.push({
      category: item.category,
      heatScore: heat,
      salesScore: sales.score,
      competitionPenalty: penalty,
      potentialScore: potential,
      redOcean: redOcean,
      riskWarning: riskWarning,
      itemCount: item.itemCount,
      sellerCount: item.sellerCount,
      revenue: item.revenue,
      top10Share: item.top10Share,
      saturation: item.saturation,
      medianSales: sales.medianSales,
      meanRevenue: sales.meanRevenue,
      validCount: sales.validCount
    });
  });
  return rows.sort(function (a, b) { return b.potentialScore - a.potentialScore; });
}

function sentimentSummary(comments) {
  const total = comments.length;
  const counts = { positive: 0, neutral: 0, negative: 0 };
  let scoreSum = 0;
  const aspectGroup = {};
  text.ASPECTS.forEach(function (aspect) {
    aspectGroup[aspect.key] = { name: aspect.name, scoreSum: 0, hits: 0, positive: 0, negative: 0 };
  });
  comments.forEach(function (comment) {
    const polarity = comment.polarity || "neutral";
    counts[polarity] = (counts[polarity] || 0) + 1;
    scoreSum += Number(comment.sentimentScore || 0);
    text.ASPECTS.forEach(function (aspect) {
      const item = (comment.aspects || {})[aspect.key];
      if (!item) return;
      const group = aspectGroup[aspect.key];
      if (item.hits > 0) {
        group.scoreSum += Number(item.score || 0) * item.hits;
        group.hits += item.hits;
        group.positive += Number(item.positive || 0);
        group.negative += Number(item.negative || 0);
      }
    });
  });
  const aspects = Object.keys(aspectGroup).map(function (key) {
    const group = aspectGroup[key];
    const score = group.hits === 0 ? 0 : group.scoreSum / group.hits;
    return {
      key: key,
      name: group.name,
      score: validate.round(score, 3),
      value: validate.round((score + 1) * 50, 2),
      hits: group.hits,
      positive: group.positive,
      negative: group.negative
    };
  });
  return {
    total: total,
    positive: counts.positive,
    neutral: counts.neutral,
    negative: counts.negative,
    positiveRatio: total === 0 ? 0 : validate.round((counts.positive / total) * 100, 2),
    neutralRatio: total === 0 ? 0 : validate.round((counts.neutral / total) * 100, 2),
    negativeRatio: total === 0 ? 0 : validate.round((counts.negative / total) * 100, 2),
    avgScore: total === 0 ? 0 : validate.round(scoreSum / total, 3),
    aspects: aspects
  };
}

function tagCloud(items, limit) {
  const texts = items.map(function (item) {
    if (typeof item === "string") return item;
    return [item.title || "", item.text || "", (item.keywords || []).join(" ")].join(" ");
  });
  return text.countTokens(texts).slice(0, limit || 40);
}

module.exports = {
  DECAY_LAMBDA: DECAY_LAMBDA,
  dayDiff: dayDiff,
  inRange: inRange,
  heatScores: heatScores,
  heatMap: heatMap,
  categoryHeat: categoryHeat,
  trend: trend,
  platformDistribution: platformDistribution,
  priceHistogram: priceHistogram,
  categoryStats: categoryStats,
  salesScore: salesScore,
  competitionPenalty: competitionPenalty,
  potentialRows: potentialRows,
  sentimentSummary: sentimentSummary,
  tagCloud: tagCloud
};

