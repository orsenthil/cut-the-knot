"use strict";

/*
 * The page for Filling an Array with 0s and 1s: drawing and input only. The grid
 * is one CSS grid of buttons with a column of row sums at the right and a row
 * of column sums at the bottom. The rules, the sums and the construction are in
 * zeros-and-ones-array-core.js.
 */

(function () {
  const Core = ZeroOneCore;
  const gridEl = document.getElementById("grid");
  const setLine = document.getElementById("setLine");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn"), mIn = document.getElementById("mIn");
  const clearBtn = document.getElementById("clearBtn"), compBtn = document.getElementById("compBtn"), bestBtn = document.getElementById("bestBtn");

  let state = Core.start();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    gridEl.textContent = "";
    gridEl.style.gridTemplateColumns = `repeat(${state.m + 1}, auto)`;
    const s = Core.sums(state);
    for (let i = 0; i < state.n; i++) {
      for (let j = 0; j < state.m; j++) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = String(state.cells[i][j]);
        if (state.cells[i][j]) b.classList.add("one");
        b.setAttribute("aria-label", `Row ${i + 1}, column ${j + 1}: ${state.cells[i][j]}. Press to flip.`);
        b.addEventListener("click", () => {
          state = Core.toggle(state, i, j) || state;
          render();
          const again = gridEl.children[i * (state.m + 1) + j];
          if (again) again.focus();
        });
        gridEl.appendChild(b);
      }
      const t = document.createElement("div");
      t.className = "sum";
      t.textContent = String(s.rows[i]);
      t.setAttribute("aria-label", `Row ${i + 1} has ${s.rows[i]} ones`);
      gridEl.appendChild(t);
    }
    for (let j = 0; j < state.m; j++) {
      const t = document.createElement("div");
      t.className = "sum";
      t.textContent = String(s.cols[j]);
      t.setAttribute("aria-label", `Column ${j + 1} has ${s.cols[j]} ones`);
      gridEl.appendChild(t);
    }
    const corner = document.createElement("div");
    corner.className = "sum corner";
    gridEl.appendChild(corner);

    setLine.textContent = `|{${s.distinct.join(", ")}}| = ${s.count}`;
    nIn.value = String(state.n);
    mIn.value = String(state.m);
    if (s.count === s.most) say(`${s.count} different sums: the most there can be on a ${state.n} by ${state.m} board (0 up to ${s.most - 1}).`, "done");
    else {
      const small = Math.max(state.n, state.m) <= 7;
      say(`The most possible is ${s.most}${Core.attainable(state.n, state.m) ? "" : small ? ", and for this size it cannot be reached (a complete search shows it)" : ", and the page does not say it can be reached for this size"}.`);
    }
    if (window.Track) window.Track.state({ ...state, count: s.count, most: s.most });
  }

  function resize() { state = Core.resize(state, nIn.value, mIn.value) || state; render(); }
  nIn.addEventListener("change", resize);
  mIn.addEventListener("change", resize);
  clearBtn.addEventListener("click", () => { state = Core.start({ n: state.n, m: state.m }); render(); });
  compBtn.addEventListener("click", () => { state = Core.complement(state); render(); });
  bestBtn.addEventListener("click", () => {
    const o = Core.optimal(state.n, state.m);
    if (!o) {
      render();
      say(`There is no array with ${Math.max(state.n, state.m) + 1} different sums for ${state.n} by ${state.m} that this page knows of; the page's claim does not cover it.`);
      return;
    }
    state = o;
    render();
  });
  render();
})();
