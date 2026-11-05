"use strict";

/*
 * UI for Contorted Fractions. The game is in fraction-core.js; this file draws
 * the table, runs the dial and alternates the turns.
 *
 * The applet asked you to click a little off a digit's centre line to nudge it
 * and then press "I move". Here a fraction is a button you select, the digits
 * get real plus and minus buttons, and the panel says why a dial is not a legal
 * move yet. "Computer Moves" is the applet's "You move" button, which hands the
 * opening to the other side.
 */
(() => {
  const F = FractionGameCore;
  const { LEFT, RIGHT, frac, cmp, text, num } = F;
  const other = (w) => (w === LEFT ? RIGHT : LEFT);

  const sideEl = document.getElementById("side");
  const boardEl = document.getElementById("board");
  const dialEl = document.getElementById("dial");
  const dialHead = document.getElementById("dialHead");
  const dialNote = document.getElementById("dialNote");
  const pVal = document.getElementById("pVal");
  const qVal = document.getElementById("qVal");
  const doMove = document.getElementById("doMove");
  const totalEl = document.getElementById("total");
  const statusEl = document.getElementById("status");
  const countInput = document.getElementById("countInput");
  const maxInput = document.getElementById("maxInput");
  const valuesBox = document.getElementById("valuesBox");
  const newBtn = document.getElementById("newBtn");
  const moveBtn = document.getElementById("moveBtn");

  const THINK_MS = 550;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let board = [];
  let max = F.DEFAULT_MAX;
  let you = LEFT;
  let turn = LEFT;        // whose move it is
  let selected = -1;      // index of the fraction being dialled
  let dialP = 0;
  let dialQ = 1;
  let over = false;
  let busy = false;
  let timer = null;

  const me = () => other(you);
  const setStatus = (t, c) => { statusEl.textContent = t || ""; statusEl.className = c || ""; };

  /* ------------------------------------------------------------ drawing */

  function fractionNode(x) {
    const wrap = document.createElement("span");
    wrap.className = x.q === 1 ? "fr whole" : "fr";
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = String(x.p);
    const d = document.createElement("span");
    d.className = "d";
    d.textContent = String(x.q);
    wrap.append(n, d);
    return wrap;
  }

  function renderBoard() {
    boardEl.replaceChildren();
    board.forEach((x, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "card";
      const stuck = !F.canMove(x, you);
      if (stuck) b.classList.add("stuck");
      b.setAttribute("aria-pressed", String(i === selected));
      b.disabled = over || busy || turn !== you || stuck;
      b.setAttribute("aria-label",
        `${text(x)}${stuck ? ", no move for you" : ", select to change"}`);
      b.appendChild(fractionNode(x));
      if (valuesBox.checked) {
        const v = document.createElement("span");
        v.className = "val";
        v.textContent = `worth ${text(F.value(x))}`;
        b.appendChild(v);
      }
      b.addEventListener("click", () => select(i));
      boardEl.appendChild(b);
    });
  }

  function renderDial() {
    if (selected < 0) { dialEl.hidden = true; return; }
    dialEl.hidden = false;
    const from = board[selected];
    const to = frac(dialP, dialQ);
    dialHead.replaceChildren();
    dialHead.append("Change ", fractionNode(from), " to ");
    const toNode = fractionNode(to);
    toNode.classList.add("to");
    dialHead.append(toNode);

    pVal.textContent = String(dialP);
    qVal.textContent = String(dialQ);

    const legal = F.isLegal(from, to, you);
    doMove.disabled = !legal;
    if (legal) {
      dialNote.textContent = `Legal: ${text(from)} ${you === LEFT ? "down" : "up"} to ${text(to)}.`;
      dialNote.className = "ok";
    } else if (cmp(to, from) === 0) {
      dialNote.textContent = "That is the number you started with.";
      dialNote.className = "";
    } else if (you === LEFT ? cmp(to, from) > 0 : cmp(to, from) < 0) {
      dialNote.textContent = you === LEFT
        ? "You are Left, so the number has to get smaller."
        : "You are Right, so the number has to get bigger.";
      dialNote.className = "bad";
    } else if (F.isInt(from)) {
      dialNote.textContent = `${text(from)} is a whole number, so you need another whole number closer to 0.`;
      dialNote.className = "bad";
    } else {
      dialNote.textContent = `The bottom number has to drop below ${from.q}.`;
      dialNote.className = "bad";
    }
  }

  function render() {
    sideEl.replaceChildren();
    sideEl.append(`You are ${you === LEFT ? "Left" : "Right"}: every move you make must `);
    const strong = document.createElement("strong");
    strong.textContent = you === LEFT ? "lower" : "raise";
    sideEl.append(strong, " a number. The computer is ", you === LEFT ? "Right" : "Left", ".");

    renderBoard();
    renderDial();
    totalEl.textContent = valuesBox.checked
      ? `Table worth ${text(F.boardValue(board))} — ${describeTotal()}`
      : "";
    moveBtn.disabled = over || busy || turn !== you;
  }

  function describeTotal() {
    const v = F.boardValue(board);
    if (v.p > 0) return "Left wins with best play";
    if (v.p < 0) return "Right wins with best play";
    return "whoever moves second wins";
  }

  /* --------------------------------------------------------------- play */

  function select(i) {
    if (over || busy || turn !== you) return;
    selected = i;
    const x = board[i];
    dialP = x.p;
    dialQ = x.q;
    render();
  }

  function nudge(dp, dq) {
    if (selected < 0) return;
    dialP = Math.max(-max, Math.min(max, dialP + dp));
    dialQ = Math.max(1, Math.min(max, dialQ + dq));
    renderDial();
  }

  function commit() {
    if (selected < 0) return;
    const from = board[selected];
    const to = frac(dialP, dialQ);
    if (!F.isLegal(from, to, you)) return;
    board = board.slice();
    board[selected] = to;
    selected = -1;
    setStatus(`You changed ${text(from)} to ${text(to)}.`);
    turn = me();
    if (F.isStuck(board, turn)) {
      over = true;
      setStatus(`You won — I have no move left.`, "win");
      render();
      return;
    }
    computerTurn();
  }

  function computerTurn() {
    busy = true;
    render();
    setStatus("Thinking…");
    timer = window.setTimeout(() => {
      timer = null;
      const mv = F.pickMove(board, me());
      busy = false;
      if (!mv) {
        over = true;
        setStatus("You won — I have no move left.", "win");
        render();
        return;
      }
      const from = board[mv.index];
      board = board.slice();
      board[mv.index] = mv.to;
      turn = you;
      if (F.isStuck(board, you)) {
        over = true;
        setStatus(`I changed ${text(from)} to ${text(mv.to)}. I won — you have no move left.`, "lose");
        render();
        return;
      }
      setStatus(`I changed ${text(from)} to ${text(mv.to)}. Your turn.`);
      render();
    }, reduceMotion.matches ? 120 : THINK_MS);
  }

  function newGame() {
    if (timer !== null) { window.clearTimeout(timer); timer = null; }
    const c = Math.min(F.MAX_COUNT, Math.max(F.MIN_COUNT, parseInt(countInput.value, 10) || F.DEFAULT_COUNT));
    max = Math.min(F.MAX_MAX, Math.max(F.MIN_MAX, parseInt(maxInput.value, 10) || F.DEFAULT_MAX));
    countInput.value = String(c);
    maxInput.value = String(max);
    you = document.querySelector('input[name="side"]:checked').value === "right" ? RIGHT : LEFT;
    board = F.newBoard(c, max, Math.random);
    selected = -1;
    busy = false;
    turn = you;
    over = F.isStuck(board, you);
    setStatus(over ? "You have no move at all — deal a new table." : "");
    render();
  }

  /* ------------------------------------------------------------ wiring */

  document.getElementById("pMinus").addEventListener("click", () => nudge(-1, 0));
  document.getElementById("pPlus").addEventListener("click", () => nudge(1, 0));
  document.getElementById("qMinus").addEventListener("click", () => nudge(0, -1));
  document.getElementById("qPlus").addEventListener("click", () => nudge(0, 1));
  doMove.addEventListener("click", commit);
  document.getElementById("cancelMove").addEventListener("click", () => { selected = -1; render(); });
  newBtn.addEventListener("click", newGame);
  countInput.addEventListener("change", newGame);
  maxInput.addEventListener("change", newGame);
  for (const r of document.querySelectorAll('input[name="side"]')) r.addEventListener("change", newGame);
  valuesBox.addEventListener("change", render);
  moveBtn.addEventListener("click", () => {
    if (over || busy || turn !== you) return;
    selected = -1;
    computerTurn();
  });

  newGame();
})();
