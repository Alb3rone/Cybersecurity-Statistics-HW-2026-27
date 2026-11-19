function renderDepartments() {
  const records = berkeleyRecords();
  renderTable("table-departments", ["department", "applicants", "admission rate, men", "admission rate, women", "χ²", "p-value"],
    BERKELEY.map(([d]) => {
      const t = crossTab(records.filter(r => r.department === d).map(r => [r.gender, r.admission]));
      const r = chiSquare(t);
      const rate = g => pct(t.counts[t.xs.indexOf(g)][0] / t.rowTotals[t.xs.indexOf(g)]);
      return [d, t.n.toLocaleString("en-US"), rate("male"), rate("female"), r.stat.toFixed(2), fmtP(r.p)];
    }));
}

renderDepartments();
