function mod(a, p) {
  const r = a % p;
  return r < 0 ? r + p : r;
}

function mulmod(a, b, p) {
  return mod(a * b, p);
}

function invmod(a, p) {
  let r0 = p, r1 = mod(a, p);
  let t0 = 0, t1 = 1;
  if (r1 === 0) throw new Error("0 has no inverse modulo " + p);
  while (r1 !== 0) {
    const q = Math.floor(r0 / r1);
    [r0, r1] = [r1, r0 - q * r1];
    [t0, t1] = [t1, t0 - q * t1];
  }
  if (r0 !== 1) throw new Error(a + " has no inverse modulo " + p);
  return mod(t0, p);
}

function powmod(base, exp, p) {
  let result = 1;
  base = mod(base, p);
  while (exp > 0) {
    if (exp % 2 === 1) result = mulmod(result, base, p);
    base = mulmod(base, base, p);
    exp = Math.floor(exp / 2);
  }
  return result;
}

function isPrime(n) {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let d = 3; d * d <= n; d += 2) {
    if (n % d === 0) return false;
  }
  return true;
}

function isQuadraticResidue(a, p) {
  a = mod(a, p);
  return a === 0 || powmod(a, (p - 1) / 2, p) === 1;
}


const INFINITY = null;

function makeCurve(p, a, b) {
  return { p, a: mod(a, p), b: mod(b, p) };
}

function isInfinity(P) {
  return P === INFINITY;
}

function samePoint(P, Q) {
  if (isInfinity(P) || isInfinity(Q)) return isInfinity(P) && isInfinity(Q);
  return P.x === Q.x && P.y === Q.y;
}

function isOnCurve(curve, P) {
  if (isInfinity(P)) return true;
  const { p, a, b } = curve;
  if (P.x < 0 || P.x >= p || P.y < 0 || P.y >= p) return false;
  const left = mulmod(P.y, P.y, p);
  const right = mod(mulmod(mulmod(P.x, P.x, p), P.x, p) + mulmod(a, P.x, p) + b, p);
  return left === right;
}

function negate(curve, P) {
  if (isInfinity(P)) return INFINITY;
  return { x: P.x, y: mod(-P.y, curve.p) };
}

function addDetailed(curve, P, Q) {
  const { p, a } = curve;
  if (isInfinity(P)) return { result: Q, kind: "identity" };
  if (isInfinity(Q)) return { result: P, kind: "identity" };
  if (P.x === Q.x && mod(P.y + Q.y, p) === 0) {
    return { result: INFINITY, kind: "opposite" };
  }
  let lambda, kind;
  if (samePoint(P, Q)) {
    lambda = mulmod(mod(3 * mulmod(P.x, P.x, p) + a, p), invmod(2 * P.y, p), p);
    kind = "double";
  } else {
    lambda = mulmod(mod(Q.y - P.y, p), invmod(Q.x - P.x, p), p);
    kind = "add";
  }
  const x3 = mod(mulmod(lambda, lambda, p) - P.x - Q.x, p);
  const y3 = mod(mulmod(lambda, P.x - x3, p) - P.y, p);
  return { result: { x: x3, y: y3 }, kind, lambda, third: { x: x3, y: mod(-y3, p) } };
}

function addPoints(curve, P, Q) {
  return addDetailed(curve, P, Q).result;
}

function pointToString(P) {
  return isInfinity(P) ? "O" : "(" + P.x + ", " + P.y + ")";
}
