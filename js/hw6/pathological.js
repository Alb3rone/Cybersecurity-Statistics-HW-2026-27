const DARBOUX_NS = [10, 100, 1000, 10000];
const COVER_QS = [10, 100, 1000];
const COVER_EPS = 0.01;

function smallestDenominator(i, n) {
  for (let q = 1; q <= n; q++) {
    if (Math.ceil((i * q) / n) <= Math.floor(((i + 1) * q) / n)) return q;
  }
  return n;
}

function thomaeUpper(n) {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += 1 / smallestDenominator(i, n);
  return sum / n;
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

function coverRationals(maxQ, eps) {
  let count = 0, total = 0;
  for (let q = 1; q <= maxQ; q++) {
    for (let p = 0; p <= q; p++) {
      if (gcd(p, q) !== 1) continue;
      count++;
      total += eps / 2 ** count;
    }
  }
  return { count, total };
}

function renderPathological() {
  renderTable("cover-table", ["rationals p/q with q ≤", "how many in [0, 1]", "total length of the cover", "bound ε"],
    COVER_QS.map(q => {
      const c = coverRationals(q, COVER_EPS);
      return [q.toLocaleString("en-US"), c.count.toLocaleString("en-US"), c.total.toPrecision(15), String(COVER_EPS)];
    }));
  renderTable("thomae-table", ["N", "upper sum U(N)", "lower sum L(N)"],
    DARBOUX_NS.map(n => [n.toLocaleString("en-US"), sci(thomaeUpper(n)), "0"]));
}

renderPathological();
