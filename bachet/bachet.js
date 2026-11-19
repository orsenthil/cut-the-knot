"use strict";

/*
 * Browser UI for Bachet's Magic Trick. The arrangement, the row-pair lookup
 * and the messages live in bachet-core.js; this file only draws and takes input.
 *
 * Stage 1 shows the M cards as pairs in short rows -- click a pair to remember
 * it. Proceed replaces them with an N by (N+1) grid; clicking the two rows that
 * hold your two numbers lets the computer name the pair. Every pressable thing
 * is a real button, so mouse, touch and keyboard all work.
 */

(() => {
  const C = BachetCore;
  const stageEl = document.getElementById("stage");
  const headingEl = document.getElementById("stageHeading");
  const listEl = document.getElementById("pairList");
  const gridWrapEl = document.getElementById("gridWrap");
  const gridEl = document.getElementById("grid");
  const hintEl = document.getElementById("stageHint");
  const status = document.getElementById("status");
  const nLess = document.getElementById("nLess");
  const nMore = document.getElementById("nMore");
  const nOut = document.getElementById("nOut");
  const straightChk = document.getElementById("straightChk");
  const randomChk = document.getElementById("randomChk");
  const proceedBtn = document.getElementById("proceedBtn");
  const resetBtn = document.getElementById("resetBtn");

  let n = 4;
  let straight = false;
  let randomized = true;
  let seed = 1;
  let state = null;
  let rowPick = [];

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are also how the player's record learns that a play
   * has ended (assets/progress.js), so use them for that and nothing else.
   */
  function say(text, kind) {
    status.textContent = text;
    status.classList.remove("win", "lose", "done");
    if (kind) status.classList.add(kind);
  }

  /** Read the palette from the stylesheet at draw time (the theme can flip). */
  function applyTokens() {
    const cs = getComputedStyle(document.documentElement);
    for (const token of ["--accent", "--accent-soft", "--accent-text", "--highlight",
      "--ink", "--good", "--border-strong", "--surface"]) {
      stageEl.style.setProperty(token, cs.getPropertyValue(token).trim());
    }
  }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  /** Move focus with the arrow keys inside a group of sibling buttons. */
  function arrowNav(event, container, selector) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const buttons = Array.from(container.querySelectorAll(selector));
    const at = buttons.indexOf(document.activeElement);
    if (at < 0) return;
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const next = buttons[at + step];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  }

  function renderPairs() {
    headingEl.textContent = "Stage 1 · the list of pairs";
    listEl.hidden = false;
    gridWrapEl.hidden = true;
    listEl.replaceChildren();

    for (const row of C.stage1Rows(state)) {
      const rowEl = el("div", "pair-row");
      for (const pair of row) {
        const btn = el("button", "pair-card");
        btn.type = "button";
        btn.dataset.index = String(pair.index);
        btn.setAttribute("aria-label",
          `Pair ${pair.index + 1}: the numbers ${pair.labels[0]} and ${pair.labels[1]}`);
        btn.setAttribute("aria-pressed", state.chosen === pair.index ? "true" : "false");
        btn.append(el("span", "card-num", String(pair.labels[0])));
        btn.append(el("span", "card-num", String(pair.labels[1])));
        if (state.chosen === pair.index) btn.classList.add("picked");
        btn.addEventListener("click", () => choose(pair.index));
        rowEl.append(btn);
      }
      listEl.append(rowEl);
    }

    hintEl.textContent = state.chosen === null
      ? "Click one pair to remember it, then press Proceed."
      : "That is the pair to remember. Press Proceed.";
  }

  function renderGrid() {
    headingEl.textContent = "Stage 2 · the grid";
    listEl.hidden = true;
    gridWrapEl.hidden = false;
    gridEl.replaceChildren();

    const answerLabels = state.answer || [];
    for (let r = 0; r < state.n; r++) {
      const rowEl = el("div", "grid-row");
      const pick = el("button", "row-btn");
      pick.type = "button";
      pick.dataset.row = String(r);
      pick.setAttribute("aria-label", `Row ${r + 1}${rowPick.includes(r) ? ", selected" : ""}`);
      pick.setAttribute("aria-pressed", rowPick.includes(r) ? "true" : "false");
      pick.textContent = `→ ${r + 1}`;
      if (rowPick.includes(r)) pick.classList.add("picked");
      // Keep the row buttons focusable after the reveal so the keyboard stays
      // on the board; pickRow() simply does nothing once the trick is over.
      pick.addEventListener("click", () => pickRow(r));
      rowEl.append(pick);

      for (let c = 0; c < state.n + 1; c++) {
        const value = state.rows[r][c];
        const cell = el("span", "grid-cell", String(value));
        cell.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}: ${value}`);
        if (answerLabels.includes(value)) cell.classList.add("revealed");
        rowEl.append(cell);
      }
      gridEl.append(rowEl);
    }

    if (state.stage === C.FINAL) {
      hintEl.textContent = state.answer
        ? `The computer read rows ${state.reportedRows[0] + 1} and ${state.reportedRows[1] + 1} and named your numbers.`
        : "No rows were named, so there was no pair to reveal.";
    } else if (rowPick.length === 1) {
      hintEl.textContent = `Row ${rowPick[0] + 1} is marked. Click the other row that holds one of your numbers.`;
    } else {
      hintEl.textContent = "Find your two numbers in the grid. Click the row each one is in (the same row twice if both are there).";
    }
  }

  function render() {
    applyTokens();
    nOut.textContent = String(n);
    nLess.disabled = n <= C.MIN_N;
    nMore.disabled = n >= C.MAX_N;
    straightChk.checked = straight;
    randomChk.checked = randomized;

    const firstStage = state.stage === C.FIRST;
    proceedBtn.disabled = !firstStage;
    resetBtn.classList.toggle("primary", !firstStage);
    proceedBtn.classList.toggle("primary", firstStage);
    if (firstStage) renderPairs();
    else renderGrid();

    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        n, straight, randomized, seed,
        stage: state.stage,
        chosen: state.chosen,
        labels: state.labels.slice(),
        rows: state.rows.map((row) => row.slice()),
        answer: state.answer,
        reportedRows: state.reportedRows,
      });
    }
  }

  function rebuild(nextSeed) {
    seed = nextSeed;
    rowPick = [];
    state = C.start({ n, straight, randomized, seed });
    say("Pick one pair of numbers from the list, then press Proceed.");
    render();
  }

  function choose(index) {
    const before = state.chosen;
    state = C.choosePair(state, index);
    if (state.chosen !== before && state.chosen !== null) {
      const pair = state.pairs[state.chosen];
      say(`You remembered the pair ${pair.labels[0]} and ${pair.labels[1]}. Press Proceed to hide them in the grid.`);
    }
    render();
    const card = listEl.querySelector(`[data-index="${index}"]`);
    if (card) card.focus();
  }

  function proceed() {
    if (state.stage !== C.FIRST || state.chosen === null) {
      if (state.chosen === null) say("Choose a pair from the list first, then press Proceed.");
      return;
    }
    state = C.play(state);
    rowPick = [];
    say("Your pair is hidden in the grid. Click the two rows that hold your two numbers.");
    render();
  }

  function pickRow(r) {
    if (state.stage !== C.SECOND) return;
    if (rowPick.includes(r)) rowPick = rowPick.filter((x) => x !== r);
    else if (rowPick.length < 2) rowPick.push(r);
    else return;

    if (rowPick.length === 2) {
      const [r1, r2] = rowPick;
      state = C.reportSelection(state, r1, r2);
      if (state.answer) {
        say(`Done — you pointed to rows ${r1 + 1} and ${r2 + 1}, and the computer read out your numbers: ${state.answer[0]} and ${state.answer[1]}.`, "done");
      } else {
        say(`Done — you pointed to rows ${r1 + 1} and ${r2 + 1}, but no pair lives in those rows this time.`, "done");
      }
    } else {
      say(`Row ${r + 1} is marked. Click the other row that holds one of your numbers.`);
    }
    render();
    const btn = gridEl.querySelector(`[data-row="${r}"]`);
    if (btn) btn.focus(); // keep the keyboard on the board after the reveal
  }

  nLess.addEventListener("click", () => { n = Math.max(C.MIN_N, n - 1); rebuild(seed); });
  nMore.addEventListener("click", () => { n = Math.min(C.MAX_N, n + 1); rebuild(seed); });
  straightChk.addEventListener("change", () => { straight = straightChk.checked; rebuild(seed); });
  randomChk.addEventListener("change", () => { randomized = randomChk.checked; rebuild(seed); });
  proceedBtn.addEventListener("click", proceed);
  resetBtn.addEventListener("click", () => rebuild(seed + 1));
  listEl.addEventListener("keydown", (e) => arrowNav(e, listEl, ".pair-card"));
  gridEl.addEventListener("keydown", (e) => arrowNav(e, gridEl, ".row-btn"));

  // The OS theme (or the header toggle) can change the palette at any moment.
  window.addEventListener("themechange", render);

  rebuild(seed);
})();
