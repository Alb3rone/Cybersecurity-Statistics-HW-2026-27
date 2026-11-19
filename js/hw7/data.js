const BERKELEY = [
  ["A", 512, 313, 89, 19],
  ["B", 353, 207, 17, 8],
  ["C", 120, 205, 202, 391],
  ["D", 138, 279, 131, 244],
  ["E", 53, 138, 94, 299],
  ["F", 22, 351, 24, 317]
];

const DATASETS = {
  "gender-admission": { x: "gender", f: "admission", label: "gender × admission" },
  "department-admission": { x: "department", f: "admission", label: "department × admission" },
  "department-gender": { x: "department", f: "gender", label: "department × gender" }
};

function berkeleyRecords() {
  const records = [];
  const add = (department, gender, admission, count) => {
    for (let i = 0; i < count; i++) records.push({ department, gender, admission });
  };
  for (const [d, ma, mr, fa, fr] of BERKELEY) {
    add(d, "male", "admitted", ma);
    add(d, "male", "rejected", mr);
    add(d, "female", "admitted", fa);
    add(d, "female", "rejected", fr);
  }
  return records;
}

function parseCsv(text) {
  const pairs = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const parts = line.split(/[,;\t]/).map(p => p.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("Line " + (i + 1) + " must contain exactly two values separated by a comma.");
    pairs.push(parts);
  });
  if (pairs.length < 2) throw new Error("Enter at least two records.");
  return pairs;
}

function crossTab(pairs) {
  const xs = [...new Set(pairs.map(p => p[0]))].sort();
  const fs = [...new Set(pairs.map(p => p[1]))].sort();
  const counts = xs.map(() => fs.map(() => 0));
  for (const [x, f] of pairs) counts[xs.indexOf(x)][fs.indexOf(f)]++;
  const rowTotals = counts.map(r => r.reduce((a, b) => a + b, 0));
  const colTotals = fs.map((_, j) => counts.reduce((a, r) => a + r[j], 0));
  return { xs, fs, counts, rowTotals, colTotals, n: pairs.length };
}
