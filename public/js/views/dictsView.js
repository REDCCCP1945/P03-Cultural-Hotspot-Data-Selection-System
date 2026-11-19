const DictsView = {
  types: [["categories", "文创类目"], ["platforms", "平台来源"], ["sourceTypes", "来源类型"]],
  render: async function (container) {
    container.innerHTML = UI.pageHead("数据字典", "维护类目、平台与来源类型；被业务数据引用的字典项不能删除", '<button class="btn primary" id="dict-add">新增字典项</button>') +
      '<div class="card"><div class="card-body">' +
      '<div class="tabs" id="dict-tabs">' + DictsView.types.map(function (item, index) {
        return '<div class="tab' + (index === 0 ? " active" : "") + '" data-type="' + item[0] + '">' + item[1] + "</div>";
      }).join("") + "</div>" +
      '<div id="dict-list"></div></div></div>';
    let currentType = "categories";
    const list = container.querySelector("#dict-list");
    async function load() {
      const result = await API.get("/api/dicts/" + currentType);
      const rows = result.data.rows;
      list.innerHTML = UI.table({
        columns: [
          { title: "名称", key: "name" },
          { title: "编码", key: "code", width: "150px", render: function (row) { return '<span class="mono">' + UI.esc(row.code || "-") + "</span>"; } },
          { title: "状态", width: "80px", render: function () { return '<span class="badge green">启用</span>'; } },
          { title: "操作", width: "170px", render: function (row) {
            return '<button class="btn sm" data-edit="' + row.id + '">编辑</button> <button class="btn sm danger" data-remove="' + row.id + '">删除</button>';
          } }
        ],
        rows: rows,
        empty: "暂无字典项"
      });
      list.querySelectorAll("[data-edit]").forEach(function (button) {
        button.addEventListener("click", function () {
          const row = rows.find(function (item) { return item.id === button.getAttribute("data-edit"); });
          DictsView.form(currentType, row, load);
        });
      });
      list.querySelectorAll("[data-remove]").forEach(function (button) {
        button.addEventListener("click", async function () {
          const ok = await UI.confirm({ title: "删除字典项", message: "删除前会检查是否被业务数据引用，是否继续？", danger: true, okText: "删除" });
          if (!ok) return;
          try {
            await API.del("/api/dicts/" + currentType + "/" + button.getAttribute("data-remove"));
            UI.toast("已删除", "success");
            load();
          } catch (error) { UI.toast(error.message, "error"); }
        });
      });
    }
    container.querySelectorAll("#dict-tabs .tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        container.querySelectorAll("#dict-tabs .tab").forEach(function (item) { item.classList.remove("active"); });
        tab.classList.add("active");
        currentType = tab.getAttribute("data-type");
        load();
      });
    });
    container.querySelector("#dict-add").addEventListener("click", function () { DictsView.form(currentType, null, load); });
    await load();
  },
  form: function (type, row, onSaved) {
    const label = { categories: "类目名称", platforms: "平台名称", sourceTypes: "来源类型名称" }[type];
    UI.modal({
      title: row ? "编辑字典项" : "新增字典项",
      size: "narrow",
      body: '<div class="field"><label>' + label + '<span class="req">*</span></label><input class="input" id="dict-name" value="' + UI.esc(row ? row.name : "") + '"></div>' +
        '<div class="field" style="margin-top:12px"><label>编码</label><input class="input" id="dict-code" value="' + UI.esc(row ? row.code : "") + '" placeholder="可选，字母或数字"></div>',
      buttons: [
        { text: "取消", onClick: function (api) { api.close(); } },
        { text: "保存", className: "primary", onClick: async function (api) {
          try {
            await API.post("/api/dicts/" + type, { id: row ? row.id : "", name: api.find("#dict-name").value.trim(), code: api.find("#dict-code").value.trim() });
            api.close();
            UI.toast("已保存", "success");
            onSaved();
          } catch (error) { UI.toast(error.message, "error"); }
        } }
      ]
    });
  }
};
App.register("dicts", DictsView);

