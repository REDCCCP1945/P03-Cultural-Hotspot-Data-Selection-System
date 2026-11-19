const Charts = {
  palette: ["#173a5e", "#0f766e", "#c1842c", "#6b4f8a", "#b42318", "#3d7ea6", "#7c8f3f", "#a35d6a"],
  colors: function (count) {
    const list = [];
    for (let i = 0; i < count; i += 1) list.push(Charts.palette[i % Charts.palette.length]);
    return list;
  },
  empty: function (text) {
    return '<div class="chart-empty">' + UI.esc(text || "暂无数据") + "</div>";
  },
  niceMax: function (value) {
    if (!value || value <= 0) return 10;
    const power = Math.pow(10, Math.floor(Math.log10(value)));
    const scaled = value / power;
    const step = scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
    return step * power;
  },
  line: function (options) {
    const labels = options.labels || [];
    const series = options.series || [];
    if (!labels.length || !series.length) return Charts.empty(options.emptyText);
    const width = 760;
    const height = options.height || 250;
    const padding = { left: 44, right: 18, top: 18, bottom: 30 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    let max = options.max;
    if (!max) {
      max = 0;
      series.forEach(function (item) {
        item.values.forEach(function (value) { if (Number(value) > max) max = Number(value); });
      });
      max = Charts.niceMax(max);
    }
    const stepX = labels.length > 1 ? innerW / (labels.length - 1) : 0;
    const y = function (value) { return padding.top + innerH - (Number(value) / max) * innerH; };
    let grid = "";
    for (let i = 0; i <= 4; i += 1) {
      const value = (max / 4) * i;
      const py = y(value);
      grid += '<line x1="' + padding.left + '" y1="' + py + '" x2="' + (width - padding.right) + '" y2="' + py + '" stroke="#edf2f4" stroke-width="1"/>';
      grid += '<text x="' + (padding.left - 8) + '" y="' + (py + 4) + '" text-anchor="end" font-size="10" fill="#8a9aa2">' + Charts.formatTick(value) + "</text>";
    }
    let paths = "";
    series.forEach(function (item, index) {
      const color = item.color || Charts.palette[index % Charts.palette.length];
      const points = item.values.map(function (value, i) {
        return (padding.left + stepX * i) + "," + y(value);
      }).join(" ");
      paths += '<polyline points="' + points + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
      if (options.dots !== false) {
        item.values.forEach(function (value, i) {
          if (labels.length > 18 && i % 2 === 1) return;
          paths += '<circle cx="' + (padding.left + stepX * i) + '" cy="' + y(value) + '" r="2.6" fill="#fff" stroke="' + color + '" stroke-width="1.6"/>';
        });
      }
    });
    let ticks = "";
    const every = Math.max(1, Math.ceil(labels.length / 8));
    labels.forEach(function (label, index) {
      if (index % every !== 0 && index !== labels.length - 1) return;
      const px = padding.left + stepX * index;
      ticks += '<text x="' + px + '" y="' + (height - 10) + '" text-anchor="middle" font-size="10" fill="#8a9aa2">' + UI.esc(label) + "</text>";
    });
    return '<div class="chart"><svg viewBox="0 0 ' + width + " " + height + '" role="img">' + grid + paths + ticks + "</svg></div>" + Charts.legend(series);
  },
  formatTick: function (value) {
    if (value >= 10000) return (value / 10000).toFixed(1) + "万";
    if (value >= 1000) return (value / 1000).toFixed(1) + "k";
    if (value < 10 && value % 1 !== 0) return value.toFixed(1);
    return String(Math.round(value));
  },
  legend: function (series) {
    if (!series || series.length < 2) return "";
    return '<div class="legend">' + series.map(function (item, index) {
      return '<span><i style="background:' + (item.color || Charts.palette[index % Charts.palette.length]) + '"></i>' + UI.esc(item.name) + "</span>";
    }).join("") + "</div>";
  },
  bar: function (options) {
    const labels = options.labels || [];
    const values = options.values || [];
    if (!labels.length) return Charts.empty(options.emptyText);
    const width = 760;
    const height = options.height || 240;
    const padding = { left: 46, right: 16, top: 18, bottom: 42 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const max = Charts.niceMax(Math.max.apply(null, values.concat([1])));
    const slot = innerW / labels.length;
    const barW = Math.min(46, slot * 0.55);
    let grid = "";
    for (let i = 0; i <= 4; i += 1) {
      const value = (max / 4) * i;
      const py = padding.top + innerH - (value / max) * innerH;
      grid += '<line x1="' + padding.left + '" y1="' + py + '" x2="' + (width - padding.right) + '" y2="' + py + '" stroke="#edf2f4"/>';
      grid += '<text x="' + (padding.left - 8) + '" y="' + (py + 4) + '" text-anchor="end" font-size="10" fill="#8a9aa2">' + Charts.formatTick(value) + "</text>";
    }
    let bars = "";
    labels.forEach(function (label, index) {
      const value = Number(values[index] || 0);
      const barH = (value / max) * innerH;
      const x = padding.left + slot * index + (slot - barW) / 2;
      const y = padding.top + innerH - barH;
      const color = options.colors && options.colors[index] ? options.colors[index] : (options.color || Charts.palette[0]);
      bars += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + Math.max(1, barH) + '" rx="2" fill="' + color + '"/>';
      bars += '<text x="' + (x + barW / 2) + '" y="' + (height - 12) + '" text-anchor="middle" font-size="10" fill="#6b7d85">' + UI.esc(label) + "</text>";
      if (options.showValue !== false && value > 0) {
        bars += '<text x="' + (x + barW / 2) + '" y="' + (y - 5) + '" text-anchor="middle" font-size="10" fill="#43565f">' + Charts.formatTick(value) + "</text>";
      }
    });
    return '<div class="chart"><svg viewBox="0 0 ' + width + " " + height + '">' + grid + bars + "</svg></div>";
  },
  donut: function (items, options) {
    const list = (items || []).filter(function (item) { return Number(item.value) > 0; });
    if (!list.length) return Charts.empty((options && options.emptyText) || "暂无数据");
    const total = list.reduce(function (sum, item) { return sum + Number(item.value); }, 0);
    const size = 200;
    const radius = 68;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    let circles = "";
    list.forEach(function (item, index) {
      const ratio = Number(item.value) / total;
      const color = item.color || Charts.palette[index % Charts.palette.length];
      circles += '<circle cx="100" cy="100" r="' + radius + '" fill="none" stroke="' + color + '" stroke-width="22" stroke-dasharray="' +
        (ratio * circumference).toFixed(2) + " " + circumference.toFixed(2) + '" stroke-dashoffset="' + (-offset * circumference).toFixed(2) +
        '" transform="rotate(-90 100 100)"/>';
      offset += ratio;
    });
    const centerLabel = options && options.centerLabel ? options.centerLabel : "合计";
    const inner = '<text x="100" y="96" text-anchor="middle" font-size="11" fill="#8a9aa2">' + UI.esc(centerLabel) + "</text>" +
      '<text x="100" y="120" text-anchor="middle" font-size="20" font-family="SimHei" fill="#173a5e">' + UI.fmtInt(total) + "</text>";
    const legend = '<div class="legend">' + list.map(function (item, index) {
      return '<span><i style="background:' + (item.color || Charts.palette[index % Charts.palette.length]) + '"></i>' + UI.esc(item.name) + " " + UI.fmtInt(item.value) + "</span>";
    }).join("") + "</div>";
    return '<div class="chart" style="max-width:260px;margin:0 auto"><svg viewBox="0 0 200 200">' + circles + inner + "</svg></div>" + legend;
  },
  radar: function (options) {
    const axes = options.axes || [];
    const values = options.values || [];
    if (!axes.length) return Charts.empty(options.emptyText);
    const size = 300;
    const center = 150;
    const radius = 96;
    const max = options.max || 100;
    const count = axes.length;
    function point(index, ratio) {
      const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
      return [center + Math.cos(angle) * radius * ratio, center + Math.sin(angle) * radius * ratio];
    }
    let grid = "";
    for (let ring = 1; ring <= 4; ring += 1) {
      const points = axes.map(function (item, index) {
        const p = point(index, ring / 4);
        return p[0].toFixed(1) + "," + p[1].toFixed(1);
      }).join(" ");
      grid += '<polygon points="' + points + '" fill="none" stroke="#e2eaee" stroke-width="1"/>';
    }
    axes.forEach(function (axis, index) {
      const p = point(index, 1);
      grid += '<line x1="' + center + '" y1="' + center + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="#e2eaee"/>';
      const labelPoint = point(index, 1.18);
      const anchor = labelPoint[0] > center + 10 ? "start" : labelPoint[0] < center - 10 ? "end" : "middle";
      grid += '<text x="' + labelPoint[0] + '" y="' + (labelPoint[1] + 3) + '" text-anchor="' + anchor + '" font-size="10.5" fill="#52666f">' + UI.esc(axis) + "</text>";
    });
    const dataPoints = values.map(function (value, index) {
      const p = point(index, Math.max(0, Math.min(1, Number(value) / max)));
      return p[0].toFixed(1) + "," + p[1].toFixed(1);
    }).join(" ");
    const color = options.color || "#0f766e";
    const polygon = '<polygon points="' + dataPoints + '" fill="' + color + '" fill-opacity="0.16" stroke="' + color + '" stroke-width="2"/>';
    let dots = "";
    values.forEach(function (value, index) {
      const p = point(index, Math.max(0, Math.min(1, Number(value) / max)));
      dots += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.8" fill="' + color + '"/>';
    });
    return '<div class="chart"><svg viewBox="0 0 300 300">' + grid + polygon + dots + "</svg></div>";
  },
  hbars: function (items, options) {
    const list = (items || []).filter(function (item) { return Number(item.value) > 0; });
    if (!list.length) return Charts.empty((options && options.emptyText) || "暂无数据");
    const max = Math.max.apply(null, list.map(function (item) { return Number(item.value); }));
    const tone = (options && options.tone) || "";
    return list.map(function (item, index) {
      const width = max === 0 ? 0 : (Number(item.value) / max) * 100;
      return '<div class="hbar ' + tone + '"><span class="name">' + UI.esc(item.name) + '</span><span class="track"><span class="fill" style="width:' +
        Math.max(2, width).toFixed(1) + '%"></span></span><span class="value">' + (options && options.format ? options.format(item.value) : UI.fmtInt(item.value)) + "</span></div>";
    }).join("");
  },
  wordCloud: function (items, limit) {
    const list = (items || []).slice(0, limit || 36);
    if (!list.length) return Charts.empty("暂无词频数据");
    const max = Math.max.apply(null, list.map(function (item) { return item.count; }));
    return '<div class="tag-cloud">' + list.map(function (item, index) {
      const size = 12 + Math.round((item.count / max) * 16);
      const tone = index % 3;
      return '<span class="tag-cloud-item tone-' + tone + '" style="font-size:' + size + 'px">' + UI.esc(item.word) + "</span>";
    }).join("") + "</div>";
  }
};

