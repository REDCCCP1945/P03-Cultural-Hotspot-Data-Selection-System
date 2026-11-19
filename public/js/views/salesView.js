const SalesView = {
  selected: [],
  render: async function (container) {
    const meta = (await API.get("/api/topics/meta")).data;
    SalesView.selected = [];
    const state = { page: 1, size: 10, total: 0 };
    container.innerHTML = UI.pageHead("电商数据大厅", "按类目聚合销量与价格分布，识别头部集中度与竞争饱和", '<button class="btn" id="sales-export">导出当前页</button>') +
      '<div class="card"><div class="card-body">' +
      '<div class="filters"><div class="field"><label>类目</label><select class="select" id="s-category"><option value="">全部类目</option>' + UI.optionList(meta.categories) + "</select></div>" +
      '<div class="field"><label>平台</label><select class="select" id="s-platform"><option value="">全部平台</option>' + UI.optionList(meta.dictPlatforms) + "</select></div>" +
      '<div class="field"><label>最低价</label><input class="input" type="number" id="s-min" placeholder="0"></div>' +
      '<div class="field"><label>最高价</label><input class="input" type="number" id="s-max" placeholder="不限"></div>' +
      '<div class="field grow"><label>商品或店铺</label><input class="input" id="s-keyword" placeholder="名称关键词"></div>' +
      '<div class="field"><label>排序</label><select class="select" id="s-sort"><option value="sales">月销量</option><option value="revenue">销售额</option><option value="price">价格</option><option value="margin">利润率</option></select></div>' +
      '<button class="btn primary" id="s-search">查询</button><button class="btn" id="s-reset">重置</button></div>' +
      '<div class="stat-strip" id="sales-summary" style="margin-top:14px"></div>' +
      '<div class="row between" style="margin-bottom:10px"><span style="color:#5d7079;font-size:12px">勾选2到4个商品可进行并列对比</span><button class="btn sm" id="compare-btn" disabled>竞品对比</button></div>' +
      '<div id="sales-list"></div><div id="sales-pager"></div></div></div>' +
      '<div class="grid grid-2" style="margin-top:16px">' +
      '<div class="card"><div class="card-head"><h3>价格区间分布</h3><span class="hint">当前筛选结果</span></div><div class="card-body" id="price-chart">' + UI.empty("正在加载", "") + "</div></div>" +
      '<div class="card"><div class="card-head"><h3>类目竞争聚合</h3><span class="hint">TOP10份额与饱和度合成惩罚</span></div><div class="card-body tight" id="category-stats">' + UI.empty("正在加载", "") + "</div></div></div>";
    const list = container.querySelector("#sales-list");
    const pager = container.querySelector("#sales-pager");
    const summary = container.querySelector("#sales-summary");
    const compareButton = container.querySelector("#compare-btn");
    function queryParams(withPage) {
      const params = new URLSearchParams();
      params.set("category", container.querySelector("#s-category").value);
      params.set("platform", container.querySelector("#s-platform").value);
      params.set("priceMin", container.querySelector("#s-min").value);
      params.set("priceMax", container.querySelector("#s-max").value);
      params.set("keyword", container.querySelector("#s-keyword").value.trim());
      params.set("sort", container.querySelector("#s-sort").value);
      if (withPage) {
        params.set("page", state.page);
        params.set("size", state.size);
      }
      return params;
    }
    async function load() {
      const result = await API.get("/api/sales/products?" + queryParams(true).toString());
      const data = result.data;
      state.total = data.total;
      summary.innerHTML = '<div class="stat-mini"><span>商品数</span><strong>' + UI.fmtInt(data.summary.itemCount) + '</strong></div>' +
        '<div class="stat-mini"><span>月销量合计</span><strong>' + UI.fmtInt(data.summary.salesTotal) + '</strong></div>' +
        '<div class="stat-mini"><span>销售额合计</span><strong>' + UI.fmtMoney(data.summary.revenueTotal) + '</strong></div>' +
        '<div class="stat-mini"><span>平均利润率</span><strong>' + (data.summary.avgMargin * 100).toFixed(1) + "%</strong></div>";
      list.innerHTML = UI.table({
        columns: [
          { title: "", width: "38px", render: function (row) { return '<input type="checkbox" class="row-check" data-id="' + row.id + '">'; } },
          { title: "商品名称", key: "name", render: function (row) { return '<span class="clickable" data-detail="' + row.id + '">' + UI.esc(row.name) + "</span>"; } },
          { title: "类目", key: "category", width: "96px" },
          { title: "平台", key: "platform", width: "72px" },
          { title: "店铺", key: "shopName", render: function (row) { return '<div class="ellipsis" style="max-width:180px">' + UI.esc(row.shopName) + "</div>"; } },
          { title: "价格", align: "right", width: "82px", render: function (row) { return "¥" + row.price.toFixed(1); } },
          { title: "月销量", align: "right", width: "82px", render: function (row) { return UI.fmtInt(row.monthlySales); } },
          { title: "销售额", align: "right", width: "96px", render: function (row) { return UI.fmtMoney(row.revenue); } },
          { title: "利润率", align: "right", width: "76px", render: function (row) { return (row.profitMargin * 100).toFixed(1) + "%"; } },
          { title: "记录日期", key: "recordDate", width: "100px" }
        ],
        rows: data.rows,
        empty: "没有符合条件的商品"
      });
      pager.innerHTML = UI.pagination(state);
      UI.bindPagination(pager, state, load);
      list.querySelectorAll("[data-detail]").forEach(function (node) {
        node.addEventListener("click", function () { SalesView.detail(node.getAttribute("data-detail")); });
      });
      list.querySelectorAll(".row-check").forEach(function (checkbox) {
        checkbox.addEventListener("change", function () {
          if (checkbox.checked) {
            if (SalesView.selected.length >= 4) {
              checkbox.checked = false;
              UI.toast("最多选择4个商品", "warn");
              return;
            }
            SalesView.selected.push(checkbox.getAttribute("data-id"));
          } else {
            SalesView.selected = SalesView.selected.filter(function (id) { return id !== checkbox.getAttribute("data-id"); });
          }
          compareButton.disabled = SalesView.selected.length < 2;
          compareButton.textContent = "竞品对比（" + SalesView.selected.length + "）";
        });
      });
      const histogram = await API.get("/api/sales/histogram?" + queryParams(false).toString());
      const histogramRows = histogram.data.rows;
      container.querySelector("#price-chart").innerHTML = Charts.bar({
        labels: histogramRows.map(function (item) { return item.label; }),
        values: histogramRows.map(function (item) { return item.count; }),
        color: "#3d7ea6",
        height: 250
      }) + '<div class="legend"><span>柱高为商品数量，区间销售额见类目聚合表</span></div>';
      const categories = await API.get("/api/sales/categories?" + queryParams(false).toString());
      container.querySelector("#category-stats").innerHTML = UI.table({
        columns: [
          { title: "类目", key: "category" },
          { title: "商品数", align: "right", width: "70px", render: function (row) { return row.itemCount; } },
          { title: "店铺数", align: "right", width: "70px", render: function (row) { return row.sellerCount; } },
          { title: "TOP10份额", align: "right", width: "92px", render: function (row) { return (row.top10Share * 100).toFixed(1) + "%"; } },
          { title: "饱和度", align: "right", width: "78px", render: function (row) { return row.saturation.toFixed(1) + "%"; } },
          { title: "惩罚", align: "right", width: "70px", render: function (row) { return '<strong style="color:' + (row.penalty >= 85 ? "#b42318" : "#173a5e") + '">' + row.penalty.toFixed(2) + "</strong>"; } },
          { title: "状态", width: "68px", render: function (row) { return row.penalty >= 85 ? '<span class="badge red">红海</span>' : '<span class="badge gray">观察</span>'; } }
        ],
        rows: categories.data.rows,
        empty: "暂无类目数据"
      });
    }
    container.querySelector("#s-search").addEventListener("click", function () { state.page = 1; load(); });
    container.querySelector("#s-keyword").addEventListener("keydown", function (event) { if (event.key === "Enter") { state.page = 1; load(); } });
    container.querySelector("#s-reset").addEventListener("click", function () {
      ["s-category", "s-platform", "s-min", "s-max", "s-keyword"].forEach(function (id) { container.querySelector("#" + id).value = ""; });
      container.querySelector("#s-sort").value = "sales";
      state.page = 1;
      load();
    });
    compareButton.addEventListener("click", function () { SalesView.compare(SalesView.selected); });
    container.querySelector("#sales-export").addEventListener("click", function () {
      const rows = list.querySelectorAll("table tbody tr");
      if (!rows.length) { UI.toast("没有可导出的数据", "warn"); return; }
      const lines = ["商品名称,类目,平台,店铺,价格,月销量,销售额,利润率,记录日期"];
      rows.forEach(function (row) {
        const cells = Array.prototype.slice.call(row.querySelectorAll("td")).slice(1);
        lines.push(cells.map(function (cell) { return '"' + cell.innerText.replace(/"/g, '""') + '"'; }).join(","));
      });
      UI.downloadText("电商商品_" + UI.today() + ".csv", "\ufeff" + lines.join("\r\n"), "text/csv;charset=utf-8");
    });
    await load();
  },
  detail: async function (id) {
    const result = await API.get("/api/sales/products/" + id);
    const data = result.data;
    const product = data.product;
    UI.modal({
      title: product.name,
      size: "wide",
      body: '<table class="kv-table"><tbody>' +
        '<tr><td>类目 / 平台</td><td>' + UI.esc(product.category) + " / " + UI.esc(product.platform) + "</td><td>店铺</td><td>" + UI.esc(product.shopName) + "</td></tr>" +
        '<tr><td>价格</td><td>¥' + product.price.toFixed(2) + "</td><td>月销量</td><td>" + UI.fmtInt(product.monthlySales) + "</td></tr>" +
        '<tr><td>销售额</td><td>¥' + UI.fmtNumber(product.revenue) + "</td><td>利润率</td><td>" + (product.profitMargin * 100).toFixed(1) + "%</td></tr>" +
        '<tr><td>记录日期</td><td>' + UI.esc(product.recordDate) + "</td><td>批次号</td><td class=\"mono\">" + UI.esc(product.batchId) + "</td></tr></tbody></table>" +
        (data.categoryStats ? '<div class="alert info" style="margin-top:12px">同类目商品 ' + data.categoryStats.itemCount + " 个，店铺 " + data.categoryStats.sellerCount +
          " 家，TOP10份额 " + (data.categoryStats.top10Share * 100).toFixed(1) + "%，竞争惩罚 " + data.categoryStats.penalty.toFixed(2) + "。</div>" : "") +
        '<h3 style="margin:16px 0 8px;font-size:13.5px">关联评论</h3>' +
        UI.table({
          columns: [
            { title: "评论", key: "text" },
            { title: "极性", width: "76px", render: function (row) { return row.polarity === "positive" ? '<span class="badge green">正向</span>' : row.polarity === "negative" ? '<span class="badge red">负向</span>' : '<span class="badge gray">中立</span>'; } },
            { title: "日期", width: "100px", render: function (row) { return UI.esc(row.commentDate); } }
          ],
          rows: data.comments,
          empty: "该商品暂无关联评论"
        })
    });
  },
  compare: async function (ids) {
    const result = await API.get("/api/sales/compare?ids=" + encodeURIComponent(ids.join(",")));
    const rows = result.data.rows;
    UI.modal({
      title: "竞品对比",
      size: "wide",
      body: '<div class="table-wrap"><table class="data"><thead><tr><th>指标</th>' + rows.map(function (row) { return "<th>" + UI.esc(row.name) + "</th>"; }).join("") + "</tr></thead><tbody>" +
        '<tr><td>类目</td>' + rows.map(function (row) { return "<td>" + UI.esc(row.category) + "</td>"; }).join("") + "</tr>" +
        '<tr><td>平台</td>' + rows.map(function (row) { return "<td>" + UI.esc(row.platform) + "</td>"; }).join("") + "</tr>" +
        '<tr><td>店铺</td>' + rows.map(function (row) { return "<td>" + UI.esc(row.shopName) + "</td>"; }).join("") + "</tr>" +
        '<tr><td>价格</td>' + rows.map(function (row) { return "<td>¥" + row.price.toFixed(2) + "</td>"; }).join("") + "</tr>" +
        '<tr><td>月销量</td>' + rows.map(function (row) { return "<td>" + UI.fmtInt(row.monthlySales) + "</td>"; }).join("") + "</tr>" +
        '<tr><td>销售额</td>' + rows.map(function (row) { return "<td>¥" + UI.fmtNumber(row.revenue) + "</td>"; }).join("") + "</tr>" +
        '<tr><td>利润率</td>' + rows.map(function (row) { return "<td>" + (row.profitMargin * 100).toFixed(1) + "%</td>"; }).join("") + "</tr>" +
        "</tbody></table></div>"
    });
  }
};
App.register("sales", SalesView);

