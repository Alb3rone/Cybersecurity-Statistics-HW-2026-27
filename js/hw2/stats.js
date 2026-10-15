const AVALANCHE_TRIALS = 3000;
const ADDRESS_COUNT = 100;
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
  for (let t = 0; t < AVALANCHE_TRIALS; t++) {
    const m = randomBytes(32);
    const m2 = m.slice();
    const bit = Math.floor(Math.random() * 256);
    m2[bit >> 3] ^= 1 << (bit & 7);
    const h1 = keccak256(m);
    const h2 = keccak256(m2);
    distances.push(hamming(h1, h2));
  }
  const s = summary(distances);
  const bins = binnedAgainstBinomial(distances, 256, 0.5, 96, 159, 4);
  barChart(document.getElementById("ch-aval"), {
    title: "Changed output bits after flipping one input bit (" + AVALANCHE_TRIALS + " trials)",
    labels: bins.labels, labelEvery: 2, series: [{ name: "Keccak-256", values: bins.observed, cls: "s1" }],
    reference: bins.expected, referenceLabel: "— Binomial(256, ½)", yFormat: "percent",
    xTitle: "number of changed bits out of 256", yTitle: "share of trials"
  });
  say("st-aval-text",
    "On average " + f(s.mean, 1) + " of 256 bits change (" + pct(s.mean / 256) + "), with standard deviation " + f(s.sd, 2) +
    " against the ideal 8: the histogram follows the binomial curve, so a one-bit change of the input gives an unpredictable new digest.");
  return s;
}

async function deriveAddresses(count) {
  const parent = (await derivePath(currentSeed, "m/44'/60'/0'/0")).node;
  const addresses = [];
  for (let i = 0; i < count; i++) {
    const child = await deriveChild(parent, i);
    addresses.push(addressFromPrivateKey(child.key).address);
  }
  return addresses;
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
  const meanShare = shares.reduce((a, v) => a + v, 0) / shares.length;
  barChart(document.getElementById("ch-bits"), {
    width: 440, title: "Share of 1s in each of the 160 address bits", labels: shares.map((_, i) => String(i)), labelEvery: 20,
    series: [{ name: "bits", values: shares, cls: "s2" }], reference: 0.5, referenceLabel: "½",
    yFormat: "percent", yMax: 1, xTitle: "bit position (0 = first)", yTitle: "share of 1s"
  });
  say("st-uniform-text",
    "Across " + total + " hex digits every digit appears close to 1/16 = 6.25% of the time (χ² = " + f(chi.chi) + " with 15 degrees of freedom, p = " + pText(chi.pValue) + "). " +
    "The 160 address bits are 1 in " + pct(meanShare) + " of the cases on average, from " + pct(Math.min(...shares), 0) + " to " + pct(Math.max(...shares), 0) + " for single positions: with only 100 addresses one standard deviation is 5%, so this spread is ordinary noise. " +
    "Unlike the public keys of HMWK 1, which showed symmetries and fixed counts, the hashed addresses show no structure: Keccak-256 has removed it.");
  return chi;
}

function eip55Share(addresses) {
  let upper = 0, letters = 0;
  for (const a of addresses) {
    letters += (a.match(/[a-f]/g) || []).length;
    upper += (toChecksumAddress(a).address.match(/[A-F]/g) || []).length;
  }
  say("st-eip55-text",
    "The " + addresses.length + " addresses contain " + letters + " letters a–f, " + f(letters / addresses.length, 1) + " per address against 40 × 6/16 = 15 expected. " +
    pct(upper / letters) + " of them are uppercase after EIP-55, close to ½, because each one depends on a digit of a Keccak-256 hash being 8 or more. " +
    "A wrong character changes that hash and the whole case pattern, so a typo passes the check only with probability about 2^−15.");
}

async function runStats() {
  if (!currentSeed) return;
  const status = document.getElementById("st-status");
  status.textContent = "Deriving " + ADDRESS_COUNT + " addresses and running the tests…";
  await new Promise(r => setTimeout(r, 20));
  keccakAvalanche();
  const addresses = await deriveAddresses(ADDRESS_COUNT);
  addressUniformity(addresses);
  eip55Share(addresses);
  status.textContent = "";
}

document.addEventListener("wallet:derived", event => {
  const first = currentSeed === null;
  currentSeed = event.detail.seed;
  if (first) runStats();
});
document.getElementById("st-run").addEventListener("click", runStats);
