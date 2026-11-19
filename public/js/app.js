const App = {
  user: null,
  menus: [],
  meta: null,
  routes: {},
  menuGroups: [
    { title: "分析视图", items: [["dashboard", "工作台"], ["topics", "热点监测"], ["sales", "电商数据大厅"], ["audience", "受众画像"]] },
    { title: "数据治理", items: [["import", "数据导入中心"], ["keywords", "关键词库"], ["cleaning", "清洗与去重"]] },
    { title: "选品决策", items: [["selection", "选品任务"], ["reports", "选品报告"]] },
    { title: "系统管理", items: [["users", "用户管理"], ["roles", "角色权限"], ["dicts", "数据字典"], ["audit", "审计日志"], ["settings", "系统设置"]] },
    { title: "服务支持", items: [["feedback", "反馈与投诉"], ["help", "帮助与合规"]] }
  ],
  titleMap: {
    dashboard: "工作台", topics: "热点监测", "topic-detail": "话题详情", sales: "电商数据大厅",
    audience: "受众画像", import: "数据导入中心", keywords: "关键词库", cleaning: "清洗与去重",
    selection: "选品任务", "task-create": "新建选品任务", "task-detail": "任务详情", reports: "选品报告",
    "report-detail": "报告详情", users: "用户管理", roles: "角色权限", dicts: "数据字典",
    audit: "审计日志", settings: "系统设置", feedback: "反馈与投诉", help: "帮助与合规", profile: "个人中心"
  },
  init: function () {
    window.addEventListener("hashchange", function () { App.route(); });
    window.addEventListener("p03:unauthorized", function () {
      App.user = null;
      App.showLogin("登录状态已失效，请重新登录");
    });
    document.getElementById("crumb").addEventListener("click", function (event) {
      const target = event.target.closest("[data-route]");
      if (!target) return;
      location.hash = "#/" + target.getAttribute("data-route");
    });
    document.addEventListener("click", function (event) {
      const toggle = event.target.closest("#user-chip-button");
      const menu = document.querySelector(".user-menu");
      if (toggle) {
        if (menu) { menu.remove(); return; }
        const chip = document.getElementById("user-chip");
        const box = document.createElement("div");
        box.className = "user-menu";
        box.innerHTML = '<button type="button" data-action="profile">个人中心</button><button type="button" data-action="help">帮助与合规</button><button type="button" data-action="logout">退出登录</button>';
        chip.appendChild(box);
        box.addEventListener("click", function (e) {
          const action = e.target.getAttribute("data-action");
          if (action === "profile") location.hash = "#/profile";
          if (action === "help") location.hash = "#/help";
          if (action === "logout") App.logout();
          box.remove();
        });
        return;
      }
      if (menu && !event.target.closest(".user-menu")) menu.remove();
    });
  },
  register: function (key, view) {
    App.routes[key] = view;
  },
  showLogin: function (message) {
    document.getElementById("shell").hidden = true;
    document.getElementById("login-root").hidden = false;
    document.getElementById("menu").innerHTML = "";
    LoginView.render(document.getElementById("login-root"), message);
  },
  start: async function () {
    if (!API.token) {
      App.showLogin();
      return;
    }
    try {
      const response = await API.get("/api/auth/me");
      App.user = response.data.user;
      App.menus = response.data.menus || [];
      App.meta = (await API.get("/api/meta")).data || {};
      App.showShell();
      if (!location.hash || location.hash === "#/") location.hash = "#/dashboard";
      App.route();
    } catch (error) {
      App.showLogin(error.message);
    }
  },
  afterLogin: function (response) {
    const result = response.data || response;
    API.setToken(result.token);
    App.user = result.user;
    App.menus = result.menus || [];
    API.get("/api/meta").then(function (response) {
      App.meta = response.data || {};
      App.showShell();
      location.hash = "#/dashboard";
      App.route();
    }).catch(function () {
      App.showShell();
      location.hash = "#/dashboard";
      App.route();
    });
  },
  showShell: function () {
    document.getElementById("login-root").hidden = true;
    document.getElementById("shell").hidden = false;
    App.renderMenu();
    App.renderUser();
    App.startClock();
  },
  renderMenu: function () {
    const nav = document.getElementById("menu");
    const allowed = App.menus;
    nav.innerHTML = App.menuGroups.map(function (group) {
      const items = group.items.filter(function (item) { return allowed.indexOf(item[0]) >= 0; });
      if (!items.length) return "";
      return '<div class="menu-group"><div class="menu-group-title">' + group.title + "</div>" + items.map(function (item) {
        return '<div class="menu-item" data-key="' + item[0] + '" data-route="' + item[0] + '"><span class="menu-icon">◆</span><span>' + item[1] + "</span></div>";
      }).join("") + "</div>";
    }).join("");
    nav.addEventListener("click", function (event) {
      const item = event.target.closest(".menu-item");
      if (!item) return;
      location.hash = "#/" + item.getAttribute("data-route");
    });
  },
  renderUser: function () {
    const chip = document.getElementById("user-chip");
    const name = App.user ? App.user.name : "";
    chip.innerHTML = '<div class="user-chip-button" id="user-chip-button"><span class="avatar">' + UI.esc(name.slice(0, 1)) +
      '</span><span><span class="user-name">' + UI.esc(name) + '</span><br><span class="user-role">' + UI.roleName(App.user.role) + "</span></span></div>";
  },
  startClock: function () {
    const node = document.getElementById("server-time");
    function tick() {
      const now = new Date();
      node.textContent = now.toLocaleString("zh-CN", { hour12: false });
    }
    tick();
    setInterval(tick, 30000);
  },
  route: async function () {
    if (!App.user) return;
    const hash = location.hash.replace(/^#\//, "") || "dashboard";
    const parts = hash.split("/");
    const key = parts[0];
    let viewKey = key;
    let params = {};
    if (key === "topics" && parts[1]) { viewKey = "topic-detail"; params.id = parts[1]; }
    if (key === "selection" && parts[1] === "new") { viewKey = "task-create"; }
    if (key === "selection" && parts[1] && parts[1] !== "new") { viewKey = "task-detail"; params.id = parts[1]; }
    if (key === "reports" && parts[1]) { viewKey = "report-detail"; params.id = parts[1]; }
    const menuKey = viewKey === "topic-detail" ? "topics" : viewKey === "task-create" || viewKey === "task-detail" ? "selection" : viewKey === "report-detail" ? "reports" : viewKey;
    if (viewKey !== "profile" && App.menus.indexOf(menuKey) < 0 && !(menuKey === "help")) {
      document.getElementById("view").innerHTML = UI.pageHead("无访问权限", "当前角色未开通该功能") + '<div class="card"><div class="card-body">' + UI.empty("无法访问", "请返回工作台或联系系统管理员。") + "</div></div>";
      return;
    }
    Array.prototype.forEach.call(document.querySelectorAll(".menu-item"), function (item) {
      item.classList.toggle("active", item.getAttribute("data-key") === menuKey);
    });
    const title = App.titleMap[viewKey] || "工作台";
    document.getElementById("crumb").innerHTML = '<span>首页</span><span>/</span><strong>' + title + "</strong>";
    document.title = title + " · 基于全网大数据的文创热点分析与智能选品系统V1.0";
    const view = App.routes[viewKey];
    const container = document.getElementById("view");
    container.innerHTML = '<div class="card"><div class="card-body">' + UI.empty("正在加载", "请稍候") + "</div></div>";
    if (!view) {
      container.innerHTML = UI.pageHead(title, "") + '<div class="card"><div class="card-body">' + UI.empty("页面未注册", "") + "</div></div>";
      return;
    }
    try {
      await view.render(container, params);
    } catch (error) {
      container.innerHTML = UI.pageHead(title, "") + '<div class="card"><div class="card-body"><div class="alert danger">' +
        UI.esc(error.message || "页面加载失败") + "</div></div></div>";
    }
  },
  logout: async function () {
    try { await API.post("/api/auth/logout", {}); } catch (e) { }
    API.setToken("");
    App.user = null;
    App.showLogin("已安全退出");
  }
};

