const STATS_MAX_N = 200000;

function bitLength(v) {
  return v <= 0 ? 0 : Math.floor(Math.log2(v)) + 1;
}

function popcount(v) {
  let c = 0;
  while (v) {
    v &= v - 1;
    c++;
  }
  return c;
}

function smallestRoot(rhs, p) {
  for (let y = 0; y < p; y++) {
    if (mulmod(y, y, p) === rhs) return y;
  }
  return null;
}

function pointAtX(curve, x) {
  const { p, b } = curve;
  const rhs = mod(mulmod(mulmod(x, x, p), x, p) + b, p);
  if (rhs === 0 || !isQuadraticResidue(rhs, p)) return null;
  const y = smallestRoot(rhs, p);
  return { x, y: Math.min(y, p - y) };
}

function firstPoint(curve) {
  for (let x = 0; x < curve.p; x++) {
    const P = pointAtX(curve, x);
    if (P) return P;
  }
  return null;
}

function allMultiples(curve, G, n) {
  const xs = new Int32Array(n - 1);
  const ys = new Int32Array(n - 1);
  let P = G;
  for (let k = 1; k < n; k++) {
    xs[k - 1] = P.x;
    ys[k - 1] = P.y;
    P = addPoints(curve, P, G);
  }
  return { xs, ys };
}

function binnedHistogram(values, p, bins) {
  const counts = new Array(bins).fill(0);
  const expected = new Array(bins).fill(0);
  const labels = [];
  for (let b = 0; b < bins; b++) {
    const lo = Math.ceil(b * p / bins);
    const hi = Math.ceil((b + 1) * p / bins);
    expected[b] = values.length * (hi - lo) / p;
    labels.push(String(lo));
  }
  for (const v of values) counts[Math.floor(v * bins / p)]++;
  return { counts, expected, labels };
}

function valueCounts(values, p) {
  const counts = new Int32Array(p);
  for (const v of values) counts[v]++;
  return counts;
}

function bitFrequencies(values, L) {
  const ones = new Array(L).fill(0);
  for (const v of values) {
    for (let i = 0; i < L; i++) if ((v >> i) & 1) ones[i]++;
  }
  return ones.map(o => o / values.length);
}

function expectedBitFrequency(i, p) {
  const period = 2 ** (i + 1);
  const half = 2 ** i;
  const full = Math.floor(p / period) * half;
  const rest = Math.max(0, (p % period) - half);
  return (full + rest) / p;
}

function pearson(a, b) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    sab += da * db; saa += da * da; sbb += db * db;
  }
  return sab / Math.sqrt(saa * sbb);
}

function avalanche(xs, ys, n, L) {
  const kBits = bitLength(n - 1);
  let total = 0;
  let trials = 0;
  for (let k = 1; k < n; k++) {
    for (let i = 0; i < kBits; i++) {
      const k2 = k ^ (1 << i);
      if (k2 < 1 || k2 >= n) continue;
      total += popcount(xs[k - 1] ^ xs[k2 - 1]) + popcount(ys[k - 1] ^ ys[k2 - 1]);
      trials++;
    }
  }
  return { mean: total / trials, trials, kBits };
}

function fmt(v, digits) {
  return Number.isFinite(v) ? v.toFixed(digits ?? 3) : "–";
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function renderTable(id, header, rows) {
  const wrap = document.getElementById(id);
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
  for (const h of header) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = h;
    tr.append(th);
  }
  thead.append(tr);
  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const r = document.createElement("tr");
    row.forEach((value, i) => {
      const td = document.createElement("td");
      td.textContent = value;
      if (i > 0) td.className = "num";
      r.append(td);
    });
    tbody.append(r);
  }
  table.append(thead, tbody);
  wrap.replaceChildren(table);
}

function chooseCurveAndPoint() {
  const curveChoice = document.getElementById("st-curve").value;
  if (curveChoice === "current") {
    const params = readParams();
    const error = validateParams(params);
    if (error) throw new Error("Section 1 has invalid parameters: " + error);
    return { curve: makeCurve(params.p, 0, params.b), G: { x: params.gx, y: params.gy } };
  }
  const curve = makeCurve(Number(curveChoice), 0, 7);
  return { curve, G: firstPoint(curve) };
}

function runAnalysis() {
  const status = document.getElementById("st-status");
  let setup;
  try {
    setup = chooseCurveAndPoint();
  } catch (error) {
    status.textContent = error.message;
    return;
  }
  const { curve, G } = setup;
  const n = pointOrder(curve, G, STATS_MAX_N);
  if (n === null) {
    status.textContent = "The order of G is above " + STATS_MAX_N + ": choose a smaller curve.";
    return;
  }
  if (n < 3) {
    status.textContent = "G has order " + n + ": there are not enough public keys to analyse.";
    return;
  }
  status.textContent = "Computing all " + (n - 1) + " public keys…";
  setTimeout(() => {
    analyse(curve, G, n);
    status.textContent = "";
  }, 20);
}

function analyse(curve, G, n) {
  const p = curve.p;
  const N = n - 1;
  const L = bitLength(p - 1);
  const { xs, ys } = allMultiples(curve, G, n);
  const ks = Int32Array.from({ length: N }, (_, i) => i + 1);

  const summary = document.getElementById("st-summary");
  summary.replaceChildren();
  fact(summary, "Curve", "y² = x³ + " + curve.b + " (mod " + p + ")");
  fact(summary, "Base point G", pointToString(G));
  fact(summary, "Order of G", String(n));
  fact(summary, "Samples", N + " public keys Q = kG, k = 1 … " + N);

  const bins = Math.min(p, 32);
  const hx = binnedHistogram(xs, p, bins);
  const hy = binnedHistogram(ys, p, bins);
  const every = Math.ceil(bins / 6);
  barChart(document.getElementById("ch-x"), {
    width: 440, title: "Histogram of x (" + bins + " classes)", labels: hx.labels, labelEvery: every,
    series: [{ name: "x", values: hx.counts, cls: "s1" }], reference: hx.expected, referenceLabel: "— uniform expectation",
    xTitle: "x (class start)", yTitle: "count"
  });
  barChart(document.getElementById("ch-y"), {
    width: 440, title: "Histogram of y (" + bins + " classes)", labels: hy.labels, labelEvery: every,
    series: [{ name: "y", values: hy.counts, cls: "s2" }], reference: hy.expected, referenceLabel: "— uniform expectation",
    xTitle: "y (class start)", yTitle: "count"
  });
  const cx = valueCounts(xs, p);
  const cy = valueCounts(ys, p);
  const distinctX = cx.reduce((s, c) => s + (c > 0 ? 1 : 0), 0);
  const distinctY = cy.reduce((s, c) => s + (c > 0 ? 1 : 0), 0);
  const maxX = Math.max(...cx);
  const maxY = Math.max(...cy);
  setText("st-uniform-text",
    "Grouped into classes, x and y are spread fairly evenly over 0 … p − 1. Value by value they are not: only " + distinctX + " of the " + p +
    " possible x values and " + distinctY + " of the " + p + " y values ever appear, and each one appears at most " + maxX + " times (x) or " + maxY + " times (y). " +
    "The x values repeat because kG and (n − k)G = −kG share the same x. " +
    (p % 3 === 1
      ? "Since p ≡ 1 (mod 3), the same y can also belong to three different x values."
      : "Since p ≡ 2 (mod 3), x ↦ x³ is one-to-one and each y belongs to a single x.") +
    " So Q is uniform over the points of the curve, not over all pairs of numbers.");

  const bx = bitFrequencies(xs, L);
  const by = bitFrequencies(ys, L);
  const expectedBits = Array.from({ length: L }, (_, i) => expectedBitFrequency(i, p));
  const bitLabels = Array.from({ length: L }, (_, i) => "b" + i);
  barChart(document.getElementById("ch-bits"), {
    title: "Share of 1s in each bit of x and y (b0 = least significant)", labels: bitLabels, labelEvery: 1,
    series: [{ name: "x", values: bx, cls: "s1" }, { name: "y", values: by, cls: "s2" }],
    reference: expectedBits, referenceLabel: "— expected for a uniform integer in [0, p)",
    yFormat: "percent", yMax: 1, xTitle: "bit position", yTitle: "share of 1s"
  });
  const top = L - 1;
  setText("st-bits-text",
    "The low bits are close to 50% ones. The top bit b" + top + " is 1 only " + fmt(100 * bx[top], 1) + "% of the time in x, because p = " + p +
    " is not a power of 2 and the largest values are missing. This comes from the encoding of the numbers, not from the curve.");

  const corr = [
    ["k and x", pearson(ks, xs)],
    ["k and y", pearson(ks, ys)],
    ["x and y", pearson(xs, ys)]
  ];
  renderTable("st-corr", ["Pair", "Pearson r"], corr.map(([name, r]) => [name, fmt(r)]));
  setText("st-corr-text",
    "All correlations are close to 0: knowing k does not linearly predict the coordinates of Q. This is only a necessary condition, " +
    "since here k is still found by trying all " + N + " keys.");

  const av = avalanche(xs, ys, n, L);
  setText("st-aval-text",
    "Flipping one of the " + av.kBits + " bits of k changes on average " + fmt(av.mean, 2) + " of the " + 2 * L + " bits of (x, y), over " + av.trials +
    " trials; an ideal hash would change about " + L + ". The result looks scrambled, but kG keeps an exact algebraic structure: Q(k + 1) = Q(k) + G " +
    "and Q(k₁) + Q(k₂) = Q(k₁ + k₂).");
}

document.getElementById("st-curve").addEventListener("change", runAnalysis);
runAnalysis();
