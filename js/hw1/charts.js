let CHART_W = 640;
const CHART_H = 280;
const CHART_PAD = { top: 16, right: 28, bottom: 46, left: 66 };

function chartSvg(tag, attrs, text) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (text !== undefined) el.textContent = text;
  return el;
}

function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * magnitude >= value) return step * magnitude;
  }
  return 10 * magnitude;
}

function formatTick(value, format) {
  if (format === "percent") return Math.round(value * 1000) / 10 + "%";
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString("en-US");
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function chartFrame(container, title, legend) {
  container.replaceChildren();
  const figure = document.createElement("figure");
  figure.className = "chart";
  const caption = document.createElement("figcaption");
  caption.textContent = title;
  figure.append(caption);
  if (legend && legend.length > 1) {
    const list = document.createElement("ul");
    list.className = "chart-legend";
    for (const item of legend) {
      const li = document.createElement("li");
      const swatch = document.createElement("span");
      swatch.className = "sw " + item.cls;
      li.append(swatch, item.name);
      list.append(li);
    }
    figure.append(list);
  }
  const svg = chartSvg("svg", { viewBox: "0 0 " + CHART_W + " " + CHART_H, role: "img", "aria-label": title });
  figure.append(svg);
  container.append(figure);
  return svg;
}

function drawAxes(svg, yMax, yFormat, xTitle, yTitle) {
  const plotH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
  const x0 = CHART_PAD.left;
  const x1 = CHART_W - CHART_PAD.right;
  for (let i = 0; i <= 4; i++) {
    const value = yFormat === "percent" || !Number.isInteger(yMax) ? yMax * i / 4 : Math.round(yMax * i / 4);
    const y = CHART_PAD.top + plotH - plotH * i / 4;
    svg.append(chartSvg("line", { x1: x0, y1: y, x2: x1, y2: y, class: i === 0 ? "axis" : "gridline" }));
    svg.append(chartSvg("text", { x: x0 - 8, y: y + 4, class: "tick", "text-anchor": "end" }, formatTick(value, yFormat)));
  }
  if (xTitle) svg.append(chartSvg("text", { x: (x0 + x1) / 2, y: CHART_H - 6, class: "axis-title", "text-anchor": "middle" }, xTitle));
  if (yTitle) svg.append(chartSvg("text", { x: 14, y: CHART_PAD.top + plotH / 2, class: "axis-title", "text-anchor": "middle", transform: "rotate(-90 14 " + (CHART_PAD.top + plotH / 2) + ")" }, yTitle));
}

function barChart(container, options) {
  const { title, labels, series, xTitle, yTitle, yFormat, reference, referenceLabel, labelEvery } = options;
  CHART_W = options.width || 640;
  const svg = chartFrame(container, title, series);
  const dataMax = Math.max(...series.flatMap(s => s.values), ...(reference ? [].concat(reference) : []));
  const yMax = options.yMax ?? niceMax(dataMax);
  drawAxes(svg, yMax, yFormat, xTitle, yTitle);
  const plotW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const plotH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
  const band = plotW / labels.length;
  const gap = Math.min(4, band * 0.2);
  const barW = Math.max(1, (band - gap) / series.length - (series.length > 1 ? 1 : 0));
  const yOf = v => CHART_PAD.top + plotH - plotH * Math.min(v, yMax) / yMax;
  const every = labelEvery || Math.ceil(labels.length / 16);
  labels.forEach((label, i) => {
    const bandX = CHART_PAD.left + i * band + gap / 2;
    series.forEach((s, j) => {
      const v = s.values[i];
      const y = yOf(v);
      const bar = chartSvg("rect", { x: bandX + j * (barW + 1), y, width: barW, height: Math.max(0, CHART_PAD.top + plotH - y), class: "bar " + s.cls });
      bar.append(chartSvg("title", {}, s.name + " · " + label + ": " + formatTick(v, yFormat === "percent" ? undefined : yFormat) + (yFormat === "percent" ? " (" + (v * 100).toFixed(1) + "%)" : "")));
      svg.append(bar);
    });
    if (i % every === 0) {
      svg.append(chartSvg("text", { x: bandX + (band - gap) / 2, y: CHART_PAD.top + plotH + 16, class: "tick", "text-anchor": "middle" }, label));
    }
    if (Array.isArray(reference)) {
      const y = yOf(reference[i]);
      svg.append(chartSvg("line", { x1: bandX - gap / 2, y1: y, x2: bandX + band - gap / 2, y2: y, class: "reference" }));
    }
  });
  if (typeof reference === "number") {
    const y = yOf(reference);
    svg.append(chartSvg("line", { x1: CHART_PAD.left, y1: y, x2: CHART_W - CHART_PAD.right, y2: y, class: "reference" }));
    if (referenceLabel) svg.append(chartSvg("text", { x: CHART_W - CHART_PAD.right, y: y - 6, class: "reference-label", "text-anchor": "end" }, referenceLabel));
  } else if (Array.isArray(reference) && referenceLabel) {
    svg.append(chartSvg("text", { x: CHART_W - CHART_PAD.right, y: CHART_PAD.top + 10, class: "reference-label", "text-anchor": "end" }, referenceLabel));
  }
}

function scatterChart(container, options) {
  const { title, points, xMax, yMax, xTitle, yTitle } = options;
  CHART_W = options.width || 640;
  const svg = chartFrame(container, title);
  const yTop = yMax;
  drawAxes(svg, yTop, null, xTitle, yTitle);
  const plotW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const plotH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
  const xTop = xMax;
  for (let i = 0; i <= 4; i++) {
    const x = CHART_PAD.left + plotW * i / 4;
    svg.append(chartSvg("text", { x, y: CHART_PAD.top + plotH + 16, class: "tick", "text-anchor": "middle" }, formatTick(Math.round(xTop * i / 4))));
  }
  const r = points.length > 2000 ? 1.4 : points.length > 300 ? 2 : 3.5;
  for (const [x, y] of points) {
    const dot = chartSvg("circle", { cx: CHART_PAD.left + plotW * x / xTop, cy: CHART_PAD.top + plotH - plotH * y / yTop, r, class: "dot" });
    if (points.length <= 300) dot.append(chartSvg("title", {}, "(" + x + ", " + y + ")"));
    svg.append(dot);
  }
}
