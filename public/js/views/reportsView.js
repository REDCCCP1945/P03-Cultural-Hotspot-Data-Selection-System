const ReportsView = {
  render: async function (container) {
    const state = { page: 1, size: 10, total: 0 };
    container.innerHTML = UI.pageHead("选品报告", "报告绑定任务参数与数据批次，审核通过后提供下载", "") +
      '<div class="card"><div class="card-body">' +
      '<div class="filters"><div class="field"><label>状态</label><select class="select" id="r-status"><option value="">全部状态</option><option value="pending">待处理</option><option value="approved">已通过</option><option value="rejected">已驳回</option></select></div>' +
      '<div class="field grow"><label>报告名称或类目</label><input class="input" id="r-keyword" placeholder="输入关键词"></div>' +
      '<button class="btn primary" id="r-search">查询</button><button class="btn" id="r-reset">重置</button></div>' +
      '<div class="stat-strip" id="report-summary" style="margin-top:14px"></div>' +
      '<div id="report-list"></div><div id="report-pager"></div></div></div>';
    const list = container.querySelector("#report-list");
    const pager = container.querySelector("#report-pager");
    async function load() {
      const result = await API.get("/api/reports?page=" + state.page + "&size=" + state.size +
        "&status=" + encodeURIComponent(container.querySelector("#r-status").value) +
        "&keyword=" + encodeURIComponent(container.querySelector("#r-keyword").value.trim()));
      const data = result.data;
      state.total = data.total;
      container.querySelector("#report-summary").innerHTML = '<div class="stat-mini"><span>待处理</span><strong>' + data.summary.pending + '</strong></div>' +
        '<div class="stat-mini"><span>已通过</span><strong>' + data.summary.approved + '</strong></div>' +
        '<div class="stat-mini"><span>已驳回</span><strong>' + data.summary.rejected + '</strong></div>' +
        '<div class="stat-mini"><span>报告总数</span><strong>' + data.total + "</strong></div>";
      list.innerHTML = UI.table({
        columns: [
          { title: "报告名称", key: "title", render: function (row) { return '<span class="clickable" data-report="' + row.id + '">' + UI.esc(row.title) + "</span>"; } },
          { title: "类目", key: "category", width: "110px" },
          { title: "结论摘要", key: "summary", render: function (row) { return '<span class="wrap-text">' + UI.esc(row.summary) + "</span>"; } },
          { title: "状态", width: "84px", render: function (row) { return UI.statusBadge(row.status); } },
          { title: "审核人", key: "reviewer", width: "92px", render: function (row) { return UI.esc(row.reviewer || "-"); } },
          { title: "生成时间", width: "160px", render: function (row) { return UI.fmtDateTime(row.generatedAt); } },
          { title: "操作", width: "76px", render: function (row) { return '<button class="btn sm" data-report="' + row.id + '">查看</button>'; } }
        ],
        rows: data.rows,
        empty: "暂无报告"
      });
      pager.innerHTML = UI.pagination(state);
      UI.bindPagination(pager, state, load);
      list.querySelectorAll("[data-report]").forEach(function (node) {
        node.addEventListener("click", function () { location.hash = "#/reports/" + node.getAttribute("data-report"); });
      });
    }
    container.querySelector("#r-search").addEventListener("click", function () { state.page = 1; load(); });
    container.querySelector("#r-reset").addEventListener("click", function () {
      container.querySelector("#r-status").value = "";
      container.querySelector("#r-keyword").value = "";
      state.page = 1;
      load();
    });
    container.querySelector("#r-keyword").addEventListener("keydown", function (event) { if (event.key === "Enter") { state.page = 1; load(); } });
    await load();
  }
};
App.register("reports", ReportsView);

