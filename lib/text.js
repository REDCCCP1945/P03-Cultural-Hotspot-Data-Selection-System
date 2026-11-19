const STOPWORDS = [
  "的", "了", "和", "与", "及", "或", "是", "在", "有", "我", "你", "他", "她", "它",
  "这", "那", "就", "都", "而", "也", "很", "还", "被", "把", "对", "从", "到", "为",
  "一个", "我们", "你们", "他们", "自己", "这个", "那个", "什么", "怎么", "可以", "没有",
  "已经", "因为", "所以", "但是", "如果", "虽然", "而且", "以及", "比较", "非常", "感觉",
  "觉得", "真的", "有点", "一点", "东西", "产品", "商品", "收到", "购买", "买", "用", "说"
];

const ASPECTS = [
  {
    key: "design",
    name: "设计/颜值",
    keywords: ["设计", "颜值", "外观", "好看", "颜色", "配色", "造型", "图案", "风格", "做工", "质感", "精致", "复古", "可爱", "丑", "老气"],
    positive: ["好看", "漂亮", "精致", "复古", "颜值高", "可爱", "高级", "独特", "耐看", "出片", "设计感"],
    negative: ["丑", "难看", "老气", "廉价感", "粗糙", "土", "俗气", "撞款", "褪色"]
  },
  {
    key: "quality",
    name: "质量/做工",
    keywords: ["质量", "做工", "材质", "手感", "耐用", "掉色", "粗糙", "破损", "结实", "细节", "印刷", "缝线"],
    positive: ["耐用", "结实", "扎实", "细腻", "精致", "质感好", "不掉色", "做工好", "细节到位"],
    negative: ["掉色", "粗糙", "破损", "开裂", "廉价", "毛边", "瑕疵", "变形", "易碎"]
  },
  {
    key: "price",
    name: "价格/性价比",
    keywords: ["价格", "性价比", "贵", "便宜", "划算", "不值", "物美价廉", "预算", "定价"],
    positive: ["划算", "性价比高", "物美价廉", "便宜", "实惠", "值", "合理"],
    negative: ["贵", "不值", "性价比低", "溢价", "坑", "太贵", "超出预算"]
  },
  {
    key: "packaging",
    name: "包装/物流",
    keywords: ["包装", "物流", "快递", "发货", "严实", "破烂", "慢", "快", "盒子", "礼盒"],
    positive: ["包装精美", "严实", "发货快", "物流快", "完好", "礼盒好看", "包装用心"],
    negative: ["包装简陋", "破损", "压坏", "发货慢", "物流慢", "漏发", "包装差"]
  },
  {
    key: "culture",
    name: "文化内涵",
    keywords: ["非遗", "国潮", "底蕴", "博物馆", "文创", "纪念", "意义", "传统", "文化", "联名", "IP"],
    positive: ["有文化", "有底蕴", "国潮", "非遗", "有意义", "有纪念价值", "创意好", "联名款", "文化感"],
    negative: ["没内涵", "敷衍", "贴牌", "没创意", "同质化", "文化符号堆砌"]
  }
];

const POSITIVE = [
  "好看", "漂亮", "精致", "喜欢", "满意", "推荐", "惊喜", "不错", "很棒", "优秀", "舒服",
  "划算", "耐用", "结实", "严实", "快", "完好", "用心", "高级", "可爱", "独特", "有创意",
  "有文化", "有底蕴", "质感好", "性价比高", "值得", "回购", "出片", "细腻", "扎实"
];

const NEGATIVE = [
  "丑", "难看", "失望", "差", "垃圾", "粗糙", "破损", "掉色", "开裂", "廉价", "贵", "不值",
  "简陋", "压坏", "发货慢", "物流慢", "漏发", "瑕疵", "变形", "易碎", "敷衍", "同质化",
  "没创意", "退货", "坑", "老气", "土", "俗气", "溢价", "毛边"
];

const BASE_WORDS = [
  "盲盒", "潮玩", "手办", "隐藏款", "非遗", "国潮", "博物馆", "文创", "手账", "文具",
  "书签", "丝巾", "刺绣", "皮影", "木雕", "陶艺", "香囊", "团扇", "饰品", "耳饰",
  "项链", "摆件", "冰箱贴", "徽章", "帆布包", "包装", "礼盒", "材质", "设计", "配色",
  "做工", "价格", "性价比", "物流", "快递", "服务", "文化", "传统", "联名", "国风",
  "宋韵", "敦煌", "故宫", "陕西", "秦腔", "汉服", "纹样", "图腾", "刺绣工艺", "手工"
];

const NEGATIONS = ["不", "没", "无", "未", "别", "非"];

let dynamicWords = [];

function setDynamicWords(words) {
  dynamicWords = Array.isArray(words) ? words.filter(function (word) {
    return typeof word === "string" && word.trim().length >= 2;
  }) : [];
}

function buildLexicon() {
  const set = new Set();
  BASE_WORDS.concat(dynamicWords).forEach(function (word) { set.add(word); });
  ASPECTS.forEach(function (aspect) {
    aspect.keywords.forEach(function (word) { set.add(word); });
    aspect.positive.forEach(function (word) { set.add(word); });
    aspect.negative.forEach(function (word) { set.add(word); });
  });
  POSITIVE.concat(NEGATIVE).forEach(function (word) { set.add(word); });
  return Array.from(set).sort(function (a, b) { return b.length - a.length; });
}

function normalize(text) {
  let out = "";
  const chars = String(text === undefined || text === null ? "" : text).split("");
  for (let i = 0; i < chars.length; i += 1) {
    const code = chars[i].charCodeAt(0);
    if (code === 12288) out += " ";
    else if (code >= 65281 && code <= 65374) out += String.fromCharCode(code - 65248);
    else out += chars[i];
  }
  return out;
}

function cleanText(text) {
  let out = normalize(text);
  out = out.replace(/<[^>]*>/g, " ");
  out = out.replace(/https?:\/\/[^\s]+/g, " ");
  out = out.replace(/www\.[^\s]+/g, " ");
  out = out.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ");
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

function maskText(text) {
  let out = String(text === undefined || text === null ? "" : text);
  out = out.replace(/1[3-9]\d{9}/g, "[手机号]");
  out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[邮箱]");
  out = out.replace(/(微信|weixin|wx)[:：]?[A-Za-z0-9_-]{4,20}/gi, "[微信]");
  out = out.replace(/(QQ|qq)[:：]?\d{5,12}/g, "[QQ]");
  out = out.replace(/\d{6,}/g, "[数字串]");
  return out;
}

function startsWithLexicon(source, index, lexicon) {
  for (let size = 6; size >= 2; size -= 1) {
    if (lexicon.indexOf(source.slice(index, index + size)) >= 0) return true;
  }
  return false;
}

function tokenize(text, extraWords) {
  const lexicon = buildLexicon();
  if (Array.isArray(extraWords)) {
    extraWords.forEach(function (word) {
      if (word && String(word).trim().length >= 2) lexicon.push(String(word).trim());
    });
    lexicon.sort(function (a, b) { return b.length - a.length; });
  }
  const source = cleanText(text).toLowerCase();
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    let matched = "";
    for (let size = 6; size >= 2; size -= 1) {
      const piece = source.slice(index, index + size);
      if (piece.length === size && lexicon.indexOf(piece) >= 0) {
        matched = piece;
        break;
      }
    }
    if (matched) {
      tokens.push(matched);
      index += matched.length;
      continue;
    }
    const char = source[index];
    if (/[\u4e00-\u9fa5]/.test(char)) {
      const next = source[index + 1] || "";
      const pair = char + next;
      if (next && /[\u4e00-\u9fa5]/.test(next) && STOPWORDS.indexOf(pair) < 0) {
        tokens.push(pair);
        index += startsWithLexicon(source, index + 1, lexicon) ? 1 : 2;
      } else {
        index += 1;
      }
    } else if (/[a-z0-9]/.test(char)) {
      let end = index;
      while (end < source.length && /[a-z0-9]/.test(source[end])) end += 1;
      tokens.push(source.slice(index, end));
      index = end;
    } else {
      index += 1;
    }
  }
  return tokens.filter(function (token) {
    return token && STOPWORDS.indexOf(token) < 0 && !/^\d+$/.test(token);
  });
}

function hash32(text, seed) {
  let hash = 2166136261 ^ seed;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function simhash(tokens) {
  const weights = new Array(64).fill(0);
  const list = tokens.length ? tokens : ["空"];
  list.forEach(function (token) {
    const first = hash32(token, 0x811c9dc5);
    const second = hash32(token, 0x9e3779b9);
    for (let bit = 0; bit < 32; bit += 1) {
      weights[bit] += (first >>> bit) & 1 ? 1 : -1;
      weights[bit + 32] += (second >>> bit) & 1 ? 1 : -1;
    }
  });
  let hex = "";
  for (let nibble = 0; nibble < 16; nibble += 1) {
    let value = 0;
    for (let bit = 0; bit < 4; bit += 1) {
      if (weights[nibble * 4 + bit] > 0) value |= 1 << (3 - bit);
    }
    hex += value.toString(16);
  }
  return hex;
}

const POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

function shingles(value, size) {
  const source = cleanText(value).replace(/[^\u4e00-\u9fa5a-z0-9]/gi, "").toLowerCase();
  const width = size || 4;
  const list = [];
  if (source.length <= width) {
    if (source) list.push(source);
    return list;
  }
  for (let i = 0; i <= source.length - width; i += 1) {
    list.push(source.slice(i, i + width));
  }
  return list;
}

function simhashText(value) {
  return simhash(shingles(value));
}

function hamming(hexA, hexB) {
  if (!hexA || !hexB || hexA.length !== 16 || hexB.length !== 16) return 64;
  let distance = 0;
  for (let i = 0; i < 16; i += 1) {
    distance += POPCOUNT[parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16)];
  }
  return distance;
}

function isNegated(text, position) {
  const start = Math.max(0, position - 2);
  const prefix = text.slice(start, position);
  return NEGATIONS.some(function (word) { return prefix.indexOf(word) >= 0; });
}

function sentiment(text) {
  const source = cleanText(text);
  let positive = 0;
  let negative = 0;
  POSITIVE.forEach(function (word) {
    let index = source.indexOf(word);
    while (index >= 0) {
      if (isNegated(source, index)) negative += 1;
      else positive += 1;
      index = source.indexOf(word, index + word.length);
    }
  });
  NEGATIVE.forEach(function (word) {
    let index = source.indexOf(word);
    while (index >= 0) {
      if (isNegated(source, index)) positive += 1;
      else negative += 1;
      index = source.indexOf(word, index + word.length);
    }
  });
  const score = (positive + 1) / (positive + negative + 2);
  let polarity = "neutral";
  if (score > 0.65) polarity = "positive";
  else if (score <= 0.35) polarity = "negative";
  return {
    score: Math.round(score * 1000) / 1000,
    positive: positive,
    negative: negative,
    polarity: polarity
  };
}

function aspectScores(text) {
  const source = cleanText(text);
  const sentences = source.split(/[。！？!?；;]/).filter(function (item) { return item.trim(); });
  const result = {};
  ASPECTS.forEach(function (aspect) {
    let pos = 0;
    let neg = 0;
    let hits = 0;
    sentences.forEach(function (sentence) {
      const hasTopic = aspect.keywords.some(function (word) { return sentence.indexOf(word) >= 0; });
      if (!hasTopic) return;
      hits += 1;
      aspect.positive.forEach(function (word) {
        let index = sentence.indexOf(word);
        while (index >= 0) {
          if (isNegated(sentence, index)) neg += 1;
          else pos += 1;
          index = sentence.indexOf(word, index + word.length);
        }
      });
      aspect.negative.forEach(function (word) {
        let index = sentence.indexOf(word);
        while (index >= 0) {
          if (isNegated(sentence, index)) pos += 1;
          else neg += 1;
          index = sentence.indexOf(word, index + word.length);
        }
      });
    });
    const total = pos + neg;
    result[aspect.key] = {
      name: aspect.name,
      score: total === 0 ? 0 : Math.round(((pos - neg) / total) * 1000) / 1000,
      positive: pos,
      negative: neg,
      hits: hits
    };
  });
  return result;
}

const TAG_NOISE = ["手机", "机号", "邮箱", "联系", "系我", "微信", "号码", "电话", "用户", "一下", "真的"];

function countTokens(texts) {
  const counter = new Map();
  texts.forEach(function (text) {
    const tokens = tokenize(text);
    tokens.forEach(function (token) {
      if (token.length < 2) return;
      if (TAG_NOISE.indexOf(token) >= 0) return;
      if (/^\[.+\]$/.test(token)) return;
      counter.set(token, (counter.get(token) || 0) + 1);
    });
  });
  return Array.from(counter.entries()).map(function (entry) {
    return { word: entry[0], count: entry[1] };
  }).sort(function (a, b) { return b.count - a.count; });
}

module.exports = {
  STOPWORDS: STOPWORDS,
  ASPECTS: ASPECTS,
  POSITIVE: POSITIVE,
  NEGATIVE: NEGATIVE,
  setDynamicWords: setDynamicWords,
  normalize: normalize,
  cleanText: cleanText,
  maskText: maskText,
  tokenize: tokenize,
  shingles: shingles,
  simhash: simhash,
  simhashText: simhashText,
  hamming: hamming,
  sentiment: sentiment,
  aspectScores: aspectScores,
  countTokens: countTokens
};

