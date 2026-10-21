const state = { d: null, Q: null, bits: 20, ciphertext: null, caesar: null, shift: 11 };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fact(list, term, text) {
  list.append(el("dt", "", term), el("dd", "", text));
}

function shortHex(v) {
  const h = hex64(v);
  return h.slice(0, 10) + "…" + h.slice(-10);
}

function pointText(P) {
  return "(" + shortHex(P.x) + ", " + shortHex(P.y) + ")";
}

function readBits() {
  const bits = Number(document.getElementById("in-bits").value);
  if (!Number.isInteger(bits) || bits < 8 || bits > 24) throw new Error("b must be an integer between 8 and 24.");
  return bits;
}

function readPrivateKey(bits) {
  const raw = document.getElementById("in-d").value.trim();
  if (!/^\d+$/.test(raw)) throw new Error("d must be a positive integer.");
  const d = BigInt(raw);
  if (d < 1n || d >= (1n << BigInt(bits))) throw new Error("d must satisfy 1 ≤ d < 2^" + bits + " = " + (1 << bits) + ".");
  return d;
}

function newKey() {
  const errorBox = document.getElementById("key-error");
  try {
    const bits = readBits();
    document.getElementById("in-d").value = generateKeys(bits).d.toString();
    errorBox.hidden = true;
    runAll();
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  }
}

function renderKeys() {
  const list = document.getElementById("ecc-keys");
  list.replaceChildren();
  fact(list, "Private key d", state.d.toString() + " (0x" + state.d.toString(16) + ")");
  fact(list, "Key space", "1 ≤ d < 2^" + state.bits + ", " + ((1 << state.bits) - 1).toLocaleString("en-US") + " possible keys");
  fact(list, "Public key Q = dG", "x = " + hex64(state.Q.x));
  fact(list, "", "y = " + hex64(state.Q.y));
}

function renderCiphertext(text) {
  const wrap = document.getElementById("ecc-table");
  const table = el("table");
  const head = el("tr");
  for (const h of ["Block", "Plaintext", "j", "C₁ = rG", "C₂ = M + rQ"]) {
    const th = el("th", "", h);
    th.scope = "col";
    head.append(th);
  }
  const thead = el("thead");
  thead.append(head);
  const body = el("tbody");
  const decoder = new TextDecoder();
  state.ciphertext.forEach((c, i) => {
    const tr = el("tr");
    tr.append(el("td", "num", String(i + 1)), el("td", "", decoder.decode(c.block)), el("td", "num", String(c.j)),
      el("td", "num", pointText(c.C1)), el("td", "num", pointText(c.C2)));
    body.append(tr);
  });
  table.append(thead, body);
  wrap.replaceChildren(table);

  const decrypted = decryptMessage(state.d, state.ciphertext);
  const result = document.getElementById("ecc-result");
  result.replaceChildren(el("span", "result-label", "DECRYPTED WITH d"), el("span", "result-text", decrypted),
    el("span", decrypted === text ? "result-note" : "result-note bad", decrypted === text ? "Identical to the plaintext." : "Does not match the plaintext."));
}

function renderCaesar(text) {
  const out = document.getElementById("caesar-out");
  out.replaceChildren();
  state.caesar = caesarEncrypt(text, state.shift);
  fact(out, "Key k", String(state.shift) + " (A → " + ALPHABET[state.shift] + ")");
  fact(out, "Ciphertext", state.caesar);
  const back = caesarDecrypt(state.caesar, state.shift);
  const result = document.getElementById("caesar-result");
  result.replaceChildren(el("span", "result-label", "DECRYPTED WITH k"), el("span", "result-text", back),
    el("span", back === text ? "result-note" : "result-note bad", back === text ? "Identical to the plaintext." : "Does not match the plaintext."));
}

function renderComparison(text) {
  const plain = letterCounts(text);
  const cipher = letterCounts(state.caesar);
  const total = plain.reduce((s, v) => s + v, 0) || 1;
  barChart(document.getElementById("ch-letters"), {
    width: 440, title: "Letters of the plaintext and of the Caesar ciphertext", labels: ALPHABET.split(""), labelEvery: 1,
    series: [{ name: "plaintext", values: plain.map(v => v / total), cls: "s1" }, { name: "ciphertext", values: cipher.map(v => v / total), cls: "s2" }],
    yFormat: "percent", xTitle: "letter", yTitle: "share of letters"
  });

  const hex = new Array(16).fill(0);
  for (const c of state.ciphertext) {
    for (const v of [c.C1.x, c.C1.y, c.C2.x, c.C2.y]) for (const ch of hex64(v)) hex[parseInt(ch, 16)]++;
  }
  const hexTotal = hex.reduce((s, v) => s + v, 0);
  barChart(document.getElementById("ch-hex"), {
    width: 440, title: "Hex digits of the ElGamal ciphertext (" + hexTotal + " digits)", labels: "0123456789abcdef".split(""), labelEvery: 1,
    series: [{ name: "digits", values: hex.map(v => v / hexTotal), cls: "s1" }], reference: 1 / 16, referenceLabel: "1/16",
    yFormat: "percent", yMax: 0.15, xTitle: "hex digit", yTitle: "share"
  });

  const top = plain.indexOf(Math.max(...plain));
  const again = encryptMessage(state.Q, text);
  const differs = again[0].C1.x !== state.ciphertext[0].C1.x && again[0].C2.x !== state.ciphertext[0].C2.x;
  document.getElementById("compare-text").textContent =
    "Caesar: the two distributions have exactly the same shape, moved by " + state.shift + " positions. The most frequent plaintext letter, " +
    ALPHABET[top] + ", becomes " + ALPHABET[(top + state.shift) % 26] + " in the ciphertext, and encrypting the message again gives the same ciphertext. " +
    "ElGamal: the " + hexTotal + " hex digits of the ciphertext are spread close to 1/16 each, whatever the message, and encrypting the same message again gives " +
    (differs ? "a completely different ciphertext" : "the same ciphertext") + " because r is new. The ciphertext only reveals the number of blocks, that is the approximate length of the message.";
}

function runAll() {
  const errorBox = document.getElementById("key-error");
  const text = document.getElementById("in-message").value;
  try {
    state.bits = readBits();
    state.d = readPrivateKey(state.bits);
    const shift = Number(document.getElementById("in-shift").value);
    if (!Number.isInteger(shift) || shift < 1 || shift > 25) throw new Error("The Caesar key k must be an integer between 1 and 25.");
    if (!text) throw new Error("The message is empty.");
    state.shift = shift;
    errorBox.hidden = true;
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
    return;
  }
  state.Q = secpMultiply(state.d, SECP_G);
  state.ciphertext = encryptMessage(state.Q, text);
  renderKeys();
  renderCiphertext(text);
  renderCaesar(text);
  renderComparison(text);
  document.dispatchEvent(new CustomEvent("hw3:encrypted"));
}

document.getElementById("btn-run").addEventListener("click", runAll);
document.getElementById("btn-newkey").addEventListener("click", newKey);
document.getElementById("key-form").addEventListener("submit", event => { event.preventDefault(); runAll(); });
document.getElementById("caesar-form").addEventListener("submit", event => { event.preventDefault(); runAll(); });
document.getElementById("in-shift").addEventListener("change", runAll);
document.getElementById("in-bits").addEventListener("change", newKey);
newKey();
