"use strict";

/*
 * The page for Other Primes: drawing and input only. The rules are in
 * other-primes-core.js. The table is a grid of cells inside the stage; the
 * cells are buttons, so a cell can be picked by mouse, touch or keyboard, and
 * the picked cell says which two odd numbers multiply to make it.
 */

(function () {
  const Core = OtherPrimesCore;
  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const gridEl = document.getElementById("grid");
  const readoutEl = document.getElementById("readout");
  const dimEl = document.getElementById("dim");
  const showN = document.getElementById("showN");
  const showX = document.getElementById("showX");
  const newBtn = document.getElementById("newBtn");

  let state = Core.start({});
  let picked = null; // [i, j]

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const rows = Core.table(state);
    gridEl.textContent = "";
    gridEl.style.setProperty("--dim", state.dim);
    rows.forEach((row, i) => row.forEach((v, j) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cell" + (picked && (picked[0] === i || picked[1] === j) ? " line" : "") +
        (picked && picked[0] === i && picked[1] === j ? " on" : "");
      b.textContent = v;
      b.setAttribute("aria-label", `Row ${i + 1}, column ${j + 1}: ${v}`);
      b.addEventListener("click", () => { picked = [i, j]; render(); explain(); });
      gridEl.appendChild(b);
    }));
    if (window.Track) window.Track.state({ dim: state.dim, showX: state.showX });
  }

  function explain() {
    if (!picked) {
      readoutEl.textContent = "Pick a cell to see where it comes from.";
      return;
    }
    const [i, j] = picked;
    const [a, b] = Core.factors(i, j);
    const n = Core.entry(i, j), x = Core.xOf(i, j);
    readoutEl.textContent = `n = ${n} gives x = 2·${n} + 1 = ${x} = ${a} × ${b}, so ${x} is not prime.`;
  }

  function newGame() {
    state = Core.start({ dim: dimEl.value, showX: showX.checked });
    dimEl.value = state.dim;
    picked = null;
    say(state.showX ? "Showing x: the odd composite numbers." : "Showing n: x is prime exactly when (x − 1) / 2 is missing.");
    render();
    explain();
  }

  newBtn.addEventListener("click", newGame);
  dimEl.addEventListener("change", newGame);
  showN.addEventListener("change", newGame);
  showX.addEventListener("change", newGame);
  newGame();
})();
