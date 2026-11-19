const crypto = require("crypto");
const text = require("./text");
const analytics = require("./analytics");

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), String(salt), 64).toString("hex");
}

function makeSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function randFactory(seed) {
  let state = seed >>> 0;
  return function () {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function localDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function pick(random, list) {
  return list[Math.floor(random() * list.length) % list.length];
}

function int(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function build(secret, dataDir) {
  const random = randFactory(20261118);
  const now = new Date().toISOString();
  const categories = [
    { id: "DICT-C01", name: "盲盒潮玩", code: "blindbox", enabled: true, createdAt: now },
    { id: "DICT-C02", name: "博物馆文创", code: "museum", enabled: true, createdAt: now },
    { id: "DICT-C03", name: "非遗手作", code: "heritage", enabled: true, createdAt: now },
    { id: "DICT-C04", name: "文具手账", code: "stationery", enabled: true, createdAt: now },
    { id: "DICT-C05", name: "国风饰品", code: "ornament", enabled: true, createdAt: now },
    { id: "DICT-C06", name: "家居摆件", code: "decor", enabled: true, createdAt: now },
    { id: "DICT-C07", name: "服饰配饰", code: "apparel", enabled: true, createdAt: now },
    { id: "DICT-C08", name: "节庆礼盒", code: "giftbox", enabled: true, createdAt: now }
  ];
  const socialPlatforms = ["微博", "小红书", "抖音"];
  const shopPlatforms = ["淘宝", "京东", "拼多多"];
  const platforms = socialPlatforms.concat(shopPlatforms).map(function (name, index) {
    return { id: "DICT-P" + String(index + 1).padStart(2, "0"), name: name, code: "pf" + (index + 1), enabled: true, createdAt: now };
  });
  const sourceTypes = ["公开数据整理", "行业研究报告", "内部销售报表", "合作方授权数据"].map(function (name, index) {
    return { id: "DICT-S" + String(index + 1).padStart(2, "0"), name: name, code: "src" + (index + 1), enabled: true, createdAt: now };
  });
  const roleMenus = {
    ADMIN: ["dashboard", "import", "topics", "keywords", "cleaning", "sales", "selection", "reports", "audience", "users", "roles", "dicts", "audit", "settings", "feedback", "help", "profile"],
    ANALYST: ["dashboard", "import", "topics", "keywords", "cleaning", "sales", "selection", "reports", "audience", "feedback", "help", "profile"],
    DESIGNER: ["dashboard", "topics", "selection", "reports", "audience", "feedback", "help", "profile"],
    OPERATOR: ["dashboard", "sales", "selection", "reports", "feedback", "help", "profile"]
  };
  const settings = {
    alpha: 0.4,
    beta: 0.4,
    gamma: 0.2,
    redOceanThreshold: 85,
    minProfitMargin: 0.15,
    windowDays: 30,
    softwareName: "基于全网大数据的文创热点分析与智能选品系统",
    softwareVersion: "V1.0",
    owner: "陕西理工大学",
    contact: "李果",
    dataPolicy: "本系统不采集网络数据，分析数据由使用单位按合规途径取得后导入。",
    aiNotice: "报告中的排名与图表由算法基于导入数据自动生成，结论仅供决策参考。",
    roleMenus: roleMenus
  };
  const userSpecs = [
    { username: "admin01", name: "系统管理员", role: "ADMIN", password: "Admin@2026" },
    { username: "analyst01", name: "数据分析师", role: "ANALYST", password: "Analyst@2026" },
    { username: "designer01", name: "产品设计师", role: "DESIGNER", password: "Designer@2026" },
    { username: "operator01", name: "运营专员", role: "OPERATOR", password: "Operator@2026" }
  ];
  const users = userSpecs.map(function (spec, index) {
    const salt = makeSalt();
    return {
      id: "USR-" + String(index + 1).padStart(2, "0"),
      username: spec.username,
      name: spec.name,
      role: spec.role,
      email: spec.username + "@cultural.example",
      status: "active",
      salt: salt,
      passwordHash: hashPassword(spec.password, salt),
      createdAt: localDate(-180),
      lastLoginAt: ""
    };
  });
  const keywordWords = {
    "盲盒潮玩": ["盲盒", "隐藏款", "潮玩", "手办", "端盒", "吧唧", "搪胶", "改娃"],
    "博物馆文创": ["博物馆", "联名", "馆藏", "文物", "冰箱贴", "文创雪糕", "徽章", "复刻"],
    "非遗手作": ["非遗", "刺绣", "皮影", "木雕", "陶艺", "香囊", "团扇", "手工"],
    "文具手账": ["手账", "胶带", "贴纸", "笔记本", "书签", "钢笔", "印章", "宋韵"],
    "国风饰品": ["国风", "耳饰", "项链", "发簪", "点翠", "玉石", "璎珞", "珐琅"],
    "家居摆件": ["摆件", "香薰", "灯饰", "桌面", "陶器", "花器", "挂画", "木作"],
    "服饰配饰": ["汉服", "丝巾", "帆布包", "刺绣", "纹样", "披肩", "盘扣", "织锦"],
    "节庆礼盒": ["礼盒", "节庆", "伴手礼", "年货", "月饼", "粽子", "包装", "定制"]
  };
  const keywords = [];
  Object.keys(keywordWords).forEach(function (category) {
    keywordWords[category].forEach(function (word, index) {
      keywords.push({
        id: "KW-" + String(keywords.length + 1).padStart(3, "0"),
        word: word,
        category: category,
        weight: Math.round((1 + index * 0.25) * 100) / 100,
        enabled: true,
        createdAt: now
      });
    });
  });
  const cleaningRules = [
    { id: "CLR-01", name: "去除HTML标签", type: "regex", pattern: "<[^>]*>", replacement: " ", enabled: true, builtin: true },
    { id: "CLR-02", name: "去除URL", type: "regex", pattern: "https?://[^\\s]+", replacement: " ", enabled: true, builtin: true },
    { id: "CLR-03", name: "手机号掩码", type: "mask", pattern: "1[3-9]\\d{9}", replacement: "[手机号]", enabled: true, builtin: true },
    { id: "CLR-04", name: "邮箱掩码", type: "mask", pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", replacement: "[邮箱]", enabled: true, builtin: true },
    { id: "CLR-05", name: "微信与QQ掩码", type: "mask", pattern: "(微信|QQ)[:：]?[A-Za-z0-9_-]{4,20}", replacement: "[联系方式]", enabled: true, builtin: true },
    { id: "CLR-06", name: "全角转半角", type: "normalize", pattern: "fullwidth", replacement: "halfwidth", enabled: true, builtin: true }
  ];
  const batchTopic = {
    id: "BAT-SEED-01",
    batchNo: "BT-TOPIC-SEED-001",
    type: "topic",
    typeName: "热点话题",
    sourceName: "社交平台文创话题公开数据（2026年11月）",
    sourceType: "公开数据整理",
    acquiredDate: localDate(-30),
    fileName: "topics_202611.csv",
    fileSize: 0,
    totalRows: 0,
    importedRows: 0,
    duplicateRows: 0,
    invalidRows: 0,
    status: "completed",
    createdBy: "USR-02",
    createdByName: "数据分析师",
    createdAt: localDate(-30) + "T09:20:00.000Z"
  };
  const batchProduct = {
    id: "BAT-SEED-02",
    batchNo: "BT-PRODUCT-SEED-001",
    type: "product",
    typeName: "电商商品",
    sourceName: "电商平台文创商品公开数据（2026年11月）",
    sourceType: "公开数据整理",
    acquiredDate: localDate(-30),
    fileName: "products_202611.csv",
    fileSize: 0,
    totalRows: 0,
    importedRows: 0,
    duplicateRows: 0,
    invalidRows: 0,
    status: "completed",
    createdBy: "USR-02",
    createdByName: "数据分析师",
    createdAt: localDate(-30) + "T09:40:00.000Z"
  };
  const batchComment = {
    id: "BAT-SEED-03",
    batchNo: "BT-COMMENT-SEED-001",
    type: "comment",
    typeName: "评论",
    sourceName: "电商商品公开评论与话题讨论（2026年11月）",
    sourceType: "公开数据整理",
    acquiredDate: localDate(-30),
    fileName: "comments_202611.csv",
    fileSize: 0,
    totalRows: 0,
    importedRows: 0,
    duplicateRows: 0,
    invalidRows: 0,
    status: "completed",
    createdBy: "USR-02",
    createdByName: "数据分析师",
    createdAt: localDate(-30) + "T10:05:00.000Z"
  };
  const topicTemplates = {
    "盲盒潮玩": ["新款盲盒隐藏款概率讨论升温", "潮玩展限定手办开箱反馈集中", "端盒攻略在社交平台持续传播", "搪胶公仔改娃教程受关注", "吧唧周边搭配玩法走红"],
    "博物馆文创": ["博物馆联名冰箱贴登上热榜", "馆藏纹样复刻徽章引发讨论", "文创雪糕打卡内容集中出现", "文物配色被用于春季设计", "博物馆夜场文创销售话题升温"],
    "非遗手作": ["非遗刺绣纹样进入年轻设计圈", "皮影元素手机壳讨论上升", "木雕手艺体验课预约增加", "香囊与团扇成为送礼选项", "陶艺手作短视频播放走高"],
    "文具手账": ["宋韵纹样手账本讨论增加", "胶带拼贴排版教程受关注", "博物馆书签被列入伴手礼清单", "手账印章国风图案热销", "开学季笔记本选购话题升温"],
    "国风饰品": ["点翠工艺耳饰引发审美讨论", "玉石项链搭配国风穿搭走红", "发簪造型教程在短视频传播", "珐琅胸针被用于通勤搭配", "璎珞配饰进入节日礼物清单"],
    "家居摆件": ["桌面香薰摆件讨论增加", "陶器花器与宋韵家居搭配", "木作灯饰被用于氛围布置", "国风挂画进入租房改造清单", "文创摆件送礼场景受关注"],
    "服饰配饰": ["汉服披肩刺绣纹样受关注", "丝巾国风配色进入通勤场景", "帆布包纹样设计引发讨论", "盘扣元素被用于现代外套", "织锦配饰成为节日搭配"],
    "节庆礼盒": ["伴手礼礼盒包装审美讨论", "年货礼盒定制需求集中出现", "月饼礼盒国风设计受关注", "节庆礼盒开箱内容增加", "企业定制礼盒询价增多"]
  };
  const topics = [];
  let topicSeq = 0;
  categories.forEach(function (category, categoryIndex) {
    const templates = topicTemplates[category.name];
    const count = category.name === "非遗手作" ? 14 : category.name === "节庆礼盒" ? 8 : 12;
    for (let index = 0; index < count; index += 1) {
      topicSeq += 1;
      let offset;
      if (category.name === "非遗手作") offset = -int(random, 1, 8);
      else if (category.name === "盲盒潮玩") offset = -int(random, 16, 29);
      else offset = -int(random, 2, 29);
      const readBase = category.name === "节庆礼盒" ? 18000 : category.name === "非遗手作" ? 120000 : 60000;
      const readCount = readBase + int(random, 5000, category.name === "非遗手作" ? 240000 : 380000);
      const discussCount = Math.round(readCount * (0.008 + random() * 0.02));
      const shareCount = Math.round(discussCount * (0.12 + random() * 0.3));
      const keywordsForCategory = keywordWords[category.name];
      topics.push({
        id: "TOP-SEED-" + String(topicSeq).padStart(3, "0"),
        batchId: batchTopic.id,
        title: templates[index % templates.length] + "（" + pick(random, ["第" + (index + 1) + "期", "话题观察", "趋势记录", "讨论汇总"]) + "）",
        platform: socialPlatforms[(categoryIndex + index) % socialPlatforms.length],
        category: category.name,
        readCount: readCount,
        discussCount: discussCount,
        shareCount: shareCount,
        publishDate: localDate(offset),
        keywords: [keywordsForCategory[index % keywordsForCategory.length], keywordsForCategory[(index + 3) % keywordsForCategory.length], category.name],
        content: templates[index % templates.length] + "，" + keywordsForCategory[index % keywordsForCategory.length] + "相关内容在" + socialPlatforms[(categoryIndex + index) % socialPlatforms.length] + "获得持续讨论。",
        simhash: text.simhash(text.tokenize(templates[index % templates.length] + category.name + index)),
        sourceUrl: "",
        importedAt: batchTopic.createdAt
      });
    }
  });
  batchTopic.totalRows = topics.length;
  batchTopic.importedRows = topics.length;
  const productNames = {
    "盲盒潮玩": ["星河盲盒", "山海经手办", "限定搪胶公仔", "国风端盒", "金属吧唧", "改娃配件包"],
    "博物馆文创": ["馆藏纹样冰箱贴", "文物复刻徽章", "博物馆联名书签", "青铜纹样胶带", "馆藏配色丝巾", "文创雪糕券"],
    "非遗手作": ["手工刺绣香囊", "皮影元素摆件", "木雕纹样书签", "陶艺手作杯", "团扇手绘礼盒", "非遗刺绣胸针"],
    "文具手账": ["宋韵纹样手账本", "国风胶带套装", "博物馆书签", "手账印章套装", "复古笔记本", "钢笔礼盒"],
    "国风饰品": ["点翠工艺耳饰", "玉石项链", "国风发簪", "珐琅胸针", "璎珞配饰", "玉石手串"],
    "家居摆件": ["桌面香薰摆件", "陶器花器", "木作灯饰", "国风挂画", "文创摆件套装", "香薰礼盒"],
    "服饰配饰": ["汉服刺绣披肩", "国风丝巾", "纹样帆布包", "盘扣外套", "织锦围巾", "刺绣腰带"],
    "节庆礼盒": ["节庆伴手礼盒", "年货国风礼盒", "月饼礼盒", "企业定制礼盒", "端午文创礼盒", "节庆包装套装"]
  };
  const shops = {
    "盲盒潮玩": ["潮玩星球旗舰店", "星河造物", "玩心研究所", "小满杂货", "二次元仓库", "造物集", "玩盒社", "盲盒研究所", "纸盒工坊", "潮玩仓库", "木马玩具", "小岛手办"],
    "博物馆文创": ["博物馆文创店", "文物新语", "典藏生活", "青瓷文创", "城市礼物店", "典藏复刻社"],
    "非遗手作": ["秦地手作", "非遗工坊", "山南织造", "守艺人集合店", "手作市集", "民艺商店"],
    "文具手账": ["汴京文创旗舰店", "纸间研究所", "墨韵文具", "小宋手账", "文具集合店", "纸上长安"],
    "国风饰品": ["拾翠阁", "云鬓首饰", "青玉案", "花间集", "琳琅饰品", "国风配饰店"],
    "家居摆件": ["半山居", "木与时", "一隅香事", "素陶生活", "东方家居", "小筑杂货"],
    "服饰配饰": ["织锦记", "云想衣", "国风织造", "长安布衣", "衣冠集", "锦绣配饰"],
    "节庆礼盒": ["礼遇长安", "节庆定制局", "东方礼盒", "年礼工坊", "伴手礼集合", "城市礼物店"]
  };
  const priceBase = {
    "盲盒潮玩": [39, 159],
    "博物馆文创": [29, 299],
    "非遗手作": [59, 399],
    "文具手账": [19, 129],
    "国风饰品": [69, 459],
    "家居摆件": [49, 599],
    "服饰配饰": [89, 499],
    "节庆礼盒": [99, 699]
  };
  const products = [];
  let productSeq = 0;
  categories.forEach(function (category) {
    const names = productNames[category.name];
    const categoryShops = shops[category.name];
    const count = category.name === "盲盒潮玩" ? 20 : 12;
    for (let index = 0; index < count; index += 1) {
      productSeq += 1;
      const base = priceBase[category.name];
      const price = Math.round((base[0] + random() * (base[1] - base[0])) * 10) / 10;
      let shopName;
      if (category.name === "盲盒潮玩") {
        shopName = index < 8 ? categoryShops[0] : categoryShops[1 + ((index - 8) % 11)];
      } else {
        shopName = categoryShops[index % categoryShops.length];
      }
      let monthlySales = int(random, 120, 3200);
      if (category.name === "盲盒潮玩" && index < 8) monthlySales = int(random, 5000, 8000);
      if (category.name === "盲盒潮玩" && index >= 8) monthlySales = int(random, 60, 180);
      if (category.name === "非遗手作") monthlySales = int(random, 260, 2600);
      if (category.name === "节庆礼盒") monthlySales = int(random, 90, 900);
      const revenue = Math.round(price * monthlySales * 100) / 100;
      products.push({
        id: "PRD-SEED-" + String(productSeq).padStart(3, "0"),
        batchId: batchProduct.id,
        name: names[index % names.length] + (index >= names.length ? "·" + (Math.floor(index / names.length) + 1) + "款" : ""),
        platform: category.name === "节庆礼盒" ? shopPlatforms[index % 2] : shopPlatforms[index % shopPlatforms.length],
        category: category.name,
        price: price,
        monthlySales: monthlySales,
        revenue: revenue,
        profitMargin: Math.round((0.16 + random() * 0.36) * 1000) / 1000,
        shopName: shopName,
        recordDate: localDate(-int(random, 1, 28)),
        importedAt: batchProduct.createdAt
      });
    }
  });
  batchProduct.totalRows = products.length;
  batchProduct.importedRows = products.length;
  const commentTemplates = {
    "盲盒潮玩": [
      "隐藏款概率太低了，抽了三次都是普通款，包装倒是严实，设计还行",
      "手办做工细腻，涂装没有瑕疵，摆在桌上很好看，物流也快",
      "价格偏贵，性价比一般，但造型确实可爱，还是推荐",
      "端盒发货慢，盒子被压坏了一角，客服处理还行，质量没问题",
      "改娃配件很全，细节精致，包装简陋了一点，整体满意"
    ],
    "博物馆文创": [
      "冰箱贴纹样好看，有文化底蕴，包装精美，送人很合适",
      "徽章做工粗糙，背面有毛边，价格不值，失望",
      "书签设计感强，材质厚实，物流快，会回购",
      "胶带颜色和馆藏文物有差距，包装简陋，性价比一般",
      "联名款很有纪念意义，细节到位，礼盒好看，推荐"
    ],
    "非遗手作": [
      "刺绣香囊手工痕迹明显，很有文化感，包装用心，喜欢",
      "木雕书签纹理漂亮，材质扎实，价格合理，值得",
      "陶艺杯子有轻微瑕疵，发货慢，但整体质感好",
      "团扇图案精致，非遗工艺有底蕴，礼盒包装精美",
      "皮影摆件创意好，做工细腻，物流包装严实，满意"
    ],
    "文具手账": [
      "手账本纸质细腻，宋韵纹样好看，价格划算，推荐",
      "胶带粘性一般，图案和宣传有差距，有点失望",
      "书签材质好，包装精美，发货快，适合送礼",
      "印章细节到位，文化感强，物流慢了两天",
      "笔记本封面设计高级，内页顺滑，性价比高"
    ],
    "国风饰品": [
      "耳饰做工精致，国风配色好看，包装严实，喜欢",
      "项链材质一般，戴了几次掉色，价格偏贵",
      "发簪造型独特，细节到位，物流快，推荐",
      "胸针设计有文化内涵，礼盒包装用心，值得",
      "手串珠子有瑕疵，客服态度好，但性价比一般"
    ],
    "家居摆件": [
      "香薰摆件造型好看，味道舒服，包装严实，满意",
      "花器有磕碰，物流慢，客服补发很快，质量还行",
      "灯饰氛围感强，木作细节到位，价格合理",
      "挂画颜色和图片有差距，包装简陋，有点失望",
      "摆件套装很有文化感，送人合适，性价比高"
    ],
    "服饰配饰": [
      "披肩刺绣纹样精致，面料舒服，包装精美，推荐",
      "丝巾颜色高级，国风搭配好看，价格略贵",
      "帆布包图案有创意，材质厚实，物流快",
      "外套盘扣做工粗糙，线头多，性价比低",
      "围巾织锦质感好，包装用心，有文化底蕴"
    ],
    "节庆礼盒": [
      "礼盒包装精美，国风设计有档次，适合企业送礼",
      "月饼口味一般，盒子好看但价格偏贵，性价比低",
      "定制礼盒细节到位，发货快，包装严实，满意",
      "伴手礼盒设计有文化感，物流慢，客服响应及时",
      "年货礼盒内容丰富，包装用心，值得推荐"
    ]
  };
  const comments = [];
  let commentSeq = 0;
  categories.forEach(function (category) {
    const templates = commentTemplates[category.name];
    const categoryProducts = products.filter(function (item) { return item.category === category.name; });
    const count = category.name === "非遗手作" ? 22 : 18;
    for (let index = 0; index < count; index += 1) {
      commentSeq += 1;
      const raw = templates[index % templates.length];
      const masked = text.maskText(text.cleanText(raw));
      const sentiment = text.sentiment(masked);
      const product = categoryProducts[index % categoryProducts.length];
      comments.push({
        id: "CMT-SEED-" + String(commentSeq).padStart(3, "0"),
        batchId: batchComment.id,
        text: masked,
        category: category.name,
        productName: product.name,
        productId: product.id,
        commentDate: localDate(-int(random, 1, 27)),
        sentimentScore: sentiment.score,
        polarity: sentiment.polarity,
        aspects: text.aspectScores(masked),
        tags: text.tokenize(masked).slice(0, 8),
        simhash: text.simhash(text.tokenize(masked + commentSeq)),
        importedAt: batchComment.createdAt
      });
    }
  });
  batchComment.totalRows = comments.length;
  batchComment.importedRows = comments.length;
  const from = localDate(-29);
  const to = localDate(0);
  const baseParams = { alpha: 0.4, beta: 0.4, gamma: 0.2, redOceanThreshold: 85, minProfitMargin: 0.15 };
  const allRows = analytics.potentialRows({
    topics: topics,
    products: products,
    category: "全部类目",
    dateFrom: from,
    dateTo: to,
    alpha: baseParams.alpha,
    beta: baseParams.beta,
    gamma: baseParams.gamma,
    redOceanThreshold: baseParams.redOceanThreshold,
    minProfitMargin: baseParams.minProfitMargin
  });
  const heritageRows = analytics.potentialRows({
    topics: topics,
    products: products,
    category: "非遗手作",
    dateFrom: from,
    dateTo: to,
    alpha: baseParams.alpha,
    beta: baseParams.beta,
    gamma: baseParams.gamma,
    redOceanThreshold: baseParams.redOceanThreshold,
    minProfitMargin: baseParams.minProfitMargin
  });
  const taskA = {
    id: "TASK-SEED-01",
    name: "全类目选品潜力评估（近30天）",
    category: "全部类目",
    platform: "全部平台",
    windowDays: 30,
    dateFrom: from,
    dateTo: to,
    alpha: 0.4,
    beta: 0.4,
    gamma: 0.2,
    redOceanThreshold: 85,
    minProfitMargin: 0.15,
    status: "completed",
    progress: 100,
    logs: [
      { time: localDate(-2) + "T09:10:00.000Z", message: "任务已创建，等待计算资源" },
      { time: localDate(-2) + "T09:10:02.000Z", message: "开始校验数据窗口与类目数据" },
      { time: localDate(-2) + "T09:10:03.000Z", message: "读取话题" + topics.length + "条、商品" + products.length + "条" },
      { time: localDate(-2) + "T09:10:04.000Z", message: "完成热度、销量与竞争惩罚计算，共" + allRows.length + "个类目" },
      { time: localDate(-2) + "T09:10:05.000Z", message: "选品报告已生成，等待审核" }
    ],
    result: allRows,
    reportId: "RPT-SEED-01",
    createdBy: "USR-02",
    createdByName: "数据分析师",
    createdAt: localDate(-2) + "T09:10:00.000Z",
    startedAt: localDate(-2) + "T09:10:02.000Z",
    finishedAt: localDate(-2) + "T09:10:05.000Z"
  };
  const taskB = {
    id: "TASK-SEED-02",
    name: "非遗手作类目蓝海验证",
    category: "非遗手作",
    platform: "全部平台",
    windowDays: 30,
    dateFrom: from,
    dateTo: to,
    alpha: 0.4,
    beta: 0.4,
    gamma: 0.2,
    redOceanThreshold: 85,
    minProfitMargin: 0.15,
    status: "completed",
    progress: 100,
    logs: [
      { time: localDate(-1) + "T14:20:00.000Z", message: "任务已创建，等待计算资源" },
      { time: localDate(-1) + "T14:20:02.000Z", message: "开始校验数据窗口与类目数据" },
      { time: localDate(-1) + "T14:20:03.000Z", message: "读取话题" + topics.length + "条、商品" + products.length + "条" },
      { time: localDate(-1) + "T14:20:04.000Z", message: "完成热度、销量与竞争惩罚计算，共" + heritageRows.length + "个类目" },
      { time: localDate(-1) + "T14:20:05.000Z", message: "选品报告已生成，等待审核" }
    ],
    result: heritageRows,
    reportId: "RPT-SEED-02",
    createdBy: "USR-03",
    createdByName: "产品设计师",
    createdAt: localDate(-1) + "T14:20:00.000Z",
    startedAt: localDate(-1) + "T14:20:02.000Z",
    finishedAt: localDate(-1) + "T14:20:05.000Z"
  };
  const taskC = {
    id: "TASK-SEED-03",
    name: "节庆礼盒抖音渠道复核",
    category: "节庆礼盒",
    platform: "抖音",
    windowDays: 30,
    dateFrom: from,
    dateTo: to,
    alpha: 0.4,
    beta: 0.4,
    gamma: 0.2,
    redOceanThreshold: 85,
    minProfitMargin: 0.15,
    status: "failed",
    progress: 100,
    logs: [
      { time: localDate(-1) + "T16:00:00.000Z", message: "任务已创建，等待计算资源" },
      { time: localDate(-1) + "T16:00:02.000Z", message: "开始校验数据窗口与类目数据" },
      { time: localDate(-1) + "T16:00:03.000Z", message: "读取话题" + topics.filter(function (item) { return item.platform === "抖音"; }).length + "条、商品0条" },
      { time: localDate(-1) + "T16:00:03.000Z", message: "失败：所选类目在时间窗口内没有可用商品数据" }
    ],
    result: [],
    reportId: "",
    createdBy: "USR-02",
    createdByName: "数据分析师",
    createdAt: localDate(-1) + "T16:00:00.000Z",
    startedAt: localDate(-1) + "T16:00:02.000Z",
    finishedAt: localDate(-1) + "T16:00:03.000Z"
  };
  function makeReport(task, rows, status, reviewComment) {
    const top = rows.slice(0, 3);
    const redCount = rows.filter(function (item) { return item.redOcean; }).length;
    return {
      id: task.reportId,
      taskId: task.id,
      taskName: task.name,
      title: task.name + "选品建议报告",
      category: task.category,
      summary: "本次任务覆盖" + rows.length + "个类目，潜力分最高为" + top[0].category + "（" + top[0].potentialScore.toFixed(2) + "分）。红海类目" + redCount + "个。",
      recommendation: top.map(function (item, index) {
        return (index + 1) + ". " + item.category + "：综合潜力" + item.potentialScore.toFixed(2) + "，热度" + item.heatScore.toFixed(2) + "，销量" + item.salesScore.toFixed(2) + "，竞争惩罚" + item.competitionPenalty.toFixed(2) + (item.redOcean ? "（红海预警）" : "");
      }).join("\n"),
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
      references: [batchTopic.id, batchProduct.id],
      topicCount: topics.length,
      productCount: products.length,
      status: status,
      reviewComment: reviewComment,
      reviewer: status === "pending" ? "" : "数据分析师",
      reviewedAt: status === "pending" ? "" : localDate(-1) + "T10:00:00.000Z",
      generatedAt: task.finishedAt,
      createdBy: task.createdBy,
      createdByName: task.createdByName
    };
  }
  const reportA = makeReport(taskA, allRows, "approved", "参数与批次记录完整，同意作为选品参考。");
  const reportB = makeReport(taskB, heritageRows, "pending", "");
  const auditLogs = [
    { id: "LOG-SEED-01", userId: "USR-02", username: "analyst01", role: "ANALYST", category: "数据导入", action: "导入热点话题", target: batchTopic.batchNo, detail: "成功" + topics.length + "条", ip: "127.0.0.1", createdAt: batchTopic.createdAt },
    { id: "LOG-SEED-02", userId: "USR-02", username: "analyst01", role: "ANALYST", category: "数据导入", action: "导入电商商品", target: batchProduct.batchNo, detail: "成功" + products.length + "条", ip: "127.0.0.1", createdAt: batchProduct.createdAt },
    { id: "LOG-SEED-03", userId: "USR-02", username: "analyst01", role: "ANALYST", category: "数据导入", action: "导入评论", target: batchComment.batchNo, detail: "成功" + comments.length + "条", ip: "127.0.0.1", createdAt: batchComment.createdAt },
    { id: "LOG-SEED-04", userId: "USR-02", username: "analyst01", role: "ANALYST", category: "智能选品", action: "创建选品任务", target: taskA.name, detail: "类目全部类目", ip: "127.0.0.1", createdAt: taskA.createdAt },
    { id: "LOG-SEED-05", userId: "USR-02", username: "analyst01", role: "ANALYST", category: "报告审核", action: "通过报告", target: reportA.title, detail: "参数与批次记录完整", ip: "127.0.0.1", createdAt: reportA.reviewedAt },
    { id: "LOG-SEED-06", userId: "USR-03", username: "designer01", role: "DESIGNER", category: "认证", action: "登录", target: "登录系统", detail: "角色DESIGNER", ip: "127.0.0.1", createdAt: localDate(-1) + "T09:00:00.000Z" },
    { id: "LOG-SEED-07", userId: "USR-04", username: "operator01", role: "OPERATOR", category: "认证", action: "登录", target: "登录系统", detail: "角色OPERATOR", ip: "127.0.0.1", createdAt: localDate(-1) + "T09:30:00.000Z" },
    { id: "LOG-SEED-08", userId: "USR-01", username: "admin01", role: "ADMIN", category: "系统设置", action: "保存系统参数", target: "算法默认参数", detail: "维持默认权重", ip: "127.0.0.1", createdAt: localDate(-3) + "T10:00:00.000Z" }
  ];
  const feedback = [
    { id: "FB-SEED-01", userId: "USR-03", userName: "产品设计师", role: "DESIGNER", type: "建议", content: "希望受众画像页可以按商品筛选评论，便于针对单款设计复盘。", status: "pending", reply: "", replier: "", createdAt: localDate(-1) + "T15:10:00.000Z", repliedAt: "" },
    { id: "FB-SEED-02", userId: "USR-04", userName: "运营专员", role: "OPERATOR", type: "异议", content: "价格分布中500元以上区间的销售额占比显示需要更直观的说明。", status: "replied", reply: "已在价格分布图下方补充区间销售额与商品数说明。", replier: "系统管理员", createdAt: localDate(-4) + "T11:20:00.000Z", repliedAt: localDate(-3) + "T09:15:00.000Z" }
  ];
  return {
    meta: { createdAt: now, version: 1 },
    settings: settings,
    users: users,
    tokens: [],
    batches: [batchComment, batchProduct, batchTopic],
    importErrors: [],
    topics: topics,
    products: products,
    comments: comments,
    keywords: keywords,
    cleaningRules: cleaningRules,
    tasks: [taskB, taskA, taskC],
    reports: [reportB, reportA],
    auditLogs: auditLogs,
    feedback: feedback,
    dicts: { categories: categories, platforms: platforms, sourceTypes: sourceTypes },
    sessions: []
  };
}

module.exports = {
  build: build
};

