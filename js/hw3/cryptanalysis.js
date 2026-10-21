const TEST_LENGTHS = [3, 5, 8, 10, 15, 20, 30, 50, 100];
const TRIALS = 400;
const METHODS = [
  { key: "dict", name: "exhaustive search + dictionary", cls: "s3" },
  { key: "freq", name: "letter frequencies (χ²)", cls: "s1" },
  { key: "bigram", name: "bigram scoring", cls: "s2" }
];

const split = Math.floor(CORPUS.length * 0.8);
const TRAIN = CORPUS.slice(0, split);
const TEST = CORPUS.slice(split);
const model = buildModel(TRAIN);

function letterIndex(c) {
  const code = c.charCodeAt(0);
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 97;
  return -1;
}

function buildModel(text) {
  const counts = letterCounts(text);
  const total = counts.reduce((s, v) => s + v, 0);
  const pairs = Array.from({ length: 26 }, () => new Array(26).fill(1));
  let prev = -1;
  for (const c of text) {
    const i = letterIndex(c);
    if (i >= 0 && prev >= 0) pairs[prev][i]++;
    prev = i;
  }
  const logPair = pairs.map(row => {
    const sum = row.reduce((s, v) => s + v, 0);
    return row.map(v => Math.log(v / sum));
  });
  const words = new Set(text.toLowerCase().match(/[a-z]+/g));
  return { letters: total, freq: counts.map(v => v / total), logPair, words };
}

function chiSquareScore(text) {
  const counts = letterCounts(text);
  const n = counts.reduce((s, v) => s + v, 0);
  let chi = 0;
  for (let i = 0; i < 26; i++) {
    const e = n * model.freq[i];
    chi += (counts[i] - e) ** 2 / e;
  }
  return chi;
}

function bigramScore(text) {
  let score = 0;
  let prev = -1;
  for (const c of text) {
    const i = letterIndex(c);
    if (i >= 0 && prev >= 0) score += model.logPair[prev][i];
    prev = i;
  }
  return score;
}

function dictionaryScore(text) {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  return words.filter(w => model.words.has(w)).length;
}

function scoreAll(cipher, method) {
  return Array.from({ length: 26 }, (_, k) => {
    const plain = caesarDecrypt(cipher, k);
    if (method === "freq") return -chiSquareScore(plain);
    if (method === "bigram") return bigramScore(plain);
    return dictionaryScore(plain);
  });
}

function bestKey(scores) {
  const max = Math.max(...scores);
  const ties = scores.map((s, k) => (s === max ? k : -1)).filter(k => k >= 0);
  return ties[Math.floor(Math.random() * ties.length)];
}

function crack(cipher, method) {
  return bestKey(scoreAll(cipher, method));
}

function sampleText(letters) {
  for (;;) {
    let i = Math.floor(Math.random() * (TEST.length - letters * 3));
    while (i > 0 && /[A-Za-z]/.test(TEST[i - 1])) i++;
    let count = 0;
    let j = i;
    while (j < TEST.length && count < letters) {
      if (letterIndex(TEST[j]) >= 0) count++;
      j++;
    }
    if (count === letters) return TEST.slice(i, j);
  }
}

function attackSection3() {
  const cipher = state.caesar;
  const chi = Array.from({ length: 26 }, (_, k) => chiSquareScore(caesarDecrypt(cipher, k)));
  const key = chi.indexOf(Math.min(...chi));
  barChart(document.getElementById("ch-chi"), {
    width: 440, title: "χ² of the decryption with each candidate key", labels: chi.map((_, k) => String(k)), labelEvery: 5,
    series: [{ name: "χ²", values: chi, cls: "s2" }], xTitle: "candidate key k", yTitle: "χ² (lower = more English)"
  });
  const letters = letterCounts(cipher).reduce((s, v) => s + v, 0);
  const sorted = chi.slice().sort((a, b) => a - b);
  const list = document.getElementById("attack-out");
  list.replaceChildren();
  fact(list, "Ciphertext letters", String(letters));
  fact(list, "Recovered key", key + (key === state.shift ? " (correct)" : " (wrong, the key was " + state.shift + ")"));
  fact(list, "Best χ² / second best", sorted[0].toFixed(1) + " / " + sorted[1].toFixed(1));
  fact(list, "Decryption", caesarDecrypt(cipher, key));
}

function runExperiment() {
  const status = document.getElementById("exp-status");
  status.textContent = "Running " + TRIALS + " trials for each length…";
  setTimeout(() => {
    const rates = METHODS.map(() => []);
    for (const n of TEST_LENGTHS) {
      const wins = METHODS.map(() => 0);
      for (let t = 0; t < TRIALS; t++) {
        const plain = sampleText(n);
        const k = 1 + Math.floor(Math.random() * 25);
        const cipher = caesarEncrypt(plain, k);
        METHODS.forEach((m, i) => { if (crack(cipher, m.key) === k) wins[i]++; });
      }
      wins.forEach((w, i) => rates[i].push(w / TRIALS));
    }
    barChart(document.getElementById("ch-exp"), {
      title: "Share of keys recovered (" + TRIALS + " random test texts per length)", labels: TEST_LENGTHS.map(String), labelEvery: 1,
      series: METHODS.map((m, i) => ({ name: m.name, values: rates[i], cls: m.cls })),
      yFormat: "percent", yMax: 1, xTitle: "ciphertext length (letters)", yTitle: "keys recovered"
    });
    const header = ["Letters", ...METHODS.map(m => m.name)];
    const rows = TEST_LENGTHS.map((n, j) => [String(n), ...rates.map(r => (100 * r[j]).toFixed(1) + "%")]);
    renderTable("exp-table", header, rows);
    const at = n => rates[1][TEST_LENGTHS.indexOf(n)];
    const first = METHODS.map((m, i) => TEST_LENGTHS.find((n, j) => rates[i][j] >= 0.95));
    document.getElementById("exp-text").textContent =
      "With letter frequencies the key is found in " + (100 * at(10)).toFixed(0) + "% of the cases at 10 letters, " + (100 * at(30)).toFixed(0) +
      "% at 30 and " + (100 * at(100)).toFixed(0) + "% at 100. The method needs enough letters for the sample distribution to resemble the language: " +
      "a short text has few distinct letters, and a shift that happens to map them onto common English letters can score better than the true key. " +
      "95% success is reached at " + (first[1] ? first[1] + " letters" : "more than 100 letters") + " with frequencies, at " +
      (first[2] ? first[2] + " letters" : "more than 100 letters") + " with bigrams and at " + (first[0] ? first[0] + " letters" : "more than 100 letters") +
      " with the dictionary. Bigrams use more information per letter (which letters follow which) and the dictionary uses whole words, so both work on shorter texts.";
    status.textContent = "";
  }, 20);
}

function renderTable(id, header, rows) {
  const table = el("table");
  const head = el("tr");
  for (const h of header) {
    const th = el("th", "", h);
    th.scope = "col";
    head.append(th);
  }
  const thead = el("thead");
  thead.append(head);
  const body = el("tbody");
  for (const row of rows) {
    const tr = el("tr");
    row.forEach((v, i) => tr.append(el("td", i > 0 ? "num" : "", v)));
    body.append(tr);
  }
  table.append(thead, body);
  document.getElementById(id).replaceChildren(table);
}

function renderCorpus() {
  const list = document.getElementById("corpus-facts");
  list.replaceChildren();
  fact(list, "Corpus", CORPUS_TITLE);
  fact(list, "Training part", "first 80%, " + model.letters.toLocaleString("en-US") + " letters, " + model.words.size.toLocaleString("en-US") + " distinct words");
  fact(list, "Test part", "last 20%, never used to build the model");
  barChart(document.getElementById("ch-english"), {
    width: 440, title: "Letter frequencies of English (training part)", labels: ALPHABET.split(""), labelEvery: 1,
    series: [{ name: "English", values: model.freq, cls: "s1" }], yFormat: "percent", xTitle: "letter", yTitle: "share of letters"
  });
}

renderCorpus();
attackSection3();
runExperiment();
document.addEventListener("hw3:encrypted", attackSection3);
document.getElementById("exp-run").addEventListener("click", runExperiment);
