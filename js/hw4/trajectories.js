const PLOT_POINTS = 400;
const params = { model: "bernoulli", p: 0.3, n: 1000, m: 30 };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderTable(id, header, rows) {
  const table = el("table");
  const head = el("tr");
  for (const h of header) {
    const th = el("th", "", h);
    th.scope = "col";
    head.append(th);
  }
  const thead = el("thead");
  thead.append(head);
  const body = el("tbody");
  for (const row of rows) {
    const tr = el("tr");
    row.forEach((v, i) => tr.append(el("td", i > 0 ? "num" : "", v)));
    body.append(tr);
  }
  table.append(thead, body);
  document.getElementById(id).replaceChildren(table);
}

function num(v, digits) {
  if (!Number.isFinite(v)) return "–";
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString("en-US");
  return Number(v.toFixed(digits ?? 4)).toString();
}

function readParams() {
  const model = document.getElementById("in-model").value;
  const p = Number(document.getElementById("in-p").value);
  const n = Number(document.getElementById("in-n").value);
  const m = Number(document.getElementById("in-m").value);
  if (model === "bernoulli" && !(p > 0 && p < 1)) throw new Error("p must be between 0 and 1.");
  if (!Number.isInteger(n) || n < 10 || n > 100000) throw new Error("n must be an integer between 10 and 100000.");
  if (!Number.isInteger(m) || m < 1 || m > 200) throw new Error("m must be an integer between 1 and 200.");
  return { model, p, n, m };
}

function renderTheory() {
  const { model, p, n } = params;
  const mu = MODELS[model].mean(p);
  const s2 = MODELS[model].variance(p);
  renderTable("theory", ["Quantity", "Mean", "Variance", "Value for n = " + n.toLocaleString("en-US")], [
    ["Total score Sₙ", "nμ", "nσ²", "mean " + num(n * mu) + ", variance " + num(n * s2)],
    ["Average score Sₙ / n", "μ", "σ² / n", "mean " + num(mu) + ", variance " + num(s2 / n, 6)],
    ["Normalized total Sₙ / √n", "√n · μ", "σ²", "mean " + num(Math.sqrt(n) * mu) + ", variance " + num(s2)]
  ]);
}

function renderTrajectories() {
  const { model, p, n, m } = params;
  const mu = MODELS[model].mean(p);
  const sigma = Math.sqrt(MODELS[model].variance(p));
  const { ks, paths } = simulatePaths(model, p, n, m, PLOT_POINTS);
  const legend = [{ name: "attackers", cls: "path" }, { name: "expected value", cls: "mean" }, { name: "± 2 standard deviations", cls: "guide" }];
  const views = [
    { id: "ch-total", label: "Total score Sₙ", title: "Total score Sₖ", yTitle: "Sₖ", f: (s, k) => s, mean: k => mu * k, sd: k => sigma * Math.sqrt(k) },
    { id: "ch-average", label: "Average score Sₙ / n", title: "Average score Sₖ / k", yTitle: "Sₖ / k", f: (s, k) => s / k, mean: () => mu, sd: k => sigma / Math.sqrt(k) },
    { id: "ch-normalized", label: "Normalized total Sₙ / √n", title: "Normalized total score Sₖ / √k", yTitle: "Sₖ / √k", f: (s, k) => s / Math.sqrt(k), mean: k => mu * Math.sqrt(k), sd: () => sigma }
  ];
  const finals = [];
  for (const v of views) {
    const lines = paths.map(path => ({ values: Array.from(path, (s, i) => v.f(s, ks[i])) }));
    const start = v.id === "ch-average" ? Math.max(1, Math.floor(ks.length / 50)) : 0;
    const xs = ks.slice(start);
    lineChart(document.getElementById(v.id), {
      title: v.title + " for " + m + " attacker" + (m === 1 ? "" : "s"), xs, legend, xMin: 0, xMax: n,
      lines: lines.map(l => ({ values: l.values.slice(start) })),
      guides: [
        { values: xs.map(k => v.mean(k)), cls: "mean" },
        { values: xs.map(k => v.mean(k) + 2 * v.sd(k)) },
        { values: xs.map(k => v.mean(k) - 2 * v.sd(k)) }
      ],
      xTitle: "systems attacked k", yTitle: v.yTitle
    });
    const last = paths.map(path => v.f(path[path.length - 1], n));
    const inside = last.filter(x => Math.abs(x - v.mean(n)) <= 2 * v.sd(n)).length;
    finals.push({ title: v.label, last, sd: v.sd(n), inside });
  }
  renderTable("spread", ["At k = n = " + n.toLocaleString("en-US"), "observed standard deviation", "theoretical", "attackers within ± 2 sd"],
    finals.map(f => [f.title, m > 1 ? num(Math.sqrt(sampleVariance(f.last))) : "–", num(f.sd), f.inside + " of " + m]));
  document.getElementById("traj-text").textContent =
    "The three charts show the same " + m + " trajectories with different scalings. The total score spreads out: its band widens like √k" +
    (mu !== 0 ? " around a line that grows like " + num(mu) + "·k" : " around 0") + ". The average score is the same trajectories divided by k: " +
    "the band shrinks like 1/√k and every attacker settles near μ = " + num(mu) + ". Dividing by √k instead keeps the width of the band constant, " +
    "equal to ±2σ = ±" + num(2 * sigma) + (mu !== 0 ? ", while the center √k·μ keeps growing because the increments do not have zero mean." : ", and the trajectories keep fluctuating without settling or spreading.");
}

function run(event) {
  if (event) event.preventDefault();
  const errorBox = document.getElementById("sim-error");
  try {
    Object.assign(params, readParams());
    errorBox.hidden = true;
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
    return;
  }
  renderTheory();
  renderTrajectories();
  document.dispatchEvent(new CustomEvent("hw4:params"));
}

function syncModel() {
  document.getElementById("in-p").disabled = document.getElementById("in-model").value !== "bernoulli";
}

document.getElementById("sim-form").addEventListener("submit", run);
document.getElementById("in-model").addEventListener("change", () => { syncModel(); run(); });
syncModel();
run();
