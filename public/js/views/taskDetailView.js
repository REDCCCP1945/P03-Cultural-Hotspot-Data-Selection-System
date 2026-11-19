const TaskDetailView = {
  timer: null,
  render: async function (container, params) {
    if (TaskDetailView.timer) {
      clearTimeout(TaskDetailView.timer);
      TaskDetailView.timer = null;
    }
    const result = await API.get("/api/selection/tasks/" + encodeURIComponent(params.id));
    const data = result.data;
    const task = data.task;
    const report = data.report;
    const rows = task.result || [];
    const canReview = (App.user.role === "ADMIN" || App.user.role === "ANALYST") && report && report.status === "pending";
    const canRetry = (App.user.role === "ADMIN" || App.user.role === "ANALYST") && task.status === "failed";
    const topRows = rows.slice(0, 8);
    container.innerHTML = UI.pageHead(task.name, "任务编号 " + task.id + " · 创建人 " + task.createdByName,
      '<button class="btn" data-route="selection">返回列表</button>' +
      (canRetry ? '<button class="btn primary" id="retry-task">重新提交</button>' : "")) +
      '<div class="card"><div class="card-body">' +
      '<div class="row between"><div class="row"><span style="font-size:13px">状态</span>' + UI.statusBadge(task.status) +
      '<span style="color:#8a9aa2;font-size:12px">创建于 ' + UI.fmtDateTime(task.createdAt) + (task.finishedAt ? " · 完成于 " + UI.fmtDateTime(task.finishedAt) : "") + "</span></div>" +
      '<span style="color:#8a9aa2;font-size:12px">进度 ' + task.progress + '%</span></div>' +
      '<div class="progress" style="margin-top:10px"><i style="width:' + task.progress + '%"></i></div>' +
      '<div class="detail-list" style="margin-top:16px">' +
      '<div class="detail-item"><span>目标类目</span><strong>' + UI.esc(task.category) + "</strong></div>" +
      '<div class="detail-item"><span>平台范围</span><strong>' + UI.esc(task.platform) + "</strong></div>" +
      '<div class="detail-item"><span>时间窗口</span><strong>' + task.dateFrom + " 至 " + task.dateTo + "</strong></div>" +
      '<div class="detail-item"><span>窗口天数</span><strong>' + task.windowDays + " 天</strong></div>" +
      '<div class="detail-item"><span>权重 α / β / γ</span><strong>' + task.alpha + " / " + task.beta + " / " + task.gamma + "</strong></div>" +
      '<div class="detail-item"><span>红海阈值</span><strong>' + task.redOceanThreshold + "</strong></div>" +
      '<div class="detail-item"><span>最低利润率</span><strong>' + (task.minProfitMargin * 100).toFixed(0) + "%</strong></div>" +
      '<div class="detail-item"><span>结果类目数</span><strong>' + rows.length + "</strong></div>" +
      "</div></div></div>" +
      '<div class="grid grid-main" style="margin-top:16px">' +
      '<div class="card"><div class="card-head"><h3>执行进度日志</h3><span class="hint">记录每一步计算所用数据量</span></div><div class="card-body">' +
      '<ul class="timeline">' + task.logs.map(function (item) {
        return '<li><div class="time">' + UI.fmtDateTime(item.time) + '</div><div class="text">' + UI.esc(item.message) + "</div></li>";
      }).join("") + "</ul></div></div>" +
      '<div class="card"><div class="card-head"><h3>参数快照</h3><span class="hint">报告复算依据</span></div><div class="card-body">' +
      '<table class="kv-table"><tbody>' +
      '<tr><td>热点权重 α</td><td>' + task.alpha + "</td></tr>" +
      '<tr><td>销量权重 β</td><td>' + task.beta + "</td></tr>" +
      '<tr><td>竞争惩罚 γ</td><td>' + task.gamma + "</td></tr>" +
      '<tr><td>红海阈值</td><td>' + task.redOceanThreshold + "</td></tr>" +
      '<tr><td>最低利润率</td><td>' + task.minProfitMargin + "</td></tr>" +
      '<tr><td>数据窗口</td><td>' + task.dateFrom + " 至 " + task.dateTo + "</td></tr>" +
      "</tbody></table></div></div></div>" +
      (rows.length ? '<div class="card" style="margin-top:16px"><div class="card-head"><h3>类目潜力排名</h3><span class="hint">按综合潜力降序</span></div><div class="card-body">' +
        Charts.bar({
          labels: topRows.map(function (item) { return item.category; }),
          values: topRows.map(function (item) { return item.potentialScore; }),
          colors: topRows.map(function (item) { return item.redOcean ? "#b42318" : "#0f766e"; }),
          height: 230
        }) +
        '<div class="grid grid-2" style="margin-top:10px"><div>' +
        (topRows.length >= 3 ? Charts.radar({
          axes: topRows.slice(0, 6).map(function (item) { return item.category; }),
          values: topRows.slice(0, 6).map(function (item) { return item.potentialScore; }),
          max: 100
        }) : Charts.radar({
          axes: ["热度分", "销量分", "竞争空间", "综合潜力"],
          values: [topRows[0].heatScore, topRows[0].salesScore, 100 - topRows[0].competitionPenalty, topRows[0].potentialScore],
          max: 100
        })) + '</div><div style="align-self:center;color:#5d7079;font-size:12px;line-height:2">' +
        (topRows.length >= 3 ? "雷达图展示前6个类目的综合潜力相对水平。" : "雷达图展示该类目的热度、销量、竞争空间与综合潜力得分。") +
        '红色柱表示该类目竞争惩罚达到阈值，建议谨慎进入。结果保留两位小数，参数与批次见上方快照。</div></div>' +
        "</div></div>" +
        '<div class="card" style="margin-top:16px"><div class="card-head"><h3>排名明细</h3><span class="hint">共 ' + rows.length + ' 个类目</span></div><div class="card-body tight">' +
        UI.table({
          columns: [
            { title: "排名", width: "58px", render: function (row, index) { return index + 1; } },
            { title: "类目", key: "category" },
            { title: "热度分", align: "right", width: "78px", render: function (row) { return row.heatScore.toFixed(2); } },
            { title: "销量分", align: "right", width: "78px", render: function (row) { return row.salesScore.toFixed(2); } },
            { title: "竞争惩罚", align: "right", width: "86px", render: function (row) { return row.competitionPenalty.toFixed(2); } },
            { title: "综合潜力", align: "right", width: "86px", render: function (row) { return '<strong style="color:' + (row.redOcean ? "#b42318" : "#0f766e") + '">' + row.potentialScore.toFixed(2) + "</strong>"; } },
            { title: "红海", width: "66px", render: function (row) { return row.redOcean ? '<span class="badge red">红海</span>' : '<span class="badge green">可关注</span>'; } },
            { title: "商品/店铺", align: "right", width: "94px", render: function (row) { return row.itemCount + " / " + row.sellerCount; } },
            { title: "风险提示", key: "riskWarning", render: function (row) { return '<span class="wrap-text">' + UI.esc(row.riskWarning || "无") + "</span>"; } }
          ],
          rows: rows,
          empty: "暂无结果"
        }) + "</div></div>" : "") +
      (report ? '<div class="card" style="margin-top:16px"><div class="card-head"><h3>选品报告</h3><span class="hint">审核通过后可下载</span></div><div class="card-body">' +
        '<div class="row between"><div><strong>' + UI.esc(report.title) + "</strong> " + UI.statusBadge(report.status) +
        '<div style="color:#5d7079;font-size:12px;margin-top:6px">' + UI.esc(report.summary) + "</div>" +
        (report.reviewComment ? '<div style="color:#8a5a10;font-size:12px;margin-top:6px">审核意见：' + UI.esc(report.reviewComment) + "</div>" : "") +
        '</div><div class="row">' +
        '<button class="btn" data-route="reports/' + report.id + '">查看报告</button>' +
        (report.status === "approved" ? '<button class="btn" id="download-html">下载HTML</button><button class="btn" id="download-csv">导出CSV</button>' : "") +
        (canReview ? '<button class="btn primary" id="review-report">审核</button>' : "") +
        "</div></div></div></div>" : "") +
      (task.status === "failed" ? '<div class="card" style="margin-top:16px"><div class="card-body"><div class="alert danger">任务未生成报告：' +
        UI.esc(task.logs.filter(function (item) { return item.message.indexOf("失败") >= 0; }).map(function (item) { return item.message; }).join("；") || "请查看日志") +
        "。可调整时间窗口或补充数据后重新提交。</div></div></div>" : "");
    container.querySelectorAll("[data-route]").forEach(function (node) {
      node.addEventListener("click", function () { location.hash = "#/" + node.getAttribute("data-route"); });
    });
    const retry = container.querySelector("#retry-task");
    if (retry) retry.addEventListener("click", async function () {
      const ok = await UI.confirm({ title: "重新提交任务", message: "将按原参数重新执行该任务，是否继续？" });
      if (!ok) return;
      try {
        await API.post("/api/selection/tasks/" + task.id + "/retry", {});
        UI.toast("任务已重新提交", "success");
        TaskDetailView.render(container, params);
      } catch (error) { UI.toast(error.message, "error"); }
    });
    const downloadHtml = container.querySelector("#download-html");
    if (downloadHtml) downloadHtml.addEventListener("click", function () { API.download("/api/reports/" + report.id + "/html"); });
    const downloadCsv = container.querySelector("#download-csv");
    if (downloadCsv) downloadCsv.addEventListener("click", function () { API.download("/api/reports/" + report.id + "/csv"); });
    const review = container.querySelector("#review-report");
    if (review) review.addEventListener("click", function () { TaskDetailView.review(report, container, params); });
    if (task.status === "queued" || task.status === "running") {
      TaskDetailView.timer = setTimeout(function () {
        if (document.body.contains(container) && location.hash.indexOf(task.id) >= 0) {
          TaskDetailView.render(container, params);
        }
      }, 1500);
    }
  },
  review: function (report, container, params) {
    UI.modal({
      title: "审核选品报告",
      size: "narrow",
      body: '<div style="font-size:12.5px;color:#5d7079;line-height:1.8;margin-bottom:12px">' + UI.esc(report.summary) + "</div>" +
        '<div class="field"><label>审核意见</label><textarea class="textarea" id="review-comment" placeholder="驳回时必须填写意见"></textarea></div>' +
        '<div class="field" style="margin-top:12px"><label>审核动作</label><select class="select" id="review-action"><option value="approve">通过</option><option value="reject">驳回</option></select></div>',
      buttons: [
        { text: "取消", onClick: function (api) { api.close(); } },
        { text: "提交审核", className: "primary", onClick: async function (api) {
          try {
            await API.post("/api/reports/" + report.id + "/review", {
              action: api.find("#review-action").value,
              comment: api.find("#review-comment").value.trim()
            });
            api.close();
            UI.toast("审核结果已保存", "success");
            TaskDetailView.render(container, params);
          } catch (error) { UI.toast(error.message, "error"); }
        } }
      ]
    });
  }
};
App.register("task-detail", TaskDetailView);

