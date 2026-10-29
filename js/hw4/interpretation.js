const SIZE_NS = [10, 100, 1000, 10000];
const ATTACKER_MS = [1, 10, 100, 1000];

function renderInterpretation() {
  const { model, p } = params;
  const mu = MODELS[model].mean(p);
  const sigma = Math.sqrt(MODELS[model].variance(p));
  const tail = 1 - normalCdf(2);
  renderTable("int-size", ["Systems n", "expected total nμ", "standard deviation σ√n", "average score: μ ± 2σ/√n"],
    SIZE_NS.map(n => [n.toLocaleString("en-US"), num(n * mu), num(sigma * Math.sqrt(n)),
      num(mu) + " ± " + num(2 * sigma / Math.sqrt(n))]));
  renderTable("int-attackers", ["Attackers m", "expected attackers above nμ + 2σ√n", "P(at least one above)", "error on the estimated mean of Sₙ/n"],
    ATTACKER_MS.map(m => [m.toLocaleString("en-US"), num(m * tail, 2), (100 * (1 - Math.pow(1 - tail, m))).toFixed(1) + "%", "σ/√(mn) = " + num(sigma / Math.sqrt(m)) + "/√n"]));
}

document.addEventListener("hw4:params", renderInterpretation);
renderInterpretation();
