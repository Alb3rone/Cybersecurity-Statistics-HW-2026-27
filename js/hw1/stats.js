const STATS_MAX_N = 200000;
const AVALANCHE_MAX_KEYS = 20000;
const SHA_MAX_TRIALS = 4000;
const LINEARITY_TRIALS = 1000;

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

function randomPoint(curve) {
  for (;;) {
    const P = pointAtX(curve, Math.floor(Math.random() * curve.p));
    if (P) return Math.random() < 0.5 ? P : negate(curve, P);
  }
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

function normalCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-z * z / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

function chiSquarePValue(chi, df) {
  const z = (Math.cbrt(chi / df) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  return 1 - normalCdf(z);
}

function chiSquare(observed, expected) {
  let chi = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] > 0) chi += (observed[i] - expected[i]) ** 2 / expected[i];
  }
  const df = observed.length - 1;
  return { chi, df, pValue: chiSquarePValue(chi, df) };
}

function occupancyTest(observedDistinct, p, N) {
  const q1 = Math.pow(1 - 1 / p, N);
  const q2 = Math.pow(1 - 2 / p, N);
  const expected = p * (1 - q1);
  const variance = p * (p - 1) * q2 + p * q1 - p * p * q1 * q1;
  const z = (observedDistinct - expected) / Math.sqrt(variance);
  return { expected, z, pValue: 2 * (1 - normalCdf(Math.abs(z))) };
}

function binnedHistogram(values, p, bins) {
  const counts = new Array(bins).fill(0);
  const expected = new Array(bins).fill(0);
  const labels = [];
  for (let b = 0; b < bins; b++) {
    const lo = Math.ceil(b * p / bins);
    const hi = Math.ceil((b + 1) * p / bins);
    expected[b] = values.length * (hi - lo) / p;
    labels.push(hi - lo === 1 ? String(lo) : String(lo));
  }
  for (const v of values) counts[Math.floor(v * bins / p)]++;
  return { counts, expected, labels };
}

function valueCounts(values, p) {
  const counts = new Int32Array(p);
  for (const v of values) counts[v]++;
  return counts;
}

function multiplicities(counts, maxM) {
  const result = new Array(maxM + 1).fill(0);
  for (const c of counts) result[Math.min(c, maxM)]++;
  return result;
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

function ranks(values) {
  const order = Array.from(values, (v, i) => i).sort((i, j) => values[i] - values[j]);
  const r = new Float64Array(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && values[order[j + 1]] === values[order[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let t = i; t <= j; t++) r[order[t]] = avg;
    i = j + 1;
  }
  return r;
}

function spearman(a, b) {
  return pearson(ranks(a), ranks(b));
}

function meanAndSd(values) {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return { mean, sd: Math.sqrt(variance) };
}

function sampleKeys(n, max) {
  if (n - 1 <= max) return Array.from({ length: n - 1 }, (_, i) => i + 1);
  const keys = [];
  for (let i = 0; i < max; i++) keys.push(1 + Math.floor(Math.random() * (n - 1)));
  return keys;
}

function keyBytes(k) {
  return new Uint8Array([(k >>> 24) & 255, (k >>> 16) & 255, (k >>> 8) & 255, k & 255]);
}

function hammingBytes(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += popcount(a[i] ^ b[i]);
  return d;
}

function avalanche(xs, ys, n, L) {
  const kBits = bitLength(n - 1);
  const ec = [];
  const sha = [];
  const pairs = [];
  for (const k of sampleKeys(n, AVALANCHE_MAX_KEYS)) {
    for (let i = 0; i < kBits; i++) {
      const k2 = k ^ (1 << i);
      if (k2 < 1 || k2 >= n) continue;
      const d = popcount(xs[k - 1] ^ xs[k2 - 1]) + popcount(ys[k - 1] ^ ys[k2 - 1]);
      ec.push(d / (2 * L));
      pairs.push([k, k2]);
    }
  }
  const shaTrials = Math.min(SHA_MAX_TRIALS, pairs.length);
  for (let t = 0; t < shaTrials; t++) {
    const [k, k2] = pairs[Math.floor(Math.random() * pairs.length)];
    sha.push(hammingBytes(sha256(keyBytes(k)), sha256(keyBytes(k2))) / 256);
  }
  return { ec, sha, kBits };
}

function shareHistogram(values, bins) {
  const counts = new Array(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.floor(v * bins))]++;
  return counts.map(c => c / values.length);
}

function linearityCheck(curve, G, xs, ys, n) {
  const point = k => (k % n === 0 ? INFINITY : { x: xs[(k % n) - 1], y: ys[(k % n) - 1] });
  let holds = 0;
  for (let t = 0; t < LINEARITY_TRIALS; t++) {
    const k1 = 1 + Math.floor(Math.random() * (n - 1));
    const k2 = 1 + Math.floor(Math.random() * (n - 1));
    if (samePoint(addPoints(curve, point(k1), point(k2)), point(k1 + k2))) holds++;
  }
  return holds;
}

function fmt(v, digits) {
  return Number.isFinite(v) ? v.toFixed(digits ?? 3) : "–";
}

function pText(pValue) {
  return pValue < 0.0001 ? "< 0.0001" : fmt(pValue, 4);
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
  const baseChoice = document.getElementById("st-base").value;
  if (curveChoice === "current") {
    const params = readParams();
    const error = validateParams(params);
    if (error) throw new Error("Section 1 has invalid parameters: " + error);
    const curve = makeCurve(params.p, 0, params.b);
    const G = baseChoice === "random" ? randomPoint(curve) : { x: params.gx, y: params.gy };
    return { curve, G };
  }
  const curve = makeCurve(Number(curveChoice), 0, 7);
  return { curve, G: baseChoice === "random" ? randomPoint(curve) : firstPoint(curve) };
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
    const t0 = performance.now();
    analyse(curve, G, n);
    status.textContent = "Analysis of " + (n - 1) + " public keys done in " + Math.round(performance.now() - t0) + " ms.";
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
  fact(summary, "Curve", "y² = x³ + " + curve.b + " (mod " + p + "), p ≡ " + (p % 3) + " (mod 3)");
  fact(summary, "Base point G", pointToString(G));
  fact(summary, "Order of G", n + (isPrime(n) ? " (prime)" : ""));
  fact(summary, "Samples", N + " public keys Q = kG, k = 1 … " + N);
  fact(summary, "Coordinate size", L + " bits for x and for y");

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
  const chiBinX = chiSquare(hx.counts, hx.expected);
  const chiBinY = chiSquare(hy.counts, hy.expected);
  const distinctX = cx.reduce((s, c) => s + (c > 0 ? 1 : 0), 0);
  const distinctY = cy.reduce((s, c) => s + (c > 0 ? 1 : 0), 0);
  const occX = occupancyTest(distinctX, p, N);
  const occY = occupancyTest(distinctY, p, N);
  const verdict = pv => (pv < 0.05 ? "reject uniformity" : "looks uniform");
  renderTable("st-uniform", ["Test", "statistic", "expected if uniform", "p-value", "verdict at 5%"], [
    ["χ² on " + bins + " classes of x (df " + chiBinX.df + ")", "χ² = " + fmt(chiBinX.chi, 1), fmt(chiBinX.df, 0), pText(chiBinX.pValue), verdict(chiBinX.pValue)],
    ["χ² on " + bins + " classes of y (df " + chiBinY.df + ")", "χ² = " + fmt(chiBinY.chi, 1), fmt(chiBinY.df, 0), pText(chiBinY.pValue), verdict(chiBinY.pValue)],
    ["distinct x values among " + N + " keys", String(distinctX), fmt(occX.expected, 0), pText(occX.pValue), verdict(occX.pValue)],
    ["distinct y values among " + N + " keys", String(distinctY), fmt(occY.expected, 0), pText(occY.pValue), verdict(occY.pValue)]
  ]);
  setText("st-uniform-text",
    "Grouped into classes, x and y look uniform" + (chiBinX.pValue < 0.05 || chiBinY.pValue < 0.05 ? " only partly" : "") +
    ". Value by value they are not: only " + distinctX + " of the " + p + " possible x values (" + fmt(100 * distinctX / p, 1) +
    "%) and " + distinctY + " of the " + p + " y values (" + fmt(100 * distinctY / p, 1) + "%) ever appear, while " + N +
    " truly uniform draws would hit about " + fmt(occX.expected, 0) + " different values. A point exists only when x³ + " + curve.b +
    " is a square mod p, which happens for about half of the x values. A χ² test on single values is not reliable here, because with about one key per value the expected counts are far below the usual minimum of 5.");

  const maxM = 6;
  const mx = multiplicities(cx, maxM);
  const my = multiplicities(cy, maxM);
  const mLabels = Array.from({ length: maxM + 1 }, (_, m) => (m === maxM ? "≥" + m : String(m)));
  barChart(document.getElementById("ch-mult"), {
    title: "How many values of [0, p) appear 0, 1, 2, … times", labels: mLabels, labelEvery: 1,
    series: [{ name: "x", values: mx, cls: "s1" }, { name: "y", values: my, cls: "s2" }],
    xTitle: "times a value appears among the " + N + " public keys", yTitle: "number of values"
  });
  const xPattern = mx.map((c, m) => (c > 0 ? m : null)).filter(m => m !== null).join(", ");
  const yPattern = my.map((c, m) => (c > 0 ? m : null)).filter(m => m !== null).join(", ");
  let symmetric = 0;
  for (let k = 1; k < n; k++) if (xs[k - 1] === xs[n - k - 1] && ys[k - 1] === mod(-ys[n - k - 1], p)) symmetric++;
  const multText = "Each x value appears either " + xPattern.replace(/, (?=[^,]*$)/, " or ") + " times, and each y value " + yPattern.replace(/, (?=[^,]*$)/, " or ") + " times. " +
    "The 2 comes from symmetry: (n − k)G = −kG has the same x and y → p − y, and this holds for " + symmetric + " of " + N + " keys. " +
    (p % 3 === 1
      ? "Because p ≡ 1 (mod 3) there is a cube root of unity β ≠ 1, and (x, y), (βx, y), (β²x, y) are all on the curve, so y values come in groups of 3."
      : "Because p ≡ 2 (mod 3), x ↦ x³ is a bijection and each y value belongs to a single x, up to the sign of y.") +
    " A random function would give a Poisson-like spread of counts instead of these fixed numbers.";
  setText("st-mult-text", multText);

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
  const allOnes = (bx.reduce((s, v) => s + v, 0) + by.reduce((s, v) => s + v, 0)) / (2 * L);
  const top = L - 1;
  setText("st-bits-text",
    "The low bits are balanced (about 50% ones). The top bit b" + top + " is 1 only " + fmt(100 * bx[top], 1) + "% of the time in x, close to the " +
    fmt(100 * expectedBits[top], 1) + "% expected for any number below p = " + p + ": since p is not a power of 2, large values are missing. " +
    "This is a property of the encoding, not of the curve. Overall " + fmt(100 * allOnes, 1) + "% of all coordinate bits are 1. " +
    "The least significant bit of y is exactly balanced because y and p − y always both occur, and one of them is odd.");

  const lagX = xs.subarray(0, N - 1);
  const lagX1 = xs.subarray(1);
  const corr = [
    ["k and x", pearson(ks, xs), spearman(ks, xs)],
    ["k and y", pearson(ks, ys), spearman(ks, ys)],
    ["x of kG and x of (k+1)G", pearson(lagX, lagX1), spearman(lagX, lagX1)],
    ["x and y of the same point", pearson(xs, ys), spearman(xs, ys)]
  ];
  const limit = 2 / Math.sqrt(N / 2);
  renderTable("st-corr", ["Pair", "Pearson r", "Spearman ρ", "|r| below noise level " + fmt(limit) + "?"],
    corr.map(([name, r, rho]) => [name, fmt(r), fmt(rho), Math.abs(r) < limit ? "yes" : "no"]));
  const step = Math.max(1, Math.floor(N / 3000));
  const scatterPts = [];
  const lagPts = [];
  for (let i = 0; i < N; i += step) {
    scatterPts.push([i + 1, xs[i]]);
    if (i + 1 < N) lagPts.push([xs[i], xs[i + 1]]);
  }
  scatterChart(document.getElementById("ch-scatter"), { width: 440, title: "Private key k against x of the public key", points: scatterPts, xMax: N, yMax: p - 1, xTitle: "k", yTitle: "x" });
  scatterChart(document.getElementById("ch-scatter-lag"), { width: 440, title: "x of kG against x of (k+1)G", points: lagPts, xMax: p - 1, yMax: p - 1, xTitle: "x of kG", yTitle: "x of (k+1)G" });
  setText("st-corr-text",
    "All correlations are close to 0. The noise level is 2/√(N/2) = " + fmt(limit) + " rather than 2/√N, because x(k) = x(n − k) means only half of the pairs are independent. " +
    "The scatter plots look like clouds: knowing k, or the previous point, " +
    "does not linearly predict x. The one visible structure is the mirror symmetry x(k) = x(n − k), which makes the first scatter plot symmetric " +
    "around k = n/2. Low correlation is only a necessary condition: k is still found by trying all " + N + " keys, which takes milliseconds here.");

  const av = avalanche(xs, ys, n, L);
  const avBins = 2 * L;
  const ecStats = meanAndSd(av.ec);
  const shaStats = meanAndSd(av.sha);
  const avLabels = Array.from({ length: avBins }, (_, i) => Math.round(i * 100 / avBins) + "%");
  barChart(document.getElementById("ch-aval"), {
    title: "Share of output bits that change when one bit of k is flipped", labels: avLabels, labelEvery: Math.ceil(avBins / 10),
    series: [{ name: "kG, bits of x‖y (" + 2 * L + " bits)", values: shareHistogram(av.ec, avBins), cls: "s1" },
             { name: "SHA-256 of k (256 bits)", values: shareHistogram(av.sha, avBins), cls: "s2" }],
    yFormat: "percent", xTitle: "share of changed output bits", yTitle: "share of trials"
  });
  const linear = linearityCheck(curve, G, xs, ys, n);
  renderTable("st-aval", ["Function", "trials", "mean changed", "std. dev.", "ideal std. dev."], [
    ["kG (x‖y, " + 2 * L + " bits)", av.ec.length, fmt(100 * ecStats.mean, 1) + "%", fmt(100 * ecStats.sd, 1) + "%", fmt(100 * 0.5 / Math.sqrt(2 * L), 1) + "%"],
    ["SHA-256 (256 bits)", av.sha.length, fmt(100 * shaStats.mean, 1) + "%", fmt(100 * shaStats.sd, 1) + "%", fmt(100 * 0.5 / Math.sqrt(256), 1) + "%"]
  ]);
  setText("st-aval-text",
    "Flipping one of the " + av.kBits + " bits of k changes on average " + fmt(100 * ecStats.mean, 1) + "% of the bits of the public key, so it looks avalanche-like, " +
    "with a wider spread than SHA-256 because the output has only " + 2 * L + " bits. But kG is not a scrambler: it is a group homomorphism. " +
    "In " + linear + " of " + LINEARITY_TRIALS + " random tests Q(k₁) + Q(k₂) = Q(k₁ + k₂), and Q(k + 1) is always Q(k) + G. " +
    "A hash function must have no such algebraic relation; for kG it is exactly what makes signatures and key exchange work.");

  setText("obs-uniform", "Classes: looks uniform. Single values: only " + fmt(100 * distinctX / p, 0) + "% of x values occur.");
  setText("obs-freq", "Fixed counts (x: " + xPattern + "; y: " + yPattern + ") from the symmetries of the curve.");
  setText("obs-bits", "Low bits balanced, top bit biased by p < 2^" + L + ".");
  setText("obs-corr", "All |r| < " + fmt(Math.max(...corr.map(c => Math.abs(c[1]))), 3) + ", but x(k) = x(n − k).");
  setText("obs-aval", "Mean " + fmt(100 * ecStats.mean, 1) + "% bits changed, yet Q(k₁)+Q(k₂) = Q(k₁+k₂) in " + linear + "/" + LINEARITY_TRIALS + ".");
  const distinctPoints = new Set(Array.from(xs, (x, i) => x * p + ys[i])).size;
  setText("obs-collision", N + " keys gave " + distinctPoints + " distinct points: " + (distinctPoints === N ? "no collisions, k ↦ kG is one-to-one." : (N - distinctPoints) + " collisions."));
  setText("obs-inversion", "Brute force over " + N + " keys is instant here; secp256k1 has n ≈ 2²⁵⁶.");
}

document.getElementById("st-run").addEventListener("click", runAnalysis);
document.getElementById("st-curve").addEventListener("change", runAnalysis);
document.getElementById("st-base").addEventListener("change", runAnalysis);
runAnalysis();
