function logGamma(z) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function upperGamma(a, x) {
  if (x <= 0) return 1;
  const front = Math.exp(-x + a * Math.log(x) - logGamma(a));
  if (x < a + 1) {
    let term = 1 / a, sum = term;
    for (let n = 1; n < 1000 && Math.abs(term) > Math.abs(sum) * 1e-16; n++) {
      term *= x / (a + n);
      sum += term;
    }
    return 1 - sum * front;
  }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return front * h;
}

function chiSquare(t) {
  const expected = t.xs.map((_, i) => t.fs.map((_, j) => t.rowTotals[i] * t.colTotals[j] / t.n));
  let stat = 0, small = 0;
  const parts = t.xs.map((_, i) => t.fs.map((_, j) => {
    const e = expected[i][j];
    if (e < 5) small++;
    const c = (t.counts[i][j] - e) ** 2 / e;
    stat += c;
    return c;
  }));
  const df = (t.xs.length - 1) * (t.fs.length - 1);
  return { expected, parts, stat, df, p: df > 0 ? upperGamma(df / 2, stat / 2) : NaN, small };
}

function fmtP(p) {
  if (!Number.isFinite(p)) return "–";
  return p < 1e-4 ? p.toExponential(2) : p.toFixed(4);
}

function renderChiSquare() {
  const t = current;
  if (!t) return;
  const r = chiSquare(t);
  const corner = t.xName + " \\ " + t.fName;
  renderTable("table-expected", [corner, ...t.fs, "total"], [
    ...t.xs.map((x, i) => [x, ...r.expected[i].map(e => e.toFixed(1)), String(t.rowTotals[i])]),
    ["total", ...t.colTotals.map(String), String(t.n)]
  ]);
  renderTable("table-parts", [corner, ...t.fs], t.xs.map((x, i) => [x, ...r.parts[i].map(c => c.toFixed(2))]));
  renderTable("table-chi", ["χ²", "degrees of freedom (r − 1)(c − 1)", "p-value", "critical value at 5%"],
    [[r.stat.toFixed(2), String(r.df), fmtP(r.p), r.df > 0 ? criticalValue(r.df).toFixed(2) : "–"]]);
  const text = document.getElementById("chi-text");
  if (r.df === 0) {
    text.textContent = "One of the two variables takes a single value, so there is nothing to test.";
    return;
  }
  text.textContent =
    "χ² = " + r.stat.toFixed(2) + " with " + r.df + (r.df === 1 ? " degree" : " degrees") + " of freedom gives p = " + fmtP(r.p) + ". " +
    (r.p < 0.05
      ? "If " + t.xName + " and " + t.fName + " were independent, a value at least this large would occur with probability " + fmtP(r.p) + ": independence is rejected at the 5% level, and the two variables are statistically dependent."
      : "A value at least this large is not unusual under independence: the data do not give evidence against independence at the 5% level.") +
    (r.small ? " Warning: " + r.small + " expected frequencies are below 5, so the χ² approximation is not reliable." : "");
}

function criticalValue(df) {
  let lo = 0, hi = df + 20 * Math.sqrt(2 * df) + 20;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (upperGamma(df / 2, mid / 2) > 0.05) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

document.addEventListener("hw7:table", renderChiSquare);
renderChiSquare();
