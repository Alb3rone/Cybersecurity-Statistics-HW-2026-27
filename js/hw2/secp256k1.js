const SECP_P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const SECP_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const SECP_G = {
  x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n
};

function bmod(a, m) {
  const r = a % m;
  return r < 0n ? r + m : r;
}

function binv(a, m) {
  let [r0, r1] = [m, bmod(a, m)];
  let [t0, t1] = [0n, 1n];
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [t0, t1] = [t1, t0 - q * t1];
  }
  return bmod(t0, m);
}

function jacobianDouble(P) {
  if (P === null || P.y === 0n) return null;
  const p = SECP_P;
  const ysq = (P.y * P.y) % p;
  const s = (4n * P.x * ysq) % p;
  const m = (3n * P.x * P.x) % p;
  const x = bmod(m * m - 2n * s, p);
  const y = bmod(m * (s - x) - 8n * ysq * ysq, p);
  const z = (2n * P.y * P.z) % p;
  return { x, y, z };
}

function jacobianAdd(P, Q) {
  if (P === null) return Q;
  if (Q === null) return P;
  const p = SECP_P;
  const z1z1 = (P.z * P.z) % p;
  const z2z2 = (Q.z * Q.z) % p;
  const u1 = (P.x * z2z2) % p;
  const u2 = (Q.x * z1z1) % p;
  const s1 = (P.y * Q.z * z2z2) % p;
  const s2 = (Q.y * P.z * z1z1) % p;
  if (u1 === u2) return s1 === s2 ? jacobianDouble(P) : null;
  const h = bmod(u2 - u1, p);
  const r = bmod(s2 - s1, p);
  const h2 = (h * h) % p;
  const h3 = (h2 * h) % p;
  const v = (u1 * h2) % p;
  const x = bmod(r * r - h3 - 2n * v, p);
  const y = bmod(r * (v - x) - s1 * h3, p);
  const z = (h * P.z * Q.z) % p;
  return { x, y, z };
}

function secpMultiply(k, point) {
  let R = null;
  const A = { x: point.x, y: point.y, z: 1n };
  for (const bit of k.toString(2)) {
    R = jacobianDouble(R);
    if (bit === "1") R = jacobianAdd(R, A);
  }
  if (R === null) return null;
  const zInv = binv(R.z, SECP_P);
  const zInv2 = (zInv * zInv) % SECP_P;
  return { x: (R.x * zInv2) % SECP_P, y: (R.y * zInv2 * zInv) % SECP_P };
}

function secpPublicKey(privateKey) {
  if (privateKey <= 0n || privateKey >= SECP_N) throw new Error("Private key out of range");
  return secpMultiply(privateKey, SECP_G);
}
