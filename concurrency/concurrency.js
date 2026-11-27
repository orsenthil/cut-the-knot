"use strict";

/*
 * The page for Concurrency: drawing and input only. The construction and the
 * three concurrency families live in concurrency-core.js. Six focusable dots
 * drive the picture: the triangle's corners and the ray point at each corner.
 * The six lines and their meeting point are redrawn from the core on every
 * move, so the family buttons and the keyboard always show the same geometry.
 */

(function () {
  const Core = ConcurrencyCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const modeButtons = [...document.querySelectorAll("[data-mode]")];
  const resetBtn = document.getElementById("newBtn");
  const trisectBtn = document.getElementById("trisectBtn");

  let state = Core.start({});

  /** A line under the picture. An illustration ends in no win and no loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Paint order: guides, highlighted lines, marks, labels, handles on top. */
  const guides = board.layer("guides");
  const family = board.layer("family");
  const marks = board.layer("marks");
  const text = board.layer("text");
  const tops = board.layer("handles");

  const triangle = [0, 1, 2].map(() => board.segment(state.V[0], state.V[1], "triangle", guides));
  const primary = [0, 1, 2].map(() => board.line(state.V[0], state.P[0], "ray", guides));
  const mirrors = [0, 1, 2].map(() => board.line(state.V[0], state.P[0], "mirror", guides));
  const highlighted = [0, 1, 2].map(() => board.line(state.V[0], state.P[0], "family-line", family));
  const arcs = [0, 1, 2].map(() => board.angleArc(state.V[0], state.V[1], state.P[0], 15, "angle-arc", marks));
  const meeting = board.point(state.V[0], "meeting", 6, marks);
  const meetingRing = board.circle(state.V[0], 12, "meeting-ring", marks);
  const labels = [0, 1, 2].map((i) => board.label(state.V[i], "ABC"[i], "pt-label", -15, -12, text));

  const speak = (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`;
  const clampToBoard = (p) => ({
    x: Geom.clamp(p.x, 12, Core.WIDTH - 12),
    y: Geom.clamp(p.y, 12, Core.HEIGHT - 12),
  });

  const vertexHandles = [0, 1, 2].map((i) => board.handle("ABC"[i], state.V[i], {
    r: 9, step: 3, cls: "geom-handle vertex-handle", layer: tops,
    label: `Corner ${"ABC"[i]}. Drag it, or focus it and use the arrow keys.`,
    describe: speak,
    clamp: clampToBoard,
    onMove: (p) => { state = Core.moveVertex(state, i, p); render(); },
  }));
  const rayHandles = [0, 1, 2].map((i) => board.handle("P" + i, state.P[i], {
    r: 7, step: 3, cls: "geom-handle ray-handle", layer: tops,
    label: `Line point at corner ${"ABC"[i]}. Drag it, or focus it and use the arrow keys.`,
    describe: speak,
    clamp: clampToBoard,
    onMove: (p) => { state = Core.movePoint(state, i, p); render(); },
  }));

  function render() {
    const g = Core.geometry(state);
    const chosen = Core.families(state)[state.mode];

    for (let i = 0; i < 3; i++) {
      const k = (i + 1) % 3, l = (i + 2) % 3;
      triangle[i].set(state.V[i], state.V[k]);
      primary[i].set(state.V[i], state.P[i]);
      mirrors[i].show(!!g.M[i]).set(state.V[i], g.M[i]);
      arcs[i].set(state.V[i], state.V[k], state.P[i], 15);
      labels[i].set(state.V[i]);
      vertexHandles[i].set(state.V[i]);
      rayHandles[i].set(state.P[i]);
      const line = chosen.lines[i];
      highlighted[i].show(!!line && !!line[1]);
      if (line && line[1]) highlighted[i].set(line[0], line[1]);
    }
    meeting.show(!!chosen.point);
    meetingRing.show(!!chosen.point);
    if (chosen.point) {
      meeting.set(chosen.point);
      meetingRing.set(chosen.point);
    }
    modeButtons.forEach((btn) => {
      const active = Number(btn.dataset.mode) === state.mode;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    say(Core.describe(state));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state = Core.setMode(state, Number(btn.dataset.mode));
      render();
    });
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });
  trisectBtn.addEventListener("click", () => {
    state = Core.trisect(state);
    render();
  });

  board.onTheme(render);
  render();
})();
