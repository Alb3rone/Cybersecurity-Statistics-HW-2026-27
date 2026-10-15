const MAX_P = 67108859;
const MAX_ROWS_SHOWN = 60;
const MAX_NAIVE_K = 100000;
const MAX_COUNT_P = 2000000;

function readParams() {
  const value = id => Number(document.getElementById(id).value);
  return { p: value("in-p"), b: value("in-b"), gx: value("in-gx"), gy: value("in-gy"), k: value("in-k") };
}

function validateParams({ p, b, gx, gy, k }) {
  for (const [name, v] of [["p", p], ["b", b], ["Gx", gx], ["Gy", gy], ["k", k]]) {
    if (!Number.isInteger(v)) return name + " must be an integer.";
  }
  if (!isPrime(p) || p < 5) return "p must be a prime number of at least 5.";
  if (p > MAX_P) return "p is too large for this demo: use a prime below " + MAX_P + ".";
  if (mod(b, p) === 0) return "b must not be a multiple of p, otherwise the curve y² = x³ is singular.";
  if (gx < 0 || gx >= p || gy < 0 || gy >= p) return "The coordinates of G must be between 0 and p − 1.";
  if (k < 1 || k > Number.MAX_SAFE_INTEGER) return "The private key k must be a positive integer below 2⁵³.";
  const curve = makeCurve(p, 0, b);
  if (!isOnCurve(curve, { x: gx, y: gy })) {
    const lhs = mulmod(gy, gy, p);
    const rhs = mod(gx * gx % p * gx + b, p);
    return "G = (" + gx + ", " + gy + ") is not on the curve: y² ≡ " + lhs + " but x³ + " + b + " ≡ " + rhs + " (mod " + p + ").";
  }
  return null;
}

function sequentialMultiples(curve, G, k) {
  const steps = [{ j: 1, op: "G", lambda: null, point: G }];
  let current = G;
  for (let j = 2; j <= k; j++) {
    const d = addDetailed(curve, current, G);
    let op;
    if (d.kind === "double") op = "G + G (doubling)";
    else if (d.kind === "add") op = (j - 1) + "G + G";
    else if (d.kind === "opposite") op = (j - 1) + "G + G = O (opposite points)";
    else op = "O + G";
    current = d.result;
    steps.push({ j, op, lambda: d.lambda ?? null, point: current });
  }
  return steps;
}

function cell(text, className) {
  const td = document.createElement("td");
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function renderSteps(steps) {
  const body = document.querySelector("#steps-table tbody");
  body.replaceChildren();
  const shown = steps.length <= MAX_ROWS_SHOWN
    ? steps
    : [...steps.slice(0, MAX_ROWS_SHOWN - 10), null, ...steps.slice(-9)];
  for (const s of shown) {
    const tr = document.createElement("tr");
    if (s === null) {
      const td = cell("… " + (steps.length - MAX_ROWS_SHOWN + 1) + " rows hidden …", "gap");
      td.colSpan = 4;
      tr.append(td);
    } else {
      tr.append(cell(s.j, "num"), cell(s.op), cell(s.lambda === null ? "–" : s.lambda, "num"), cell(pointToString(s.point), "num"));
      if (s.j === steps.length) tr.className = "final";
    }
    body.append(tr);
  }
}

function renderDoubleAndAdd(k, dna) {
  document.getElementById("dna-bits").textContent = "k = " + k + " = " + dna.bits + "₂ (" + dna.bits.length + " bits)";
  const body = document.querySelector("#dna-table tbody");
  body.replaceChildren();
  dna.trace.forEach((row, i) => {
    const tr = document.createElement("tr");
    const value = parseInt(row.prefix, 2);
    const doubleText = isInfinity(row.before) ? "2·O = O" : "2·" + pointToString(row.before) + " = " + pointToString(row.doubled);
    const addText = row.addOp ? pointToString(row.doubled) + " + G = " + pointToString(row.after) : "–";
    tr.append(cell(row.bit, "num"), cell(row.prefix + "₂ = " + value, "num"), cell(doubleText, "num"), cell(addText, "num"), cell(pointToString(row.after) + " = " + value + "G", "num"));
    if (i === dna.trace.length - 1) tr.className = "final";
    body.append(tr);
  });
}

function renderPublicKey(k, Q) {
  const box = document.getElementById("public-key");
  box.replaceChildren();
  const label = document.createElement("span");
  label.className = "result-label";
  label.textContent = "TOY PUBLIC KEY";
  const value = document.createElement("span");
  value.className = "result-value";
  value.textContent = "Q = " + k + "G = " + pointToString(Q);
  box.append(label, value);
}

function fact(list, term, text) {
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.textContent = text;
  list.append(dt, dd);
}

function renderCurveInfo(curve, G, k) {
  const list = document.getElementById("curve-info");
  list.replaceChildren();
  if (curve.p > MAX_COUNT_P) {
    fact(list, "Points on the curve", "not counted for p above " + MAX_COUNT_P);
    return null;
  }
  const total = countPoints(curve);
  const n = pointOrder(curve, G, total);
  fact(list, "Points on the curve", total + " (" + (total - 1) + " affine points + O)");
  fact(list, "Order of G", n + " (the smallest n with nG = O)");
  fact(list, "Distinct public keys from G", n - 1 + " (k = 1 … " + (n - 1) + ")");
  if (k >= n) fact(list, "Note", "k = " + k + " ≥ n, so kG = (k mod n)G = " + (k % n) + "G.");
  return n;
}

function compute(event) {
  if (event) event.preventDefault();
  const params = readParams();
  const errorBox = document.getElementById("param-error");
  const check = document.getElementById("param-check");
  const error = validateParams(params);
  if (error) {
    errorBox.textContent = error;
    errorBox.hidden = false;
    check.textContent = "";
    return;
  }
  errorBox.hidden = true;
  const curve = makeCurve(params.p, 0, params.b);
  const G = { x: params.gx, y: params.gy };
  const k = params.k;
  const g2 = mulmod(G.y, G.y, curve.p);
  check.textContent = "G = " + pointToString(G) + " is on the curve: " + G.y + "² ≡ " + g2 + " ≡ " + G.x + "³ + " + curve.b + " (mod " + curve.p + ").";
  renderCurveInfo(curve, G, k);

  const dna = scalarMultiply(curve, k, G);
  const skipped = document.getElementById("naive-skipped");
  const table = document.getElementById("steps-table");
  if (k <= MAX_NAIVE_K) {
    const steps = sequentialMultiples(curve, G, k);
    renderSteps(steps);
    table.hidden = false;
    skipped.hidden = true;
    if (!samePoint(steps[steps.length - 1].point, dna.result)) throw new Error("The two methods disagree.");
  } else {
    table.hidden = true;
    skipped.textContent = "k is larger than " + MAX_NAIVE_K + ": repeated addition is skipped and Q is computed with double-and-add below.";
    skipped.hidden = false;
  }
  renderPublicKey(k, dna.result);
  renderDoubleAndAdd(k, dna);
  renderVisual(curve, G, k);
}

document.getElementById("param-form").addEventListener("submit", compute);
compute();
