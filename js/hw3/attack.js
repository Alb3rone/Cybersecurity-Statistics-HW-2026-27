const CHUNK = 20000;
const attackState = { bruteRate: null, running: false };

function sameJacobian(P, Q) {
  const z2 = (P.z * P.z) % SECP_P;
  return P.x === (Q.x * z2) % SECP_P && P.y === (Q.y * z2 % SECP_P * P.z) % SECP_P;
}

function humanTime(seconds) {
  if (seconds < 1) return (seconds * 1000).toFixed(seconds < 0.01 ? 2 : 0) + " ms";
  if (seconds < 120) return seconds.toFixed(1) + " s";
  if (seconds < 7200) return (seconds / 60).toFixed(1) + " min";
  if (seconds < 172800) return (seconds / 3600).toFixed(1) + " h";
  const years = seconds / 31557600;
  if (years < 1) return (seconds / 86400).toFixed(0) + " days";
  if (years < 10000) return years.toFixed(0) + " years";
  return "10^" + Math.log10(years).toFixed(0) + " years";
}

function setBusy(busy) {
  attackState.running = busy;
  for (const id of ["atk-brute", "atk-bsgs"]) document.getElementById(id).disabled = busy;
}

function reportFound(method, d, ops, seconds) {
  const decrypted = decryptMessage(d, state.ciphertext);
  const ok = secpMultiply(d, SECP_G);
  const list = document.getElementById("atk-out");
  list.replaceChildren();
  fact(list, "Method", method);
  fact(list, "Recovered d", d.toString() + (ok.x === state.Q.x && ok.y === state.Q.y ? " (dG = Q)" : " (wrong)"));
  fact(list, "Group operations", ops.toLocaleString("en-US"));
  fact(list, "Time", humanTime(seconds));
  fact(list, "Decrypted message", decrypted);
}

function bruteForce() {
  if (attackState.running) return;
  setBusy(true);
  const Q = state.Q;
  const limit = 1 << state.bits;
  const G = toJacobian(SECP_G);
  const progress = document.getElementById("atk-status");
  let P = G;
  let k = 1;
  const t0 = performance.now();
  const step = () => {
    const end = Math.min(k + CHUNK, limit);
    for (; k < end; k++) {
      if (sameJacobian(P, Q)) {
        const seconds = (performance.now() - t0) / 1000;
        attackState.bruteRate = k / seconds;
        progress.textContent = "";
        reportFound("exhaustive search", BigInt(k), k, seconds);
        renderExtrapolation();
        setBusy(false);
        return;
      }
      P = jacobianAdd(P, G);
    }
    if (k >= limit) {
      progress.textContent = "Key not found in the range.";
      setBusy(false);
      return;
    }
    progress.textContent = "Trying d = " + k.toLocaleString("en-US") + " of " + limit.toLocaleString("en-US") + " (" + (100 * k / limit).toFixed(0) + "%)…";
    setTimeout(step, 0);
  };
  step();
}

function babyStepGiantStep() {
  if (attackState.running) return;
  setBusy(true);
  document.getElementById("atk-status").textContent = "Running baby-step giant-step…";
  setTimeout(() => {
    const t0 = performance.now();
    const m = Math.ceil(Math.sqrt(1 << state.bits));
    const table = new Map();
    let P = null;
    for (let j = 1; j <= m; j++) {
      P = pointAdd(P, SECP_G);
      table.set(P.x.toString(16) + ":" + P.y.toString(16), j);
    }
    const stride = pointNegate(secpMultiply(BigInt(m), SECP_G));
    let R = state.Q;
    let found = null;
    let ops = m;
    for (let i = 0; i <= m && found === null; i++) {
      const j = table.get(R.x.toString(16) + ":" + R.y.toString(16));
      if (j !== undefined) found = BigInt(i) * BigInt(m) + BigInt(j);
      else {
        R = pointAdd(R, stride);
        ops++;
        if (R === null) found = BigInt(i + 1) * BigInt(m);
      }
    }
    const seconds = (performance.now() - t0) / 1000;
    document.getElementById("atk-status").textContent = found === null ? "Key not found in the range." : "";
    if (found !== null) reportFound("baby-step giant-step (table of " + m.toLocaleString("en-US") + " points)", found, ops, seconds);
    setBusy(false);
  }, 20);
}

function renderExtrapolation() {
  const rate = attackState.bruteRate;
  const rows = [state.bits, 32, 48, 64, 128, 256].filter((b, i, a) => a.indexOf(b) === i).map(b => {
    const brute = Math.pow(2, b) / rate;
    const sqrt = 2 * Math.pow(2, b / 2) / rate;
    return [b + (b === state.bits ? " (this page)" : b === 256 ? " (secp256k1)" : ""), "2^" + b, humanTime(brute), "2^" + (b / 2 + 1), humanTime(sqrt)];
  });
  renderTable("atk-extra", ["Key bits", "Keys to try (worst case)", "Exhaustive search", "Steps for BSGS or rho", "BSGS or rho"], rows);
  document.getElementById("atk-extra-text").textContent =
    "Measured speed: " + Math.round(rate).toLocaleString("en-US") + " point additions per second in this browser. " +
    "Every extra bit of key doubles the exhaustive search and multiplies the square-root attacks by √2. For a full 256-bit key " +
    "even 2^128 operations, at a billion times this speed, would take about " + humanTime(Math.pow(2, 128) / (rate * 1e9)) + ".";
}

document.getElementById("atk-brute").addEventListener("click", bruteForce);
document.getElementById("atk-bsgs").addEventListener("click", babyStepGiantStep);
document.addEventListener("hw3:encrypted", () => {
  document.getElementById("atk-out").replaceChildren();
  document.getElementById("atk-status").textContent = "";
});
