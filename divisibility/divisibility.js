"use strict";

/*
 * The page for Divisibility: drawing and input only; the rules are in
 * divisibility-core.js. The digits are buttons in a table: press one to raise it
 * by 1 (9 wraps to 0), or focus it and type a digit. The integer each row makes
 * is written at its right, the integer each column makes under it, and the ones
 * that p divides are tinted.
 */

(function () {
  const Core = DivisibilityCore;
  const grid = document.getElementById("grid");
  const statusEl = document.getElementById("status");
  const rowsIn = document.getElementById("rowsIn");
  const colsIn = document.getElementById("colsIn");
  const pIn = document.getElementById("pIn");
  const newBtn = document.getElementById("newBtn");
  const summary = document.getElementById("summary");

  let state = Core.start({ seed: (Date.now() % 100000) + 1 });

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state);
    if (kind) statusEl.classList.add(kind);
  }

  let focusAt = null;
  function render() {
    grid.textContent = "";
    const d = Core.divisibility(state);
    const rn = Core.rowNumbers(state), cn = Core.colNumbers(state);
    const tbl = document.createElement("table");
    tbl.className = "matrix";
    state.digits.forEach((row, i) => {
      const tr = document.createElement("tr");
      row.forEach((v, j) => {
        const td = document.createElement("td");
        const b = document.createElement("button");
        b.type = "button"; b.className = "digit"; b.textContent = String(v);
        b.dataset.i = i; b.dataset.j = j;
        b.setAttribute("aria-label", `Row ${i + 1}, column ${j + 1}: digit ${v}. Press to raise it, or type a digit.`);
        td.appendChild(b); tr.appendChild(td);
      });
      const t = document.createElement("td");
      t.className = "num" + (d.rows[i] ? " yes" : "");
      t.textContent = String(rn[i]);
      t.setAttribute("aria-label", `Row ${i + 1} reads ${rn[i]}, ${d.rows[i] ? "divisible" : "not divisible"} by ${state.p}`);
      tr.appendChild(t);
      tbl.appendChild(tr);
    });
    const tr = document.createElement("tr");
    cn.forEach((v, j) => {
      const t = document.createElement("td");
      t.className = "num" + (d.cols[j] ? " yes" : "");
      t.textContent = String(v);
      t.setAttribute("aria-label", `Column ${j + 1} reads ${v}, ${d.cols[j] ? "divisible" : "not divisible"} by ${state.p}`);
      tr.appendChild(t);
    });
    tbl.appendChild(tr);
    grid.appendChild(tbl);
    rowsIn.value = String(state.rows); colsIn.value = String(state.cols);
    if (document.activeElement !== pIn) pIn.value = String(state.p);
    const note = Core.primeTo10(state.p) ? "" : ` ${state.p} is not prime to 10, so the rule below does not have to hold.`;
    summary.textContent = `${d.count} of the ${d.total} numbers are divisible by ${state.p}.` + (d.notDivisible === 1 ? ` Exactly one is not.${Core.primeTo10(state.p) ? " That cannot happen when p is prime to 10!" : ""}` : "") + note;
    if (focusAt) { const b = grid.querySelector(`button[data-i="${focusAt[0]}"][data-j="${focusAt[1]}"]`); if (b) b.focus(); focusAt = null; }
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next; render();
    if (note !== undefined) say(note);
    return true;
  }

  grid.addEventListener("click", (e) => {
    const b = e.target.closest("button.digit");
    if (!b) return;
    focusAt = [b.dataset.i, b.dataset.j];
    apply({ type: "digit", i: Number(b.dataset.i), j: Number(b.dataset.j) }, "Digit raised by 1.");
  });
  grid.addEventListener("keydown", (e) => {
    const b = e.target.closest("button.digit");
    if (!b) return;
    const i = Number(b.dataset.i), j = Number(b.dataset.j);
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); focusAt = [i, j]; apply({ type: "digit", i, j, value: Number(e.key) }, `Digit set to ${e.key}.`); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const ni = Math.max(0, Math.min(state.rows - 1, i + (e.key === "ArrowDown") - (e.key === "ArrowUp")));
      const nj = Math.max(0, Math.min(state.cols - 1, j + (e.key === "ArrowRight") - (e.key === "ArrowLeft")));
      const nb = grid.querySelector(`button[data-i="${ni}"][data-j="${nj}"]`); if (nb) nb.focus();
    }
  });

  function resize() {
    if (!apply({ type: "size", rows: rowsIn.value, cols: colsIn.value, seed: Date.now() % 100000 + 1 }, `A new matrix, ${state.rows === undefined ? "" : ""}with new digits.`)) { say(`Rows and columns are whole numbers from ${Core.MIN_SIZE} to ${Core.MAX_SIZE}.`); render(); }
  }
  rowsIn.addEventListener("change", resize);
  colsIn.addEventListener("change", resize);
  pIn.addEventListener("change", () => { if (!apply({ type: "p", value: pIn.value }, "")) { say(`p is a whole number from ${Core.MIN_P} to ${Core.MAX_P}.`); pIn.value = String(state.p); } });
  newBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset", seed: Date.now() % 100000 + 1 }); render(); say("New random digits."); });

  render();
})();
