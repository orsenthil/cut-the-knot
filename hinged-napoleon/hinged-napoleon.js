"use strict";

/*
 * Hinged Napoleon — drawing and input only. All the geometry, the applet's
 * option ranges and the page's claims live in hinged-napoleon-core.js.
 *
 * The stage is one SVG: triangle ABC with an equilateral triangle on each
 * side, the three centres Ac, Bc, Cc that form Napoleon's triangle, and two
 * hinged pieces that turn about their centre dots as the Turn slider moves.
 * Shapes are created once and only updated on redraw, so a dragged corner
 * keeps keyboard focus. At 120° the status says which two corners land where.
 */

(function () {
  const Core = HingedNapoleonCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const turn = document.getElementById("turn");
  const turnOut = document.getElementById("turnOut");
  const namesBox = document.getElementById("names");
  const resetBtn = document.getElementById("resetBtn");
  const swivelBtns = [
    document.getElementById("swivelBC"),
    document.getElementById("swivelAC"),
    document.getElementById("swivelAB"),
  ];

  let state = Core.start();

  /* Back to front: translucent pieces, construction lines, dots, names, handles. */
  const fills = board.layer("fills");
  const lines = board.layer("lines");
  const dots = board.layer("dots");
  const texts = board.layer("texts");
  const top = board.layer("handles");

  const pieces = [0, 1, 2, 3, 4].map((i) =>
    board.polygon([state.A, state.B, state.C], i < 3 ? "piece" : "piece-moving", fills));
  const abc = board.polygon([state.A, state.B, state.C], "abc", lines);
  const spokes = [0, 1, 2, 3, 4, 5].map(() => board.segment(state.A, state.B, "spoke", lines));
  const centreLines = [0, 1, 2, 3, 4, 5].map(() =>
    board.segment(state.A, state.B, "centre-line", lines));
  const napoleon = board.polygon([state.A, state.B, state.C], "napoleon", lines);
  const apexDots = [0, 1, 2].map(() => board.point(state.A, "apex-dot", 5, dots));
  const centreDots = [0, 1, 2].map(() => board.point(state.A, "centre-dot", 5, dots));
  const pivotDots = [0, 1].map(() => board.point(state.A, "pivot-dot", 7, dots));
  const starDot = board.point(state.A, "star-dot", 6, dots);

  const labelKeys = ["A", "B", "C", "A″", "B″", "C″", "A′", "B′", "C′", "A*", "B*", "C*"];
  const labels = {};
  for (const key of labelKeys) labels[key] = board.label(state.A, key, "point-label", 10, -9, texts);

  const handle = (name) => board.handle(name, state[name], {
    r: 14, step: 5, shift: 15, layer: top,
    clamp: (p) => Core.clamp(p),
    label: `Corner ${name}. Drag it, or focus it and use the arrow keys to move the triangle.`,
    onMove: (p, which) => {
      state = Core.move(state, which, p);
      render();
    },
  });
  const handles = { A: handle("A"), B: handle("B"), C: handle("C") };

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function outward(from, p, size) {
    const dx = p.x - from.x, dy = p.y - from.y;
    const n = Math.hypot(dx, dy) || 1;
    return { dx: (dx / n) * size, dy: (dy / n) * size };
  }

  function setLabel(key, at, dx, dy) {
    labels[key].show(state.options.names && !!at);
    if (at) labels[key].set(at, key, dx, dy);
  }

  function render() {
    for (const name of ["A", "B", "C"]) handles[name].set(state[name]);
    turnOut.textContent = `${state.options.angle}°`;
    swivelBtns.forEach((btn, i) => btn.setAttribute("aria-pressed", String(i === state.options.swivel)));

    const g = Core.geometry(state);
    if (!g) {
      for (const s of pieces.concat([abc, napoleon, starDot], spokes, centreLines, apexDots, centreDots, pivotDots)) s.show(false);
      for (const key of labelKeys) labels[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    const mid = Core.barycenter(g.A, g.B, g.C);
    const apexes = [g.Ap, g.Bp, g.Cp];
    const centres = [g.Ac, g.Bc, g.Cc];
    const corners = [g.A, g.B, g.C];

    g.polys.forEach((poly, i) => {
      pieces[i].show(i < 3 || state.options.angle > 0).set(poly);
    });
    abc.show(true).set(corners);
    napoleon.show(true).set(centres);

    const spokesEnds = [
      [g.Ap, g.B], [g.Ap, g.C], [g.Bp, g.C], [g.Bp, g.A], [g.Cp, g.A], [g.Cp, g.B],
    ];
    spokes.forEach((s, i) => s.show(true).set(spokesEnds[i][0], spokesEnds[i][1]));
    const centreEnds = [
      [g.Ac, g.B], [g.Ac, g.C], [g.Cc, g.A], [g.Cc, g.B], [g.Bc, g.C], [g.Bc, g.A],
    ];
    centreLines.forEach((s, i) => s.show(true).set(centreEnds[i][0], centreEnds[i][1]));

    apexes.forEach((p, i) => apexDots[i].show(true).set(p));
    centres.forEach((p, i) => centreDots[i].show(true).set(p));
    const pivots = g.centreKeys.map((k) => g.centres[k]);
    pivots.forEach((p, i) => pivotDots[i].show(true).set(p));
    starDot.show(state.options.angle >= 120).set(g.star);

    /* Push names clear of their own dots and of their neighbours. */
    const awayLabel = (key, p, size) => {
      const v = outward(mid, p, size);
      setLabel(key, p, v.dx - 4, v.dy - 4);
    };
    awayLabel("A", g.A, 28);
    awayLabel("B", g.B, 28);
    awayLabel("C", g.C, 28);
    for (let i = 0; i < 3; i++) {
      awayLabel(["A″", "B″", "C″"][i], apexes[i], 30);
      awayLabel(["A′", "B′", "C′"][i], centres[i], 26);
    }
    const starName = { Aq: "A*", Bq: "B*", Cq: "C*" }[g.starKey];
    setLabel(starName, state.options.angle >= 120 ? g.star : null, 10, -14);
    for (const key of labelKeys.filter((k) => k !== starName)) {
      if (["A", "B", "C", "A″", "B″", "C″", "A′", "B′", "C′"].includes(key)) continue;
      labels[key].show(false);
    }

    say(Core.describe(state), state.explored ? "done" : null);
    // Board units, not screen pixels, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C,
        Ac: g.Ac, Bc: g.Bc, Cc: g.Cc,
        movingPieces: [g.polys[3], g.polys[4]], star: g.star,
        options: state.options, claims: g.claims, measures: g.measures,
      });
    }
  }

  function syncControls() {
    turn.value = String(state.options.angle);
    namesBox.checked = state.options.names;
    swivelBtns.forEach((btn, i) => btn.setAttribute("aria-pressed", String(i === state.options.swivel)));
  }

  turn.addEventListener("input", () => {
    state = Core.setOption(state, "angle", Number(turn.value));
    render();
  });
  swivelBtns.forEach((btn, i) => btn.addEventListener("click", () => {
    state = Core.setOption(state, "swivel", i);
    syncControls();
    render();
  }));
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  function newDiagram() {
    state = Core.reset(state);
    syncControls();
    render();
  }
  resetBtn.addEventListener("click", newDiagram);
  document.addEventListener("keydown", (e) => {
    if ((e.key === "r" || e.key === "R") && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
      newDiagram();
    }
  });

  board.onTheme(render);
  syncControls();
  render();
})();
