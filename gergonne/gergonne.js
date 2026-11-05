"use strict";

/*
 * UI for Gergonne's Magic Trick. The deal, the gather-and-redeal and the
 * display shuffle live in gergonne-core.js; this file draws the three rows and
 * handles the three answers.
 *
 * The applet's wording is kept: GergonneMagicOb's AnnouncementU and
 * AnnouncementL pair up as "Select a number and click" / "to the left of the
 * row it's in". The applet colours its rows; this page leaves them plain, since
 * the row you name is not where your number ends up.
 */
(() => {
  const C = GergonneCore;

  const stage = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const roundLine = document.getElementById("roundLine");
  const resetBtn = document.getElementById("resetBtn");

  const N = C.DEFAULT_PILES;
  const M = C.rowsPerPile(N);
  const TARGET = C.finalCell(N);

  let game = null;
  let rows = [];

  function build() {
    stage.textContent = "";
    rows = [];
    for (let c = 0; c < N; c++) {
      const line = document.createElement("div");
      line.className = "rowline";

      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "pick";
      pick.textContent = "It's here";
      pick.addEventListener("click", () => answer(c));
      line.appendChild(pick);

      const cards = document.createElement("div");
      cards.className = "cards";
      const cells = [];
      for (let r = 0; r < M; r++) {
        const cell = document.createElement("div");
        cell.className = "card";
        cards.appendChild(cell);
        cells.push(cell);
      }
      line.appendChild(cards);
      stage.appendChild(line);
      rows.push({ line, pick, cells });
    }
  }

  function render() {
    const done = C.finished(game);
    for (let c = 0; c < N; c++) {
      const { line, pick, cells } = rows[c];
      for (let r = 0; r < M; r++) {
        const value = C.shown(game, c, r);
        cells[r].textContent = String(value);
        const isAnswer = done && c === TARGET.col && r === TARGET.row;
        cells[r].classList.toggle("answer", isAnswer);
        cells[r].setAttribute("aria-label", isAnswer ? `Your number: ${value}` : String(value));
      }
      pick.disabled = done;
      pick.setAttribute("aria-label", `My number is in row ${c + 1}`);
    }
    stage.classList.toggle("done", done);

    if (done) {
      statusEl.textContent = `Your number is ${C.revealed(game)}. Press New deal!`;
      statusEl.classList.add("win");
      roundLine.textContent = "It was the middle number of the middle row — it always is.";
    } else {
      statusEl.classList.remove("win");
      statusEl.textContent = game.state === 0
        ? "Think of a number, then click to the left of the row it's in."
        : "Please click again, to the left of the row it's in.";
      roundLine.textContent = `Question ${game.state + 1} of ${C.rounds(N)}.`;
    }
  }

  function answer(col) {
    if (C.finished(game)) return;
    game = C.reportSelection(game, col);
    render();
  }

  function reset() {
    game = C.deal(N);
    render();
  }

  resetBtn.addEventListener("click", reset);
  build();
  reset();
})();
