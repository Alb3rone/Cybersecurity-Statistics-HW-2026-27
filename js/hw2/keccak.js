const KECCAK_RC = [
  [0x00000001, 0x00000000], [0x00008082, 0x00000000], [0x0000808a, 0x80000000], [0x80008000, 0x80000000],
  [0x0000808b, 0x00000000], [0x80000001, 0x00000000], [0x80008081, 0x80000000], [0x00008009, 0x80000000],
  [0x0000008a, 0x00000000], [0x00000088, 0x00000000], [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
  [0x8000808b, 0x00000000], [0x0000008b, 0x80000000], [0x00008089, 0x80000000], [0x00008003, 0x80000000],
  [0x00008002, 0x80000000], [0x00000080, 0x80000000], [0x0000800a, 0x00000000], [0x8000000a, 0x80000000],
  [0x80008081, 0x80000000], [0x00008080, 0x80000000], [0x80000001, 0x00000000], [0x80008008, 0x80000000]
];
const KECCAK_ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];

function keccakF(lo, hi) {
  const cLo = new Uint32Array(5), cHi = new Uint32Array(5);
  const bLo = new Uint32Array(25), bHi = new Uint32Array(25);
  for (let round = 0; round < 24; round++) {
    for (let x = 0; x < 5; x++) {
      cLo[x] = lo[x] ^ lo[x + 5] ^ lo[x + 10] ^ lo[x + 15] ^ lo[x + 20];
      cHi[x] = hi[x] ^ hi[x + 5] ^ hi[x + 10] ^ hi[x + 15] ^ hi[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      const nLo = cLo[(x + 1) % 5], nHi = cHi[(x + 1) % 5];
      const dLo = cLo[(x + 4) % 5] ^ ((nLo << 1) | (nHi >>> 31));
      const dHi = cHi[(x + 4) % 5] ^ ((nHi << 1) | (nLo >>> 31));
      for (let y = 0; y < 25; y += 5) {
        lo[y + x] ^= dLo;
        hi[y + x] ^= dHi;
      }
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const i = x + 5 * y;
        const j = y + 5 * ((2 * x + 3 * y) % 5);
        const r = KECCAK_ROT[i];
        let l = lo[i], h = hi[i];
        if (r >= 32) {
          [l, h] = [h, l];
        }
        const s = r % 32;
        if (s === 0) {
          bLo[j] = l;
          bHi[j] = h;
        } else {
          bLo[j] = (l << s) | (h >>> (32 - s));
          bHi[j] = (h << s) | (l >>> (32 - s));
        }
      }
    }
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x++) {
        lo[y + x] = bLo[y + x] ^ (~bLo[y + (x + 1) % 5] & bLo[y + (x + 2) % 5]);
        hi[y + x] = bHi[y + x] ^ (~bHi[y + (x + 1) % 5] & bHi[y + (x + 2) % 5]);
      }
    }
    lo[0] ^= KECCAK_RC[round][0];
    hi[0] ^= KECCAK_RC[round][1];
  }
}

function keccakSponge(bytes, outputBytes, domainByte) {
  const rate = 200 - 2 * outputBytes;
  const lo = new Uint32Array(25), hi = new Uint32Array(25);
  const padded = new Uint8Array(Math.floor(bytes.length / rate + 1) * rate);
  padded.set(bytes);
  padded[bytes.length] ^= domainByte;
  padded[padded.length - 1] ^= 0x80;
  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let i = 0; i < rate / 8; i++) {
      const p = offset + 8 * i;
      lo[i] ^= padded[p] | (padded[p + 1] << 8) | (padded[p + 2] << 16) | (padded[p + 3] << 24);
      hi[i] ^= padded[p + 4] | (padded[p + 5] << 8) | (padded[p + 6] << 16) | (padded[p + 7] << 24);
    }
    keccakF(lo, hi);
  }
  const out = new Uint8Array(outputBytes);
  for (let i = 0; i < outputBytes; i++) {
    const lane = i >> 3;
    const word = (i & 7) < 4 ? lo[lane] : hi[lane];
    out[i] = (word >>> (8 * (i & 3))) & 0xff;
  }
  return out;
}

function keccak256(bytes) {
  return keccakSponge(bytes, 32, 0x01);
}

function sha3_256(bytes) {
  return keccakSponge(bytes, 32, 0x06);
}
