const TopicDetailView = {
  render: async function (container, params) {
    const result = await API.get("/api/topics/" + encodeURIComponent(params.id));
    const data = result.data;
    const topic = data.topic;
    const trendLabels = data.trend.map(function (item) { return item.date.slice(5); });
    const trendValues = data.trend.map(function (item) { return item.value; });
    const platforms = data.platforms.map(function (item, index) {
      return { name: item.name, value: item.count, color: Charts.palette[index % Charts.palette.length] };
    });
    container.innerHTML = UI.pageHead(topic.title, "话题详情 · 所属类目 " + topic.category + " · 平台 " + topic.platform,
      '<button class="btn" data-route="topics">返回列表</button>') +
      '<div class="card"><div class="card-body"><div class="detail-list">' +
      '<div class="detail-item"><span>热度指数</span><strong style="color:#0f766e">' + topic.heatIndex.toFixed(2) + "</strong></div>" +
      '<div class="detail-item"><span>阅读量</span><strong>' + UI.fmtInt(topic.readCount) + "</strong></div>" +
      '<div class="detail-item"><span>讨论量</span><strong>' + UI.fmtInt(topic.discussCount) + "</strong></div>" +
      '<div class="detail-item"><span>转发量</span><strong>' + UI.fmtInt(topic.shareCount) + "</strong></div>" +
      '<div class="detail-item"><span>发布日期</span><strong>' + UI.esc(topic.publishDate) + "</strong></div>" +
      '<div class="detail-item"><span>平台</span><strong>' + UI.esc(topic.platform) + "</strong></div>" +
      '<div class="detail-item"><span>类目</span><strong>' + UI.esc(topic.category) + "</strong></div>" +
      '<div class="detail-item"><span>批次号</span><strong class="mono">' + UI.esc(topic.batchId) + "</strong></div>" +
      '</div><div class="chip-list" style="margin-top:14px">' + (topic.keywords || []).map(function (word) {
        return '<span class="chip">' + UI.esc(word) + "</span>";
      }).join("") + "</div>" +
      (topic.content ? '<p style="margin-top:14px;color:#43565f">' + UI.esc(topic.content) + "</p>" : "") +
      "</div></div>" +
      '<div class="grid grid-main" style="margin-top:16px">' +
      '<div class="card"><div class="card-head"><h3>同类目热度趋势</h3><span class="hint">按发布日归一化，反映近期走势</span></div><div class="card-body">' +
      Charts.line({ labels: trendLabels, series: [{ name: "类目热度", values: trendValues, color: "#173a5e" }], max: 100, height: 240 }) +
      '</div></div>' +
      '<div class="card"><div class="card-head"><h3>平台分布</h3><span class="hint">同类目话题数</span></div><div class="card-body">' +
      Charts.donut(platforms, { centerLabel: "话题" }) + "</div></div></div>" +
      '<div class="grid grid-2" style="margin-top:16px">' +
      '<div class="card"><div class="card-head"><h3>同类目词云</h3><span class="hint">来自启用关键词库与话题文本</span></div><div class="card-body">' +
      Charts.wordCloud(data.wordCloud, 32) + "</div></div>" +
      '<div class="card"><div class="card-head"><h3>同类目高热度话题</h3><a href="#/topics">查看全部</a></div><div class="card-body tight">' +
      UI.table({
        columns: [
          { title: "话题", key: "title", render: function (row) { return '<span class="clickable" data-id="' + row.id + '">' + UI.esc(row.title) + "</span>"; } },
          { title: "平台", key: "platform", width: "80px" },
          { title: "热度", align: "right", width: "72px", render: function (row) { return row.heatIndex.toFixed(2); } }
        ],
        rows: data.related,
        empty: "暂无相关话题"
      }) + "</div></div></div>";
    container.querySelectorAll("[data-route]").forEach(function (node) {
      node.addEventListener("click", function () { location.hash = "#/" + node.getAttribute("data-route"); });
    });
    container.querySelectorAll("[data-id]").forEach(function (node) {
      node.addEventListener("click", function () { location.hash = "#/topics/" + node.getAttribute("data-id"); });
    });
  }
};
App.register("topic-detail", TopicDetailView);

