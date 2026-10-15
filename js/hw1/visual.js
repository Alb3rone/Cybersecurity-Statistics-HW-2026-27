const SVG_NS = "http://www.w3.org/2000/svg";
const VIZ_MAX_P = 61;
const VIZ_MAX_OPS = 80;
const VIZ_SIZE = 560;
const VIZ_MARGIN = 34;

const viz = {
  curve: null,
  G: null,
  k: 0,
  ops: [],
  opIndex: 0,
  phase: 0,
  timer: null,
  trail: []
};

function svgEl(tag, attrs, text) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (text !== undefined) el.textContent = text;
  return el;
}

function px(x) {
  const step = (VIZ_SIZE - 2 * VIZ_MARGIN) / (viz.curve.p - 1);
  return VIZ_MARGIN + x * step;
}

function py(y) {
  const step = (VIZ_SIZE - 2 * VIZ_MARGIN) / (viz.curve.p - 1);
  return VIZ_SIZE - VIZ_MARGIN - y * step;
}

function multipleName(v) {
  return v === 1 ? "G" : v + "G";
}

function buildSequentialOps(curve, G, k) {
  const ops = [];
  let A = G;
  for (let j = 1; j < k && ops.length < VIZ_MAX_OPS; j++) {
    const d = addDetailed(curve, A, G);
    ops.push({ A, B: G, nameA: multipleName(j), nameB: "G", nameR: multipleName(j + 1), detail: d });
    A = d.result;
  }
  return ops;
}

function stopTimer() {
  if (viz.timer) clearInterval(viz.timer);
  viz.timer = null;
  document.getElementById("viz-play").textContent = "Animate";
}

function resetVisual() {
  stopTimer();
  viz.opIndex = 0;
  viz.phase = 0;
  viz.trail = viz.G ? [{ P: viz.G, name: "G" }] : [];
  viz.ops = buildSequentialOps(viz.curve, viz.G, viz.k);
  drawVisual();
}

function renderVisual(curve, G, k) {
  viz.curve = curve;
  viz.G = G;
  viz.k = k;
  resetVisual();
}

function drawGrid(svg) {
  const p = viz.curve.p;
  const every = p <= 20 ? 1 : p <= 40 ? 5 : 10;
  for (let v = 0; v < p; v++) {
    const major = v % every === 0;
    svg.append(svgEl("line", { x1: px(v), y1: py(0), x2: px(v), y2: py(p - 1), class: major ? "grid major" : "grid" }));
    svg.append(svgEl("line", { x1: px(0), y1: py(v), x2: px(p - 1), y2: py(v), class: major ? "grid major" : "grid" }));
    if (major) {
      svg.append(svgEl("text", { x: px(v), y: VIZ_SIZE - VIZ_MARGIN + 18, class: "tick", "text-anchor": "middle" }, v));
      svg.append(svgEl("text", { x: VIZ_MARGIN - 10, y: py(v) + 4, class: "tick", "text-anchor": "end" }, v));
    }
  }
}

function drawLine(svg, op) {
  const { p } = viz.curve;
  const { A, detail } = op;
  if (detail.kind === "opposite") {
    svg.append(svgEl("line", { x1: px(A.x), y1: py(0), x2: px(A.x), y2: py(p - 1), class: "mod-line vertical" }));
    return;
  }
  const r = Math.max(2, Math.min(4, 120 / p));
  for (let x = 0; x < p; x++) {
    const y = mod(detail.lambda * (x - A.x) + A.y, p);
    svg.append(svgEl("rect", { x: px(x) - r, y: py(y) - r, width: 2 * r, height: 2 * r, class: "mod-line" }));
  }
}

function label(svg, P, text, cls) {
  svg.append(svgEl("text", { x: px(P.x) + 8, y: py(P.y) - 8, class: "pt-label " + cls }, text));
}

function caption(op) {
  const { detail } = op;
  const lam = detail.lambda;
  const prefix = "Step " + (viz.opIndex + 1) + " of " + viz.ops.length + ": ";
  const sum = op.detail.kind === "double"
    ? "2·" + op.nameA
    : op.nameA + " + " + op.nameB;
  if (viz.phase === 0) {
    return prefix + sum + " with " + op.nameA + " = " + pointToString(op.A) + (op.A === op.B ? "" : " and " + op.nameB + " = " + pointToString(op.B)) + ".";
  }
  if (detail.kind === "opposite") {
    return prefix + "the two points have the same x and opposite y, the line is vertical and the result is O.";
  }
  const kindText = detail.kind === "double" ? "tangent slope λ = (3x² + a) / 2y" : "secant slope λ = (y₂ − y₁) / (x₂ − x₁)";
  if (viz.phase === 1) return prefix + kindText + " = " + lam + " (mod " + viz.curve.p + "). The line meets the curve again at " + pointToString(detail.third) + ".";
  return prefix + "reflect " + pointToString(detail.third) + " to get " + op.nameR + " = " + pointToString(detail.result) + ".";
}

function drawVisual() {
  const svg = document.getElementById("viz");
  const cap = document.getElementById("viz-caption");
  svg.replaceChildren();
  const controls = document.querySelectorAll("#viz-play, #viz-step, #viz-reset");
  if (!viz.curve || viz.curve.p > VIZ_MAX_P) {
    svg.setAttribute("viewBox", "0 0 " + VIZ_SIZE + " 60");
    svg.append(svgEl("text", { x: VIZ_SIZE / 2, y: 34, class: "tick", "text-anchor": "middle" }, "The grid is drawn only for p ≤ " + VIZ_MAX_P + "."));
    cap.textContent = "Choose a smaller p in section 1 to see the animation.";
    controls.forEach(c => { c.disabled = true; });
    return;
  }
  controls.forEach(c => { c.disabled = false; });
  svg.setAttribute("viewBox", "0 0 " + VIZ_SIZE + " " + VIZ_SIZE);
  drawGrid(svg);

  const op = viz.ops[viz.opIndex];
  const finished = viz.opIndex >= viz.ops.length;
  if (op && viz.phase >= 1) drawLine(svg, op);

  const r = Math.max(3, Math.min(6, 160 / viz.curve.p));
  for (const P of listPoints(viz.curve)) {
    svg.append(svgEl("circle", { cx: px(P.x), cy: py(P.y), r, class: "pt" }));
  }
  for (const t of viz.trail) {
    if (isInfinity(t.P)) continue;
    svg.append(svgEl("circle", { cx: px(t.P.x), cy: py(t.P.y), r: r + 1, class: "pt trail" }));
    label(svg, t.P, t.name, "trail-label");
  }

  if (finished) {
    const last = viz.trail[viz.trail.length - 1];
    if (last && !isInfinity(last.P)) {
      svg.append(svgEl("circle", { cx: px(last.P.x), cy: py(last.P.y), r: r + 3, class: "pt result" }));
      label(svg, last.P, last.name, "result-label-svg");
    }
    cap.textContent = viz.ops.length === 0
      ? "k = 1: the public key is G itself, there is nothing to add."
      : "Done: " + (last ? last.name + " = " + pointToString(last.P) : "") +
        (viz.ops.length >= VIZ_MAX_OPS ? " (animation limited to the first " + VIZ_MAX_OPS + " operations)." : ".");
    return;
  }

  for (const P of [op.A, op.B]) {
    svg.append(svgEl("circle", { cx: px(P.x), cy: py(P.y), r: r + 2, class: "pt operand" }));
  }
  label(svg, op.A, op.nameA, "operand-label");
  if (op.A !== op.B) label(svg, op.B, op.nameB, "operand-label");

  if (viz.phase >= 1 && op.detail.kind !== "opposite") {
    const T = op.detail.third;
    svg.append(svgEl("circle", { cx: px(T.x), cy: py(T.y), r: r + 3, class: "pt third" }));
  }
  if (viz.phase >= 2 && op.detail.kind !== "opposite") {
    const T = op.detail.third;
    const R = op.detail.result;
    svg.append(svgEl("line", { x1: px(T.x), y1: py(T.y), x2: px(R.x), y2: py(R.y), class: "reflect" }));
    svg.append(svgEl("circle", { cx: px(R.x), cy: py(R.y), r: r + 3, class: "pt result" }));
    label(svg, R, op.nameR, "result-label-svg");
  }
  cap.textContent = caption(op);
}

function stepVisual() {
  if (viz.opIndex >= viz.ops.length) {
    stopTimer();
    return;
  }
  const op = viz.ops[viz.opIndex];
  const lastPhase = op.detail.kind === "opposite" ? 1 : 2;
  if (viz.phase < lastPhase) {
    viz.phase++;
  } else {
    const trailNames = new Set(viz.trail.map(t => t.name));
    if (!trailNames.has(op.nameR)) viz.trail.push({ P: op.detail.result, name: op.nameR });
    viz.opIndex++;
    viz.phase = 0;
  }
  drawVisual();
  if (viz.opIndex >= viz.ops.length) stopTimer();
}

function togglePlay() {
  if (viz.timer) {
    stopTimer();
    return;
  }
  if (viz.opIndex >= viz.ops.length) resetVisual();
  const delay = 2150 - Number(document.getElementById("viz-speed").value);
  viz.timer = setInterval(stepVisual, delay);
  document.getElementById("viz-play").textContent = "Pause";
}

document.getElementById("viz-play").addEventListener("click", togglePlay);
document.getElementById("viz-step").addEventListener("click", () => { stopTimer(); stepVisual(); });
document.getElementById("viz-reset").addEventListener("click", resetVisual);
document.getElementById("viz-speed").addEventListener("input", () => {
  if (viz.timer) { stopTimer(); togglePlay(); }
});
