"use strict";

/*
 * Full House - the UI. The board, the sliding rule and the applet's puzzle
 * library live in fullhouse-core.js.
 *
 * The board is one SVG, redrawn from the core's grid after every move, with a
 * transparent hit rectangle over each square so clicks, taps and the keyboard
 * all work. Dashed rings mark the squares a slide can reach from here, which
 * is the one thing the applet left you to work out with the mouse.
 *
 * "Auto-slide forced moves" is the applet's "Speed up assistance" checkbox: as
 * long as exactly one direction is open, the path takes it by itself.
 */

(function () {
  const F = FullHouseCore;
  const SVG = "http://www.w3.org/2000/svg";
  const U = 100;            // one square, in viewBox units

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const coveredEl = document.getElementById("covered");
  const totalEl = document.getElementById("total");
  const sizeLabel = document.getElementById("sizeLabel");
  const puzzleLabel = document.getElementById("puzzleLabel");
  const autoBtn = document.getElementById("autoBtn");
  const backBtn = document.getElementById("backBtn");

  const state = { size: 5, index: 0, auto: false, board: null };

  const centre = (r, c) => [c * U + U / 2, r * U + U / 2];

  function load() {
    state.board = F.Board.fromLibrary(state.size, state.index);
    boardEl.setAttribute("viewBox", `0 0 ${state.size * U} ${state.size * U}`);
    sizeLabel.textContent = `${state.size}×${state.size}`;
    puzzleLabel.textContent = `${state.index + 1} of ${F.PUZZLES[state.size].length}`;
    totalEl.textContent = String(state.board.empties);
    render();
    say("Click any white square to start the path.");
  }

  function render() {
    const b = state.board;
    boardEl.textContent = "";

    // squares
    for (let r = 0; r < b.size; r++) {
      for (let c = 0; c < b.size; c++) {
        const rect = document.createElementNS(SVG, "rect");
        rect.setAttribute("x", c * U + 3);
        rect.setAttribute("y", r * U + 3);
        rect.setAttribute("width", U - 6);
        rect.setAttribute("height", U - 6);
        rect.setAttribute("rx", 10);
        const blocked = b.grid[r][c] === F.BLOCKED;
        rect.setAttribute("class", `cell${blocked ? " blocked" : b.grid[r][c] === F.TRAVERSED ? " walked" : ""}`);
        boardEl.appendChild(rect);
      }
    }

    // the path so far
    if (b.path.length) {
      const line = document.createElementNS(SVG, "polyline");
      line.setAttribute("class", "trail");
      line.setAttribute("points", b.path.map(([r, c]) => centre(r, c).join(",")).join(" "));
      boardEl.appendChild(line);

      const [sx, sy] = centre(b.path[0][0], b.path[0][1]);
      const start = document.createElementNS(SVG, "circle");
      start.setAttribute("class", "start");
      start.setAttribute("cx", sx);
      start.setAttribute("cy", sy);
      start.setAttribute("r", 22);
      boardEl.appendChild(start);

      const [hx, hy] = centre(b.head[0], b.head[1]);
      const head = document.createElementNS(SVG, "circle");
      head.setAttribute("class", "head");
      head.setAttribute("cx", hx);
      head.setAttribute("cy", hy);
      head.setAttribute("r", 18);
      boardEl.appendChild(head);
    }

    // where a slide could land
    const ends = b.started ? b.availableDirections().map((d) => b.slideEnd(d)) : [];
    for (const [r, c] of ends) {
      const [x, y] = centre(r, c);
      const ring = document.createElementNS(SVG, "circle");
      ring.setAttribute("class", "target");
      ring.setAttribute("cx", x);
      ring.setAttribute("cy", y);
      ring.setAttribute("r", 28);
      boardEl.appendChild(ring);
    }

    // clickable squares, on top
    for (let r = 0; r < b.size; r++) {
      for (let c = 0; c < b.size; c++) {
        if (b.grid[r][c] === F.BLOCKED) continue;
        const hit = document.createElementNS(SVG, "rect");
        hit.setAttribute("x", c * U + 3);
        hit.setAttribute("y", r * U + 3);
        hit.setAttribute("width", U - 6);
        hit.setAttribute("height", U - 6);
        hit.setAttribute("rx", 10);
        const live = b.canClick(r, c);
        hit.setAttribute("class", `hit${live ? "" : " dead"}`);
        hit.setAttribute("tabindex", "0");
        hit.setAttribute("role", "button");
        hit.setAttribute("aria-label", label(r, c));
        hit.addEventListener("click", () => onClick(r, c));
        hit.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onClick(r, c); }
        });
        boardEl.appendChild(hit);
      }
    }

    coveredEl.textContent = String(b.path.length);
    totalEl.textContent = String(b.empties);
    backBtn.disabled = b.legs.length === 0;
  }

  function label(r, c) {
    const b = state.board;
    const where = `row ${r + 1}, column ${c + 1}`;
    if (b.grid[r][c] === F.TRAVERSED) {
      return b.head && b.head[0] === r && b.head[1] === c
        ? `${where}, the head of the path`
        : `${where}, already covered`;
    }
    return `${where}, free`;
  }

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.toggle("win", kind === "win");
    statusEl.classList.toggle("lose", kind === "lose");
  }

  function report() {
    const b = state.board;
    if (b.finished) { say("Full house! Every square covered in one path.", "win"); return; }
    if (b.stuck) {
      say(`Stuck with ${b.empties - b.path.length} squares left over. Step back and turn the other way.`, "lose");
      return;
    }
    if (!b.started) { say("Click any white square to start the path."); return; }
    say(`${b.path.length} of ${b.empties} squares covered. Click a square to one side to slide on.`);
  }

  function onClick(r, c) {
    const b = state.board;
    if (b.click(r, c) === null) {
      say(b.started
        ? "The path can only slide straight from its head, and not across itself."
        : "That square is blocked.");
      return;
    }
    if (state.auto) {
      // The applet's assistance: keep going while there is only one way to go.
      let dirs = b.availableDirections();
      while (dirs.length === 1 && !b.finished) {
        b.move(dirs[0]);
        dirs = b.availableDirections();
      }
    }
    render();
    report();
  }

  /* ------------------------------------------------------------- controls */

  function setSize(next) {
    if (!F.SIZES.includes(next)) return;
    state.size = next;
    state.index = 0;
    load();
  }

  function setIndex(next) {
    const n = F.PUZZLES[state.size].length;
    state.index = ((next % n) + n) % n;
    load();
  }

  document.getElementById("smallerBtn").addEventListener("click", () => setSize(state.size - 1));
  document.getElementById("biggerBtn").addEventListener("click", () => setSize(state.size + 1));
  document.getElementById("prevBtn").addEventListener("click", () => setIndex(state.index - 1));
  document.getElementById("nextBtn").addEventListener("click", () => setIndex(state.index + 1));

  autoBtn.addEventListener("click", () => {
    state.auto = !state.auto;
    autoBtn.setAttribute("aria-pressed", String(state.auto));
    say(state.auto
      ? "Forced slides will now be taken for you."
      : "Every slide is yours to make again.");
  });

  backBtn.addEventListener("click", () => {
    const leg = state.board.undo();
    render();
    if (!leg) { say("Nothing to take back."); return; }
    report();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    state.board.reset();
    render();
    say("Board cleared. Click any white square to start again.");
  });

  load();
})();
