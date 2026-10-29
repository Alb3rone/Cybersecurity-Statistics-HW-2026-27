function niceStep(raw) {
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * magnitude >= raw) return f * magnitude;
  return 10 * magnitude;
}

function tickText(v, step) {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + (step / Math.pow(10, Math.floor(Math.log10(step))) === 2.5 ? 1 : 0));
  const rounded = Math.abs(v) < step / 1e6 ? 0 : v;
  return Math.abs(rounded) >= 1000 ? Math.round(rounded).toLocaleString("en-US") : rounded.toFixed(decimals);
}

function lineChart(container, options) {
  const { title, xs, lines, guides, xTitle, yTitle, legend } = options;
  CHART_W = options.width || 640;
  const svg = chartFrame(container, title, legend);
  const plotW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const plotH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
  const all = lines.flatMap(l => Array.from(l.values)).concat((guides || []).flatMap(g => Array.from(g.values)));
  let yMin = options.yMin ?? Math.min(...all);
  let yMax = options.yMax ?? Math.max(...all);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const pad = (yMax - yMin) * 0.05;
  if (options.yMin === undefined) yMin -= pad;
  if (options.yMax === undefined) yMax += pad;
  const xMin = options.xMin ?? xs[0];
  const xMax = options.xMax ?? xs[xs.length - 1];
  const xOf = x => CHART_PAD.left + plotW * (x - xMin) / (xMax - xMin);
  const yOf = y => CHART_PAD.top + plotH - plotH * (Math.max(yMin, Math.min(yMax, y)) - yMin) / (yMax - yMin);
  const yStep = niceStep((yMax - yMin) / 4);
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax + 1e-9; v += yStep) {
    const y = yOf(v);
    svg.append(chartSvg("line", { x1: CHART_PAD.left, y1: y, x2: CHART_W - CHART_PAD.right, y2: y, class: "gridline" }));
    svg.append(chartSvg("text", { x: CHART_PAD.left - 8, y: y + 4, class: "tick", "text-anchor": "end" }, tickText(v, yStep)));
  }
  const xStep = niceStep((xMax - xMin) / 4);
  for (let v = Math.ceil(xMin / xStep) * xStep; v <= xMax + 1e-9; v += xStep) {
    svg.append(chartSvg("text", { x: xOf(v), y: CHART_PAD.top + plotH + 16, class: "tick", "text-anchor": "middle" }, tickText(v, xStep)));
  }
  svg.append(chartSvg("line", { x1: CHART_PAD.left, y1: CHART_PAD.top + plotH, x2: CHART_W - CHART_PAD.right, y2: CHART_PAD.top + plotH, class: "axis" }));
  if (xTitle) svg.append(chartSvg("text", { x: CHART_PAD.left + plotW / 2, y: CHART_H - 6, class: "axis-title", "text-anchor": "middle" }, xTitle));
  if (yTitle) svg.append(chartSvg("text", { x: 14, y: CHART_PAD.top + plotH / 2, class: "axis-title", "text-anchor": "middle", transform: "rotate(-90 14 " + (CHART_PAD.top + plotH / 2) + ")" }, yTitle));
  const pathOf = (lx, values) => {
    let d = "";
    for (let i = 0; i < values.length; i++) d += (i ? "L" : "M") + xOf(lx[i]).toFixed(1) + " " + yOf(values[i]).toFixed(1);
    return d;
  };
  for (const l of lines) svg.append(chartSvg("path", { d: pathOf(l.xs || xs, l.values), class: "line " + (l.cls || "path") }));
  for (const g of guides || []) svg.append(chartSvg("path", { d: pathOf(g.xs || xs, g.values), class: "line " + (g.cls || "guide") }));
}
