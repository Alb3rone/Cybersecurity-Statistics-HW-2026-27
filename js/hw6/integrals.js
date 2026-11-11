const FUNCTIONS = [
  { name: "sin(x)", domain: "[0, π]", a: 0, b: Math.PI, f: x => Math.sin(x), exact: 2 },
  { name: "x²", domain: "[0, 1]", a: 0, b: 1, f: x => x * x, exact: 1 / 3 },
  { name: "1 if x < 0.5, 3 if x ≥ 0.5", domain: "[0, 1]", a: 0, b: 1, f: x => (x < 0.5 ? 1 : 3), exact: 2 },
  { name: "|x − 0.5|", domain: "[0, 1]", a: 0, b: 1, f: x => Math.abs(x - 0.5), exact: 0.25 },
  { name: "1/√x", domain: "(0, 1]", a: 0, b: 1, f: x => 1 / Math.sqrt(x), exact: 2 },
  { name: "1 if x < 0.5, 0 if x ≥ 0.5", domain: "[0, 1]", a: 0, b: 1, f: x => (x < 0.5 ? 1 : 0), exact: 0.5 },
  { name: "sin(x)/x", domain: "[0, π]", a: 0, b: Math.PI, f: x => (x === 0 ? 1 : Math.sin(x) / x), exact: 1.851937051982466 }
];
const CONV_NS = [10, 100, 1000, 10000, 100000];

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
    row.forEach((cell, i) => tr.append(el("td", i > 0 ? "num" : "", cell)));
    body.append(tr);
  }
  table.append(thead, body);
  document.getElementById(id).replaceChildren(table);
}

function sci(v) {
  if (!Number.isFinite(v)) return "–";
  if (v === 0) return "0";
  return Math.abs(v) >= 1e-3 && Math.abs(v) < 1e4 ? Number(v.toPrecision(4)).toString() : v.toExponential(2);
}

function riemann(fn, n) {
  const h = (fn.b - fn.a) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += fn.f(fn.a + (i + 0.5) * h);
  return sum * h;
}

function countAbove(sorted, t) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] > t) hi = mid;
    else lo = mid + 1;
  }
  return sorted.length - lo;
}

function lebesgue(fn, m, k) {
  const length = fn.b - fn.a;
  const h = length / m;
  const values = new Float64Array(m);
  for (let i = 0; i < m; i++) values[i] = fn.f(fn.a + (i + 0.5) * h);
  values.sort();
  const low = values[0];
  const dt = (values[m - 1] - low) / k;
  let sum = low * length;
  for (let j = 0; j < k; j++) sum += dt * length * countAbove(values, low + (j + 0.5) * dt) / m;
  return sum;
}

function readInt(id, lo, hi, label) {
  const v = Number(document.getElementById(id).value);
  if (!Number.isInteger(v) || v < lo || v > hi) throw new Error(label + " must be an integer between " + lo.toLocaleString("en-US") + " and " + hi.toLocaleString("en-US") + ".");
  return v;
}

function renderIntegrals() {
  const error = document.getElementById("int-error");
  let n, k;
  try {
    n = readInt("in-n", 2, 1000000, "N");
    k = readInt("in-k", 1, 1000000, "K");
    error.hidden = true;
  } catch (e) {
    error.textContent = e.message;
    error.hidden = false;
    return;
  }
  renderTable("int-table", ["f(x)", "domain", "exact integral", "Riemann", "error", "Lebesgue", "error"],
    FUNCTIONS.map(fn => {
      const r = riemann(fn, n);
      const l = lebesgue(fn, n, k);
      return [fn.name, fn.domain, Number(fn.exact.toPrecision(10)).toString(), r.toPrecision(10), sci(r - fn.exact), l.toPrecision(10), sci(l - fn.exact)];
    }));
}

function timeIt(run) {
  let reps = 0;
  const start = performance.now();
  do {
    run();
    reps++;
  } while (performance.now() - start < 60);
  return (performance.now() - start) / reps;
}

function renderConvergence() {
  const header = ["f(x)"].concat(CONV_NS.map(n => "N = " + n.toLocaleString("en-US")));
  renderTable("conv-riemann", header, FUNCTIONS.map(fn => [fn.name].concat(CONV_NS.map(n => sci(Math.abs(riemann(fn, n) - fn.exact))))));
  renderTable("conv-lebesgue", header, FUNCTIONS.map(fn => [fn.name].concat(CONV_NS.map(n => sci(Math.abs(lebesgue(fn, n, n) - fn.exact))))));
  const fn = FUNCTIONS[0];
  renderTable("conv-time", ["N = K", "Riemann time", "Lebesgue time", "ratio"], [1000, 10000, 100000].map(n => {
    const tr = timeIt(() => riemann(fn, n));
    const tl = timeIt(() => lebesgue(fn, n, n));
    return [n.toLocaleString("en-US"), tr.toFixed(3) + " ms", tl.toFixed(3) + " ms", (tl / tr).toFixed(1) + "×"];
  }));
}

document.getElementById("int-form").addEventListener("submit", e => {
  e.preventDefault();
  renderIntegrals();
});
renderIntegrals();
renderConvergence();
