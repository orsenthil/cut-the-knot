"use strict";

/*
 * The Lucky 7 page: drawing and input only. Two rings overlap; the eight
 * places are drawn in board units with Geom, and the six places that can be
 * clicked get focusable handles as well as ordinary buttons. All the rules
 * (which places turn, what Shuffle and Cheat do, when the counters are home)
 * live in lucky7-core.js.
 */

(() => {
  const Core = Lucky7Core;
  const statusEl = document.getElementById("status");
  const movesEl = document.getElementById("moveButtons");
  const countEl = document.getElementById("count");
  const cyclesBox = document.getElementById("cyclesBox");
  const lessBtn = document.getElementById("lessBtn");
  const moreBtn = document.getElementById("moreBtn");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const cheatBtn = document.getElementById("cheatBtn");
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board("board");
  const rings = board.layer("rings");
  const dots = board.layer("dots");
  const hits = board.layer("hits");
  const texts = board.layer("texts");

  let state = Core.start({});
  let lastMove = "The counters are in their home order.";
  let layout = null;
  let dotsAt = [];
  let labelsAt = [];

  /** Show a line under the board. "done" is the finish mark for the record. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const spoken = {
    leftM: "the left ring turns one step",
    leftP: "the left ring turns the other way",
    rightM: "the right ring turns one step",
    rightP: "the right ring turns the other way",
    circP: "all counters turn one step",
    circM: "all counters turn the other way",
  };

  function describe(id) {
    return spoken[id] || "the counters turn";
  }

  function buildBoard() {
    board.clear(rings);
    board.clear(dots);
    board.clear(hits);
    board.clear(texts);
    layout = Core.layout(state.n);
    dotsAt = [];
    labelsAt = [];

    board.circle(layout.left, layout.radius, "ring", rings);
    board.circle(layout.right, layout.radius, "ring", rings);

    for (let i = 0; i <= state.n; i++) {
      const p = layout.points[i];
      const empty = i === 0;
      dotsAt.push(board.point(p, empty ? "empty" : "counter", 15, dots));
      labelsAt.push(board.label(p, empty ? "" : "?", "counter-text", 0, 0, texts));

      const id = Core.hitMove(state.n, i);
      if (!id) continue; // only the six control places can be pressed
      const at = { x: p.x, y: p.y };
      const handle = board.handle("place" + i, at, {
        r: 20,
        cls: "geom-handle hit",
        label: `${Core.placeName(state.n, i)} counter. Press Enter, Space or an arrow key to turn ${describe(id)}.`,
        clamp: () => at,
        onMove: () => {},
      });
      // A pointer press makes the same turn as a key press. Geom's own
      // listeners keep the dot still and preserve keyboard focus on redraw.
      handle.node.addEventListener("pointerdown", () => play(id));
      handle.node.addEventListener("keydown", (event) => {
        if (!["Enter", " ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        play(id);
        handle.node.focus();
      });
    }
  }

  function buildMoves() {
    movesEl.textContent = "";
    for (let i = 0; i <= state.n; i++) {
      const id = Core.hitMove(state.n, i);
      if (!id) continue;
      const where = Core.placeName(state.n, i);
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.move = id;
      button.textContent = where;
      button.setAttribute("aria-label", `${where} counter: turn ${describe(id)}`);
      button.addEventListener("click", () => play(id));
      movesEl.appendChild(button);
    }
  }

  function render() {
    for (let i = 0; i <= state.n; i++) {
      const value = state.values[i];
      dotsAt[i].set(layout.points[i]);
      labelsAt[i].set(layout.points[i], value === 0 ? "" : String(value));
    }
    board.root.classList.toggle("solved", state.solved);
    countEl.textContent = String(state.n);
    lessBtn.disabled = state.n <= Core.MIN_N;
    moreBtn.disabled = state.n >= Core.MAX_N;

    let message = lastMove;
    if (cyclesBox.checked) message += `  Cycles: ${Core.cycles(state)}.`;
    if (state.solved) {
      say(`${message}  All ${state.n} counters are home.`, "done");
    } else {
      say(message);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({ n: state.n, values: state.values.slice(), solved: state.solved, moves: state.moves });
    }
  }

  function play(id) {
    const next = Core.move(state, id);
    if (!next) return;
    state = next;
    lastMove = `The ${Core.placeName(state.n, Core.controlIndex(state.n, id))} counter: ${describe(id)}.`;
    render();
  }

  function newGame() {
    state = Core.shuffle(state, Math.random);
    lastMove = "Shuffled: put the counters back in order.";
    render();
  }

  shuffleBtn.addEventListener("click", newGame);
  cheatBtn.addEventListener("click", () => {
    state = Core.cheat(state);
    lastMove = "Cheat swapped the first two counters.";
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start({ n: state.n });
    lastMove = "Back at the home position.";
    render();
  });
  lessBtn.addEventListener("click", () => {
    const before = state.n;
    state = Core.resize(state, -2);
    lastMove = `Now ${state.n} counters instead of ${before}.`;
    buildBoard();
    buildMoves();
    render();
  });
  moreBtn.addEventListener("click", () => {
    const before = state.n;
    state = Core.resize(state, 2);
    lastMove = `Now ${state.n} counters instead of ${before}.`;
    buildBoard();
    buildMoves();
    render();
  });
  cyclesBox.addEventListener("change", render);

  buildBoard();
  buildMoves();
  render();
  board.onTheme(render);
})();
