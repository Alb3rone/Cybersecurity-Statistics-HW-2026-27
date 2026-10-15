const HARDENED = 0x80000000;

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(2 * i, 2), 16);
  return out;
}

function bigToBytes(value, length) {
  return hexToBytes(value.toString(16).padStart(2 * length, "0"));
}

function bytesToBig(bytes) {
  return BigInt("0x" + (bytesToHex(bytes) || "0"));
}

function concatBytes(...parts) {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function bytesToBits(bytes) {
  return Array.from(bytes, b => b.toString(2).padStart(8, "0")).join("");
}

function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

function normalizeMnemonic(text) {
  return text.normalize("NFKD").trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function checkMnemonic(words) {
  if (![12, 15, 18, 21, 24].includes(words.length)) {
    return { valid: false, reason: "A BIP-39 mnemonic has 12, 15, 18, 21 or 24 words, this one has " + words.length + "." };
  }
  const indexes = [];
  for (const w of words) {
    const i = BIP39_WORDLIST.indexOf(w);
    if (i < 0) return { valid: false, reason: "\"" + w + "\" is not in the BIP-39 English word list." };
    indexes.push(i);
  }
  const bits = indexes.map(i => i.toString(2).padStart(11, "0")).join("");
  const checksumBits = bits.length / 33;
  const entropyBits = bits.slice(0, bits.length - checksumBits);
  const entropy = new Uint8Array(entropyBits.length / 8);
  for (let i = 0; i < entropy.length; i++) entropy[i] = parseInt(entropyBits.slice(8 * i, 8 * i + 8), 2);
  const expected = bytesToBits(sha256(entropy)).slice(0, checksumBits);
  const found = bits.slice(bits.length - checksumBits);
  return { valid: expected === found, entropy, indexes, bits, checksumBits, expected, found,
    reason: expected === found ? "" : "The checksum does not match: the last " + checksumBits + " bits should be " + expected + " but are " + found + "." };
}

async function mnemonicToSeed(words, passphrase) {
  const enc = new TextEncoder();
  const password = enc.encode(words.join(" ").normalize("NFKD"));
  const salt = enc.encode(("mnemonic" + (passphrase || "")).normalize("NFKD"));
  const key = await crypto.subtle.importKey("raw", password, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-512", salt, iterations: 2048 }, key, 512);
  return new Uint8Array(bits);
}

async function hmacSha512(keyBytes, data) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}

async function masterKeyFromSeed(seed) {
  const I = await hmacSha512(new TextEncoder().encode("Bitcoin seed"), seed);
  const key = bytesToBig(I.slice(0, 32));
  if (key === 0n || key >= SECP_N) throw new Error("Invalid master key, try another seed.");
  return { key, chainCode: I.slice(32) };
}

function compressedPublicKey(point) {
  return concatBytes(new Uint8Array([point.y % 2n === 0n ? 2 : 3]), bigToBytes(point.x, 32));
}

async function deriveChild(parent, index) {
  const indexBytes = new Uint8Array([(index >>> 24) & 255, (index >>> 16) & 255, (index >>> 8) & 255, index & 255]);
  const data = index >= HARDENED
    ? concatBytes(new Uint8Array([0]), bigToBytes(parent.key, 32), indexBytes)
    : concatBytes(compressedPublicKey(secpPublicKey(parent.key)), indexBytes);
  const I = await hmacSha512(parent.chainCode, data);
  const tweak = bytesToBig(I.slice(0, 32));
  const key = (tweak + parent.key) % SECP_N;
  if (tweak >= SECP_N || key === 0n) throw new Error("Invalid child key at index " + index + ", the next index must be used.");
  return { key, chainCode: I.slice(32) };
}

function parsePath(path) {
  const parts = path.trim().split("/");
  if (parts[0] !== "m") throw new Error("A derivation path starts with m.");
  return parts.slice(1).map(part => {
    const hardened = part.endsWith("'");
    const n = Number(hardened ? part.slice(0, -1) : part);
    if (!Number.isInteger(n) || n < 0 || n >= HARDENED) throw new Error("\"" + part + "\" is not a valid path level.");
    return hardened ? n + HARDENED : n;
  });
}

async function derivePath(seed, path) {
  let node = await masterKeyFromSeed(seed);
  const steps = [{ label: "m", node }];
  let label = "m";
  for (const index of parsePath(path)) {
    node = await deriveChild(node, index);
    label += "/" + (index >= HARDENED ? (index - HARDENED) + "'" : index);
    steps.push({ label, node });
  }
  return { node, steps };
}

function publicKeyBytes(privateKey) {
  const point = secpPublicKey(privateKey);
  return concatBytes(bigToBytes(point.x, 32), bigToBytes(point.y, 32));
}

function addressFromPrivateKey(privateKey) {
  const pub = publicKeyBytes(privateKey);
  const hash = keccak256(pub);
  return { pub, hash, address: bytesToHex(hash.slice(12)) };
}

function toChecksumAddress(lowerHex) {
  const hash = bytesToHex(keccak256(new TextEncoder().encode(lowerHex)));
  let out = "";
  for (let i = 0; i < lowerHex.length; i++) {
    const c = lowerHex[i];
    out += /[a-f]/.test(c) && parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c;
  }
  return { address: "0x" + out, hash };
}
