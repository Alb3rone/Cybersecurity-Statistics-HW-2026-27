const SCORE = {
  mean: 20 / 7,
  variance: 1000 / 392,
  kurtosis: 2.88
};

function drawScore() {
  let first = Infinity, second = Infinity;
  for (let i = 0; i < 6; i++) {
    const u = Math.random();
    if (u < first) {
      second = first;
      first = u;
    } else if (u < second) {
      second = u;
    }
  }
  return 10 * second;
}

function simulateHackers(m, n) {
  const means = new Float64Array(m);
  const variances = new Float64Array(m);
  const scores = new Float64Array(n);
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) scores[i] = drawScore();
    const r = welford(scores);
    means[j] = r.mean;
    variances[j] = r.variance;
  }
  return { means, variances };
}

function summary(values) {
  const r = welford(values);
  return { mean: r.mean, sd: Math.sqrt(r.variance), se: Math.sqrt(r.variance / r.n) };
}

function readSample() {
  const m = Number(document.getElementById("in-hackers").value);
  const n = Number(document.getElementById("in-systems").value);
  if (!Number.isInteger(m) || m < 10 || m > 10000) throw new Error("m must be an integer between 10 and 10000.");
  if (!Number.isInteger(n) || n < 2 || n > 10000) throw new Error("n must be an integer between 2 and 10000.");
  if (m * n > 2e7) throw new Error("m × n must be at most 20,000,000.");
  return { m, n };
}

function renderScoreTable() {
  renderTable("score-theory", ["", "value"], [
    ["μ = 10·α/(α + β)", num(SCORE.mean)],
    ["σ² = 100·αβ/((α + β)²(α + β + 1))", num(SCORE.variance)],
    ["σ", num(Math.sqrt(SCORE.variance))]
  ]);
}

function runSample() {
  const error = document.getElementById("sample-error");
  let p;
  try {
    p = readSample();
    error.hidden = true;
  } catch (e) {
    error.textContent = e.message;
    error.hidden = false;
    return;
  }
  const { m, n } = p;
  const data = simulateHackers(m, n);
  const sm = summary(data.means);
  const sv = summary(data.variances);
  const z = (a, b, se) => num((a - b) / se, 2);
  renderTable("sample-table", ["quantity", "average over the m hackers", "theoretical value", "difference", "standard error of the average", "difference / standard error"], [
    ["sampling mean x̄", num(sm.mean), "μ = " + num(SCORE.mean), num(sm.mean - SCORE.mean), num(sm.se), z(sm.mean, SCORE.mean, sm.se)],
    ["sampling variance s²", num(sv.mean), "σ² = " + num(SCORE.variance), num(sv.mean - SCORE.variance), num(sv.se), z(sv.mean, SCORE.variance, sv.se)]
  ]);
  document.getElementById("sample-text").textContent =
    "With " + m.toLocaleString("en-US") + " hackers and n = " + n.toLocaleString("en-US") + " systems each, the average of the sampling means differs from μ by " +
    num(Math.abs(sm.mean - SCORE.mean)) + " and the average of the sampling variances differs from σ² by " + num(Math.abs(sv.mean - SCORE.variance)) +
    (Math.abs((sm.mean - SCORE.mean) / sm.se) < 3 && Math.abs((sv.mean - SCORE.variance) / sv.se) < 3
      ? ". Both differences are within three standard errors of the average, so they are explained by the finite number of hackers and show no systematic error."
      : ". One difference is larger than three standard errors: this happens by chance in a small fraction of the runs, and it disappears when the simulation is repeated.");
}

renderScoreTable();
document.getElementById("sample-form").addEventListener("submit", e => {
  e.preventDefault();
  runSample();
});
runSample();
