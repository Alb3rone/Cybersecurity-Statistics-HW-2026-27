const AVALANCHE_TRIALS = 3000;
const RANDOM_PHRASES = 20000;
const TYPO_TRIALS = 5000;
let currentSeed = null;

function popcount8(b) {
  let c = 0;
  while (b) {
    b &= b - 1;
    c++;
  }
  return c;
}

function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += popcount8(a[i] ^ b[i]);
  return d;
}

function normalCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-z * z / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

function chiSquareTest(observed, expected) {
  let chi = 0;
  for (let i = 0; i < observed.length; i++) chi += (observed[i] - expected[i]) ** 2 / expected[i];
  const df = observed.length - 1;
  const z = (Math.cbrt(chi / df) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  return { chi, df, pValue: 1 - normalCdf(z) };
}

function binomialPmf(n, p) {
  const pmf = new Array(n + 1).fill(0);
  let logC = 0;
  for (let k = 0; k <= n; k++) {
    if (k > 0) logC += Math.log(n - k + 1) - Math.log(k);
    pmf[k] = Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p));
  }
  return pmf;
}

function summary(values) {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  return { n, mean, sd, min: Math.min(...values), max: Math.max(...values) };
}

function binnedAgainstBinomial(values, n, p, lo, hi, width) {
  const pmf = binomialPmf(n, p);
  const labels = [], observed = [], expected = [];
  for (let start = lo; start <= hi; start += width) {
    const end = Math.min(start + width - 1, hi);
    labels.push(width === 1 ? String(start) : start + "–" + end);
    observed.push(values.filter(v => v >= start && v <= end).length / values.length);
    let e = 0;
    for (let k = start; k <= end; k++) e += pmf[k] || 0;
    expected.push(e);
  }
  return { labels, observed, expected };
}

function f(v, d) {
  return v.toFixed(d ?? 2);
}

function pct(v, d) {
  return (100 * v).toFixed(d ?? 1) + "%";
}

function pText(p) {
  return p < 0.0001 ? "< 0.0001" : p.toFixed(4);
}

function table(id, header, rows) {
  const wrap = document.getElementById(id);
  const t = document.createElement("table");
  const head = document.createElement("tr");
  for (const h of header) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = h;
    head.append(th);
  }
  const thead = document.createElement("thead");
  thead.append(head);
  const body = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    row.forEach((v, i) => {
      const td = document.createElement("td");
      td.textContent = v;
      if (i > 0) td.className = "num";
      tr.append(td);
    });
    body.append(tr);
  }
  t.append(thead, body);
  wrap.replaceChildren(t);
}

function say(id, text) {
  document.getElementById(id).textContent = text;
}

function keccakAvalanche() {
  const distances = [];
  const flips = new Array(256).fill(0);
  for (let t = 0; t < AVALANCHE_TRIALS; t++) {
    const m = randomBytes(32);
    const m2 = m.slice();
    const bit = Math.floor(Math.random() * 256);
    m2[bit >> 3] ^= 1 << (bit & 7);
    const h1 = keccak256(m);
    const h2 = keccak256(m2);
    distances.push(hamming(h1, h2));
    for (let i = 0; i < 256; i++) if ((h1[i >> 3] ^ h2[i >> 3]) & (1 << (i & 7))) flips[i]++;
  }
  const s = summary(distances);
  const bins = binnedAgainstBinomial(distances, 256, 0.5, 96, 159, 4);
  barChart(document.getElementById("ch-aval"), {
    title: "Changed output bits after flipping one input bit (" + AVALANCHE_TRIALS + " trials)",
    labels: bins.labels, labelEvery: 2, series: [{ name: "Keccak-256", values: bins.observed, cls: "s1" }],
    reference: bins.expected, referenceLabel: "— Binomial(256, ½)", yFormat: "percent",
    xTitle: "number of changed bits out of 256", yTitle: "share of trials"
  });
  const flipShares = flips.map(c => c / AVALANCHE_TRIALS);
  const sigma = 0.5 / Math.sqrt(AVALANCHE_TRIALS);
  const outside = flipShares.filter(v => Math.abs(v - 0.5) > 1.96 * sigma).length;
  table("st-aval", ["", "trials", "mean", "std. dev.", "min", "max"], [
    ["Keccak-256 measured", String(s.n), f(s.mean), f(s.sd), String(s.min), String(s.max)],
    ["ideal Binomial(256, ½)", "–", "128.00", "8.00", "–", "–"]
  ]);
  say("st-aval-text",
    "On average " + f(s.mean, 1) + " of 256 bits change (" + pct(s.mean / 256) + "), with standard deviation " + f(s.sd, 2) +
    " against the ideal 8: the histogram follows the binomial curve. Looking at each output bit separately, the share of trials in which it flipped " +
    "goes from " + pct(Math.min(...flipShares)) + " to " + pct(Math.max(...flipShares)) + "; " + outside + " of 256 bits fall outside the 95% band " +
    "½ ± " + pct(1.96 * sigma) + ", close to the 5% (about 13) expected by chance. No output bit is predictable from the input change.");
  return s;
}

async function deriveAddresses(count) {
  const parent = (await derivePath(currentSeed, "m/44'/60'/0'/0")).node;
  const children = [];
  const addresses = [];
  for (let i = 0; i < count; i++) {
    const child = await deriveChild(parent, i);
    children.push(bigToBytes(child.key, 32));
    addresses.push(addressFromPrivateKey(child.key).address);
  }
  return { children, addresses };
}

function addressUniformity(addresses) {
  const counts = new Array(16).fill(0);
  for (const a of addresses) for (const c of a) counts[parseInt(c, 16)]++;
  const total = addresses.length * 40;
  const chi = chiSquareTest(counts, new Array(16).fill(total / 16));
  barChart(document.getElementById("ch-nibbles"), {
    width: 440, title: "Hex digits in " + addresses.length + " addresses", labels: "0123456789abcdef".split(""), labelEvery: 1,
    series: [{ name: "digits", values: counts.map(c => c / total), cls: "s1" }], reference: 1 / 16, referenceLabel: "1/16",
    yFormat: "percent", yMax: 0.1, xTitle: "hex digit", yTitle: "share"
  });
  const ones = new Array(160).fill(0);
  for (const a of addresses) {
    const bytes = hexToBytes(a);
    for (let i = 0; i < 160; i++) if (bytes[i >> 3] & (0x80 >> (i & 7))) ones[i]++;
  }
  const shares = ones.map(o => o / addresses.length);
  const sigma = 0.5 / Math.sqrt(addresses.length);
  const outside = shares.filter(v => Math.abs(v - 0.5) > 1.96 * sigma).length;
  barChart(document.getElementById("ch-bits"), {
    width: 440, title: "Share of 1s in each of the 160 address bits", labels: shares.map((_, i) => String(i)), labelEvery: 20,
    series: [{ name: "bits", values: shares, cls: "s2" }], reference: 0.5, referenceLabel: "½",
    yFormat: "percent", yMax: 1, xTitle: "bit position (0 = first)", yTitle: "share of 1s"
  });
  const bitChi = chiSquareTest([ones.reduce((s, v) => s + v, 0), 160 * addresses.length - ones.reduce((s, v) => s + v, 0)], [80 * addresses.length, 80 * addresses.length]);
  table("st-uniform", ["Test", "statistic", "df", "p-value", "verdict at 5%"], [
    ["χ² on the 16 hex digits", "χ² = " + f(chi.chi), String(chi.df), pText(chi.pValue), chi.pValue < 0.05 ? "reject uniformity" : "looks uniform"],
    ["χ² on total 1s vs 0s", "χ² = " + f(bitChi.chi), String(bitChi.df), pText(bitChi.pValue), bitChi.pValue < 0.05 ? "reject balance" : "looks balanced"],
    ["bits outside ½ ± 1.96σ", outside + " of 160", "–", "expected ≈ 8", outside <= 16 ? "consistent with chance" : "too many"]
  ]);
  say("st-uniform-text",
    "Across " + total + " hex digits every digit appears close to 1/16 = 6.25% of the time (χ² = " + f(chi.chi) + " with 15 degrees of freedom, p = " + pText(chi.pValue) + "). " +
    "Each address bit is 1 in about half of the addresses: " + outside + " of 160 positions are outside the 95% band, where about 8 are expected by chance. " +
    "Unlike the public keys of HMWK 1, which showed symmetries and fixed counts, the hashed addresses show no structure: Keccak-256 has removed it.");
  return { chi, outside };
}

function childIndependence(children) {
  const distances = [];
  for (let i = 0; i + 1 < children.length; i++) distances.push(hamming(children[i], children[i + 1]));
  const s = summary(distances);
  const bins = binnedAgainstBinomial(distances, 256, 0.5, 96, 159, 4);
  barChart(document.getElementById("ch-children"), {
    title: "Different bits between child keys i and i + 1 (" + distances.length + " pairs)",
    labels: bins.labels, labelEvery: 2, series: [{ name: "BIP-32 children", values: bins.observed, cls: "s1" }],
    reference: bins.expected, referenceLabel: "— Binomial(256, ½)", yFormat: "percent",
    xTitle: "number of different bits out of 256", yTitle: "share of pairs"
  });
  say("st-children-text",
    "Consecutive child private keys differ in " + f(s.mean, 1) + " bits on average (standard deviation " + f(s.sd, 2) + ", ideal 128 and 8). " +
    "The index changes by one, the keys look unrelated. This is what makes it safe to give out many addresses from one phrase: " +
    "seeing some public addresses does not help to guess the others.");
  return s;
}

function bip39Checksum() {
  const trial = (words, n) => {
    let pass = 0;
    for (let t = 0; t < n; t++) {
      const w = Array.from({ length: words }, () => BIP39_WORDLIST[Math.floor(Math.random() * 2048)]);
      if (checkMnemonic(w).valid) pass++;
    }
    return pass;
  };
  const p12 = trial(12, RANDOM_PHRASES);
  const p24 = trial(24, RANDOM_PHRASES / 4);
  let oneWord = 0;
  for (let t = 0; t < TYPO_TRIALS; t++) {
    const w = entropyToMnemonic(randomBytes(16)).words;
    const pos = Math.floor(Math.random() * 12);
    let replacement;
    do replacement = BIP39_WORDLIST[Math.floor(Math.random() * 2048)]; while (replacement === w[pos]);
    w[pos] = replacement;
    if (checkMnemonic(w).valid) oneWord++;
  }
  return { p12, p24, oneWord };
}

function eip55Checks(addresses) {
  const letters = [];
  const uppers = [];
  let upperTotal = 0, letterTotal = 0;
  for (const a of addresses) {
    const cs = toChecksumAddress(a).address.slice(2);
    const l = (a.match(/[a-f]/g) || []).length;
    const u = (cs.match(/[A-F]/g) || []).length;
    letters.push(l);
    uppers.push(u);
    letterTotal += l;
    upperTotal += u;
  }
  const lBins = binnedAgainstBinomial(letters, 40, 6 / 16, 4, 27, 2);
  barChart(document.getElementById("ch-letters"), {
    width: 440, title: "Letters a–f per address", labels: lBins.labels, labelEvery: 2,
    series: [{ name: "letters", values: lBins.observed, cls: "s1" }], reference: lBins.expected, referenceLabel: "— Binomial(40, 6/16)",
    yFormat: "percent", xTitle: "letters in the address", yTitle: "share of addresses"
  });
  const uBins = binnedAgainstBinomial(uppers, 40, 3 / 16, 0, 19, 2);
  barChart(document.getElementById("ch-upper"), {
    width: 440, title: "Uppercase letters per checksummed address", labels: uBins.labels, labelEvery: 2,
    series: [{ name: "uppercase", values: uBins.observed, cls: "s2" }], reference: uBins.expected, referenceLabel: "— Binomial(40, 3/16)",
    yFormat: "percent", xTitle: "uppercase letters", yTitle: "share of addresses"
  });

  let digitTypoPass = 0, expectedPass = 0, caseTypoPass = 0, caseTrials = 0;
  const hex = "0123456789abcdef";
  for (let t = 0; t < TYPO_TRIALS; t++) {
    const lower = addresses[t % addresses.length];
    const cs = toChecksumAddress(lower).address.slice(2).split("");
    const pos = Math.floor(Math.random() * 40);
    let c;
    do c = hex[Math.floor(Math.random() * 16)]; while (c === lower[pos]);
    const typo = cs.slice();
    typo[pos] = /[a-f]/.test(c) && Math.random() < 0.5 ? c.toUpperCase() : c;
    if (isValidChecksumAddress("0x" + typo.join(""))) digitTypoPass++;
    const newLower = typo.join("").toLowerCase();
    expectedPass += Math.pow(0.5, (newLower.match(/[a-f]/g) || []).length);
    const letterPositions = cs.map((ch, i) => (/[a-fA-F]/.test(ch) ? i : -1)).filter(i => i >= 0);
    if (letterPositions.length) {
      const lp = letterPositions[Math.floor(Math.random() * letterPositions.length)];
      const flipped = cs.slice();
      flipped[lp] = flipped[lp] === flipped[lp].toUpperCase() ? flipped[lp].toLowerCase() : flipped[lp].toUpperCase();
      caseTrials++;
      if (isValidChecksumAddress("0x" + flipped.join(""))) caseTypoPass++;
    }
  }
  return { letterTotal, upperTotal, meanLetters: letterTotal / addresses.length, digitTypoPass, expectedPass, caseTypoPass, caseTrials };
}

async function runStats() {
  if (!currentSeed) return;
  const status = document.getElementById("st-status");
  const count = Number(document.getElementById("st-addresses").value);
  status.textContent = "Deriving " + count + " addresses and running the tests…";
  await new Promise(r => setTimeout(r, 20));
  const t0 = performance.now();
  const kec = keccakAvalanche();
  const { children, addresses } = await deriveAddresses(count);
  const uni = addressUniformity(addresses);
  const child = childIndependence(children);
  const bip = bip39Checksum();
  const eip = eip55Checks(addresses);

  table("st-check", ["Error or random input", "trials", "accepted as valid", "measured", "expected"], [
    ["Random 12-word sequence (4 checksum bits)", String(RANDOM_PHRASES), String(bip.p12), pct(bip.p12 / RANDOM_PHRASES, 2), "1/16 = 6.25%"],
    ["Random 24-word sequence (8 checksum bits)", String(RANDOM_PHRASES / 4), String(bip.p24), pct(bip.p24 / (RANDOM_PHRASES / 4), 2), "1/256 = 0.39%"],
    ["Valid 12-word phrase with one word changed", String(TYPO_TRIALS), String(bip.oneWord), pct(bip.oneWord / TYPO_TRIALS, 2), "≈ 1/16 = 6.25%"],
    ["EIP-55 address with one hex digit changed", String(TYPO_TRIALS), String(eip.digitTypoPass), pct(eip.digitTypoPass / TYPO_TRIALS, 3), (eip.expectedPass).toFixed(2) + " expected passes"],
    ["EIP-55 address with the case of one letter flipped", String(eip.caseTrials), String(eip.caseTypoPass), pct(eip.caseTypoPass / Math.max(1, eip.caseTrials), 3), "0, always detected"]
  ]);
  say("st-check-text",
    "BIP-39: about 1 random phrase in 16 has a valid checksum (" + pct(bip.p12 / RANDOM_PHRASES, 2) + " measured), and a single wrong word slips through with the same probability, " +
    "because the 4 checksum bits are just the first bits of a hash. The checksum catches most mistakes, not all, which is why wallets also check that the derived address is the expected one. " +
    "EIP-55: an address has on average " + f(eip.meanLetters, 1) + " letters (40 × 6/16 = 15 expected) and " + pct(eip.upperTotal / eip.letterTotal) + " of them are uppercase, as the ½ rule predicts. " +
    "A changed digit gives a new hash and a new random case pattern, so it passes only with probability 2^−letters ≈ 1 in 30 000: " +
    eip.digitTypoPass + " of " + TYPO_TRIALS + " passed. Flipping the case of a letter is always detected, because the hash of the lowercase text does not change. " +
    "An all-lowercase address carries no checksum and is accepted by wallets as it is.");

  say("sum-bip39", pct(bip.p12 / RANDOM_PHRASES, 2) + " of random 12-word phrases valid (expected 6.25%).");
  say("sum-hmac", "Consecutive child keys differ in " + f(child.mean, 1) + " of 256 bits (expected 128).");
  say("sum-keccak", "Avalanche " + f(kec.mean, 1) + " ± " + f(kec.sd, 1) + " bits (ideal 128 ± 8); hex digits χ² p = " + pText(uni.chi.pValue) + ".");
  say("sum-eip55", pct(eip.upperTotal / eip.letterTotal) + " of letters uppercase; " + eip.digitTypoPass + " of " + TYPO_TRIALS + " changed digits undetected.");
  status.textContent = "Done in " + Math.round(performance.now() - t0) + " ms, using " + count + " addresses derived from the phrase in section 1.";
}

document.addEventListener("wallet:derived", event => {
  const first = currentSeed === null;
  currentSeed = event.detail.seed;
  if (first) runStats();
});
document.getElementById("st-run").addEventListener("click", runStats);
document.getElementById("st-addresses").addEventListener("change", runStats);
