"use strict";

/*
 * The page for the Menelaus applet: drawing and input only; all geometry and
 * the two theorems live in menelaus-core.js.
 *
 * The SVG has the applet's 500 by 380 board. A B C are draggable corners. In
 * Ceva mode K is free and the three cevians through it cut the other sides at
 * D, E and F. In Menelaus mode K becomes the side point E on AC, and D on BC
 * and F on AB are draggable; the core keeps the three of them on one line by
 * recomputing the next point after each drag, just as DrawMenelaus does.
 */

(function () {
  const Core = MenelausCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const cevaBtn = document.getElementById("cevaBtn");
  const menelausBtn = document.getElementById("menelausBtn");
  const resetBtn = document.getElementById("resetBtn");
  const view = board.viewBox;

  let state = Core.start();
  let seenBoth = false;

  const guideLayer = board.layer("guides");
  const cevianLayer = board.layer("cevians");
  const frameLayer = board.layer("frame");
  const markLayer = board.layer("marks");
  const textLayer = board.layer("text");
  const handleLayer = board.layer("handles");

  const sides = [
    board.segment(state.A, state.B, "tri-side", frameLayer),
    board.segment(state.B, state.C, "tri-side", frameLayer),
    board.segment(state.C, state.A, "tri-side", frameLayer),
  ];
  const guides = [
    board.segment(state.A, state.K, "guide", guideLayer),
    board.segment(state.B, state.K, "guide", guideLayer),
    board.segment(state.C, state.K, "guide", guideLayer),
  ];
  const cevians = [
    board.segment(state.A, state.Dm || state.A, "cevian", cevianLayer),
    board.segment(state.B, state.K, "cevian", cevianLayer),
    board.segment(state.C, state.K, "cevian", cevianLayer),
  ];
  const transversal = board.segment(state.A, state.B, "transversal", cevianLayer);
  const marks = {
    D: board.point(state.A, "mark", 5, markLayer),
    E: board.point(state.B, "mark", 5, markLayer),
    F: board.point(state.C, "mark", 5, markLayer),
    K: board.point(state.K, "meet-dot", 6, markLayer),
  };
  const labels = {};
  for (const name of ["A", "B", "C", "D", "E", "F", "K"]) {
    const off = {
      A: [9, -12], B: [-18, 18], C: [9, 18],
      D: [8, 18], E: [-17, -11], F: [8, -11], K: [9, -12],
    }[name];
    labels[name] = board.label(state.A, name, "pt-label " +
      ({ A: "vertex-label", B: "vertex-label", C: "vertex-label" }[name] || "mark-label"),
    off[0], off[1], textLayer);
    labels[name].show(name !== "E");
  }

  /** Say what the figure shows. "done" marks the illustration as explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  function setLine(shape, p, q, show) {
    const on = show && finite(p) && finite(q);
    shape.show(on);
    if (on) shape.set(p, q);
  }
  function setDot(shape, p, show) {
    const on = show && finite(p);
    shape.show(on);
    if (on) shape.set(p);
  }
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(3) : "not defined");

  function render() {
    const p = Core.points(state);
    const n = Core.numbers(state);
    const menelausMode = state.mode === "menelaus";

    setLine(sides[0], state.A, state.B, true);
    setLine(sides[1], state.B, state.C, true);
    setLine(sides[2], state.C, state.A, true);

    /* Ceva: faint cevians from the vertices to K, bright cevian segments.
       Menelaus: faint side guides, bright transversal F-E-D. */
    setLine(guides[0], state.A, state.K, true);
    setLine(guides[1], state.B, state.K, !menelausMode);
    setLine(guides[2], state.C, state.K, true);
    setLine(cevians[0], state.A, p.D, !menelausMode);
    setLine(cevians[1], state.B, p.E, !menelausMode);
    setLine(cevians[2], state.C, p.F, !menelausMode);
    setLine(transversal, p.F, p.D, menelausMode);

    setDot(marks.D, p.D, true);
    setDot(marks.E, p.E, true);
    setDot(marks.F, p.F, true);
    setDot(marks.K, state.K, true);

    const markPos = { D: p.D, E: menelausMode ? state.K : p.E, F: p.F };
    for (const name of ["D", "E", "F"]) {
      setDot(labels[name], markPos[name], true);
      labels[name].set(markPos[name]);
    }
    labels.K.show(!menelausMode);
    if (!menelausMode) labels.K.set(state.K);
    for (const name of ["A", "B", "C"]) {
      labels[name].set(state[name]);
      handles[name].set(state[name]);
    }
    handles.K.set(state.K);
    handles.K.node.setAttribute("aria-label", menelausMode
      ? "E on side A C. Drag it, or focus it and use the arrow keys."
      : "K, the meeting point of the three cevians. Drag it, or focus it and use the arrow keys.");
    handles.D.show(menelausMode);
    handles.F.show(menelausMode);
    if (menelausMode) {
      handles.D.set(p.D);
      handles.F.set(p.F);
    }

    cevaBtn.setAttribute("aria-pressed", String(!menelausMode));
    menelausBtn.setAttribute("aria-pressed", String(menelausMode));

    const scale = Math.max(1, Math.hypot(p.D.x - p.E.x, p.D.y - p.E.y));
    const collinear = Math.abs(n.cross) <= 1e-6 * scale * scale;
    const tol = 1e-4;
    const onLine = (a, b, c) => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) <=
      tol * Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    const sidesOk = finite(p.D) && finite(p.E) && finite(p.F) &&
      onLine(state.A, state.B, p.F) && onLine(state.B, state.C, p.D) &&
      onLine(state.A, state.C, p.E);
    const product = fmt(n.product);
    const kind = seenBoth ? "done" : null;

    if (menelausMode && collinear && sidesOk) {
      say("Menelaus: AF/BF × BD/CD × CE/AE = " + product + ". D, E and F lie on one line.", kind);
    } else if (menelausMode && collinear) {
      say("D, E and F are still in a line, but moving a corner left a dot off its side; " +
        "drag D, E or F to bring it back. The product is " + product + ".", kind);
    } else if (menelausMode) {
      say("Menelaus: the dots are not lined up; the product is " + product + ".", kind);
    } else if (Number.isFinite(n.product)) {
      say("Ceva: AF/BF × BD/CD × CE/AE = " + product + ". AD, BE and CF meet at K.", kind);
    } else {
      say("Ceva: a cevian is parallel to a side, so the crossing is not on the board.", kind);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 12, view.x + view.width - 12),
    y: Geom.clamp(p.y, view.y + 12, view.y + view.height - 12),
  });

  const handles = {};
  for (const name of ["A", "B", "C"]) {
    handles[name] = board.handle(name, state[name], {
      r: 9, step: 5, shift: 15, layer: handleLayer, cls: "geom-handle corner-handle",
      clamp: inside,
      label: "Corner " + name + ". Drag it, or focus it and use the arrow keys.",
      describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
      onMove: (p) => { state = Core.move(state, name, p); render(); },
    });
  }
  handles.K = board.handle("K", state.K, {
    r: 8, step: 5, shift: 15, layer: handleLayer, cls: "geom-handle mark-handle k-handle",
    clamp: (p) => Core.projectHandle(state, "K", p),
    label: "K, the meeting point of the three cevians. Drag it, or focus it and use the arrow keys.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
    onMove: (p) => { state = Core.move(state, "K", p); render(); },
  });
  handles.D = board.handle("D", state.A, {
    r: 8, step: 5, shift: 15, layer: handleLayer, cls: "geom-handle mark-handle d-handle",
    clamp: (p) => Core.projectHandle(state, "D", p),
    label: "D on side B C. Drag it, or focus it and use the arrow keys.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
    onMove: (p) => { state = Core.move(state, "D", p); render(); },
  });
  handles.F = board.handle("F", state.B, {
    r: 8, step: 5, shift: 15, layer: handleLayer, cls: "geom-handle mark-handle f-handle",
    clamp: (p) => Core.projectHandle(state, "F", p),
    label: "F on side A B. Drag it, or focus it and use the arrow keys.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
    onMove: (p) => { state = Core.move(state, "F", p); render(); },
  });

  function changeMode(mode) {
    if (state.mode === mode) return;
    state = Core.switchMode(state, mode);
    seenBoth = true;
    render();
    (mode === "menelaus" ? menelausBtn : cevaBtn).focus();
  }

  function reset() {
    state = Core.start({ mode: state.mode });
    render();
    (state.mode === "menelaus" ? menelausBtn : cevaBtn).focus();
  }

  cevaBtn.addEventListener("click", () => changeMode("ceva"));
  menelausBtn.addEventListener("click", () => changeMode("menelaus"));
  resetBtn.addEventListener("click", reset);
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target?.isContentEditable) return;
    if (e.key.toLowerCase() === "c") { e.preventDefault(); changeMode("ceva"); }
    else if (e.key.toLowerCase() === "m") { e.preventDefault(); changeMode("menelaus"); }
    else if (e.key.toLowerCase() === "r") { e.preventDefault(); reset(); }
  });

  board.onTheme(render);
  render();
})();
