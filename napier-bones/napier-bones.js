"use strict";

/*
 * The page for Napier's Bones in Various Bases: drawing and input only. The bones
 * of the digits of the number, with the multipliers in the left column. Pressing
 * a multiplier highlights its row and writes out the addition along the
 * diagonals. The rules are in napier-bones-core.js.
 */

(function () {
  const Core = NapierCore;
  const bones = document.getElementById("bones");
  const steps = document.getElementById("steps");
  const statusEl = document.getElementById("status");
  const numEl = document.getElementById("num");
  const baseEl = document.getElementById("base");

  let state = Core.start();
  let k = 3;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const D = (v) => Core.DIGITS[v];
  const T = (n) => Core.toString(n, state.base);

  function render() {
    const base = state.base, ds = Core.digitsOf(state.number, base), cols = ds.length;
    if (k >= base) k = base - 1;
    document.getElementById("baseOut").textContent = base;
    baseEl.value = base;
    if (document.activeElement !== numEl) numEl.value = T(state.number);
    bones.textContent = "";
    bones.style.gridTemplateColumns = `auto repeat(${cols}, auto)`;
    const corner = document.createElement("div"); bones.appendChild(corner);
    ds.forEach((d) => { const h = document.createElement("div"); h.className = "head"; h.textContent = D(d); bones.appendChild(h); });
    const boneRows = ds.map((d) => Core.bone(d, base));
    for (let r = 1; r < base; r++) {
      const lab = document.createElement("button");
      lab.type = "button"; lab.className = "rowlab" + (r === k ? " sel" : ""); lab.textContent = D(r);
      lab.setAttribute("aria-label", `Multiply by ${D(r)} (base ${base})`);
      lab.setAttribute("aria-pressed", r === k ? "true" : "false");
      lab.addEventListener("click", () => { k = r; render(); lab.focus(); });
      bones.appendChild(lab);
      boneRows.forEach((b) => {
        const c = b[r - 1], cell = document.createElement("div");
        cell.className = "cell" + (r === k ? " row" : "");
        const t = document.createElement("span"); t.className = "t"; t.textContent = D(c.tens);
        const u = document.createElement("span"); u.className = "u"; u.textContent = D(c.units);
        cell.append(t, u);
        cell.setAttribute("aria-label", `${D(ds[boneRows.indexOf(b)])} times ${D(r)} is ${D(c.tens)}${D(c.units)}`);
        bones.appendChild(cell);
      });
    }
    // the diagonals
    const m = Core.multiply(state, k);
    if (m) {
      const lines = [`${T(state.number)} × ${D(k)}  (base ${base})`, `Row ${D(k)}: ` + m.cells.map((c) => `${D(c.tens)}${D(c.units)}`).join("  ")];
      m.diagonals.forEach((d, j) => {
        const carry = m.carries[j];
        lines.push(`line ${j + 1} from the right: ${D(d.units)} + ${D(d.tens)}${carry ? " + carry " + D(carry) : ""} = ${T(d.sum + carry)}`);
      });
      lines.push(`Product: ${m.text}   (in base 10: ${state.number} × ${k} = ${state.number * k})`);
      steps.textContent = lines.join("\n");
      say(`${T(state.number)} × ${D(k)} = ${m.text} in base ${base}.`, "done");
    }
    if (window.Track) window.Track.state({ base, number: state.number, multiplier: k });
  }

  numEl.addEventListener("input", () => {
    const s = Core.setText(state, numEl.value);
    if (s) { state = s; render(); }
    else if (numEl.value.trim() !== "") say(`"${numEl.value}" is not a number in base ${state.base} (digits ${Core.DIGITS.slice(0, state.base)}, up to ${Core.MAX_DIGITS} of them).`);
  });
  numEl.addEventListener("blur", () => { numEl.value = T(state.number); });
  baseEl.addEventListener("input", () => { state = Core.setBase(state, baseEl.value); render(); });
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start(); k = 3; numEl.value = "187"; render(); });
  render();
})();
