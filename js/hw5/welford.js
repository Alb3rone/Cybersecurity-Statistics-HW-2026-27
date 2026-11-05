function welford(xs) {
  let k = 0, mean = 0, ss = 0;
  for (const x of xs) {
    const d = x - mean;
    mean += d / ++k;
    ss += d * (x - mean);
  }
  return { n: k, mean, ss, variance: k > 1 ? ss / (k - 1) : NaN };
}

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

function num(v, digits) {
  if (!Number.isFinite(v)) return "–";
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString("en-US");
  return Number(v.toFixed(digits ?? 4)).toString();
}

function parseData(text) {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const xs = parts.map(Number);
  if (xs.length < 2) throw new Error("Enter at least two numbers.");
  if (xs.length > 1000) throw new Error("Enter at most 1000 numbers.");
  const bad = parts.find((p, i) => !Number.isFinite(xs[i]));
  if (bad !== undefined) throw new Error("\"" + bad + "\" is not a number.");
  return xs;
}

function twoPass(xs) {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const ss = xs.reduce((a, x) => a + (x - mean) ** 2, 0);
  return { mean, ss, variance: ss / (xs.length - 1) };
}

function runWelford() {
  const error = document.getElementById("welford-error");
  let xs;
  try {
    xs = parseData(document.getElementById("in-data").value);
    error.hidden = true;
  } catch (e) {
    error.textContent = e.message;
    error.hidden = false;
    return;
  }
  const rows = [];
  let previous = welford([]);
  for (let k = 1; k <= xs.length; k++) {
    const current = welford(xs.slice(0, k));
    if (k <= 20 || k === xs.length) rows.push([k, num(xs[k - 1]), num(xs[k - 1] - previous.mean), num(current.mean), num(current.ss), num(current.variance)]);
    previous = current;
  }
  const result = previous;
  renderTable("welford-steps", ["k", "xₖ", "xₖ − Mₖ₋₁", "Mₖ", "SSₖ", "sₖ²"], rows);
  const ref = twoPass(xs);
  document.getElementById("welford-check").textContent =
    "Two-pass formulas on the same " + xs.length + " values: mean " + num(ref.mean) + ", SS " + num(ref.ss) + ", variance " + num(ref.variance) +
    ". Welford: mean " + num(result.mean) + ", SS " + num(result.ss) + ", variance " + num(result.variance) +
    (xs.length > 20 ? ". The table shows the first 20 steps and the last one." : ".");
}

document.getElementById("welford-code").textContent = welford.toString();
document.getElementById("welford-form").addEventListener("submit", e => {
  e.preventDefault();
  runWelford();
});
runWelford();
