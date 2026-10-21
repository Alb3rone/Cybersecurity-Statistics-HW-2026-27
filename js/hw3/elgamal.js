const BLOCK_BYTES = 30;
const SQRT_EXP = (SECP_P + 1n) / 4n;

function bpow(base, exp, m) {
  let result = 1n;
  let b = bmod(base, m);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return result;
}

function toAffine(P) {
  if (P === null) return null;
  const zInv = binv(P.z, SECP_P);
  const zInv2 = (zInv * zInv) % SECP_P;
  return { x: (P.x * zInv2) % SECP_P, y: (P.y * zInv2 * zInv) % SECP_P };
}

function toJacobian(P) {
  return P === null ? null : { x: P.x, y: P.y, z: 1n };
}

function pointAdd(P, Q) {
  return toAffine(jacobianAdd(toJacobian(P), toJacobian(Q)));
}

function pointNegate(P) {
  return P === null ? null : { x: P.x, y: bmod(-P.y, SECP_P) };
}

function hex64(v) {
  return v.toString(16).padStart(64, "0");
}

function randomScalar(limit) {
  const bytes = Math.ceil(limit.toString(2).length / 8);
  for (;;) {
    let v = 0n;
    for (const b of crypto.getRandomValues(new Uint8Array(bytes))) v = (v << 8n) | BigInt(b);
    v &= (1n << BigInt(limit.toString(2).length)) - 1n;
    if (v > 0n && v < limit) return v;
  }
}

function generateKeys(bits) {
  const d = randomScalar(1n << BigInt(bits));
  return { d, Q: secpMultiply(d, SECP_G) };
}

function encodeBlock(bytes) {
  let m = 0n;
  for (const b of bytes) m = (m << 8n) | BigInt(b);
  for (let j = 0n; j < 256n; j++) {
    const x = (m << 8n) | j;
    const rhs = (x * x % SECP_P * x + 7n) % SECP_P;
    const y = bpow(rhs, SQRT_EXP, SECP_P);
    if ((y * y) % SECP_P === rhs) return { m, j: Number(j), M: { x, y } };
  }
  throw new Error("No point found for this block");
}

function decodePoint(M) {
  let m = M.x >> 8n;
  const bytes = [];
  while (m > 0n) {
    bytes.unshift(Number(m & 255n));
    m >>= 8n;
  }
  return new Uint8Array(bytes);
}

function splitBlocks(bytes) {
  const blocks = [];
  for (let i = 0; i < bytes.length; i += BLOCK_BYTES) blocks.push(bytes.slice(i, i + BLOCK_BYTES));
  return blocks;
}

function encryptMessage(Q, text) {
  const bytes = new TextEncoder().encode(text);
  return splitBlocks(bytes).map(block => {
    const enc = encodeBlock(block);
    const r = randomScalar(SECP_N);
    const C1 = secpMultiply(r, SECP_G);
    const C2 = pointAdd(enc.M, secpMultiply(r, Q));
    return { block, j: enc.j, M: enc.M, C1, C2 };
  });
}

function decryptMessage(d, ciphertext) {
  const parts = ciphertext.map(({ C1, C2 }) => {
    const S = secpMultiply(d, C1);
    return decodePoint(pointAdd(C2, pointNegate(S)));
  });
  const all = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    all.set(p, offset);
    offset += p.length;
  }
  return new TextDecoder().decode(all);
}
