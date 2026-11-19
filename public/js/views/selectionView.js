const SelectionView = {
  render: async function (container) {
    const canCreate = App.user.role !== "OPERATOR";
    const state = { page: 1, size: 10, total: 0, status: "", keyword: "" };
    container.innerHTML = UI.pageHead("选品任务", "按类目与时间窗口计算热度、销量与竞争惩罚，输出综合潜力排名",
      canCreate ? '<button class="btn primary" data-route="selection/new">新建选品任务</button>' : "") +
      '<div class="card"><div class="card-body">' +
      '<div class="filters"><div class="field"><label>状态</label><select class="select" id="t-status"><option value="">全部状态</option><option value="queued">排队中</option><option value="running">执行中</option><option value="completed">已完成</option><option value="failed">失败</option></select></div>' +
      '<div class="field grow"><label>任务名称或类目</label><input class="input" id="t-keyword" placeholder="输入关键词"></div>' +
      '<button class="btn primary" id="t-search">查询</button><button class="btn" id="t-reset">重置</button></div>' +
      '<div class="stat-strip" id="task-summary" style="margin-top:14px"></div>' +
      '<div id="task-list"></div><div id="task-pager"></div></div></div>';
    const list = container.querySelector("#task-list");
    const pager = container.querySelector("#task-pager");
    const summary = container.querySelector("#task-summary");
    async function load() {
      const result = await API.get("/api/selection/tasks?page=" + state.page + "&size=" + state.size +
        "&status=" + encodeURIComponent(container.querySelector("#t-status").value) +
        "&keyword=" + encodeURIComponent(container.querySelector("#t-keyword").value.trim()));
      const data = result.data;
      state.total = data.total;
      summary.innerHTML = '<div class="stat-mini"><span>排队中</span><strong>' + data.summary.queued + '</strong></div>' +
        '<div class="stat-mini"><span>执行中</span><strong>' + data.summary.running + '</strong></div>' +
        '<div class="stat-mini"><span>已完成</span><strong>' + data.summary.completed + '</strong></div>' +
        '<div class="stat-mini"><span>失败</span><strong>' + data.summary.failed + "</strong></div>";
      list.innerHTML = UI.table({
        columns: [
          { title: "任务名称", key: "name", render: function (row) { return '<span class="clickable" data-task="' + row.id + '">' + UI.esc(row.name) + "</span>"; } },
          { title: "类目", key: "category", width: "108px" },
          { title: "时间窗口", width: "190px", render: function (row) { return row.dateFrom + " 至 " + row.dateTo; } },
          { title: "权重 α/β/γ", width: "136px", render: function (row) { return row.alpha + " / " + row.beta + " / " + row.gamma; } },
          { title: "状态", width: "86px", render: function (row) { return UI.statusBadge(row.status); } },
          { title: "进度", width: "120px", render: function (row) { return '<div class="progress"><i style="width:' + row.progress + '%"></i></div><span style="font-size:10.5px;color:#8a9aa2">' + row.progress + "%</span>"; } },
          { title: "创建人", key: "createdByName", width: "92px" },
          { title: "创建时间", width: "160px", render: function (row) { return UI.fmtDateTime(row.createdAt); } },
          { title: "操作", width: "76px", render: function (row) { return '<button class="btn sm" data-task="' + row.id + '">查看</button>'; } }
        ],
        rows: data.rows,
        empty: "暂无选品任务"
      });
      pager.innerHTML = UI.pagination(state);
      UI.bindPagination(pager, state, load);
      list.querySelectorAll("[data-task]").forEach(function (node) {
        node.addEventListener("click", function () { location.hash = "#/selection/" + node.getAttribute("data-task"); });
      });
    }
    container.querySelector("#t-search").addEventListener("click", function () { state.page = 1; load(); });
    container.querySelector("#t-reset").addEventListener("click", function () {
      container.querySelector("#t-status").value = "";
      container.querySelector("#t-keyword").value = "";
      state.page = 1;
      load();
    });
    container.querySelector("#t-keyword").addEventListener("keydown", function (event) { if (event.key === "Enter") { state.page = 1; load(); } });
    container.querySelectorAll("[data-route]").forEach(function (node) {
      node.addEventListener("click", function () { location.hash = "#/" + node.getAttribute("data-route"); });
    });
    await load();
  }
};
App.register("selection", SelectionView);

