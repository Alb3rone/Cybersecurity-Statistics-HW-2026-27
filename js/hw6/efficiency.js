const SIMPSON_NS = [2, 4, 8, 16, 32, 64, 128, 256];
const SERIES_XS = [1, 2, 4, 6, 8];
const TIME_POINTS = Array.from({ length: 1000 }, (_, i) => -8 + 16 * i / 999);

function largestTerm(x) {
  const z = x / Math.SQRT2;
  let term = z, best = Math.abs(z);
  for (let k = 1; k < 500; k++) {
    term *= -z * z / k;
    best = Math.max(best, Math.abs(term / (2 * k + 1)));
  }
  return best / Math.sqrt(Math.PI);
}

function maxError(method) {
  let worst = 0;
  for (const [x, p] of REFERENCE) worst = Math.max(worst, Math.abs(method(x) - (1 + Number(p)) / 2));
  return worst;
}

function timePerEvaluation(method) {
  let reps = 0, sink = 0;
  const start = performance.now();
  do {
    for (const x of TIME_POINTS) sink += method(x);
    reps++;
  } while (performance.now() - start < 80);
  return sink === Infinity ? 0 : (performance.now() - start) * 1000 / (reps * TIME_POINTS.length);
}

function renderEfficiency() {
  const ref2 = (1 + 0.954499736103642) / 2;
  let previous = NaN;
  renderTable("simpson-table", ["n", "error at x = 2", "previous error / error"], SIMPSON_NS.map(n => {
    const e = Math.abs(cdfSimpson(2, n) - ref2);
    const row = [String(n), expo(e), Number.isFinite(previous) && e > 0 ? (previous / e).toFixed(1) : "–"];
    previous = e;
    return row;
  }));
  renderTable("series-table", ["x", "terms used", "largest term", "error"], SERIES_XS.map(x => {
    const ref = (1 + Number(REFERENCE.find(r => r[0] === x)[1])) / 2;
    const s = cdfErfSeries(x);
    return [String(x), String(s.terms), expo(largestTerm(x)), expo(Math.abs(s.value - ref))];
  }));
  const methods = [
    ["this method", cdf],
    ["Simpson, n = 100", x => cdfSimpson(x, 100)],
    ["erf series", x => cdfErfSeries(x).value],
    ["erf, A&S 7.1.26", cdfAS]
  ];
  renderTable("time-table", ["method", "largest error on the reference points", "time per evaluation"],
    methods.map(([name, method]) => [name, expo(maxError(method)), timePerEvaluation(method).toFixed(3) + " µs"]));
}

renderEfficiency();
