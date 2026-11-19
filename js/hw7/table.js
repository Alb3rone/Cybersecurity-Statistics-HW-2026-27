let current = null;

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

function pct(v) {
  return Number.isFinite(v) ? (100 * v).toFixed(1) + "%" : "–";
}

function readData() {
  const choice = document.getElementById("in-dataset").value;
  if (choice === "custom") {
    return { pairs: parseCsv(document.getElementById("in-csv").value), x: "X", f: "F" };
  }
  const d = DATASETS[choice];
  return { pairs: berkeleyRecords().map(r => [r[d.x], r[d.f]]), x: d.x, f: d.f };
}

function renderContingency() {
  const error = document.getElementById("data-error");
  let data;
  try {
    data = readData();
    error.hidden = true;
  } catch (e) {
    error.textContent = e.message;
    error.hidden = false;
    return;
  }
  const t = crossTab(data.pairs);
  current = { ...t, xName: data.x, fName: data.f };
  const corner = data.x + " \\ " + data.f;
  document.getElementById("data-summary").textContent =
    t.n.toLocaleString("en-US") + " records, " + t.xs.length + " values of " + data.x + " and " + t.fs.length + " values of " + data.f + ".";

  renderTable("table-counts", [corner, ...t.fs, "total"], [
    ...t.xs.map((x, i) => [x, ...t.counts[i].map(String), String(t.rowTotals[i])]),
    ["total", ...t.colTotals.map(String), String(t.n)]
  ]);
  renderTable("table-joint", [corner, ...t.fs, "marginal of " + data.x], [
    ...t.xs.map((x, i) => [x, ...t.counts[i].map(c => pct(c / t.n)), pct(t.rowTotals[i] / t.n)]),
    ["marginal of " + data.f, ...t.colTotals.map(c => pct(c / t.n)), "100.0%"]
  ]);
  renderTable("table-row", [corner, ...t.fs, "total"], [
    ...t.xs.map((x, i) => [x, ...t.counts[i].map(c => pct(c / t.rowTotals[i])), "100.0%"]),
    ["all", ...t.colTotals.map(c => pct(c / t.n)), "100.0%"]
  ]);
  renderTable("table-col", [corner, ...t.fs, "all"], [
    ...t.xs.map((x, i) => [x, ...t.counts[i].map((c, j) => pct(c / t.colTotals[j])), pct(t.rowTotals[i] / t.n)]),
    ["total", ...t.fs.map(() => "100.0%"), "100.0%"]
  ]);
  document.dispatchEvent(new Event("hw7:table"));
}

function syncCustom() {
  document.getElementById("csv-field").hidden = document.getElementById("in-dataset").value !== "custom";
}

document.getElementById("in-dataset").addEventListener("change", () => {
  syncCustom();
  renderContingency();
});
document.getElementById("data-form").addEventListener("submit", e => {
  e.preventDefault();
  renderContingency();
});
syncCustom();
renderContingency();
