const MODELS = {
  bernoulli: {
    name: "Bernoulli",
    draw: p => (Math.random() < p ? 1 : 0),
    mean: p => p,
    variance: p => p * (1 - p)
  },
  rademacher: {
    name: "Rademacher",
    draw: () => (Math.random() < 0.5 ? -1 : 1),
    mean: () => 0,
    variance: () => 1
  }
};

function simulatePaths(model, p, n, m, points) {
  const draw = MODELS[model].draw;
  const step = Math.max(1, Math.floor(n / points));
  const ks = [];
  for (let k = step; k <= n; k += step) ks.push(k);
  if (ks[ks.length - 1] !== n) ks.push(n);
  const paths = [];
  for (let a = 0; a < m; a++) {
    const values = new Float64Array(ks.length);
    let s = 0;
    let next = 0;
    for (let k = 1; k <= n; k++) {
      s += draw(p);
      if (k === ks[next]) values[next++] = s;
    }
    paths.push(values);
  }
  return { ks, paths };
}

function simulateTotals(model, p, n, m) {
  const draw = MODELS[model].draw;
  const totals = new Float64Array(m);
  for (let a = 0; a < m; a++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += draw(p);
    totals[a] = s;
  }
  return totals;
}

function sampleMean(values) {
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

function sampleVariance(values) {
  const mean = sampleMean(values);
  let s = 0;
  for (const v of values) s += (v - mean) ** 2;
  return s / (values.length - 1);
}
