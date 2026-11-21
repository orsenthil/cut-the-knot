"use strict";

/* Browser UI: the 2^n corner of the infinite Latin square, as numbers or colours. */
(() => {
  const C = InfiniteLatinSquareCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const levelInput = document.getElementById("levelInput");
  const modInput = document.getElementById("modInput");
  let state = null;

  function render() {
    stage.replaceChildren();
    const rows = C.square(state.level, state.modulus);
    const n = rows.length;
    const table = document.createElement("div");
    table.className = "latin-grid";
    table.style.setProperty("--n", String(n));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const cell = document.createElement("span");
        cell.className = "cell";
        const v = rows[i][j];
        if (state.modulus && n > 16) cell.style.setProperty("--hue", String(v * 360 / state.modulus));
        else cell.textContent = String(v);
        cell.setAttribute("aria-label", `Row ${i}, column ${j}: ${v}`);
        table.appendChild(cell);
      }
    }
    stage.appendChild(table);
    levelInput.value = String(state.level);
    modInput.value = String(state.modulus);
    status.textContent = `The ${n} by ${n} corner: every row and column holds each of its ${n} symbols once. ` +
      (state.modulus ? `Colours are values modulo ${state.modulus}.` : "Numbers are shown directly.");
    if (window.Track) window.Track.state({ level: state.level, modulus: state.modulus, side: n });
  }

  levelInput.addEventListener("input", () => {
    state = C.setLevel(state, Number(levelInput.value));
    render();
  });
  modInput.addEventListener("change", () => {
    state = C.setModulus(state, Number(modInput.value));
    render();
  });
  state = C.start();
  render();
})();
