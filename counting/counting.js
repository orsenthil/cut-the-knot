"use strict";

/*
 * The page for Counting: drawing and input only; the rules are in
 * counting-core.js. The play area is a board of real <button>s, one per dot,
 * each placed at its random spot in its cell with percentages so the board
 * scales; below it an SVG tally draws one stroke for each dot counted so far in
 * groups of the chosen size, and when every dot is counted the tally gives way
 * to the equation. Dots can be reached and pressed with the keyboard in reading
 * order.
 */

(function () {
  const Core = CountingCore;
  const board = document.getElementById("dots");
  const tallyEl = document.getElementById("tally");
  const equationEl = document.getElementById("equation");
  const statusEl = document.getElementById("status");
  const countIn = document.getElementById("countIn");
  const groupIn = document.getElementById("groupIn");
  const maxIn = document.getElementById("maxIn");
  const groupLess = document.getElementById("groupLess");
  const groupMore = document.getElementById("groupMore");
  const maxLess = document.getElementById("maxLess");
  const maxMore = document.getElementById("maxMore");
  const numbersBox = document.getElementById("numbersBox");
  const againBtn = document.getElementById("againBtn");
  const newBtn = document.getElementById("newBtn");
  const NS = "http://www.w3.org/2000/svg";

  let state = Core.start();
  let focusIndex = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function drawBoard() {
    const { rows, cols } = Core.layout(state.dots.length);
    board.textContent = "";
    board.style.aspectRatio = `${cols} / ${rows}`;
    state.dots.forEach((d, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dot" + (d.num ? " counted" : "");
      // The dot fills half its cell in each direction, at a random spot inside the cell.
      b.style.width = `${50 / cols}%`;
      b.style.height = `${50 / rows}%`;
      b.style.left = `${((d.col + d.jx * 0.5) / cols) * 100}%`;
      b.style.top = `${((d.row + d.jy * 0.5) / rows) * 100}%`;
      b.textContent = d.num && state.numbers ? String(d.num) : "";
      b.disabled = false;
      b.setAttribute("aria-label", d.num ? `Dot ${i + 1}, counted as ${d.num}` : `Dot ${i + 1}, not counted yet. Press to count it.`);
      b.setAttribute("aria-pressed", d.num ? "true" : "false");
      b.addEventListener("click", () => count(i));
      board.appendChild(b);
    });
  }

  function drawTally() {
    const groups = Core.tally(state.counted, state.group);
    tallyEl.textContent = "";
    const stroke = 6, gap = 5, bigGap = 16, h = 34;
    let x = 4;
    groups.forEach((g, gi) => {
      for (let k = 0; k < g; k++) {
        const line = document.createElementNS(NS, "line");
        line.setAttribute("x1", x); line.setAttribute("x2", x);
        line.setAttribute("y1", 4); line.setAttribute("y2", h - 4);
        line.setAttribute("class", "stroke");
        tallyEl.appendChild(line);
        x += stroke + gap;
      }
      x += bigGap - gap;
    });
    tallyEl.setAttribute("viewBox", `0 0 ${Math.max(40, x)} ${h}`);
    tallyEl.style.width = `${Math.min(100, Math.max(8, (x / 360) * 100))}%`;
    tallyEl.setAttribute("aria-label", state.counted ? `Tally: ${state.counted} strokes in groups of ${state.group}` : "Tally: nothing counted yet");
  }

  function render() {
    drawBoard();
    drawTally();
    const done = state.finished;
    equationEl.textContent = done ? Core.equation(state.counted, state.group) : "";
    equationEl.hidden = !done;
    countIn.value = String(state.dots.length);
    groupIn.value = String(state.group);
    maxIn.value = String(state.max);
    numbersBox.checked = state.numbers;
    groupLess.disabled = state.group <= Core.lowGroup(state.max);
    maxLess.disabled = state.max <= 5;
    maxMore.disabled = state.max >= 100;
    if (focusIndex !== null) {
      const b = board.children[focusIndex];
      if (b) b.focus();
    }
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render();
    const kind = Core.result(state);
    say(kind ? `All ${state.counted} dots counted: ${Core.equation(state.counted, state.group)}` : note || `${state.counted} of ${state.dots.length} counted.`, kind);
    return true;
  }

  function count(i) {
    focusIndex = i;
    if (!apply({ type: "count", index: i })) say("That dot is already counted.");
  }

  const options = (m, note) => () => { focusIndex = null; if (!apply(m(), note)) { say("That value is not allowed."); render(); } };
  groupLess.addEventListener("click", options(() => ({ type: "group", value: state.group - 1 }), "Group size changed."));
  groupMore.addEventListener("click", options(() => ({ type: "group", value: state.group + 1 }), "Group size changed."));
  groupIn.addEventListener("change", options(() => ({ type: "group", value: Math.trunc(Number(groupIn.value)) }), "Group size changed."));
  maxLess.addEventListener("click", options(() => ({ type: "max", dir: -1 }), "Maximum changed."));
  maxMore.addEventListener("click", options(() => ({ type: "max", dir: 1 }), "Maximum changed."));
  maxIn.addEventListener("change", options(() => ({ type: "max", value: Math.trunc(Number(maxIn.value)) }), "Maximum changed."));
  countIn.addEventListener("change", () => {
    focusIndex = null;
    const v = Math.trunc(Number(countIn.value));
    const next = Core.move(state, { type: "count-to", value: Math.min(v, Core.COUNT_LIMIT) });
    if (next) { state = next; render(); say(`${state.dots.length} new dots.`); } else { say("Type a whole number of dots, 1 or more."); render(); }
  });
  numbersBox.addEventListener("change", () => { apply({ type: "numbers", value: numbersBox.checked }, numbersBox.checked ? "Counted dots show their number." : "Numbers hidden."); });
  againBtn.addEventListener("click", () => { focusIndex = null; apply({ type: "again" }, "Count them again."); });
  newBtn.addEventListener("click", () => {
    focusIndex = null;
    state = Core.move(state, { type: "new" });
    render();
    say("A new set of dots.");
  });

  render();
})();
