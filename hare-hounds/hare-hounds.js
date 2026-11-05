"use strict";

/*
 * Hare and Hounds - the page.
 *
 * Rules and the computer live in hare-hounds-core.js; this file draws the
 * board and runs the turns. As in the applet: you pick a side and a level
 * (Beginner to start), the hounds always move first, switching sides on your
 * turn hands the move to the computer, and a score is kept across games.
 *
 * The applet dragged animals; here you click (or tap, or press Enter on) one
 * of yours and then an empty point it can reach, which is highlighted.
 */

(() => {
  const H = HareHoundsCore;
  const { HOUND, HARE, EMPTY, CONNECT } = H;

  const svg = document.getElementById("board");
  const sideInput = document.getElementById("sideInput");
  const levelInput = document.getElementById("levelInput");
  const newBtn = document.getElementById("newBtn");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");

  const SVG = "http://www.w3.org/2000/svg";
  const THINK_MS = 450;
  const R = 24;
  // Points: 0 on the left, columns 1-3, 4-6, 7-9 top to bottom, 10 on the right.
  const POS = [[40, 120]];
  for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) POS.push([140 + col * 100, 30 + row * 90]);
  POS.push([440, 120]);
  const NAMES = ["left end", "top left", "middle left", "bottom left", "top middle", "centre", "bottom middle",
    "top right", "middle right", "bottom right", "right end"];

  let state = null;
  let human = HOUND;
  let selected = -1;
  let busy = false;
  let timer = null;
  let last = [];
  const score = { you: 0, computer: 0 };
  const spots = [];

  function el(name, attrs) {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  function build() {
    for (let a = 0; a < 11; a++) {
      for (let b = a + 1; b < 11; b++) {
        if (CONNECT[a][b]) svg.appendChild(el("line", { x1: POS[a][0], y1: POS[a][1], x2: POS[b][0], y2: POS[b][1], class: "line" }));
      }
    }
    for (let p = 0; p < 11; p++) {
      const c = el("circle", { cx: POS[p][0], cy: POS[p][1], r: R, class: "spot", tabindex: "0", role: "button" });
      c.addEventListener("click", () => tap(p));
      c.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(p); }
      });
      svg.appendChild(c);
      spots.push(c);
    }
    svg.appendChild(el("g", { id: "pieces" }));
  }

  function targets() {
    if (selected < 0) return [];
    return H.moves(state).filter(([a]) => a === selected).map(([, t]) => t);
  }

  function render() {
    const tg = targets();
    const pieces = document.getElementById("pieces");
    pieces.replaceChildren();
    for (let p = 0; p < 11; p++) {
      const v = state.b[p];
      spots[p].setAttribute("class", "spot" + (tg.includes(p) ? " target" : ""));
      const who = v === HOUND ? "hound" : v === HARE ? "hare" : "empty";
      spots[p].setAttribute("aria-label", `${NAMES[p]}: ${who}` + (tg.includes(p) ? ", move here" : ""));
      if (v === EMPTY) continue;
      const cls = (v === HOUND ? "hound" : "hare") + (p === selected ? " selected" : last.includes(p) ? " last" : "");
      const [x, y] = POS[p];
      if (v === HARE) {
        // two long ears, so the hare is a hare without relying on a font
        for (const dx of [-7, 7]) pieces.appendChild(el("ellipse", { cx: x + dx, cy: y - R + 2, rx: 4.5, ry: 11, class: "hare" }));
      }
      pieces.appendChild(el("circle", { cx: x, cy: y, r: R - 4, class: cls }));
      if (v === HOUND) {
        const t = el("text", { x, y, class: "piece-label" });
        t.textContent = "H";
        pieces.appendChild(t);
      }
    }
    svg.classList.toggle("busy", busy);
    scoreEl.textContent = `Score: you ${score.you}, computer ${score.computer}`;
  }

  function say(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls || "";
  }

  function finish() {
    const youWon = state.winner === human;
    if (youWon) score.you++;
    else score.computer++;
    const text = state.reason === "trapped" ? "The hare is trapped! The hounds win!"
      : state.reason === "stalling" ? "The hounds are stalling! The hare wins!"
      : "The hare escapes!";
    say(text + (youWon ? " You win." : " The computer wins."), youWon ? "win" : "lose");
  }

  function computerTurn() {
    if (state.winner || state.turn === human) return;
    busy = true;
    say("Thinking ...", "");
    render();
    timer = setTimeout(() => {
      timer = null;
      const m = H.chooseMove(state, levelInput.value);
      busy = false;
      if (!m) { // only the hounds can run out of moves; the hare is free
        state.winner = HARE;
        state.reason = "escape";
      } else {
        H.play(state, ...m);
        last = m;
      }
      if (state.winner) finish();
      else say("Your move.", "");
      render();
    }, THINK_MS);
  }

  function tap(p) {
    if (busy || state.winner || state.turn !== human) return;
    if (state.b[p] === human) {
      selected = selected === p ? -1 : p;
      render();
      return;
    }
    if (selected >= 0 && H.legal(state, selected, p)) {
      H.play(state, selected, p);
      last = [selected, p];
      selected = -1;
      if (state.winner) {
        finish();
        render();
        return;
      }
      computerTurn();
      return;
    }
    if (selected >= 0) say(human === HOUND ? "Hounds move along a line, up, down or to the right, to an empty spot." : "The hare moves along a line to an empty spot.", "");
  }

  function newGame() {
    if (timer) clearTimeout(timer);
    timer = null;
    busy = false;
    human = Number(sideInput.value);
    state = H.start();
    selected = -1;
    last = [];
    say(human === HOUND ? "The hounds move first. Your move." : "", "");
    render();
    computerTurn();
  }

  // As in the applet: switching sides on your turn lets the computer move.
  sideInput.addEventListener("change", () => {
    if (!state || state.winner) { newGame(); return; }
    if (busy) { sideInput.value = String(human); return; }
    human = Number(sideInput.value);
    selected = -1;
    render();
    computerTurn();
  });
  newBtn.addEventListener("click", newGame);

  build();
  newGame();
})();
