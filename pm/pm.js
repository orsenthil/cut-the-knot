"use strict";

/*
 * UI for Plus or Minus. Numbers and gap buttons sit in a horizontal row that
 * can slide sideways on a phone. Choose + or −, press an empty gap; after a
 * short pause the computer fills another gap at random.
 */

(function () {
  const Core = PmCore;
  const exprEl = document.getElementById("expr");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const randomInput = document.getElementById("randomInput");
  const nInput = document.getElementById("nInput");
  const plusInput = document.getElementById("plusInput");
  const minusInput = document.getElementById("minusInput");
  const newBtn = document.getElementById("newBtn");

  const THINK_MS = 500;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let state = null;
  let busy = false;
  let focusGap = 0;
  let justIndex = null;
  let timer = null;
  const score = { wins: 0, losses: 0 };

  for (let n = Core.MIN_N; n <= Core.MAX_N; n++) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = String(n);
    nInput.appendChild(o);
  }
  nInput.value = String(Core.DEFAULT_N);

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function showScore() {
    scoreEl.textContent = "Score (computer wins:losses): " + score.wins + ":" + score.losses;
  }

  function pendingFromControls() {
    return minusInput.checked ? Core.MINUS : Core.PLUS;
  }

  function syncPending() {
    if (!state || state.over) return;
    state = Object.assign({}, state, { pendingSign: pendingFromControls() });
  }

  function render() {
    exprEl.innerHTML = "";
    const canPlay = !state.over && !busy && state.turn === "you";

    for (let i = 0; i < state.n; i++) {
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = String(i + 1);
      exprEl.appendChild(num);

      if (i < state.n - 1) {
        const gap = document.createElement("button");
        gap.type = "button";
        gap.className = "gap";
        gap.dataset.index = String(i);
        const filled = state.signs[i] !== 0;
        if (filled) {
          gap.classList.add("filled");
          gap.textContent = state.signs[i] === Core.PLUS ? "+" : "−";
          gap.disabled = true;
          gap.setAttribute("aria-label", "Gap after " + (i + 1) + ": " + gap.textContent);
        } else {
          gap.textContent = "·";
          gap.disabled = !canPlay;
          gap.setAttribute(
            "aria-label",
            "Empty gap after " + (i + 1) + ", press to place " + (state.pendingSign === Core.PLUS ? "plus" : "minus"),
          );
          gap.addEventListener("click", () => onPlace(i));
        }
        if (justIndex === i) gap.classList.add("just");
        gap.tabIndex = canPlay && !filled && focusGap === i ? 0 : -1;
        gap.addEventListener("keydown", onGapKey);
        exprEl.appendChild(gap);
      }
    }

    nInput.disabled = randomInput.checked;
    showScore();
    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  function focusButton() {
    const btn = exprEl.querySelector('.gap[data-index="' + focusGap + '"]');
    if (btn && !btn.disabled) btn.focus();
    else {
      const first = exprEl.querySelector(".gap:not(:disabled)");
      if (first) first.focus();
    }
  }

  function endIfOver(s) {
    if (!s.over) return false;
    score.wins = s.wins;
    score.losses = s.losses;
    showScore();
    say(s.announce, Core.result(s));
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
      justIndex = pick ? pick.index : null;
      state = next;
      if (endIfOver(state)) {
        render();
        return;
      }
      const signWord = pick.sign === Core.PLUS ? "plus" : "minus";
      say("Computer put " + signWord + " after " + (pick.index + 1) + ". Your move.");
      render();
      focusButton();
      setTimeout(() => {
        justIndex = null;
        render();
        focusButton();
      }, reduceMotion.matches ? 0 : 450);
    }, wait);
  }

  function onPlace(index) {
    if (busy || state.over || state.turn !== "you") return;
    syncPending();
    focusGap = index;
    const next = Core.place(state, index);
    if (next.error) {
      state = next;
      say(next.announce);
      render();
      return;
    }
    justIndex = index;
    state = next;
    afterHuman();
  }

  function onGapKey(ev) {
    const idx = Number(ev.currentTarget.dataset.index);
    if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
      ev.preventDefault();
      const empty = [];
      for (let i = 0; i < state.signs.length; i++) if (state.signs[i] === 0) empty.push(i);
      if (!empty.length) return;
      const pos = empty.indexOf(idx);
      const next =
        ev.key === "ArrowRight"
          ? empty[(pos + 1) % empty.length]
          : empty[(pos - 1 + empty.length) % empty.length];
      focusGap = next;
      render();
      focusButton();
    } else if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onPlace(idx);
    }
  }

  function newGame() {
    if (timer) clearTimeout(timer);
    busy = false;
    justIndex = null;
    const random = randomInput.checked;
    state = Core.start({
      n: Number(nInput.value),
      random,
      pendingSign: pendingFromControls(),
      wins: score.wins,
      losses: score.losses,
    });
    nInput.value = String(state.n);
    focusGap = 0;
    say("Your move. Choose + or −, then press an empty gap.");
    render();
  }

  newBtn.addEventListener("click", newGame);
  randomInput.addEventListener("change", () => {
    nInput.disabled = randomInput.checked;
    newGame();
  });
  nInput.addEventListener("change", newGame);
  plusInput.addEventListener("change", () => {
    syncPending();
    render();
  });
  minusInput.addEventListener("change", () => {
    syncPending();
    render();
  });

  newGame();
})();
