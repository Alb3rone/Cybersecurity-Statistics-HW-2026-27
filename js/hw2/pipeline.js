const TEST_VECTOR = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const CHIPS = {
  gen: ["c-gen", "key generation"],
  enc: ["c-enc", "encoding"],
  sum: ["c-sum", "checksum"],
  der: ["c-der", "key derivation"],
  pkc: ["c-pkc", "public-key crypto"],
  hash: ["c-hash", "hashing"]
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shortHex(hex, keep) {
  return hex.length <= 2 * keep + 1 ? hex : hex.slice(0, keep) + "…" + hex.slice(-keep);
}

function addStep(list, { title, standard, chips, text, values }) {
  const li = el("li", "step");
  const head = el("div", "step-head");
  head.append(el("span", "step-title", title));
  if (standard) head.append(el("span", "badge", standard));
  for (const c of chips) {
    const [cls, label] = CHIPS[c];
    head.append(el("span", "chip " + cls, label));
  }
  li.append(head, el("p", "step-text", text));
  for (const v of values) {
    const row = el("div", "step-value");
    row.append(el("span", "value-label", v.label));
    const value = el("span", "value " + (v.className || ""));
    if (v.node) value.append(v.node);
    else value.textContent = v.value;
    row.append(value);
    li.append(row);
  }
  list.append(li);
}

function mnemonicNode(check, words) {
  const wrap = el("span", "words");
  const csStart = check.bits.length - check.checksumBits;
  words.forEach((w, i) => {
    const bits = check.bits.slice(11 * i, 11 * i + 11);
    const word = el("span", "word");
    word.append(el("span", "word-text", w));
    const bitSpan = el("span", "word-bits");
    for (let b = 0; b < 11; b++) {
      const s = el("span", 11 * i + b >= csStart ? "cs-bit" : "", bits[b]);
      bitSpan.append(s);
    }
    word.append(el("span", "word-index", "#" + check.indexes[i]), bitSpan);
    wrap.append(word);
  });
  return wrap;
}

function addressNode(lower, checksummed, hash) {
  const wrap = el("span", "addr-chars");
  wrap.append(el("span", "", "0x"));
  for (let i = 0; i < lower.length; i++) {
    const c = checksummed[i + 2];
    const isLetter = /[a-f]/i.test(c);
    const span = el("span", isLetter ? (c === c.toUpperCase() ? "upper" : "lower") : "digit", c);
    span.title = isLetter ? "hash digit " + hash[i] + (parseInt(hash[i], 16) >= 8 ? " ≥ 8 → uppercase" : " < 8 → lowercase") : "digit, no case";
    wrap.append(span);
  }
  return wrap;
}

function hashWithTail(hex) {
  const wrap = el("span", "");
  wrap.append(el("span", "dim", hex.slice(0, 24)), el("span", "tail", hex.slice(24)));
  return wrap;
}

async function runPipeline(event) {
  if (event) event.preventDefault();
  const errorBox = document.getElementById("wallet-error");
  const list = document.getElementById("steps");
  const final = document.getElementById("final-address");
  errorBox.hidden = true;
  try {
    const words = normalizeMnemonic(document.getElementById("in-words").value);
    const check = checkMnemonic(words);
    if (!check.valid) throw new Error(check.reason);
    const passphrase = document.getElementById("in-pass").value;
    const account = Number(document.getElementById("in-account").value);
    const index = Number(document.getElementById("in-index").value);
    if (!Number.isInteger(account) || account < 0 || !Number.isInteger(index) || index < 0) throw new Error("Account and address index must be non-negative integers.");
    const path = "m/44'/60'/" + account + "'/0/" + index;

    const t0 = performance.now();
    const seed = await mnemonicToSeed(words, passphrase);
    const seedMs = performance.now() - t0;
    const derived = await derivePath(seed, path);
    const privateKey = derived.node.key;
    const { pub, hash, address } = addressFromPrivateKey(privateKey);
    const checksum = toChecksumAddress(address);

    list.replaceChildren();
    const entBits = check.entropy.length * 8;
    addStep(list, {
      title: "Entropy", standard: "BIP-39", chips: ["gen"],
      text: entBits + " random bits. This is the only random input of the whole wallet: everything below is computed from it. " +
        "The search space is 2^" + entBits + " ≈ 10^" + Math.round(entBits * Math.log10(2)) + " phrases.",
      values: [{ label: "hex", value: bytesToHex(check.entropy), className: "mono" }]
    });
    addStep(list, {
      title: "Mnemonic", standard: "BIP-39", chips: ["enc", "sum"],
      text: "The first " + check.checksumBits + " bits of SHA-256(entropy) are appended as a checksum (highlighted), then every 11 bits " +
        "select one of 2048 words. " + words.length + " words × 11 bits = " + entBits + " + " + check.checksumBits + " bits.",
      values: [{ label: "words", node: mnemonicNode(check, words) }]
    });
    addStep(list, {
      title: "Seed", standard: "BIP-39", chips: ["der"],
      text: "PBKDF2-HMAC-SHA512 with 2048 iterations, salt \"mnemonic\" + passphrase. The repetition is key stretching: " +
        "it took " + seedMs.toFixed(1) + " ms here, and every guess of an attacker costs the same. A different passphrase gives a completely different wallet.",
      values: [{ label: "512 bits", value: bytesToHex(seed), className: "mono" }]
    });
    const master = derived.steps[0].node;
    addStep(list, {
      title: "Master key", standard: "BIP-32", chips: ["der"],
      text: "HMAC-SHA512 with key \"Bitcoin seed\": the left 256 bits are the master private key, the right 256 bits the chain code, " +
        "which is extra secret material needed to derive children.",
      values: [
        { label: "private key", value: bigToBytes(master.key, 32).reduce((s, b) => s + b.toString(16).padStart(2, "0"), ""), className: "mono" },
        { label: "chain code", value: bytesToHex(master.chainCode), className: "mono" }
      ]
    });
    const pathTable = el("span", "path-levels");
    const levelNames = ["purpose 44'", "coin 60' (Ethereum)", "account " + account + "'", "change 0 (external)", "index " + index];
    derived.steps.slice(1).forEach((s, i) => {
      const row = el("span", "path-level");
      row.append(el("span", "path-label", s.label), el("span", "path-name", levelNames[i]), el("span", "mono", shortHex(s.node.key.toString(16).padStart(64, "0"), 10)));
      pathTable.append(row);
    });
    addStep(list, {
      title: "Derivation path " + path, standard: "BIP-32 / BIP-44", chips: ["der"],
      text: "Each level is a child key: HMAC-SHA512(chain code, parent data ‖ index), left half added to the parent key mod n. " +
        "Levels with ' are hardened: they use the parent private key, so a leaked child key and the parent public key cannot reveal siblings.",
      values: [{ label: "levels", node: pathTable }]
    });
    addStep(list, {
      title: "Private key", standard: "BIP-32", chips: ["der"],
      text: "The 256-bit number k at the end of the path. In MetaMask this is what \"export private key\" shows.",
      values: [{ label: "k", value: privateKey.toString(16).padStart(64, "0"), className: "mono" }]
    });
    addStep(list, {
      title: "Public key", standard: "secp256k1", chips: ["pkc"],
      text: "Q = kG on y² = x³ + 7 over a 256-bit prime field, the same scalar multiplication as HMWK 1. " +
        "Ethereum uses the 64 bytes x ‖ y.",
      values: [
        { label: "x", value: bytesToHex(pub.slice(0, 32)), className: "mono" },
        { label: "y", value: bytesToHex(pub.slice(32)), className: "mono" }
      ]
    });
    addStep(list, {
      title: "Keccak-256 of the public key", standard: "Keccak-256", chips: ["hash"],
      text: "The 64 bytes are hashed to 32 bytes. Only the last 20 bytes (highlighted) are kept.",
      values: [{ label: "digest", node: hashWithTail(bytesToHex(hash)), className: "mono" }]
    });
    addStep(list, {
      title: "Address", standard: "Ethereum", chips: ["enc"],
      text: "20 bytes written as 40 hexadecimal digits with the prefix 0x.",
      values: [{ label: "lowercase", value: "0x" + address, className: "mono" }]
    });
    const upper = (checksum.address.match(/[A-F]/g) || []).length;
    const letters = (address.match(/[a-f]/g) || []).length;
    addStep(list, {
      title: "Checksummed address", standard: "EIP-55", chips: ["sum", "enc"],
      text: "Keccak-256 of the 40 lowercase characters gives one hex digit per character: when that digit is 8 or more the letter is " +
        "uppercased. This address has " + letters + " letters, " + upper + " uppercase. Hover a character to see its hash digit.",
      values: [
        { label: "hash of text", value: checksum.hash.slice(0, 40), className: "mono dim" },
        { label: "EIP-55", node: addressNode(address, checksum.address, checksum.hash), className: "mono" }
      ]
    });

    final.replaceChildren(el("span", "result-label", "ETHEREUM ADDRESS"), el("span", "result-value", checksum.address));
    if (words.join(" ") === TEST_VECTOR && !passphrase && account === 0 && index === 0) {
      final.append(el("span", "result-note", checksum.address === "0x9858EfFD232B4033E47d90003D41EC34EcaEda94"
        ? "Matches the address MetaMask shows for the test vector."
        : "Does not match the known test-vector address."));
    }
    document.dispatchEvent(new CustomEvent("wallet:derived", { detail: { seed } }));
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  }
}

function newPhrase(bytes) {
  document.getElementById("in-words").value = entropyToMnemonic(randomBytes(bytes)).words.join(" ");
  runPipeline();
}

function renderHashDemo() {
  const text = document.getElementById("in-hash").value;
  const bytes = new TextEncoder().encode(text);
  const list = document.getElementById("hash-demo");
  list.replaceChildren();
  for (const [name, fn] of [["SHA-256", sha256], ["Keccak-256", keccak256], ["SHA3-256", sha3_256]]) {
    list.append(el("dt", "", name), el("dd", "mono", bytesToHex(fn(bytes))));
  }
}

document.getElementById("wallet-form").addEventListener("submit", runPipeline);
document.getElementById("btn-new12").addEventListener("click", () => newPhrase(16));
document.getElementById("btn-new24").addEventListener("click", () => newPhrase(32));
document.getElementById("btn-vector").addEventListener("click", () => {
  document.getElementById("in-words").value = TEST_VECTOR;
  document.getElementById("in-pass").value = "";
  document.getElementById("in-account").value = 0;
  document.getElementById("in-index").value = 0;
  runPipeline();
});
document.getElementById("in-hash").addEventListener("input", renderHashDemo);
renderHashDemo();
runPipeline();
