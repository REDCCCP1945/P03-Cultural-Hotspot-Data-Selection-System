const CleaningView = {
  render: async function (container) {
    const result = await API.get("/api/cleaning/rules");
    const rules = result.data.rows;
    container.innerHTML = UI.pageHead("清洗与去重", "文本清洗、敏感信息掩码与SimHash相似文本去重规则", "") +
      '<div class="grid grid-main">' +
      '<div class="card"><div class="card-head"><h3>清洗与掩码规则</h3><span class="hint">内置规则不可删除</span></div><div class="card-body tight">' +
      UI.table({
        columns: [
          { title: "规则名称", key: "name" },
          { title: "类型", key: "type", width: "86px", render: function (row) { return { regex: "正则替换", mask: "掩码", normalize: "规范化" }[row.type] || row.type; } },
          { title: "匹配表达式", key: "pattern", render: function (row) { return '<span class="mono">' + UI.esc(row.pattern) + "</span>"; } },
          { title: "替换为", key: "replacement", width: "130px", render: function (row) { return '<span class="mono">' + UI.esc(row.replacement) + "</span>"; } },
          { title: "状态", width: "76px", render: function (row) { return UI.statusBadge(row.enabled ? "active" : "disabled"); } },
          { title: "操作", width: "92px", render: function (row) {
            if (row.builtin) return '<span class="badge gray">内置</span>';
            return '<button class="btn sm" data-toggle="' + row.id + '">' + (row.enabled ? "停用" : "启用") + "</button>";
          } }
        ],
        rows: rules,
        empty: "暂无规则"
      }) + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>清洗与掩码校验</h3><span class="hint">输入文本查看处理结果</span></div><div class="card-body">' +
      '<form id="clean-form"><div class="field"><label>原始文本</label><textarea class="textarea" name="text" placeholder="例如：这款手账本好看，联系 13800138000 或 hello@example.com，详情见 https://example.com/item">这款手账本好看，联系 13800138000 或 hello@example.com，详情见 https://example.com/item</textarea></div>' +
      '<div class="row end" style="margin-top:10px"><button class="btn primary" type="submit">执行清洗</button></div></form>' +
      '<div id="clean-result" style="margin-top:14px"></div></div></div></div>' +
      '<div class="card" style="margin-top:16px"><div class="card-head"><h3>去重记录</h3><span class="hint">同批次SimHash汉明距离≤3判为重复</span></div><div class="card-body tight" id="dedup-table">' + UI.empty("正在加载", "") + "</div></div>";
    container.querySelectorAll("[data-toggle]").forEach(function (button) {
      button.addEventListener("click", async function () {
        try {
          await API.post("/api/cleaning/rules/" + button.getAttribute("data-toggle") + "/toggle", {});
          UI.toast("规则状态已更新", "success");
          CleaningView.render(container);
        } catch (error) { UI.toast(error.message, "error"); }
      });
    });
    const form = container.querySelector("#clean-form");
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      try {
        const response = await API.post("/api/cleaning/test", { text: form.text.value });
        const data = response.data;
        container.querySelector("#clean-result").innerHTML = '<table class="kv-table"><tbody>' +
          '<tr><td>清洗结果</td><td>' + UI.esc(data.cleaned) + "</td></tr>" +
          '<tr><td>掩码结果</td><td>' + UI.esc(data.masked) + "</td></tr>" +
          '<tr><td>分词结果</td><td>' + (data.tokens.length ? data.tokens.slice(0, 18).map(function (word) { return '<span class="chip">' + UI.esc(word) + "</span>"; }).join(" ") : "无有效词") + "</td></tr>" +
          '<tr><td>情感得分</td><td>' + data.sentiment.score.toFixed(3) + "（" + (data.sentiment.polarity === "positive" ? "正向" : data.sentiment.polarity === "negative" ? "负向" : "中立") + "）</td></tr>" +
          '<tr><td>SimHash</td><td class="mono">' + UI.esc(data.simhash) + "</td></tr></tbody></table>";
      } catch (error) { UI.toast(error.message, "error"); }
    });
    const dedup = await API.get("/api/cleaning/dedup");
    const target = container.querySelector("#dedup-table");
    target.innerHTML = UI.table({
      columns: [
        { title: "批次号", key: "batchNo", render: function (row) { return '<span class="mono">' + UI.esc(row.batchNo) + "</span>"; } },
        { title: "类型", key: "typeName", width: "90px" },
        { title: "总行", align: "right", width: "80px", render: function (row) { return UI.fmtInt(row.totalRows); } },
        { title: "重复", align: "right", width: "80px", render: function (row) { return UI.fmtInt(row.duplicateRows); } },
        { title: "重复率", align: "right", width: "88px", render: function (row) { return row.duplicateRatio.toFixed(2) + "%"; } },
        { title: "时间", width: "170px", render: function (row) { return UI.fmtDateTime(row.createdAt); } }
      ],
      rows: dedup.data.rows,
      empty: "暂无去重记录"
    });
  }
};
App.register("cleaning", CleaningView);

