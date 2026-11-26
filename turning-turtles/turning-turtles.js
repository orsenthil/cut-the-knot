"use strict";

/*
 * The page for Turning Turtles: drawing and input only; the rules and the
 * computer's play are in turning-turtles-core.js. Eleven square buttons
 * show O or X. Click an O to pick it (it will turn to X), optionally click
 * a square to its left to flip it too, then Make Move. The computer
 * answers after a short pause, with its squares highlighted.
 */

(function () {
  const Core = TurningTurtlesCore;
  const row = document.getElementById("row");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const moveBtn = document.getElementById("moveBtn");

  let state = Core.start({ seed: Math.floor(Math.random() * 2 ** 31) });
  let pick = null, flip = null, thinking = false, timer = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const cells = [];
  for (let i = 0; i < Core.N; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sq";
    b.dataset.i = String(i);
    b.innerHTML = `<span class="num">${i + 1}</span><span class="mark"></span>`;
    row.appendChild(b);
    cells.push(b);
  }

  function describe(m) {
    return `turned ${m.i + 1} to X${m.j === null ? "" : ` and flipped ${m.j + 1}`}`;
  }

  function render() {
    state.x.forEach((isX, i) => {
      const b = cells[i];
      b.querySelector(".mark").textContent = isX ? "X" : "O";
      b.classList.toggle("x", isX);
      b.classList.toggle("pick", pick === i);
      b.classList.toggle("flip", flip === i);
      b.classList.toggle("theirs", !!(state.last && state.last.who === "me" && (state.last.i === i || state.last.j === i)));
      b.setAttribute("aria-label", `Square ${i + 1}: ${isX ? "X" : "O"}${pick === i ? ", will turn to X" : ""}${flip === i ? ", will flip" : ""}`);
      b.disabled = thinking || !!state.winner;
    });
    moveBtn.disabled = pick === null || thinking || !!state.winner;
    scoreEl.textContent = `Computer ${state.score.me} : ${state.score.you} You`;
    const last = state.last;
    if (state.winner === "me") say(`I ${describe(last)}: no O is left. I won!`, "lose");
    else if (state.winner === "you") say("You turned the last O. Congratulations! You won!", "win");
    else if (thinking) say("My move…");
    else if (pick !== null) say(flip === null ? `Square ${pick + 1} will turn to X. Pick a square to its left to flip too, or Make Move.` : `Square ${pick + 1} turns to X and square ${flip + 1} flips. Make Move?`);
    else say(last && last.who === "me" ? `I ${describe(last)}. Your move: pick an O.` : "Your move: pick an O.");
    if (window.Track) window.Track.state({ x: state.x, turn: state.turn, score: state.score });
  }

  row.addEventListener("click", (e) => {
    const b = e.target.closest(".sq");
    if (!b || thinking || state.winner) return;
    const i = Number(b.dataset.i);
    if (pick === i) { pick = flip; flip = null; if (pick !== null && state.x[pick]) pick = null; }
    else if (flip === i) flip = null;
    else if (pick === null) { if (!state.x[i]) pick = i; }
    else if (i < pick) flip = i;
    else if (!state.x[i]) { pick = i; if (flip !== null && flip >= i) flip = null; }
    render();
  });

  moveBtn.addEventListener("click", () => {
    const s = Core.play(state, pick, flip);
    if (!s) return;
    state = s; pick = null; flip = null;
    if (!state.winner) {
      thinking = true;
      timer = setTimeout(() => { thinking = false; state = Core.reply(state); render(); moveBtn.focus(); }, 700);
    }
    render();
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    clearTimeout(timer); thinking = false;
    state = Core.again(state); pick = null; flip = null;
    render();
  });

  render();
})();
