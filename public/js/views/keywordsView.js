const KeywordsView = {
  render: async function (container) {
    const meta = (await API.get("/api/topics/meta")).data;
    container.innerHTML = UI.pageHead("关键词库", "关键词参与导入文本分词与词云统计，停用后不再参与", '<button class="btn primary" id="kw-add">新增关键词</button>') +
      '<div class="card"><div class="card-body">' +
      '<div class="filters"><div class="field grow"><label>关键词</label><input class="input" id="kw-search" placeholder="输入关键词"></div>' +
      '<div class="field"><label>类目</label><select class="select" id="kw-category"><option value="">全部类目</option>' + UI.optionList(meta.categories) + "</select></div>" +
      '<div class="field"><label>状态</label><select class="select" id="kw-enabled"><option value="">全部</option><option value="true">启用</option><option value="false">停用</option></select></div>' +
      '<button class="btn" id="kw-query">查询</button></div>' +
      '<div id="kw-list" style="margin-top:12px"></div></div></div>';
    const list = container.querySelector("#kw-list");
    async function load() {
      const params = new URLSearchParams();
      params.set("keyword", container.querySelector("#kw-search").value.trim());
      params.set("category", container.querySelector("#kw-category").value);
      params.set("enabled", container.querySelector("#kw-enabled").value);
      const result = await API.get("/api/keywords?" + params.toString());
      const rows = result.data.rows;
      list.innerHTML = UI.table({
        columns: [
          { title: "关键词", key: "word", render: function (row) { return "<strong>" + UI.esc(row.word) + "</strong>"; } },
          { title: "类目", key: "category", width: "120px" },
          { title: "权重", key: "weight", width: "72px", align: "right", render: function (row) { return row.weight.toFixed(2); } },
          { title: "状态", width: "76px", render: function (row) { return UI.statusBadge(row.enabled ? "active" : "disabled"); } },
          { title: "创建时间", width: "160px", render: function (row) { return UI.fmtDateTime(row.createdAt); } },
          { title: "操作", width: "190px", render: function (row) {
            return '<button class="btn sm" data-edit="' + row.id + '">编辑</button> ' +
              '<button class="btn sm" data-toggle="' + row.id + '">' + (row.enabled ? "停用" : "启用") + "</button> " +
              '<button class="btn sm danger" data-remove="' + row.id + '">删除</button>';
          } }
        ],
        rows: rows,
        empty: "暂无关键词"
      });
      list.querySelectorAll("[data-edit]").forEach(function (button) {
        button.addEventListener("click", function () {
          const row = rows.find(function (item) { return item.id === button.getAttribute("data-edit"); });
          KeywordsView.form(meta, row, load);
        });
      });
      list.querySelectorAll("[data-toggle]").forEach(function (button) {
        button.addEventListener("click", async function () {
          try {
            await API.post("/api/keywords/" + button.getAttribute("data-toggle") + "/toggle", {});
            UI.toast("状态已更新", "success");
            load();
          } catch (error) { UI.toast(error.message, "error"); }
        });
      });
      list.querySelectorAll("[data-remove]").forEach(function (button) {
        button.addEventListener("click", async function () {
          const ok = await UI.confirm({ title: "删除关键词", message: "删除后该词不再参与分词与词云统计，是否继续？", danger: true, okText: "删除" });
          if (!ok) return;
          try {
            await API.del("/api/keywords/" + button.getAttribute("data-remove"));
            UI.toast("已删除", "success");
            load();
          } catch (error) { UI.toast(error.message, "error"); }
        });
      });
    }
    container.querySelector("#kw-query").addEventListener("click", load);
    container.querySelector("#kw-add").addEventListener("click", function () { KeywordsView.form(meta, null, load); });
    container.querySelector("#kw-search").addEventListener("keydown", function (event) { if (event.key === "Enter") load(); });
    await load();
  },
  form: function (meta, row, onSaved) {
    const isEdit = !!row;
    UI.modal({
      title: isEdit ? "编辑关键词" : "新增关键词",
      size: "narrow",
      body: '<form id="kw-form"><div class="field"><label>关键词<span class="req">*</span></label><input class="input" name="word" value="' + UI.esc(row ? row.word : "") + '" placeholder="2到20个字符"></div>' +
        '<div class="field" style="margin-top:12px"><label>所属类目<span class="req">*</span></label><select class="select" name="category">' + UI.optionList(meta.categories, row ? row.category : "") + "</select></div>" +
        '<div class="field" style="margin-top:12px"><label>权重<span class="req">*</span></label><input class="input" name="weight" type="number" step="0.1" min="0.1" max="10" value="' + (row ? row.weight : 1) + '"><span class="field-hint">0.1到10，权重越高在热词排序中越靠前</span></div></form>',
      buttons: [
        { text: "取消", onClick: function (api) { api.close(); } },
        { text: "保存", className: "primary", onClick: async function (api) {
          const form = api.find("#kw-form");
          try {
            const data = UI.formData(form);
            if (isEdit) await API.put("/api/keywords/" + row.id, data);
            else await API.post("/api/keywords", data);
            api.close();
            UI.toast("已保存", "success");
            onSaved();
          } catch (error) { UI.showError(form, error); }
        } }
      ]
    });
  }
};
App.register("keywords", KeywordsView);

