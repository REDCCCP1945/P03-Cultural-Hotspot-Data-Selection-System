const TaskCreateView = {
  render: async function (container) {
    const meta = (await API.get("/api/topics/meta")).data;
    const metaInfo = (await API.get("/api/meta")).data;
    const rules = metaInfo.rules || {};
    const categories = ["全部类目"].concat(meta.categories);
    const platforms = ["全部平台"].concat(meta.dictPlatforms || []);
    container.innerHTML = UI.pageHead("新建选品任务", "参数将在任务执行时保存快照，作为报告审核与复算依据",
      '<button class="btn" data-route="selection">返回任务列表</button>') +
      '<div class="grid grid-main">' +
      '<div class="card"><div class="card-body"><form id="task-form">' +
      '<h3 style="font-size:14px;margin-bottom:12px">基本信息</h3>' +
      '<div class="form-grid">' +
      '<div class="field span-2"><label>任务名称<span class="req">*</span></label><input class="input" name="name" placeholder="例如：非遗手作类目蓝海验证" maxlength="40"></div>' +
      '<div class="field"><label>目标类目<span class="req">*</span></label><select class="select" name="category">' + UI.optionList(categories) + "</select></div>" +
      '<div class="field"><label>平台范围</label><select class="select" name="platform">' + UI.optionList(platforms) + "</select></div>" +
      '<div class="field"><label>时间窗口<span class="req">*</span></label><select class="select" name="windowDays"><option value="7">近7天</option><option value="14">近14天</option><option value="30" selected>近30天</option><option value="60">近60天</option><option value="90">近90天</option></select></div>' +
      '<div class="field"><label>平台数据口径</label><input class="input" value="按导入批次中的记录日期过滤" disabled></div>' +
      "</div><h3 style=\"font-size:14px;margin:20px 0 12px\">算法参数</h3>" +
      '<div class="form-grid-3">' +
      '<div class="field"><label>热点权重 α<span class="req">*</span></label><input class="input" name="alpha" type="number" step="0.01" min="0.2" max="0.4" value="' + (rules.alpha || 0.4) + '"><span class="field-hint">0.20 至 0.40</span></div>' +
      '<div class="field"><label>销量权重 β<span class="req">*</span></label><input class="input" name="beta" type="number" step="0.01" min="0.3" max="0.5" value="' + (rules.beta || 0.4) + '"><span class="field-hint">0.30 至 0.50，且 α+β≤0.95</span></div>' +
      '<div class="field"><label>竞争惩罚系数 γ<span class="req">*</span></label><input class="input" name="gamma" type="number" step="0.01" min="0.1" max="0.5" value="' + (rules.gamma || 0.2) + '"><span class="field-hint">0.10 至 0.50</span></div>' +
      '<div class="field"><label>红海阈值<span class="req">*</span></label><input class="input" name="redOceanThreshold" type="number" step="1" min="60" max="95" value="' + (rules.redOceanThreshold || 85) + '"><span class="field-hint">惩罚分达到该值标记红海</span></div>' +
      '<div class="field"><label>最低利润率<span class="req">*</span></label><input class="input" name="minProfitMargin" type="number" step="0.01" min="0" max="0.6" value="' + (rules.minProfitMargin || 0.15) + '"><span class="field-hint">低于该值的商品不参与销量分</span></div>' +
      '<div class="field"><label>结果范围</label><input class="input" value="按综合潜力分降序排列" disabled></div>' +
      '</div><div class="form-actions"><button class="btn" type="button" data-route="selection">取消</button><button class="btn primary" type="submit">提交任务</button></div>' +
      "</form></div></div>" +
      '<div class="stack"><div class="card"><div class="card-head"><h3>计算口径</h3></div><div class="card-body">' +
      '<div class="formula">热度分 = 窗口内话题热度均值\n热度 = 100/(1+e^-z)，基础热度=(阅读×0.5+讨论×0.3+转发×0.2)×e^(-0.1×天数)</div>' +
      '<div class="formula">销量分 = (ln(1+月销量中位数)×0.6 + ln(1+平均销售额)×0.4)×10</div>' +
      '<div class="formula">竞争惩罚 = 0.7×TOP10销售额份额×100 + 0.3×(店铺数/商品数)×100</div>' +
      '<div class="formula">综合潜力 = 热度分×α + 销量分×β - 竞争惩罚×γ</div>' +
      '<div class="alert info" style="margin-top:12px">任务提交后依次进入排队中、执行中，完成后生成待审核报告。失败任务保留日志并允许重新提交。</div>' +
      "</div></div></div></div>";
    container.querySelectorAll("[data-route]").forEach(function (node) {
      node.addEventListener("click", function () { location.hash = "#/" + node.getAttribute("data-route"); });
    });
    const form = container.querySelector("#task-form");
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const submit = form.querySelector("button[type=submit]");
      submit.disabled = true;
      submit.textContent = "正在提交";
      try {
        const data = UI.formData(form);
        const result = await API.post("/api/selection/tasks", data);
        UI.toast("任务已提交，正在计算", "success");
        location.hash = "#/selection/" + result.data.task.id;
      } catch (error) {
        UI.showError(form, error);
        submit.disabled = false;
        submit.textContent = "提交任务";
      }
    });
  }
};
App.register("task-create", TaskCreateView);

