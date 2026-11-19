const SettingsView = {
  render: async function (container) {
    const result = await API.get("/api/settings");
    const settings = result.data.settings;
    container.innerHTML = UI.pageHead("系统设置", "默认算法参数、数据合规告知与备份", '<button class="btn" id="backup">导出数据备份</button>') +
      '<div class="grid grid-main"><div class="card"><div class="card-body"><form id="settings-form">' +
      '<h3 style="font-size:14px;margin-bottom:12px">算法默认参数</h3>' +
      '<div class="form-grid-3">' +
      '<div class="field"><label>热点权重 α</label><input class="input" name="alpha" type="number" step="0.01" min="0.2" max="0.4" value="' + settings.alpha + '"></div>' +
      '<div class="field"><label>销量权重 β</label><input class="input" name="beta" type="number" step="0.01" min="0.3" max="0.5" value="' + settings.beta + '"></div>' +
      '<div class="field"><label>竞争惩罚 γ</label><input class="input" name="gamma" type="number" step="0.01" min="0.1" max="0.5" value="' + settings.gamma + '"></div>' +
      '<div class="field"><label>红海阈值</label><input class="input" name="redOceanThreshold" type="number" step="1" min="60" max="95" value="' + settings.redOceanThreshold + '"></div>' +
      '<div class="field"><label>最低利润率</label><input class="input" name="minProfitMargin" type="number" step="0.01" min="0" max="0.6" value="' + settings.minProfitMargin + '"></div>' +
      '<div class="field"><label>默认窗口天数</label><input class="input" name="windowDays" type="number" step="1" min="7" max="90" value="' + settings.windowDays + '"></div>' +
      "</div><h3 style=\"font-size:14px;margin:20px 0 12px\">合规告知</h3>" +
      '<div class="field"><label>数据来源说明</label><textarea class="textarea" name="dataPolicy">' + UI.esc(settings.dataPolicy) + "</textarea></div>" +
      '<div class="field" style="margin-top:12px"><label>报告算法说明</label><textarea class="textarea" name="aiNotice">' + UI.esc(settings.aiNotice) + "</textarea></div>" +
      '<div class="form-actions"><button class="btn primary" type="submit">保存设置</button><button class="btn" type="button" data-route="roles">角色菜单配置</button></div>' +
      "</form></div></div>" +
      '<div class="stack"><div class="card"><div class="card-head"><h3>版本与部署信息</h3></div><div class="card-body">' +
      '<table class="kv-table"><tbody>' +
      '<tr><td>软件全称</td><td>' + UI.esc(settings.softwareName) + "</td></tr>" +
      '<tr><td>软件版本</td><td>' + UI.esc(settings.softwareVersion) + "</td></tr>" +
      '<tr><td>著作权人</td><td>陕西理工大学</td></tr>' +
      '<tr><td>经办人</td><td>李果</td></tr>' +
      '<tr><td>部署方式</td><td>本地单机，监听127.0.0.1:4103</td></tr>' +
      '<tr><td>数据存储</td><td>data/db.json 原子写入</td></tr>' +
      '</tbody></table></div></div>' +
      '<div class="card"><div class="card-head"><h3>备份说明</h3></div><div class="card-body"><p style="color:#5d7079;line-height:1.9;margin:0">备份文件包含业务数据、用户密码哈希与盐，不包含会话令牌。恢复时停止服务，将备份文件替换为data/db.json后重新启动。原始导入文件保存在data/uploads目录，可按批次号对应。</p></div></div></div></div>';
    container.querySelectorAll("[data-route]").forEach(function (node) {
      node.addEventListener("click", function () { location.hash = "#/" + node.getAttribute("data-route"); });
    });
    const form = container.querySelector("#settings-form");
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      try {
        await API.post("/api/settings", UI.formData(form));
        UI.toast("设置已保存", "success");
      } catch (error) { UI.showError(form, error); }
    });
    container.querySelector("#backup").addEventListener("click", function () { API.download("/api/users/backup"); });
  }
};
App.register("settings", SettingsView);

