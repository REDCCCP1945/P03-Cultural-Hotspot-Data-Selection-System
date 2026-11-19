const ReportDetailView = {
  render: async function (container, params) {
    const result = await API.get("/api/reports/" + encodeURIComponent(params.id));
    const report = result.data.report;
    const rows = report.rows || [];
    const canReview = (App.user.role === "ADMIN" || App.user.role === "ANALYST") && report.status === "pending";
    container.innerHTML = UI.pageHead(report.title, "报告编号 " + report.id + " · 任务编号 " + report.taskId,
      '<button class="btn" data-route="reports">返回列表</button>' +
      (report.status === "approved" ? '<button class="btn" id="dl-html">下载HTML</button><button class="btn" id="dl-csv">导出CSV</button>' : "") +
      (canReview ? '<button class="btn primary" id="review">审核报告</button>' : "")) +
      '<div class="card"><div class="card-body">' +
      '<div class="row between"><div class="row"><span>状态</span>' + UI.statusBadge(report.status) +
      '<span style="color:#8a9aa2;font-size:12px">生成时间 ' + UI.fmtDateTime(report.generatedAt) + " · 生成人 " + UI.esc(report.createdByName) + "</span></div>" +
      (report.reviewer ? '<span style="color:#8a9aa2;font-size:12px">审核人 ' + UI.esc(report.reviewer) + " · " + UI.fmtDateTime(report.reviewedAt) + "</span>" : "") + "</div>" +
      '<div class="alert info" style="margin-top:14px">' + UI.esc(report.summary) + "</div>" +
      (report.reviewComment ? '<div class="alert warn" style="margin-top:10px">审核意见：' + UI.esc(report.reviewComment) + "</div>" : "") +
      (report.status === "rejected" ? '<div class="alert danger" style="margin-top:10px">报告已驳回，下载入口关闭。请根据审核意见调整任务参数或补充数据后重新创建任务。</div>' : "") +
      "</div></div>" +
      '<div class="grid grid-main" style="margin-top:16px">' +
      '<div class="card"><div class="card-head"><h3>建议结论</h3><span class="hint">由排名规则生成</span></div><div class="card-body">' +
      '<div style="white-space:pre-line;line-height:2;font-size:13px">' + UI.esc(report.recommendation) + "</div>" +
      '<div class="alert info" style="margin-top:14px">本报告由系统算法基于使用单位导入的公开数据自动生成，参数与数据批次已记录，结论仅供选品决策参考。</div>' +
      "</div></div>" +
      '<div class="card"><div class="card-head"><h3>任务参数快照</h3></div><div class="card-body">' +
      '<table class="kv-table"><tbody>' +
      '<tr><td>目标类目</td><td>' + UI.esc(report.category) + "</td></tr>" +
      '<tr><td>平台范围</td><td>' + UI.esc(report.params.platform) + "</td></tr>" +
      '<tr><td>数据窗口</td><td>' + report.params.dateFrom + " 至 " + report.params.dateTo + "（" + report.params.windowDays + "天）</td></tr>" +
      '<tr><td>权重 α / β / γ</td><td>' + report.params.alpha + " / " + report.params.beta + " / " + report.params.gamma + "</td></tr>" +
      '<tr><td>红海阈值</td><td>' + report.params.redOceanThreshold + "</td></tr>" +
      '<tr><td>最低利润率</td><td>' + report.params.minProfitMargin + "</td></tr>" +
      '<tr><td>数据批次</td><td class="mono">' + UI.esc((report.references || []).join("、") || "-") + "</td></tr>" +
      '<tr><td>样本量</td><td>话题 ' + UI.fmtInt(report.topicCount || 0) + " 条 · 商品 " + UI.fmtInt(report.productCount || 0) + " 条</td></tr>" +
      "</tbody></table></div></div></div>" +
      '<div class="card" style="margin-top:16px"><div class="card-head"><h3>类目潜力分布</h3><span class="hint">红色为红海类目</span></div><div class="card-body">' +
      Charts.bar({
        labels: rows.map(function (item) { return item.category; }),
        values: rows.map(function (item) { return item.potentialScore; }),
        colors: rows.map(function (item) { return item.redOcean ? "#b42318" : "#0f766e"; }),
        height: 240
      }) + "</div></div>" +
      '<div class="card" style="margin-top:16px"><div class="card-head"><h3>排名明细</h3><span class="hint">共 ' + rows.length + " 个类目</span></div><div class=\"card-body tight\">" +
      UI.table({
        columns: [
          { title: "排名", width: "58px", render: function (row, index) { return index + 1; } },
          { title: "类目", key: "category" },
          { title: "热度分", align: "right", width: "78px", render: function (row) { return row.heatScore.toFixed(2); } },
          { title: "销量分", align: "right", width: "78px", render: function (row) { return row.salesScore.toFixed(2); } },
          { title: "竞争惩罚", align: "right", width: "86px", render: function (row) { return row.competitionPenalty.toFixed(2); } },
          { title: "综合潜力", align: "right", width: "86px", render: function (row) { return '<strong>' + row.potentialScore.toFixed(2) + "</strong>"; } },
          { title: "红海", width: "66px", render: function (row) { return row.redOcean ? '<span class="badge red">红海</span>' : '<span class="badge green">可关注</span>'; } },
          { title: "TOP10份额", align: "right", width: "96px", render: function (row) { return (row.top10Share * 100).toFixed(1) + "%"; } },
          { title: "风险提示", key: "riskWarning", render: function (row) { return '<span class="wrap-text">' + UI.esc(row.riskWarning || "无") + "</span>"; } }
        ],
        rows: rows,
        empty: "暂无排名数据"
      }) + "</div></div>";
    container.querySelectorAll("[data-route]").forEach(function (node) {
      node.addEventListener("click", function () { location.hash = "#/" + node.getAttribute("data-route"); });
    });
    const dlHtml = container.querySelector("#dl-html");
    if (dlHtml) dlHtml.addEventListener("click", function () { API.download("/api/reports/" + report.id + "/html"); });
    const dlCsv = container.querySelector("#dl-csv");
    if (dlCsv) dlCsv.addEventListener("click", function () { API.download("/api/reports/" + report.id + "/csv"); });
    const review = container.querySelector("#review");
    if (review) review.addEventListener("click", function () {
      UI.modal({
        title: "审核报告",
        size: "narrow",
        body: '<div style="font-size:12.5px;color:#5d7079;line-height:1.8;margin-bottom:12px">' + UI.esc(report.summary) + "</div>" +
          '<div class="field"><label>审核动作</label><select class="select" id="rp-action"><option value="approve">通过</option><option value="reject">驳回</option></select></div>' +
          '<div class="field" style="margin-top:12px"><label>审核意见</label><textarea class="textarea" id="rp-comment" placeholder="驳回时必须填写意见"></textarea></div>',
        buttons: [
          { text: "取消", onClick: function (api) { api.close(); } },
          { text: "提交", className: "primary", onClick: async function (api) {
            try {
              await API.post("/api/reports/" + report.id + "/review", { action: api.find("#rp-action").value, comment: api.find("#rp-comment").value.trim() });
              api.close();
              UI.toast("审核结果已保存", "success");
              ReportDetailView.render(container, params);
            } catch (error) { UI.toast(error.message, "error"); }
          } }
        ]
      });
    });
  }
};
App.register("report-detail", ReportDetailView);

