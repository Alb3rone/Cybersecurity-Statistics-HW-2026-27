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

if (typeof module !== "undefined") {
  module.exports = { mod, mulmod, invmod, powmod, isPrime, isQuadraticResidue };
}
