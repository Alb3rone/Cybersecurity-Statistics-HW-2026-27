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

function hashWithTail(hex) {
  const wrap = el("span", "");
  wrap.append(el("span", "dim", hex.slice(0, 24)), el("span", "tail", hex.slice(24)));
  return wrap;
}

async function runPipeline() {
  const errorBox = document.getElementById("wallet-error");
  const list = document.getElementById("steps");
  const final = document.getElementById("final-address");
  errorBox.hidden = true;
  try {
    const words = normalizeMnemonic(TEST_VECTOR);
    const check = checkMnemonic(words);
    const path = "m/44'/60'/0'/0/0";

    const t0 = performance.now();
    const seed = await mnemonicToSeed(words, "");
    const seedMs = performance.now() - t0;
    const derived = await derivePath(seed, path);
    const privateKey = derived.node.key;
    const { pub, hash, address } = addressFromPrivateKey(privateKey);
    const checksum = toChecksumAddress(address);

    list.replaceChildren();
    const entBits = check.entropy.length * 8;
    addStep(list, {
      title: "Entropy and mnemonic", standard: "BIP-39", chips: ["gen", "sum", "enc"],
      text: entBits + " random bits, plus the first " + check.checksumBits + " bits of SHA-256(entropy) as a checksum. " +
        "Every 11 bits select one of 2048 words: " + words.length + " × 11 = " + entBits + " + " + check.checksumBits + " bits.",
      values: [
        { label: "entropy", value: bytesToHex(check.entropy), className: "mono" },
        { label: "words", value: words.join(" "), className: "mono" }
      ]
    });
    addStep(list, {
      title: "Seed", standard: "BIP-39", chips: ["der"],
      text: "PBKDF2-HMAC-SHA512 with 2048 iterations and salt \"mnemonic\" + passphrase. The repetition makes every guess of an attacker slower.",
      values: [{ label: "512 bits", value: bytesToHex(seed), className: "mono" }]
    });
    const pathTable = el("span", "path-levels");
    derived.steps.forEach(s => {
      const row = el("span", "path-level");
      row.append(el("span", "path-label", s.label), el("span", "mono", shortHex(s.node.key.toString(16).padStart(64, "0"), 10)));
      pathTable.append(row);
    });
    addStep(list, {
      title: "Derivation path " + path, standard: "BIP-32 / BIP-44", chips: ["der"],
      text: "The master key is HMAC-SHA512(\"Bitcoin seed\", seed); every level below is a child key computed with HMAC-SHA512 from its parent. " +
        "Levels marked with ' are hardened.",
      values: [{ label: "keys", node: pathTable }]
    });
    addStep(list, {
      title: "Private key", standard: "BIP-32", chips: ["der"],
      text: "The 256-bit number k at the end of the path.",
      values: [{ label: "k", value: privateKey.toString(16).padStart(64, "0"), className: "mono" }]
    });
    addStep(list, {
      title: "Public key", standard: "secp256k1", chips: ["pkc"],
      text: "Q = kG, the same scalar multiplication as HMWK 1 on a 256-bit curve. Ethereum uses the 64 bytes x ‖ y.",
      values: [
        { label: "x", value: bytesToHex(pub.slice(0, 32)), className: "mono" },
        { label: "y", value: bytesToHex(pub.slice(32)), className: "mono" }
      ]
    });
    addStep(list, {
      title: "Keccak-256 of the public key", standard: "Keccak-256", chips: ["hash"],
      text: "The 64 bytes are hashed to 32 bytes; the last 20 bytes (highlighted) are kept.",
      values: [{ label: "digest", node: hashWithTail(bytesToHex(hash)), className: "mono" }]
    });
    addStep(list, {
      title: "Address", standard: "Ethereum", chips: ["enc"],
      text: "The 20 bytes written as 40 hexadecimal digits with the prefix 0x.",
      values: [{ label: "lowercase", value: "0x" + address, className: "mono" }]
    });
    addStep(list, {
      title: "Checksummed address", standard: "EIP-55", chips: ["sum", "enc"],
      text: "A letter is uppercased when the matching hex digit of Keccak-256(lowercase address) is 8 or more.",
      values: [{ label: "EIP-55", value: checksum.address, className: "mono" }]
    });

    final.replaceChildren(el("span", "result-label", "ETHEREUM ADDRESS"), el("span", "result-value", checksum.address));
    final.append(el("span", "result-note", checksum.address === "0x9858EfFD232B4033E47d90003D41EC34EcaEda94"
      ? "Matches the address MetaMask shows for the test vector."
      : "Does not match the known test-vector address."));
    document.dispatchEvent(new CustomEvent("wallet:derived", { detail: { seed } }));
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  }
}

function renderHashDemo() {
  const text = document.getElementById("in-hash").value;
  const bytes = new TextEncoder().encode(text);
  const list = document.getElementById("hash-demo");
  list.replaceChildren();
  const kec = keccak256(bytes);
  const sha3 = sha3_256(bytes);
  for (const [name, digest] of [["Keccak-256", kec], ["SHA3-256", sha3]]) {
    list.append(el("dt", "", name), el("dd", "mono", bytesToHex(digest)));
  }
}

document.getElementById("in-hash").addEventListener("input", renderHashDemo);
renderHashDemo();
runPipeline();
