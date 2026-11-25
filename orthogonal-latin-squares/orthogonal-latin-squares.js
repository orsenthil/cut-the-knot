"use strict";

/*
 * The page for Orthogonal Latin Squares: drawing and input only. The board is a
 * grid of buttons with rotate arrows on all four sides. Pressing a cell and then
 * another cell in the same row swaps their letters in the chosen square. The
 * rules, the checks and the constructions are in orthogonal-latin-squares-core.js.
 */

(function () {
  const Core = LatinCore;
  const gridEl = document.getElementById("grid");
  const checksEl = document.getElementById("checks");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn"), randBox = document.getElementById("randBox");
  const applyL = document.getElementById("applyL"), applyR = document.getElementById("applyR");
  const newBtn = document.getElementById("newBtn"), showBtn = document.getElementById("showBtn");
  const SMALL = "abcdefghijklmnopqrstuvwxyz", BIG = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  let state = null;
  let picked = null;          // [row, col] of the first cell of a swap
  let announced = false;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function rot(label, text, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rot";
    b.textContent = text;
    b.setAttribute("aria-label", label);
    b.addEventListener("click", () => { const next = fn(); if (next) { state = next; picked = null; render(); } });
    return b;
  }
  const spacer = () => { const d = document.createElement("div"); d.className = "spacer"; return d; };

  function render() {
    gridEl.textContent = "";
    const n = state.n;
    gridEl.style.gridTemplateColumns = `auto repeat(${n}, auto) auto`;
    const st = Core.status(state);
    const dup = new Set();
    Core.repeatedPairs(state).forEach(([a, b]) => { dup.add(a.join(",")); dup.add(b.join(",")); });
    // top arrows: rotate a column up
    gridEl.appendChild(spacer());
    for (let c = 0; c < n; c++) gridEl.appendChild(rot(`Rotate column ${c + 1} up`, "▲", () => Core.rotateCol(state, c, "up")));
    gridEl.appendChild(spacer());
    for (let r = 0; r < n; r++) {
      gridEl.appendChild(rot(`Rotate row ${r + 1} left`, "◀", () => Core.rotateRow(state, r, "left")));
      for (let c = 0; c < n; c++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cell" + (picked && picked[0] === r && picked[1] === c ? " sel" : "") + (dup.has(`${r},${c}`) ? " dup" : "");
        const l = document.createElement("span"), rr = document.createElement("span");
        l.className = "l"; rr.className = "r";
        l.textContent = SMALL[state.left[r][c]]; rr.textContent = BIG[state.right[r][c]];
        b.appendChild(l); b.appendChild(rr);
        b.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}: ${SMALL[state.left[r][c]]} and ${BIG[state.right[r][c]]}${dup.has(`${r},${c}`) ? ", repeats a pair" : ""}${picked && picked[0] === r && picked[1] === c ? ", picked" : ""}`);
        b.addEventListener("click", () => press(r, c));
        gridEl.appendChild(b);
      }
      gridEl.appendChild(rot(`Rotate row ${r + 1} right`, "▶", () => Core.rotateRow(state, r, "right")));
    }
    gridEl.appendChild(spacer());
    for (let c = 0; c < n; c++) gridEl.appendChild(rot(`Rotate column ${c + 1} down`, "▼", () => Core.rotateCol(state, c, "down")));
    gridEl.appendChild(spacer());

    checksEl.textContent = `Small letters: ${st.latinLeft ? "Latin ✓" : "a letter repeats in a row or column"}. Capitals: ${st.latinRight ? "Latin ✓" : "a letter repeats in a row or column"}. Repeated pairs: ${st.repeats}.`;
    applyL.checked = state.apply === "left"; applyR.checked = state.apply === "right";
    nIn.value = String(n);
    if (st.solved) {
      if (!announced) say("Solved! Both squares are Latin and no pair of letters repeats: they are orthogonal.", "win");
      announced = true;
    } else {
      if (announced) say("");
      announced = false;
      if (n === 2 || n === 6) say(n === 2 ? "There is no solution for size 2." : "There is no solution for size 6: this is Euler's 36 officers problem, settled by Tarry in 1900.");
    }
    if (window.Track) window.Track.state({ ...state, picked, status: st });
  }

  function press(r, c) {
    if (!picked) { picked = [r, c]; render(); return; }
    const [r1, c1] = picked;
    if (r1 !== r) { picked = null; render(); say("You may only swap counters in the same row!"); return; }
    picked = null;
    if (c1 === c) { render(); return; }
    state = Core.swap(state, r1, c1, r, c) || state;
    render();
  }

  function newGame() {
    state = Core.start({ n: nIn.value, randomize: randBox.checked });
    state = Core.setApply(state, applyR.checked ? "right" : "left");
    picked = null; announced = false;
    say("");
    render();
  }

  applyL.addEventListener("change", () => { state = Core.setApply(state, "left"); picked = null; render(); });
  applyR.addEventListener("change", () => { state = Core.setApply(state, "right"); picked = null; render(); });
  nIn.addEventListener("change", newGame);
  randBox.addEventListener("change", newGame);
  newBtn.addEventListener("click", newGame);
  showBtn.addEventListener("click", () => {
    const b = Core.solved_board(Number(nIn.value));
    if (!b) { say("This page has no pair to show for this size: none exists for 2 and 6, and the pairs for 10, 14 and 18 need cleverer constructions."); return; }
    state = { ...b, apply: applyR.checked ? "right" : "left" };
    picked = null; announced = false;
    render();
  });
  newGame();
})();
