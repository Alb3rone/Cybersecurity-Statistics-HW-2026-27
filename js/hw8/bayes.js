const PREVALENCES = [0.0001, 0.001, 0.01, 0.1];
const BETA_PRIORS = [
  { name: "uniform Beta(1, 1)", a: 1, b: 1 },
  { name: "last audit Beta(2, 18), mean 10%", a: 2, b: 18 },
  { name: "wrong and strong Beta(50, 50), mean 50%", a: 50, b: 50 }
];
const SCANS = [[10, 3], [100, 30], [1000, 300]];

function posterior(prior, sens, fpr) {
  return sens * prior / (sens * prior + fpr * (1 - prior));
}

function readProb(id, label) {
  const v = Number(document.getElementById(id).value);
  if (!(v > 0 && v < 1)) throw new Error(label + " must be between 0 and 1 (excluded).");
  return v;
}

function renderAlert() {
  const error = document.getElementById("alert-error");
  let sens, fpr;
  try {
    sens = readProb("in-sens", "Sensitivity");
    fpr = readProb("in-fpr", "False-positive rate");
    error.hidden = true;
  } catch (e) {
    error.textContent = e.message;
    error.hidden = false;
    return;
  }
  renderTable("alert-table", ["prior P(malware)", "P(alert)", "posterior after one alert", "posterior after two independent alerts", "posterior after one negative scan"],
    PREVALENCES.map(p => {
      const one = posterior(p, sens, fpr);
      const two = posterior(one, sens, fpr);
      const neg = posterior(p, 1 - sens, 1 - fpr);
      return [(100 * p) + "%", pct(sens * p + fpr * (1 - p)), pct(one), pct(two), (100 * neg).toPrecision(2) + "%"];
    }));
}

function logBeta(a, b) {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function logGamma(z) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = z;
  let tmp = z + 5.5;
  tmp -= (z + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / z);
}

function betaFraction(a, b, x) {
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-300) d = 1e-300;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return h;
}

function betaCdf(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta(a, b));
  return x < (a + 1) / (a + b + 2) ? front * betaFraction(a, b, x) / a : 1 - front * betaFraction(b, a, 1 - x) / b;
}

function betaQuantile(q, a, b) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (betaCdf(mid, a, b) < q) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function renderBetaBinomial() {
  const rows = [];
  for (const [n, k] of SCANS) {
    for (const pr of BETA_PRIORS) {
      const a = pr.a + k, b = pr.b + n - k;
      rows.push([n.toLocaleString("en-US") + " servers, " + k + " vulnerable", pr.name, "Beta(" + a + ", " + b + ")", pct(a / (a + b)),
        pct(betaQuantile(0.025, a, b)) + " – " + pct(betaQuantile(0.975, a, b))]);
    }
  }
  renderTable("beta-table", ["data", "prior", "posterior", "posterior mean", "95% credible interval"], rows);
}

document.getElementById("alert-form").addEventListener("submit", e => {
  e.preventDefault();
  renderAlert();
});
renderAlert();
renderBetaBinomial();
