const DashboardView = {
  render: async function (container) {
    const response = await API.get("/api/dashboard");
    const data = response.data;
    const metrics = data.metrics;
    const canCreate = App.menus.indexOf("selection") >= 0 && App.user.role !== "OPERATOR";
    const canImport = App.menus.indexOf("import") >= 0;
    const actions = '<button class="btn" data-route="topics">查看热点榜单</button>' +
      (canImport ? '<button class="btn" data-route="import">导入数据</button>' : "") +
      (canCreate ? '<button class="btn primary" data-route="selection/new">新建选品任务</button>' : "");
    const trendLabels = data.trend.map(function (item) { return item.date.slice(5); });
    const trendValues = data.trend.map(function (item) { return item.value; });
    const topRows = data.topTopics.map(function (item) {
      return {
        title: item.title,
        platform: item.platform,
        category: item.category,
        read: item.readCount,
        heat: item.heatIndex,
        id: item.id
      };
    });
    container.innerHTML = UI.pageHead("工作台", "数据窗口：" + UI.today() + " 前30天 · 指标由当前导入数据实时计算", actions) +
      '<div class="grid grid-5">' +
      DashboardView.metric("近30天话题", metrics.topicCount, "条", "覆盖 " + metrics.categoryCount + " 个文创类目") +
      DashboardView.metric("商品记录", metrics.productCount, "条", "来自 " + metrics.batchCount + " 个导入批次") +
      DashboardView.metric("评论样本", metrics.commentCount, "条", "已完成清洗与掩码") +
      DashboardView.metric("待审核报告", metrics.pendingReports, "份", "任务执行中 " + metrics.runningTasks + " 个", "accent-amber") +
      DashboardView.metric("红海类目", metrics.redOceanCount, "个", "竞争惩罚达到阈值", "accent-red") +
      "</div>" +
      '<div class="grid grid-main" style="margin-top:16px">' +
      '<div class="stack">' +
      '<div class="card"><div class="card-head"><h3>近14天话题热度趋势</h3><span class="hint">按发布日衰减后归一化</span></div><div class="card-body">' +
      Charts.line({ labels: trendLabels, series: [{ name: "热度指数", values: trendValues, color: "#173a5e" }], max: 100, height: 220 }) +
      '</div></div>' +
      '<div class="card"><div class="card-head"><h3>热点话题 Top 8</h3><a href="#/topics">全部话题</a></div><div class="card-body tight">' +
      UI.table({
        columns: [
          { title: "话题", key: "title", render: function (row) { return '<span class="clickable" data-topic="' + row.id + '">' + UI.esc(row.title) + "</span>"; } },
          { title: "平台", key: "platform", width: "84px" },
          { title: "类目", key: "category", width: "104px" },
          { title: "阅读量", align: "right", render: function (row) { return UI.fmtInt(row.read); } },
          { title: "热度", align: "right", width: "78px", render: function (row) { return '<strong style="color:#0f766e">' + row.heat.toFixed(2) + "</strong>"; } }
        ],
        rows: topRows,
        empty: "当前时间窗口内没有话题数据"
      }) + "</div></div></div>" +
      '<div class="stack">' +
      '<div class="card"><div class="card-head"><h3>类目潜力 Top 5</h3><a href="#/selection">选品任务</a></div><div class="card-body">' +
      (data.topCategories.length ? data.topCategories.map(function (item) {
        return '<div style="margin-bottom:14px"><div class="row between"><span><strong>' + UI.esc(item.category) + "</strong> " +
          (item.redOcean ? '<span class="badge red">红海</span>' : '<span class="badge teal">可关注</span>') +
          '</span><span style="font-family:SimHei;color:#173a5e">' + item.potentialScore.toFixed(2) + "</span></div>" +
          '<div class="hbar' + (item.redOcean ? " red" : " teal") + '" style="margin-top:6px"><span class="track"><span class="fill" style="width:' +
          Math.max(2, item.potentialScore) + '%"></span></span></div>' +
          '<div style="color:#8a9aa2;font-size:11px;margin-top:3px">热度 ' + item.heatScore.toFixed(2) + " · 销量 " + item.salesScore.toFixed(2) +
          " · 竞争惩罚 " + item.competitionPenalty.toFixed(2) + "</div></div>";
      }).join("") : UI.empty("暂无类目结果", "请先导入商品数据")) + "</div></div>" +
      '<div class="card"><div class="card-head"><h3>最新选品报告</h3><a href="#/reports">报告列表</a></div><div class="card-body tight">' +
      UI.table({
        columns: [
          { title: "报告", key: "title", render: function (row) { return '<span class="clickable" data-report="' + row.id + '">' + UI.esc(row.title) + "</span>"; } },
          { title: "状态", width: "82px", render: function (row) { return UI.statusBadge(row.status); } }
        ],
        rows: data.latestReports,
        empty: "尚无选品报告"
      }) + "</div></div>" +
      '<div class="card"><div class="card-head"><h3>最近导入批次</h3><a href="#/import">导入中心</a></div><div class="card-body tight">' +
      UI.table({
        columns: [
          { title: "批次号", key: "batchNo", render: function (row) { return '<span class="mono">' + UI.esc(row.batchNo) + "</span>"; } },
          { title: "类型", key: "typeName", width: "88px" },
          { title: "成功/错误", align: "right", width: "100px", render: function (row) { return UI.fmtInt(row.importedRows) + " / " + UI.fmtInt(row.invalidRows); } }
        ],
        rows: data.recentBatches,
        empty: "尚无导入批次"
      }) + "</div></div></div></div>";
    container.querySelectorAll("[data-topic]").forEach(function (node) {
      node.addEventListener("click", function () { location.hash = "#/topics/" + node.getAttribute("data-topic"); });
    });
    container.querySelectorAll("[data-report]").forEach(function (node) {
      node.addEventListener("click", function () { location.hash = "#/reports/" + node.getAttribute("data-report"); });
    });
    container.querySelectorAll("[data-route]").forEach(function (node) {
      node.addEventListener("click", function () { location.hash = "#/" + node.getAttribute("data-route"); });
    });
  },
  metric: function (label, value, unit, foot, tone) {
    return '<div class="card metric ' + (tone || "") + '"><div class="metric-label"><span>' + UI.esc(label) + '</span><span>' + UI.esc(unit) + '</span></div>' +
      '<div class="metric-value">' + UI.fmtInt(value) + '</div><div class="metric-foot">' + UI.esc(foot) + "</div></div>";
  }
};
App.register("dashboard", DashboardView);

