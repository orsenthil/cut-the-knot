"use strict";

/*
 * UI for Candy Squares. Each heap is a row of square chips with cut buttons
 * in the gaps. Cutting a heap replaces both heaps with the two pieces; the
 * uneaten heap disappears.
 */

(function () {
  const Core = RaisinGameCore;
  const heapsEl = document.getElementById("heaps");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const maxInput = document.getElementById("maxInput");
  const randomInput = document.getElementById("randomInput");
  const startBtn = document.getElementById("startBtn");
  const newBtn = document.getElementById("newBtn");

  const THINK_MS = 550;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let state = null;
  let busy = false;
  let justCut = null;
  let timer = null;
  const score = { wins: 0, losses: 0 };

  for (let n = Core.MIN_MAX; n <= Core.MAX_MAX; n++) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = String(n);
    maxInput.appendChild(o);
  }
  maxInput.value = String(Core.DEFAULT_MAX);

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function showScore() {
    scoreEl.textContent = "Score (computer wins:losses): " + score.wins + ":" + score.losses;
  }

  function render() {
    heapsEl.innerHTML = "";
    const canPlay = !state.over && !busy && state.turn === "you";

    state.heaps.forEach((size, which) => {
      const wrap = document.createElement("div");
      wrap.className = "heap";
      const label = document.createElement("p");
      label.className = "heap-label";
      label.textContent = "Heap of " + size + (size % 2 === 0 ? " (even)" : " (odd)");
      wrap.appendChild(label);

      const row = document.createElement("div");
      row.className = "squares";
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", "Heap of " + size + " squares");

      for (let i = 0; i < size; i++) {
        const sq = document.createElement("span");
        sq.className = "sq";
        sq.setAttribute("aria-hidden", "true");
        row.appendChild(sq);
        if (i < size - 1) {
          const cut = document.createElement("button");
          cut.type = "button";
          cut.className = "cut";
          cut.dataset.which = String(which);
          cut.dataset.k = String(i + 1);
          cut.disabled = !canPlay || size < 2;
          cut.setAttribute("aria-label", "Cut heap " + (which + 1) + " after " + (i + 1) + " square" + (i + 1 === 1 ? "" : "s"));
          if (justCut && justCut.which === which && justCut.k === i + 1) cut.classList.add("just");
          cut.addEventListener("click", () => onCut(which, i + 1));
          row.appendChild(cut);
        }
      }
      wrap.appendChild(row);
      heapsEl.appendChild(wrap);
    });

    startBtn.disabled = !(canPlay && Core.canMove(state));
    showScore();
    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  function endIfOver(s) {
    if (!s.over) return false;
    score.wins = s.wins;
    score.losses = s.losses;
    showScore();
    say(s.winner === "you" ? "You won!" : "I won!", Core.result(s));
    return true;
  }

  function afterHuman() {
    if (endIfOver(state)) {
      render();
      return;
    }
    busy = true;
    say("Thinking…");
    render();
    const wait = reduceMotion.matches ? 0 : THINK_MS;
    timer = setTimeout(() => {
      const pick = Core.chooseComputerMove(state);
      const next = Core.computerMove(state);
      busy = false;
      if (!next) {
        say("Your move.");
        render();
        return;
      }
      justCut = pick;
      state = next;
      if (endIfOver(state)) {
        render();
        return;
      }
      say(
        "Computer left heaps of " +
          state.heaps[0] +
          " and " +
          state.heaps[1] +
          " (cut after " +
          pick.k +
          "). Your move.",
      );
      render();
      setTimeout(() => {
        justCut = null;
        render();
      }, reduceMotion.matches ? 0 : 450);
    }, wait);
  }

  function onCut(which, k) {
    if (busy || state.over || state.turn !== "you") return;
    const next = Core.move(state, which, k);
    if (next.note && next.turn === state.turn && !next.over && next.heaps[0] === state.heaps[0]) {
      state = next;
      say(next.note);
      render();
      return;
    }
    justCut = { which, k };
    state = next;
    afterHuman();
  }

  function doYouStart() {
    if (busy || state.over) return;
    state = Core.youStart(state);
    afterHuman();
  }

  function newGame() {
    if (timer) clearTimeout(timer);
    busy = false;
    justCut = null;
    state = Core.start({
      max: Number(maxInput.value),
      random: randomInput.checked,
      wins: score.wins,
      losses: score.losses,
    });
    say("Your move. Cut between squares in one heap.");
    render();
  }

  newBtn.addEventListener("click", newGame);
  startBtn.addEventListener("click", doYouStart);
  maxInput.addEventListener("change", newGame);
  randomInput.addEventListener("change", newGame);

  newGame();
})();
