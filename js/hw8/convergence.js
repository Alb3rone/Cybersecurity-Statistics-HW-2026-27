const DECADES = [1, 2, 3, 4, 5, 6, 7, 8];

function successTimes(limit) {
  const times = [];
  let n = 1;
  while (n <= limit) {
    times.push(n);
    n = Math.floor(n / Math.random()) + 1;
  }
  return times;
}

function renderConvergence() {
  const m = Number(document.getElementById("in-paths").value);
  const error = document.getElementById("conv-error");
  if (!Number.isInteger(m) || m < 100 || m > 100000) {
    error.textContent = "m must be an integer between 100 and 100000.";
    error.hidden = false;
    return;
  }
  error.hidden = true;
  const limit = 10 ** (DECADES[DECADES.length - 1] + 1);
  const counts = DECADES.map(() => 0);
  const hit = DECADES.map(() => 0);
  for (let j = 0; j < m; j++) {
    const seen = DECADES.map(() => false);
    for (const t of successTimes(limit - 1)) {
      const d = Math.floor(Math.log10(t)) - DECADES[0];
      if (d < 0 || d >= DECADES.length) continue;
      counts[d]++;
      seen[d] = true;
    }
    seen.forEach((s, d) => { if (s) hit[d]++; });
  }
  renderTable("conv-table", ["n in", "P(Xₙ = 1) = 1/n at the start", "E[Xₙ²] at the start", "average number of n with Xₙ = 1", "paths with at least one Xₙ = 1", "theory"],
    DECADES.map((k, d) => [
      "[10^" + k + ", 10^" + (k + 1) + ")", (10 ** -k).toExponential(0), (10 ** -k).toExponential(0),
      (counts[d] / m).toFixed(2), pct(hit[d] / m), pct(1 - (10 ** k - 1) / (10 ** (k + 1) - 1))
    ]));
}

document.getElementById("conv-form").addEventListener("submit", e => {
  e.preventDefault();
  renderConvergence();
});
renderConvergence();
