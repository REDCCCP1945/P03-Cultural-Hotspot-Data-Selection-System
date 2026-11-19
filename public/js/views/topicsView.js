const TopicsView = {
  render: async function (container) {
    const meta = (await API.get("/api/topics/meta")).data;
    const state = { page: 1, size: 12, total: 0, windowDays: 30, platform: "", category: "", keyword: "", sort: "heat" };
    container.innerHTML = UI.pageHead("热点监测", "按时间窗口计算热度指数，衰减后的排序反映近期关注度", '<button class="btn" id="topic-export">导出当前页</button>') +
      '<div class="card"><div class="card-body">' +
      '<div class="filters"><div class="field"><label>时间窗口</label><select class="select" id="f-window"><option value="7">近7天</option><option value="14">近14天</option><option value="30" selected>近30天</option><option value="custom">自定义</option></select></div>' +
      '<div class="field" id="date-from-wrap" hidden><label>开始日期</label><input class="input" type="date" id="f-from"></div>' +
      '<div class="field" id="date-to-wrap" hidden><label>结束日期</label><input class="input" type="date" id="f-to" value="' + UI.today() + '"></div>' +
      '<div class="field"><label>平台</label><select class="select" id="f-platform"><option value="">全部平台</option>' + UI.optionList(meta.platforms) + "</select></div>" +
      '<div class="field"><label>类目</label><select class="select" id="f-category"><option value="">全部类目</option>' + UI.optionList(meta.categories) + "</select></div>" +
      '<div class="field grow"><label>关键词</label><input class="input" id="f-keyword" placeholder="标题、关键词或正文"></div>' +
      '<div class="field"><label>排序</label><select class="select" id="f-sort"><option value="heat">热度指数</option><option value="read">阅读量</option><option value="discuss">讨论量</option><option value="publishDate">发布日期</option></select></div>' +
      '<button class="btn primary" id="f-search">查询</button><button class="btn" id="f-reset">重置</button></div>' +
      '<div class="stat-strip" id="topic-summary" style="margin-top:14px"></div>' +
      '<div id="topic-list"></div><div id="topic-pager"></div>' +
      "</div></div>";
    const list = container.querySelector("#topic-list");
    const pager = container.querySelector("#topic-pager");
    const summary = container.querySelector("#topic-summary");
    const windowSelect = container.querySelector("#f-window");
    windowSelect.addEventListener("change", function () {
      const custom = windowSelect.value === "custom";
      container.querySelector("#date-from-wrap").hidden = !custom;
      container.querySelector("#date-to-wrap").hidden = !custom;
    });
    container.querySelector("#f-reset").addEventListener("click", function () {
      windowSelect.value = "30";
      container.querySelector("#date-from-wrap").hidden = true;
      container.querySelector("#date-to-wrap").hidden = true;
      ["f-platform", "f-category", "f-keyword"].forEach(function (id) { container.querySelector("#" + id).value = ""; });
      container.querySelector("#f-sort").value = "heat";
      state.page = 1;
      load();
    });
    container.querySelector("#f-search").addEventListener("click", function () { state.page = 1; load(); });
    container.querySelector("#f-keyword").addEventListener("keydown", function (event) {
      if (event.key === "Enter") { state.page = 1; load(); }
    });
    async function load() {
      const params = new URLSearchParams();
      params.set("page", state.page);
      params.set("size", state.size);
      params.set("platform", container.querySelector("#f-platform").value);
      params.set("category", container.querySelector("#f-category").value);
      params.set("keyword", container.querySelector("#f-keyword").value.trim());
      params.set("sort", container.querySelector("#f-sort").value);
      const windowValue = windowSelect.value;
      if (windowValue === "custom") {
        params.set("dateFrom", container.querySelector("#f-from").value);
        params.set("dateTo", container.querySelector("#f-to").value);
      } else {
        params.set("windowDays", windowValue);
      }
      const result = await API.get("/api/topics?" + params.toString());
      const data = result.data;
      state.total = data.total;
      summary.innerHTML = '<div class="stat-mini"><span>话题数</span><strong>' + UI.fmtInt(data.summary.topicCount) + '</strong></div>' +
        '<div class="stat-mini"><span>阅读量合计</span><strong>' + UI.fmtInt(data.summary.readTotal) + '</strong></div>' +
        '<div class="stat-mini"><span>讨论量合计</span><strong>' + UI.fmtInt(data.summary.discussTotal) + '</strong></div>' +
        '<div class="stat-mini"><span>转发量合计</span><strong>' + UI.fmtInt(data.summary.shareTotal) + "</strong></div>";
      list.innerHTML = UI.table({
        columns: [
          { title: "热度", width: "74px", align: "right", render: function (row) { return '<strong style="color:#0f766e">' + row.heatIndex.toFixed(2) + "</strong>"; } },
          { title: "话题", key: "title", render: function (row) { return '<span class="clickable" data-id="' + row.id + '">' + UI.esc(row.title) + "</span>"; } },
          { title: "平台", key: "platform", width: "84px" },
          { title: "类目", key: "category", width: "100px" },
          { title: "阅读量", align: "right", width: "96px", render: function (row) { return UI.fmtInt(row.readCount); } },
          { title: "讨论量", align: "right", width: "84px", render: function (row) { return UI.fmtInt(row.discussCount); } },
          { title: "转发量", align: "right", width: "84px", render: function (row) { return UI.fmtInt(row.shareCount); } },
          { title: "发布日期", key: "publishDate", width: "104px" }
        ],
        rows: data.rows,
        empty: "当前筛选条件下没有话题"
      });
      pager.innerHTML = UI.pagination(state);
      UI.bindPagination(pager, state, load);
      list.querySelectorAll("[data-id]").forEach(function (node) {
        node.addEventListener("click", function () { location.hash = "#/topics/" + node.getAttribute("data-id"); });
      });
    }
    container.querySelector("#topic-export").addEventListener("click", function () {
      const rows = list.querySelectorAll("table tbody tr");
      if (!rows.length) { UI.toast("没有可导出的数据", "warn"); return; }
      const lines = ["话题,平台,类目,热度指数,阅读量,讨论量,转发量,发布日期"];
      rows.forEach(function (row) {
        const cells = Array.prototype.map.call(row.querySelectorAll("td"), function (cell) { return '"' + cell.innerText.replace(/"/g, '""') + '"'; });
        lines.push(cells.join(","));
      });
      UI.downloadText("热点话题_" + UI.today() + ".csv", "\ufeff" + lines.join("\r\n"), "text/csv;charset=utf-8");
    });
    await load();
  }
};
App.register("topics", TopicsView);

