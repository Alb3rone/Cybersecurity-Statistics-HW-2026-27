const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function shiftLetter(c, k) {
  const code = c.charCodeAt(0);
  if (code >= 65 && code <= 90) return String.fromCharCode(65 + (code - 65 + k + 26) % 26);
  if (code >= 97 && code <= 122) return String.fromCharCode(97 + (code - 97 + k + 26) % 26);
  return c;
}

function caesarEncrypt(text, k) {
  return Array.from(text, c => shiftLetter(c, k % 26)).join("");
}

function caesarDecrypt(text, k) {
  return caesarEncrypt(text, -(k % 26));
}

function letterCounts(text) {
  const counts = new Array(26).fill(0);
  for (const c of text.toUpperCase()) {
    const i = c.charCodeAt(0) - 65;
    if (i >= 0 && i < 26) counts[i]++;
  }
  return counts;
}
