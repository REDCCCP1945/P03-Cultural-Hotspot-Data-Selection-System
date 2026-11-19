const AudienceView = {
  render: async function (container) {
    container.innerHTML = UI.pageHead("受众画像", "对评论执行方面级情感分析，输出极性占比、关注点雷达与标签云", "") +
      '<div class="card"><div class="card-body">' +
      '<div class="filters"><div class="field"><label>类目</label><select class="select" id="a-category"><option value="">全部类目</option></select></div>' +
      '<div class="field grow"><label>商品</label><select class="select" id="a-product"><option value="">全部商品</option></select></div>' +
      '<div class="field"><label>开始日期</label><input class="input" type="date" id="a-from"></div>' +
      '<div class="field"><label>结束日期</label><input class="input" type="date" id="a-to" value="' + UI.today() + '"></div>' +
      '<button class="btn primary" id="a-search">分析</button><button class="btn" id="a-reset">重置</button></div>' +
      '<div id="audience-content" style="margin-top:14px"></div></div></div>';
    const categorySelect = container.querySelector("#a-category");
    const productSelect = container.querySelector("#a-product");
    const content = container.querySelector("#audience-content");
    let categoriesLoaded = false;
    async function load() {
      const params = new URLSearchParams();
      params.set("category", categorySelect.value);
      params.set("productName", productSelect.value);
      params.set("dateFrom", container.querySelector("#a-from").value);
      params.set("dateTo", container.querySelector("#a-to").value);
      const result = await API.get("/api/audience?" + params.toString());
      const data = result.data;
      if (!categoriesLoaded) {
        categorySelect.innerHTML = '<option value="">全部类目</option>' + UI.optionList(data.categories);
        categoriesLoaded = true;
      }
      const currentProduct = productSelect.value;
      productSelect.innerHTML = '<option value="">全部商品</option>' + UI.optionList(data.products, currentProduct);
      const summary = data.summary;
      const sentimentItems = [
        { name: "正向", value: summary.positive, color: "#2f8f6a" },
        { name: "中立", value: summary.neutral, color: "#b9c6cd" },
        { name: "负向", value: summary.negative, color: "#c0564a" }
      ];
      const trendLabels = data.trend.map(function (item) { return item.date.slice(5); });
      const positiveSeries = data.trend.map(function (item) { return item.positiveRatio; });
      const negativeSeries = data.trend.map(function (item) { return item.negativeRatio; });
      content.innerHTML = '<div class="stat-strip"><div class="stat-mini"><span>评论样本</span><strong>' + UI.fmtInt(summary.total) + '</strong></div>' +
        '<div class="stat-mini"><span>正向占比</span><strong>' + summary.positiveRatio.toFixed(2) + '%</strong></div>' +
        '<div class="stat-mini"><span>中立占比</span><strong>' + summary.neutralRatio.toFixed(2) + '%</strong></div>' +
        '<div class="stat-mini"><span>负向占比</span><strong>' + summary.negativeRatio.toFixed(2) + "%</strong></div></div>" +
        '<div class="sentiment-bar" style="margin-top:12px"><i class="pos" style="width:' + summary.positiveRatio + '%"></i><i class="neu" style="width:' + summary.neutralRatio + '%"></i><i class="neg" style="width:' + summary.negativeRatio + '%"></i></div>' +
        '<div class="grid grid-main" style="margin-top:16px">' +
        '<div class="card"><div class="card-head"><h3>情感极性分布</h3><span class="hint">阈值：得分>0.65正向，≤0.35负向</span></div><div class="card-body">' +
        Charts.donut(sentimentItems, { centerLabel: "评论" }) + "</div></div>" +
        '<div class="card"><div class="card-head"><h3>消费者关注点雷达</h3><span class="hint">五维方面得分映射到0-100</span></div><div class="card-body">' +
        Charts.radar({ axes: summary.aspects.map(function (item) { return item.name; }), values: summary.aspects.map(function (item) { return item.value; }), max: 100 }) +
        "</div></div></div>" +
        '<div class="grid grid-2" style="margin-top:16px">' +
        '<div class="card"><div class="card-head"><h3>方面得分明细</h3><span class="hint">得分区间-1到1</span></div><div class="card-body tight">' +
        UI.table({
          columns: [
            { title: "方面", key: "name" },
            { title: "得分", align: "right", width: "80px", render: function (row) { return row.score.toFixed(3); } },
            { title: "正向词", align: "right", width: "78px", render: function (row) { return row.positive; } },
            { title: "负向词", align: "right", width: "78px", render: function (row) { return row.negative; } },
            { title: "命中句", align: "right", width: "78px", render: function (row) { return row.hits; } },
            { title: "状态", width: "90px", render: function (row) { return row.hits ? '<span class="badge teal">有样本</span>' : '<span class="badge gray">无样本</span>'; } }
          ],
          rows: summary.aspects,
          empty: "暂无方面数据"
        }) + "</div></div>" +
        '<div class="card"><div class="card-head"><h3>评论标签云</h3><span class="hint">来自清洗后的评论分词</span></div><div class="card-body">' +
        Charts.wordCloud(data.tags, 36) + "</div></div></div>" +
        '<div class="card" style="margin-top:16px"><div class="card-head"><h3>情感趋势</h3><span class="hint">按评论日期统计正向与负向占比</span></div><div class="card-body">' +
        Charts.line({
          labels: trendLabels,
          series: [
            { name: "正向占比", values: positiveSeries, color: "#2f8f6a" },
            { name: "负向占比", values: negativeSeries, color: "#c0564a" }
          ],
          max: 100,
          height: 230
        }) + "</div></div>" +
        '<div class="card" style="margin-top:16px"><div class="card-head"><h3>代表评论</h3><span class="hint">已执行手机号、邮箱掩码</span></div><div class="card-body tight">' +
        UI.table({
          columns: [
            { title: "评论内容", key: "text", render: function (row) { return '<span class="wrap-text">' + UI.esc(row.text) + "</span>"; } },
            { title: "商品", key: "productName", width: "160px" },
            { title: "极性", width: "76px", render: function (row) { return row.polarity === "positive" ? '<span class="badge green">正向</span>' : row.polarity === "negative" ? '<span class="badge red">负向</span>' : '<span class="badge gray">中立</span>'; } },
            { title: "得分", align: "right", width: "70px", render: function (row) { return row.sentimentScore.toFixed(3); } },
            { title: "日期", width: "100px", render: function (row) { return UI.esc(row.commentDate); } }
          ],
          rows: data.samples,
          empty: "当前筛选条件下没有评论"
        }) + "</div></div>";
    }
    container.querySelector("#a-search").addEventListener("click", load);
    container.querySelector("#a-reset").addEventListener("click", function () {
      categorySelect.value = "";
      productSelect.value = "";
      container.querySelector("#a-from").value = "";
      container.querySelector("#a-to").value = UI.today();
      load();
    });
    categorySelect.addEventListener("change", function () { productSelect.value = ""; load(); });
    await load();
  }
};
App.register("audience", AudienceView);

