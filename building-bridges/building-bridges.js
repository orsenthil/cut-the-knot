"use strict";

/*
 * The page for Building Bridges: drawing and input only. The construction and
 * its claims live in building-bridges-core.js.
 *
 * The SVG shows two rivers (each a strip between two parallel banks), the two
 * towns A and B, the dashed straight line A'B' through the translated towns,
 * the shortest road in a solid stroke, and the road through the two draggable
 * bridge points C and C'' in a dashed stroke. Towns, bank ends, bank middles
 * and the two bridge points are all real, focusable handles.
 */

(function () {
  const Core = BuildingBridgesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const checkBtn = document.getElementById("checkBtn");
  const newBtn = document.getElementById("newBtn");
  const labelsBtn = document.getElementById("labelsBtn");
  const view = board.viewBox;

  const margin = 8;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + margin, view.x + view.width - margin),
    y: Geom.clamp(p.y, view.y + margin, view.y + view.height - margin),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");
  const here = (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`;

  let state = Core.start({});
  let checked = false;
  let showLabels = true;

  /* Layers are created in paint order: fills, banks, guides, roads, marks. */
  const fills = board.layer("fills");
  const banksLayer = board.layer("banks");
  const guides = board.layer("guides");
  const tryLayer = board.layer("try-road");
  const bestLayer = board.layer("best-road");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  const strips = [0, 1].map(() => board.polygon([{ x: 0, y: 0 }], "river-strip", fills));
  const banks = [0, 1].flatMap((i) => [
    board.segment(state.rivers[i].upper.a, state.rivers[i].upper.b, "bank", banksLayer),
    board.segment(state.rivers[i].lower.a, state.rivers[i].lower.b, "bank", banksLayer),
  ]);
  const translated = board.line(state.A, state.B, "guide", guides);
  const throughA = board.line(state.A, state.B, "guide soft", guides);
  const throughB = board.line(state.A, state.B, "guide soft", guides);

  /* Five pieces: land, bridge, land, bridge, land. Objects are made once and
     only their geometry changes, so keyboard focus on a handle survives. */
  const tryPieces = Array.from({ length: 5 }, (_, i) =>
    board.segment(state.A, state.B, i === 1 || i === 3 ? "try-bridge" : "try-road", tryLayer));
  const bestPieces = Array.from({ length: 5 }, (_, i) =>
    board.segment(state.A, state.B, i === 1 || i === 3 ? "best-bridge" : "best-road", bestLayer));
  const bestDots = Array.from({ length: 4 }, () => board.point(state.A, "best-dot", 3.5, marks));
  const tryDots = Array.from({ length: 2 }, () => board.point(state.A, "try-dot", 3.5, marks));

  const labels = [
    board.label(state.A, "A", "glabel", -17, -9, marks),
    board.label(state.B, "B", "glabel", -17, 18, marks),
    board.label(state.A, "A'", "glabel prime", -22, -9, marks),
    board.label(state.B, "B'", "glabel prime", -24, 18, marks),
    board.label(state.A, "C", "glabel", -17, -9, marks),
    board.label(state.A, "C'", "glabel", -19, -9, marks),
    board.label(state.A, "C''", "glabel", -22, 18, marks),
    board.label(state.A, "C'''", "glabel", -26, 18, marks),
  ];

  /**
   * Shows the line under the board. "done" is used only when the construction
   * has been checked; the shared record reads that class (a demo never wins).
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const setPiece = (shape, on, p, q) => {
    shape.show(on);
    if (on) shape.set(p, q);
  };

  function render() {
    const g = Core.geometry(state);
    const ok = Core.valid(state, g);
    const cl = Core.claims(state, g);
    const a = Core.attempt(state, g);

    state.rivers.forEach((r, i) => {
      strips[i].set([r.upper.a, r.upper.b, r.lower.b, r.lower.a]);
      banks[2 * i].set(r.upper.a, r.upper.b);
      banks[2 * i + 1].set(r.lower.a, r.lower.b);
    });

    translated.show(ok);
    throughA.show(ok);
    throughB.show(ok);
    if (ok) {
      translated.set(g.Aprime, g.Bprime);
      throughA.set(state.A, Core.add(state.A, g.v));
      throughB.set(state.B, Core.sub(state.B, g.v));
    }

    const best = Core.route(state, g);
    for (let i = 0; i < 5; i++) setPiece(bestPieces[i], ok, best[i], best[i + 1]);
    [g.KU0, g.KL0, g.KL1, g.KU1].forEach((p, i) => {
      bestDots[i].show(ok);
      if (ok) bestDots[i].set(p);
    });

    const attempt = [state.A, a.C0, a.Cp0, a.C1, a.Cp1, state.B];
    for (let i = 0; i < 5; i++) setPiece(tryPieces[i], true, attempt[i], attempt[i + 1]);
    [a.C0, a.C1].forEach((p, i) => tryDots[i].set(p));

    const labelPoints = [state.A, state.B, g.Aprime, g.Bprime, a.C0, a.Cp0, a.C1, a.Cp1];
    labels.forEach((label, i) => {
      label.show(showLabels && (i < 2 || ok));
      if (showLabels && (i < 2 || ok)) label.set(labelPoints[i]);
    });

    const named = {
      A: state.A, B: state.B, C0: a.C0, C1: a.C1,
      U0a: state.rivers[0].upper.a, U0b: state.rivers[0].upper.b,
      L0a: state.rivers[0].lower.a, L0b: state.rivers[0].lower.b,
      U1a: state.rivers[1].upper.a, U1b: state.rivers[1].upper.b,
      L1a: state.rivers[1].lower.a, L1b: state.rivers[1].lower.b,
      M0: Core.midpoint(state.rivers[0].upper.a, state.rivers[0].upper.b),
      M1: Core.midpoint(state.rivers[1].upper.a, state.rivers[1].upper.b),
    };
    Object.keys(named).forEach((name) => handles[name].set(named[name]));

    if (!ok) {
      say("This drawing does not make sense: keep both towns outside the rivers and the two rivers apart.", null);
    } else if (checked && Object.values(cl).every(Boolean)) {
      say("Checked: the three land pieces are parallel and this is the shortest possible road.", "done");
    } else {
      say(`Your road is ${fmt(Core.attemptLength(state, g))} long; the shortest is ${fmt(Core.shortestLength(state, g))}. Drag C or C'' until your road lies on the straight dashed line.`, null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const handles = Object.create(null);
  function addHandle(name, point, options) {
    handles[name] = board.handle(name, point, {
      r: options.r || 5,
      step: options.step || 2,
      shift: 10,
      cls: options.cls || "bank-handle",
      layer: handlesLayer,
      label: options.label,
      describe: here,
      clamp: options.clamp || inside,
      onMove: (p) => {
        state = Core.withPoint(state, name, p);
        checked = false;
        render();
      },
    });
  }

  addHandle("A", state.A, {
    r: 9, step: 3, cls: "geom-handle town-handle",
    label: "Town A. Drag, or focus and use the arrow keys to move it.",
  });
  addHandle("B", state.B, {
    r: 9, step: 3, cls: "geom-handle town-handle",
    label: "Town B. Drag, or focus and use the arrow keys to move it.",
  });
  addHandle("C0", Core.lerp(state.rivers[0].upper.a, state.rivers[0].upper.b, state.rivers[0].coef), {
    r: 7, step: 2, cls: "geom-handle c-handle",
    label: "Bridge point C on the first river. Drag along the bank, or use the arrow keys.",
    clamp: (p) => inside(Core.onBank(state, 0, p)),
  });
  addHandle("C1", Core.lerp(state.rivers[1].upper.a, state.rivers[1].upper.b, state.rivers[1].coef), {
    r: 7, step: 2, cls: "geom-handle c-handle",
    label: "Bridge point C double prime on the second river. Drag along the bank, or use the arrow keys.",
    clamp: (p) => inside(Core.onBank(state, 1, p)),
  });
  const bankEnds = [
    ["U0a", "first river, upper bank, left end"], ["U0b", "first river, upper bank, right end"],
    ["L0a", "first river, lower bank, left end"], ["L0b", "first river, lower bank, right end"],
    ["U1a", "second river, upper bank, left end"], ["U1b", "second river, upper bank, right end"],
    ["L1a", "second river, lower bank, left end"], ["L1b", "second river, lower bank, right end"],
  ];
  for (const [name, description] of bankEnds) {
    const match = /^([UL])([01])([ab])$/.exec(name);
    const bank = match[1] === "U" ? "upper" : "lower";
    addHandle(name, state.rivers[Number(match[2])][bank][match[3]], {
      label: `${description[0].toUpperCase() + description.slice(1)}. Drag to turn the river, or use the arrow keys.`,
    });
  }
  for (const i of [0, 1]) {
    addHandle(`M${i}`, Core.midpoint(state.rivers[i].upper.a, state.rivers[i].upper.b), {
      r: 7, step: 2, cls: "geom-handle mid-handle",
      label: `Middle of the ${i === 0 ? "first" : "second"} river. Drag to slide both banks together, or use the arrow keys.`,
    });
  }

  function checkConstruction() {
    const g = Core.geometry(state);
    const cl = Core.claims(state, g);
    checked = Core.valid(state, g) && Object.values(cl).every(Boolean);
    render();
    if (!checked) say("Move the towns and banks back into a sensible picture, then check again.", null);
  }

  function newLayout() {
    state = Core.start({});
    checked = false;
    render();
    handles.A.node.focus();
  }

  checkBtn.addEventListener("click", checkConstruction);
  newBtn.addEventListener("click", newLayout);
  labelsBtn.addEventListener("click", () => {
    showLabels = !showLabels;
    labelsBtn.setAttribute("aria-pressed", String(showLabels));
    labelsBtn.textContent = showLabels ? "Hide names" : "Show names";
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") newLayout();
    if (e.key === "c" || e.key === "C") checkConstruction();
  });
  board.onTheme(render);
  render();
})();
