"use strict";

/*
 * Looping Chips - the page.
 *
 * LoopingCore owns the move rule and the right-board numbering; this file
 * draws the rectangular loop and the unfolded ring from one shared state.
 * Select a chip, then an empty legal square (real <button>s, so mouse, touch
 * and keyboard all work). The right board's chips are not clickable: they
 * only mirror the left, as the applet's dummies did.
 */

(function () {
  const H = LoopingCore;

  const leftEl = document.getElementById("leftBoard");
  const rightEl = document.getElementById("rightBoard");
  const resetBtn = document.getElementById("resetBtn");
  const hintInput = document.getElementById("hintInput");
  const statusEl = document.getElementById("status");
  const moveNumEl = document.getElementById("moveNum");

  let state = H.start();
  let selected = -1;

  const leftBtns = new Array(H.N);
  const rightBtns = new Array(H.N);

  function buildBoards() {
    leftEl.innerHTML = "";
    rightEl.innerHTML = "";

    // 4×4 grid; only the 12 border cells are playable (the applet's chain).
    const byRC = {};
    for (let i = 0; i < H.N; i++) {
      const { row, col } = H.leftCell(i);
      byRC[row + "," + col] = i;
    }
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const key = row + "," + col;
        if (!(key in byRC)) {
          const spacer = document.createElement("div");
          spacer.className = "cell spacer";
          spacer.setAttribute("aria-hidden", "true");
          leftEl.appendChild(spacer);
          continue;
        }
        const sq = byRC[key];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell left " + ((row + col) % 2 === 0 ? "light" : "dark");
        btn.dataset.sq = String(sq);
        btn.addEventListener("click", () => onLeftClick(sq));
        const label = document.createElement("span");
        label.className = "sqLabel";
        label.textContent = String(sq + 1);
        btn.appendChild(label);
        leftEl.appendChild(btn);
        leftBtns[sq] = btn;
      }
    }

    const radius = 92;
    const center = 120;
    for (let r = 0; r < H.N; r++) {
      const angle = (r * (360 / H.N) - 90) * (Math.PI / 180);
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      const leftSq = H.leftOf(r);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell right";
      btn.style.left = x + "px";
      btn.style.top = y + "px";
      btn.disabled = true; // mirror only; the applet never lets you drag dummies
      btn.setAttribute("tabindex", "-1");
      const label = document.createElement("span");
      label.className = "sqLabel";
      label.textContent = String(leftSq + 1);
      btn.appendChild(label);
      rightEl.appendChild(btn);
      rightBtns[leftSq] = btn;
    }
  }

  function chipEl(id) {
    const d = document.createElement("span");
    d.className = "chip " + H.COLORS[id];
    d.setAttribute("aria-hidden", "true");
    return d;
  }

  function describe(sq) {
    const id = state.loc[sq];
    const name = id ? H.COLORS[id] + " chip" : "empty";
    return "Square " + (sq + 1) + ": " + name;
  }

  function render() {
    const legal = selected >= 0 ? H.legalMoves(state, selected) : [];
    for (let sq = 0; sq < H.N; sq++) {
      const id = state.loc[sq];
      for (const btn of [leftBtns[sq], rightBtns[sq]]) {
        const old = btn.querySelector(".chip");
        if (old) old.remove();
        if (id) btn.appendChild(chipEl(id));
        btn.querySelector(".sqLabel").style.visibility = hintInput.checked ? "visible" : "hidden";
      }
      const btn = leftBtns[sq];
      btn.classList.toggle("selected", sq === selected);
      btn.classList.toggle("selectable", legal.includes(sq));
      let label = describe(sq);
      if (sq === selected) label += ", selected";
      else if (legal.includes(sq)) label += ", press to move the selected chip here";
      else if (id) label += ", press to select";
      btn.setAttribute("aria-label", label);

      rightBtns[sq].setAttribute("aria-label", "Unfolded view: " + describe(sq));
    }
    moveNumEl.textContent = String(state.moves);
  }

  function afterMove() {
    if (H.isReversed(state)) {
      // Unreachable; kept so a future rule change would still announce it.
      statusEl.textContent = "Reversed in " + state.moves + " moves!";
      statusEl.className = "win";
      return;
    }
    const home = H.homeChips(state);
    if (home) {
      statusEl.textContent =
        "Home squares again: " + home.map((c) => H.COLORS[c]).join(", ") +
        ". Still not reversed.";
      statusEl.className = "";
    } else {
      statusEl.textContent = "";
      statusEl.className = "";
    }
  }

  function onLeftClick(sq) {
    if (selected >= 0 && H.legalMoves(state, selected).includes(sq)) {
      state = H.move(state, selected, sq);
      selected = -1;
      render();
      afterMove();
      return;
    }
    if (state.loc[sq]) selected = selected === sq ? -1 : sq;
    else selected = -1;
    render();
  }

  function onReset() {
    state = H.start();
    selected = -1;
    statusEl.textContent = "";
    statusEl.className = "";
    render();
  }

  resetBtn.addEventListener("click", onReset);
  hintInput.addEventListener("change", render);

  buildBoards();
  render();
})();
