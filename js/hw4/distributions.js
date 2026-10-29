const DIST_NS = [10, 100, 1000, 10000];
const LLN_NS = [10, 30, 100, 300, 1000, 3000, 10000];
const LLN_EPS = [0.05, 0.01];
const HIST_BINS = 24;

function checkpointsOf(model, p, ns, m) {
  const draw = MODELS[model].draw;
  const max = Math.max(...ns);
  const out = new Map(ns.map(n => [n, new Float64Array(m)]));
  for (let a = 0; a < m; a++) {
    let s = 0;
    for (let k = 1; k <= max; k++) {
      s += draw(p);
      const row = out.get(k);
      if (row) row[a] = s;
    }
  }
  return out;
}

function normalCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-z * z / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

function histogram(values, lo, hi, bins) {
  const counts = new Array(bins).fill(0);
  const width = (hi - lo) / bins;
  for (const v of values) {
    const i = Math.floor((v - lo) / width);
    if (i >= 0 && i < bins) counts[i]++;
  }
  return { shares: counts.map(c => c / values.length), width };
}

function binLabels(lo, width, bins) {
  return Array.from({ length: bins }, (_, i) => {
    const v = lo + (i + 0.5) * width;
    return Math.abs(v) >= 100 ? String(Math.round(v)) : Number(v.toPrecision(2)).toString();
  });
}

function readDistM() {
  const m = Number(document.getElementById("in-mdist").value);
  if (!Number.isInteger(m) || m < 100 || m > 10000) throw new Error("The number of attackers must be an integer between 100 and 10000.");
  return m;
}

function renderDistributions(data, m) {
  const { model, p } = params;
  const mu = MODELS[model].mean(p);
  const s2 = MODELS[model].variance(p);
  const quantities = [
    { key: "total", name: "Sₙ", f: (s, n) => s, mean: n => n * mu, variance: n => n * s2 },
    { key: "average", name: "Sₙ / n", f: (s, n) => s / n, mean: () => mu, variance: n => s2 / n },
    { key: "normalized", name: "Sₙ / √n", f: (s, n) => s / Math.sqrt(n), mean: n => Math.sqrt(n) * mu, variance: () => s2 }
  ];
  const values = quantities.map(q => DIST_NS.map(n => Array.from(data.get(n), s => q.f(s, n))));
  const sigma = Math.sqrt(s2);
  const unit0 = model === "bernoulli" ? 1 : 2;
  const grid = document.getElementById("dist-grid");
  grid.replaceChildren();
  DIST_NS.forEach((n, j) => {
    quantities.forEach((q, i) => {
      const scale = q.f(1, n);
      const center = q.key === "average" ? mu : q.mean(n);
      const half = q.key === "average" ? 4 * sigma / Math.sqrt(DIST_NS[0]) : 4 * Math.sqrt(q.variance(n));
      const unit = unit0 * scale;
      const base = (model === "bernoulli" ? 0 : n % 2) * scale;
      const width = unit * Math.max(1, Math.ceil(2 * half / HIST_BINS / unit));
      const start = base + unit * Math.floor((center - half - base) / unit) - unit / 2;
      const bins = Math.ceil((center + half - start) / width);
      const h = histogram(values[i][j], start, start + bins * width, bins);
      const box = document.createElement("div");
      grid.append(box);
      barChart(box, {
        width: 320, title: q.name + ", n = " + n.toLocaleString("en-US"), labels: binLabels(start, width, bins), labelEvery: Math.ceil(bins / 4),
        series: [{ name: q.name, values: h.shares, cls: "s" + (i + 1) }], yFormat: "percent", xTitle: q.name, yTitle: "attackers"
      });
    });
  });
  const rows = [];
  DIST_NS.forEach((n, j) => {
    quantities.forEach((q, i) => {
      const v = values[i][j];
      rows.push([q.name + ", n = " + n.toLocaleString("en-US"), num(sampleMean(v)), num(q.mean(n)), num(sampleVariance(v), 6), num(q.variance(n), 6)]);
    });
  });
  renderTable("dist-table", ["Quantity", "observed mean", "theoretical mean", "observed variance", "theoretical variance"], rows);
  const v1 = sampleVariance(values[0][0]), v4 = sampleVariance(values[0][3]);
  document.getElementById("dist-text").textContent =
    "The middle column uses the same horizontal scale for every n; the other two are centered on their expected value and span ±4 theoretical standard deviations, so the width of the scale is read on the axis. The total score spreads out: from n = 10 to n = 10,000 its variance grows from " + num(v1) +
    " to " + num(v4) + ", about 1,000 times, like nσ². The average score does the opposite: its variance falls like σ²/n and the histogram collapses onto μ = " + num(mu) +
    ". The normalized total keeps a variance close to σ² = " + num(s2) + " for every n, so its histogram keeps the same width" +
    (mu !== 0 ? "; in the Bernoulli model it slides to the right, because its mean √n·μ grows without limit." : " and the same position, centered at 0.");
}

function renderLln(data, m) {
  const { model, p } = params;
  const mu = MODELS[model].mean(p);
  const s2 = MODELS[model].variance(p);
  const charts = document.getElementById("lln-grid");
  charts.replaceChildren();
  const rows = [];
  LLN_EPS.forEach((eps, i) => {
    const observed = LLN_NS.map(n => {
      const totals = data.get(n);
      let out = 0;
      for (const s of totals) if (Math.abs(s / n - mu) > eps) out++;
      return out / m;
    });
    const bound = LLN_NS.map(n => Math.min(1, s2 / (n * eps * eps)));
    const box = document.createElement("div");
    charts.append(box);
    barChart(box, {
      width: 440, title: "P(|Sₙ/n − μ| > " + eps + ")", labels: LLN_NS.map(n => n.toLocaleString("en-US")), labelEvery: 1,
      series: [{ name: "observed share of attackers", values: observed, cls: "s1" }], reference: bound, referenceLabel: "— Chebyshev bound σ²/(nε²)",
      yFormat: "percent", yMax: 1, xTitle: "systems n", yTitle: "probability"
    });
    LLN_NS.forEach((n, j) => {
      if (i === 0) rows.push([n.toLocaleString("en-US")]);
      rows[j].push((100 * observed[j]).toFixed(1) + "%", (100 * bound[j]).toFixed(1) + "%");
    });
  });
  renderTable("lln-table", ["n", ...LLN_EPS.flatMap(e => ["ε = " + e + " observed", "ε = " + e + " Chebyshev"])], rows);
  const last = LLN_NS[LLN_NS.length - 1];
  document.getElementById("lln-text").textContent =
    "For every fixed ε the share of attackers whose average is farther than ε from μ goes to 0 as n grows: this is the convergence in probability Sₙ/n → μ " +
    "stated by the Weak Law of Large Numbers. The Chebyshev inequality P(|Sₙ/n − μ| > ε) ≤ σ²/(nε²), which follows from Var(Sₙ/n) = σ²/n, proves it and is always above the observed values, " +
    "but it is a loose bound: the real probability falls much faster. A smaller ε needs a larger n: with ε = " + LLN_EPS[1] + " even n = " + last.toLocaleString("en-US") +
    " systems leave a visible share of attackers outside the interval. For small n the average can only take the values k/n, so the share can stay flat or even rise before it starts to fall.";
}

function renderClt(m) {
  const data = params.model === "rademacher" && lastData ? lastData : checkpointsOf("rademacher", 0.5, LLN_NS, m);
  const grid = document.getElementById("clt-grid");
  grid.replaceChildren();
  for (const n of [10, 100, 1000]) {
    const z = Array.from(data.get(n), s => s / Math.sqrt(n));
    const root = Math.sqrt(n);
    const lattice = 2 / root;
    const width = lattice * Math.max(1, Math.ceil(0.25 / lattice));
    const bins = Math.ceil(8 / width);
    const parity = n % 2;
    const start = (parity - 1 + 2 * Math.floor((-4 * root - (parity - 1)) / 2)) / root;
    const h = histogram(z, start, start + bins * width, bins);
    const expected = Array.from({ length: bins }, (_, i) => normalCdf(start + (i + 1) * width) - normalCdf(start + i * width));
    const box = document.createElement("div");
    grid.append(box);
    barChart(box, {
      width: 320, title: "Rademacher Sₙ / √n, n = " + n.toLocaleString("en-US"), labels: binLabels(start, width, bins), labelEvery: Math.ceil(bins / 6),
      series: [{ name: "attackers", values: h.shares, cls: "s1" }], reference: expected, referenceLabel: "— N(0, 1)",
      yFormat: "percent", xTitle: "Sₙ / √n", yTitle: "attackers"
    });
  }
  const rows = LLN_NS.map(n => {
    const z = Array.from(data.get(n), s => s / Math.sqrt(n)).sort((a, b) => a - b);
    let ks = 0;
    let first = 0;
    for (let i = 0; i < z.length; i++) {
      if (i > 0 && z[i] !== z[i - 1]) first = i;
      if (i + 1 < z.length && z[i + 1] === z[i]) continue;
      const phi = normalCdf(z[i]);
      ks = Math.max(ks, Math.abs((i + 1) / z.length - phi), Math.abs(first / z.length - phi));
    }
    return [n.toLocaleString("en-US"), num(sampleMean(z)), num(sampleVariance(z)), ks.toFixed(3)];
  });
  renderTable("clt-table", ["n", "mean of Sₙ/√n", "variance of Sₙ/√n", "max |F(x) − Φ(x)|"], rows);
  document.getElementById("clt-text").textContent =
    "In the Rademacher model μ = 0 and σ² = 1, so Sₙ/√n has mean 0 and variance 1 for every n, and the Central Limit Theorem says that its distribution converges to the standard normal N(0, 1). " +
    "For n = 10 the score can take only 11 values and the histogram is a coarse staircase; as n grows the possible values get closer (2/√n apart) and the bars follow the normal curve. " +
    "The largest distance between the observed distribution function and Φ shrinks with n until it is comparable to the sampling noise of " + m.toLocaleString("en-US") +
    " attackers: the 5% critical value of the Kolmogorov–Smirnov test is 1.36/√m ≈ " + (1.36 / Math.sqrt(m)).toFixed(3) + ". In the Bernoulli model Sₙ/√n does not converge, because its mean √n·p grows; the theorem applies after centering, to (Sₙ − np)/√(np(1 − p)).";
}

let lastData = null;

function runDistributions() {
  const errorBox = document.getElementById("dist-error");
  const status = document.getElementById("dist-status");
  let m;
  try {
    m = readDistM();
    errorBox.hidden = true;
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
    return;
  }
  status.textContent = "Simulating " + m.toLocaleString("en-US") + " attackers on up to 10,000 systems…";
  setTimeout(() => {
    const ns = [...new Set([...DIST_NS, ...LLN_NS])];
    lastData = checkpointsOf(params.model, params.p, ns, m);
    renderDistributions(lastData, m);
    renderLln(lastData, m);
    renderClt(m);
    status.textContent = "";
    document.dispatchEvent(new CustomEvent("hw4:distributions"));
  }, 20);
}

document.getElementById("dist-run").addEventListener("click", runDistributions);
document.addEventListener("hw4:params", runDistributions);
runDistributions();
