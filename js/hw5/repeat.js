const REPEAT_NS = [2, 5, 10, 30, 100, 1000];
const HIST_NS = [5, 30, 1000];

function sdOfVariance(n) {
  const s4 = SCORE.variance * SCORE.variance;
  return Math.sqrt(s4 * (SCORE.kurtosis / n - (n - 3) / (n * (n - 1))));
}

function shares(values, lo, hi, bins) {
  const counts = new Array(bins).fill(0);
  const width = (hi - lo) / bins;
  for (const v of values) {
    const i = Math.floor((v - lo) / width);
    if (i >= 0 && i < bins) counts[i]++;
  }
  return counts.map(c => c / values.length);
}

function centers(lo, hi, bins) {
  const width = (hi - lo) / bins;
  return Array.from({ length: bins }, (_, i) => Number((lo + (i + 0.5) * width).toFixed(2)).toString());
}

function runRepeat() {
  let m;
  try {
    m = readSample().m;
  } catch (e) {
    return;
  }
  const results = new Map(REPEAT_NS.map(n => [n, simulateHackers(m, n)]));
  const sigma = Math.sqrt(SCORE.variance);
  const rows = [];
  for (const [n, data] of results) {
    const sm = summary(data.means);
    const sv = summary(data.variances);
    rows.push([n.toLocaleString("en-US"), num(sm.mean), num(sv.mean), num(sm.sd), num(sigma / Math.sqrt(n)), num(sv.sd), num(sdOfVariance(n))]);
  }
  renderTable("repeat-table", ["systems n", "average x̄", "average s²", "sd of x̄", "σ/√n", "sd of s²", "theoretical sd of s²"], rows);

  const grid = document.getElementById("repeat-grid");
  grid.replaceChildren();
  const quantities = [
    { key: "means", name: "sampling mean x̄", lo: -0.125, hi: 5.875, bins: 24, cls: "s1" },
    { key: "variances", name: "sampling variance s²", lo: -0.125, hi: 9.875, bins: 40, cls: "s2" }
  ];
  for (const q of quantities) {
    for (const n of HIST_NS) {
      const box = document.createElement("div");
      grid.append(box);
      barChart(box, {
        width: 320, title: q.name + ", n = " + n.toLocaleString("en-US"), labels: centers(q.lo, q.hi, q.bins), labelEvery: q.bins / 4,
        series: [{ name: "hackers", values: shares(results.get(n)[q.key], q.lo, q.hi, q.bins), cls: q.cls }], yFormat: "percent", xTitle: q.name, yTitle: "hackers"
      });
    }
  }

  const first = summary(results.get(REPEAT_NS[0]).variances).sd;
  const last = summary(results.get(REPEAT_NS[REPEAT_NS.length - 1]).variances).sd;
  document.getElementById("repeat-text").textContent =
    "For every n the two averages stay close to μ = " + num(SCORE.mean) + " and σ² = " + num(SCORE.variance) + ". What changes is the spread across hackers: from n = 2 to n = 1,000 the standard deviation of the sampling means falls from " +
    num(summary(results.get(2).means).sd) + " to " + num(summary(results.get(1000).means).sd) + " and that of the sampling variances from " + num(first) + " to " + num(last) +
    ", both following the theoretical values, which decrease like 1/√n.";
}

document.getElementById("sample-form").addEventListener("submit", runRepeat);
runRepeat();
