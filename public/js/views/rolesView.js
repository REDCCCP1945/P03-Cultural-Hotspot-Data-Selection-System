const RolesView = {
  labels: {
    dashboard: "工作台", import: "数据导入中心", topics: "热点监测", keywords: "关键词库", cleaning: "清洗与去重",
    sales: "电商数据大厅", selection: "选品任务", reports: "选品报告", audience: "受众画像", users: "用户管理",
    roles: "角色权限", dicts: "数据字典", audit: "审计日志", settings: "系统设置", feedback: "反馈与投诉", help: "帮助与合规"
  },
  render: async function (container) {
    const result = await API.get("/api/settings/roles");
    const roleMenus = result.data.roleMenus;
    const roles = ["ADMIN", "ANALYST", "DESIGNER", "OPERATOR"];
    const keys = Object.keys(RolesView.labels);
    container.innerHTML = UI.pageHead("角色权限", "菜单权限可配置；写入类接口仍按固定角色校验，避免越权", '<button class="btn primary" id="save-roles">保存菜单配置</button>') +
      '<div class="card"><div class="card-body">' +
      '<div class="alert info" style="margin-bottom:16px">系统管理员菜单固定为全部功能。数据分析师默认拥有导入、关键词、清洗与审核权限；产品经理与设计师可创建选品任务但不能导入或审核；运营专员仅查看销量、选品结果与报告。</div>' +
      '<div class="role-matrix">' + roles.map(function (role) {
        return '<div class="role-name">' + UI.roleName(role) + (role === "ADMIN" ? '<div style="font-weight:400;color:#8a9aa2;font-size:11px;margin-top:3px">固定全部</div>' : "") + "</div>" +
          '<div class="checks" data-role="' + role + '">' + keys.map(function (key) {
            const checked = role === "ADMIN" || (roleMenus[role] || []).indexOf(key) >= 0;
            return '<label class="check"><input type="checkbox" value="' + key + '"' + (checked ? " checked" : "") + (role === "ADMIN" ? " disabled" : "") + ">" + RolesView.labels[key] + "</label>";
          }).join("") + "</div>";
      }).join("") + "</div></div></div>";
    container.querySelector("#save-roles").addEventListener("click", async function () {
      const button = container.querySelector("#save-roles");
      button.disabled = true;
      try {
        for (const role of ["ANALYST", "DESIGNER", "OPERATOR"]) {
          const menus = Array.prototype.map.call(container.querySelectorAll('[data-role="' + role + '"] input:checked'), function (input) { return input.value; });
          await API.post("/api/settings/roles", { role: role, menus: menus });
        }
        UI.toast("菜单权限已保存，相关用户重新登录后生效", "success");
      } catch (error) {
        UI.toast(error.message, "error");
      } finally {
        button.disabled = false;
      }
    });
  }
};
App.register("roles", RolesView);

