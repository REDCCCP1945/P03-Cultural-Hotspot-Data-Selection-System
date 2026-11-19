const ImportView = {
  fileContent: "",
  fileName: "",
  render: async function (container) {
    const meta = (await API.get("/api/topics/meta")).data;
    ImportView.fileContent = "";
    ImportView.fileName = "";
    container.innerHTML = UI.pageHead("数据导入中心", "导入使用单位按合规途径取得的公开数据，登记来源与批次", '<button class="btn" id="batch-refresh">刷新批次</button>') +
      '<div class="tabs"><div class="tab active" data-tab="import">导入数据</div><div class="tab" data-tab="batches">批次记录</div><div class="tab" data-tab="dedup">去重统计</div></div>' +
      '<div id="tab-import">' +
      '<div class="grid grid-2">' +
      '<div class="card"><div class="card-head"><h3>导入配置</h3><span class="hint">CSV或JSON，首行为字段名</span></div><div class="card-body">' +
      '<form id="import-form"><div class="form-grid">' +
      '<div class="field"><label>数据类型<span class="req">*</span></label><select class="select" name="type"><option value="topic">热点话题</option><option value="product">电商商品</option><option value="comment">评论</option></select></div>' +
      '<div class="field"><label>来源类型<span class="req">*</span></label><select class="select" name="sourceType"><option value="">请选择</option>' + UI.optionList(meta.dictSourceTypes || []) + "</select></div>" +
      '<div class="field span-2"><label>数据来源名称<span class="req">*</span></label><input class="input" name="sourceName" placeholder="例如：社交平台文创话题公开数据（2026年11月）"></div>' +
      '<div class="field"><label>取得日期<span class="req">*</span></label><input class="input" type="date" name="acquiredDate" value="' + UI.today() + '"></div>' +
      '<div class="field"><label>模板下载</label><div class="row"><button class="btn sm" type="button" data-template="topic">话题模板</button><button class="btn sm" type="button" data-template="product">商品模板</button><button class="btn sm" type="button" data-template="comment">评论模板</button></div></div>' +
      '<div class="field span-2"><label>数据文件<span class="req">*</span></label><div class="upload-zone" id="upload-zone"><strong>点击选择文件，或将文件拖拽到此处</strong><span id="upload-name">支持 .csv / .json，UTF-8 编码</span><input type="file" id="import-file" accept=".csv,.json,text/csv,application/json" style="display:none"></div></div>' +
      '</div><div class="form-actions"><button class="btn" type="reset">重置</button><button class="btn primary" type="submit">开始导入</button></div></form>' +
      '</div></div>' +
      '<div class="card"><div class="card-head"><h3>字段要求</h3><span class="hint">导入前请核对列名</span></div><div class="card-body">' +
      '<table class="kv-table"><tbody>' +
      '<tr><td>话题</td><td>标题、平台、类目、阅读量、讨论量、转发量、发布日期；可选关键词、正文</td></tr>' +
      '<tr><td>商品</td><td>商品名称、平台、类目、价格、月销量、销售额、利润率、店铺、记录日期；销售额可由价格×月销量计算</td></tr>' +
      '<tr><td>评论</td><td>评论内容、类目、商品名称、评论日期；可选商品ID</td></tr>' +
      '<tr><td>日期格式</td><td>YYYY-MM-DD，不得晚于当前日期</td></tr>' +
      '<tr><td>数值约束</td><td>价格、销量、互动量为非负数字；利润率0到1</td></tr>' +
      '<tr><td>去重规则</td><td>同批次文本SimHash汉明距离≤3判为重复，保留首条</td></tr>' +
      '</tbody></table><div class="alert info" style="margin-top:12px">本软件不主动采集网络数据。请确认数据来源合法、已去除敏感个人信息后再导入；系统仍会对手机号、邮箱等执行掩码。</div>' +
      '</div></div></div>' +
      '<div id="import-result" style="margin-top:16px"></div></div>' +
      '<div id="tab-batches" hidden></div>' +
      '<div id="tab-dedup" hidden></div>';
    const form = container.querySelector("#import-form");
    const fileInput = container.querySelector("#import-file");
    const zone = container.querySelector("#upload-zone");
    const nameNode = container.querySelector("#upload-name");
    zone.addEventListener("click", function () { fileInput.click(); });
    zone.addEventListener("dragover", function (event) { event.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", function () { zone.classList.remove("dragover"); });
    zone.addEventListener("drop", async function (event) {
      event.preventDefault();
      zone.classList.remove("dragover");
      if (event.dataTransfer.files.length) {
        fileInput.files = event.dataTransfer.files;
        await ImportView.pickFile(fileInput, nameNode);
      }
    });
    fileInput.addEventListener("change", function () { ImportView.pickFile(fileInput, nameNode); });
    container.querySelectorAll("[data-template]").forEach(function (button) {
      button.addEventListener("click", function () { API.download("/api/import/template?type=" + button.getAttribute("data-template")); });
    });
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const data = UI.formData(form);
      if (!ImportView.fileContent) {
        UI.toast("请先选择数据文件", "warn");
        return;
      }
      const submit = form.querySelector("button[type=submit]");
      submit.disabled = true;
      submit.textContent = "正在导入";
      try {
        const result = await API.post("/api/import/execute", {
          type: data.type,
          sourceType: data.sourceType,
          sourceName: data.sourceName,
          acquiredDate: data.acquiredDate,
          fileName: ImportView.fileName,
          content: ImportView.fileContent
        });
        ImportView.renderResult(container.querySelector("#import-result"), result.data);
        UI.toast("导入完成：成功" + result.data.batch.importedRows + "条", "success");
        ImportView.bindBatches(container);
      } catch (error) {
        UI.toast(error.message, "error");
      } finally {
        submit.disabled = false;
        submit.textContent = "开始导入";
      }
    });
    container.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        container.querySelectorAll(".tab").forEach(function (item) { item.classList.remove("active"); });
        tab.classList.add("active");
        ["import", "batches", "dedup"].forEach(function (key) {
          container.querySelector("#tab-" + key).hidden = key !== tab.getAttribute("data-tab");
        });
        if (tab.getAttribute("data-tab") === "batches") ImportView.bindBatches(container);
        if (tab.getAttribute("data-tab") === "dedup") ImportView.bindDedup(container);
      });
    });
    ImportView.bindBatches(container);
  },
  pickFile: async function (input, nameNode) {
    if (!input.files.length) return;
    const file = input.files[0];
    if (file.size > 8 * 1024 * 1024) {
      UI.toast("文件不能超过8MB", "error");
      return;
    }
    ImportView.fileName = file.name;
    try {
      ImportView.fileContent = await UI.readFile(file);
      nameNode.textContent = file.name + " · " + (file.size / 1024).toFixed(1) + " KB · 已读取";
    } catch (error) {
      UI.toast(error.message, "error");
    }
  },
  renderResult: function (node, data) {
    const batch = data.batch;
    const errors = data.errors || [];
    node.innerHTML = '<div class="card"><div class="card-head"><h3>本次导入结果</h3><span class="hint">批次号 ' + UI.esc(batch.batchNo) + '</span></div><div class="card-body">' +
      '<div class="stat-strip"><div class="stat-mini"><span>数据行</span><strong>' + UI.fmtInt(batch.totalRows) + '</strong></div>' +
      '<div class="stat-mini"><span>成功入库</span><strong>' + UI.fmtInt(batch.importedRows) + '</strong></div>' +
      '<div class="stat-mini"><span>重复跳过</span><strong>' + UI.fmtInt(batch.duplicateRows) + '</strong></div>' +
      '<div class="stat-mini"><span>校验错误</span><strong>' + UI.fmtInt(batch.invalidRows) + '</strong></div></div>' +
      '<div class="row between"><span>状态：' + UI.statusBadge(batch.status) + '</span><div class="row">' +
      (batch.invalidRows ? '<button class="btn sm" id="download-errors">下载错误明细</button>' : "") +
      '<button class="btn sm" id="go-batches">查看批次记录</button></div></div>' +
      (errors.length ? '<div style="margin-top:14px">' + UI.table({
        columns: [
          { title: "行号", key: "row", width: "64px" },
          { title: "字段", key: "field", width: "150px" },
          { title: "原因", key: "message" }
        ],
        rows: errors.slice(0, 10),
        empty: "无错误"
      }) + "</div>" : "") +
      "</div></div>";
    const download = node.querySelector("#download-errors");
    if (download) download.addEventListener("click", function () { API.download("/api/import/batches/" + batch.id + "/errors"); });
    const go = node.querySelector("#go-batches");
    if (go) go.addEventListener("click", function () {
      const tab = document.querySelector('.tab[data-tab="batches"]');
      if (tab) tab.click();
    });
  },
  bindBatches: async function (container) {
    const target = container.querySelector("#tab-batches");
    if (!target) return;
    target.innerHTML = '<div class="card"><div class="card-head"><h3>批次记录</h3><span class="hint">按时间倒序</span></div><div class="card-body">' +
      '<div class="filters" style="margin-bottom:12px"><div class="field"><label>类型</label><select class="select" id="batch-type"><option value="">全部</option><option value="topic">热点话题</option><option value="product">电商商品</option><option value="comment">评论</option></select></div>' +
      '<div class="field"><label>状态</label><select class="select" id="batch-status"><option value="">全部</option><option value="completed">已完成</option><option value="failed">失败</option></select></div>' +
      '<div class="field grow"><label>关键词</label><input class="input" id="batch-keyword" placeholder="批次号、来源或文件名"></div>' +
      '<button class="btn primary" id="batch-search">查询</button></div><div id="batch-list"></div><div id="batch-pager"></div></div></div>';
    const state = { page: 1, size: 10, total: 0 };
    const list = target.querySelector("#batch-list");
    const pager = target.querySelector("#batch-pager");
    async function load() {
      const type = target.querySelector("#batch-type").value;
      const status = target.querySelector("#batch-status").value;
      const keyword = target.querySelector("#batch-keyword").value.trim();
      const result = await API.get("/api/import/batches?page=" + state.page + "&size=" + state.size + "&type=" + encodeURIComponent(type) + "&status=" + encodeURIComponent(status) + "&keyword=" + encodeURIComponent(keyword));
      state.total = result.data.total;
      list.innerHTML = UI.table({
        columns: [
          { title: "批次号", key: "batchNo", render: function (row) { return '<span class="mono">' + UI.esc(row.batchNo) + "</span>"; } },
          { title: "类型", key: "typeName", width: "84px" },
          { title: "来源", key: "sourceName", render: function (row) { return '<div class="ellipsis" style="max-width:250px">' + UI.esc(row.sourceName) + "</div>"; } },
          { title: "取得日期", key: "acquiredDate", width: "100px" },
          { title: "总行/成功/错误", align: "right", width: "130px", render: function (row) { return row.totalRows + " / " + row.importedRows + " / " + row.invalidRows; } },
          { title: "状态", width: "76px", render: function (row) { return UI.statusBadge(row.status); } },
          { title: "操作", width: "76px", render: function (row) { return '<button class="btn sm" data-batch="' + row.id + '">详情</button>'; } }
        ],
        rows: result.data.rows,
        empty: "暂无批次记录"
      });
      pager.innerHTML = UI.pagination(state);
      UI.bindPagination(pager, state, load);
      list.querySelectorAll("[data-batch]").forEach(function (button) {
        button.addEventListener("click", function () { ImportView.batchDetail(button.getAttribute("data-batch")); });
      });
    }
    target.querySelector("#batch-search").addEventListener("click", function () { state.page = 1; load(); });
    await load();
  },
  batchDetail: async function (id) {
    const result = await API.get("/api/import/batches/" + id);
    const batch = result.data.batch;
    const errors = result.data.errors || [];
    UI.modal({
      title: "批次详情 " + batch.batchNo,
      size: "wide",
      body: '<table class="kv-table"><tbody>' +
        '<tr><td>数据类型</td><td>' + UI.esc(batch.typeName) + '</td><td>状态</td><td>' + UI.statusBadge(batch.status) + "</td></tr>" +
        '<tr><td>来源名称</td><td colspan="3">' + UI.esc(batch.sourceName) + "</td></tr>" +
        '<tr><td>来源类型</td><td>' + UI.esc(batch.sourceType) + '</td><td>取得日期</td><td>' + UI.esc(batch.acquiredDate) + "</td></tr>" +
        '<tr><td>文件名</td><td>' + UI.esc(batch.fileName) + '</td><td>导入人</td><td>' + UI.esc(batch.createdByName) + "</td></tr>" +
        '<tr><td>数据行</td><td>' + batch.totalRows + '</td><td>成功/重复/错误</td><td>' + batch.importedRows + " / " + batch.duplicateRows + " / " + batch.invalidRows + "</td></tr>" +
        '<tr><td>导入时间</td><td colspan="3">' + UI.fmtDateTime(batch.createdAt) + "</td></tr></tbody></table>" +
        '<h3 style="margin:16px 0 8px;font-size:13.5px">错误明细</h3>' +
        UI.table({
          columns: [
            { title: "行号", key: "row", width: "64px" },
            { title: "字段", key: "field", width: "140px" },
            { title: "原始值", key: "value", width: "140px" },
            { title: "原因", key: "message" }
          ],
          rows: errors,
          empty: "该批次没有错误行"
        }),
      buttons: errors.length ? [{ text: "下载错误明细", onClick: function (api) { API.download("/api/import/batches/" + batch.id + "/errors"); } }] : []
    });
  },
  bindDedup: async function (container) {
    const target = container.querySelector("#tab-dedup");
    if (!target) return;
    const result = await API.get("/api/cleaning/dedup");
    const data = result.data;
    target.innerHTML = '<div class="card"><div class="card-head"><h3>去重统计</h3><span class="hint">累计跳过重复 ' + UI.fmtInt(data.totalDuplicate) + ' 条</span></div><div class="card-body">' +
      UI.table({
        columns: [
          { title: "批次号", key: "batchNo", render: function (row) { return '<span class="mono">' + UI.esc(row.batchNo) + "</span>"; } },
          { title: "类型", key: "typeName", width: "86px" },
          { title: "来源", key: "sourceName", render: function (row) { return '<div class="ellipsis">' + UI.esc(row.sourceName) + "</div>"; } },
          { title: "总行", align: "right", width: "74px", render: function (row) { return UI.fmtInt(row.totalRows); } },
          { title: "重复", align: "right", width: "74px", render: function (row) { return UI.fmtInt(row.duplicateRows); } },
          { title: "重复率", align: "right", width: "86px", render: function (row) { return row.duplicateRatio.toFixed(2) + "%"; } },
          { title: "时间", width: "160px", render: function (row) { return UI.fmtDateTime(row.createdAt); } }
        ],
        rows: data.rows,
        empty: "暂无去重记录"
      }) + "</div></div>";
  }
};
App.register("import", ImportView);

