const SQRT_NS = [10, 100, 1000, 10000];
const RHOS = [0, 0.01, 0.1];

function sdMean(n, rho) {
  return Math.sqrt((1 + (n - 1) * rho) / n);
}

function renderSqrtN() {
  renderTable("sqrt-table", ["n", "sd(Sₙ) = σ√n", "sd(Sₙ/n) = σ/√n", "sd(Sₙ/√n) = σ", ...RHOS.slice(1).map(r => "sd(Sₙ/n), ρ = " + r)],
    SQRT_NS.map(n => [n.toLocaleString("en-US"), Math.sqrt(n).toFixed(2), (1 / Math.sqrt(n)).toFixed(4), "1", ...RHOS.slice(1).map(r => sdMean(n, r).toFixed(4))]));
  renderTable("sample-size", ["margin of error δ (in units of σ)", "n needed for a 95% interval x̄ ± δ"],
    [0.5, 0.1, 0.05, 0.01].map(d => [String(d), Math.ceil((1.96 / d) ** 2).toLocaleString("en-US")]));
}

renderSqrtN();
