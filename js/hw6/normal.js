const SQRT2PI = Math.sqrt(2 * Math.PI);
const REFERENCE = [
  [0, "0"],
  [0.5, "0.382924922548026"],
  [1, "0.682689492137086"],
  [1.5, "0.866385597462284"],
  [2, "0.954499736103642"],
  [2.5, "0.987580669348448"],
  [3, "0.997300203936740"],
  [4, "0.999936657516334"],
  [5, "0.999999426696856"],
  [6, "0.999999998026825"],
  [7, "0.999999999997440"],
  [8, "0.999999999999999"]
];

function pdf(x) {
  return Math.exp(-x * x / 2) / SQRT2PI;
}

function cdfSimpson(x, n) {
  const h = x / n;
  let sum = pdf(0) + pdf(x);
  for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * pdf(i * h);
  return 0.5 + sum * h / 3;
}

function cdfErfSeries(x) {
  const z = x / Math.SQRT2;
  let term = z, sum = z, k = 0;
  while (Math.abs(term) > 1e-17 * Math.abs(sum) && k < 500) {
    k++;
    term *= -z * z / k;
    sum += term / (2 * k + 1);
  }
  return { value: 0.5 + sum / Math.sqrt(Math.PI), terms: k + 1 };
}

function erfAS(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const e = 1 - poly * Math.exp(-z * z);
  return z < 0 ? -e : e;
}

function cdfAS(x) {
  return 0.5 * (1 + erfAS(x / Math.SQRT2));
}

function upperTail(x) {
  let f = x;
  for (let k = 60; k >= 1; k--) f = x + k / f;
  return pdf(x) / f;
}

function cdf(x) {
  if (x > 3) return 1 - upperTail(x);
  if (x < -3) return upperTail(-x);
  let term = x, sum = x;
  for (let k = 1; Math.abs(term) > 1e-17 * Math.abs(sum); k++) {
    term *= x * x / (2 * k + 1);
    sum += term;
  }
  return 0.5 + pdf(x) * sum;
}

function expo(v) {
  if (!Number.isFinite(v)) return "–";
  if (v === 0) return "0";
  return v.toExponential(1);
}

function renderNormal() {
  renderTable("cdf-table", ["x", "reference Φ(x)", "this method Φ(x)", "error", "Simpson, n = 100", "erf series", "erf, A&S 7.1.26"],
    REFERENCE.map(([x, p]) => {
      const ref = (1 + Number(p)) / 2;
      const err = v => expo(Math.abs(v - ref));
      return [String(x), ref.toFixed(16), cdf(x).toFixed(16), err(cdf(x)), err(cdfSimpson(x, 100)), err(cdfErfSeries(x).value), err(cdfAS(x))];
    }));
}

renderNormal();
