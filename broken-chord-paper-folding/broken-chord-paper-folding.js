"use strict";

/*
 * The page for Broken Chord Paper Folding: drawing and input only. The geometry
 * is in broken-chord-paper-folding-core.js. An SVG board shows the circumcircle,
 * the broken line A-C-B, the foot M, the crease PC and the folded point F; the
 * extra fold gives G. A, B and C are draggable Geom handles, so a pointer or
 * the arrow keys can put the triangle anywhere. The five checkboxes reproduce
 * the applet's "names", "hint", "lines", "angles" and "extra" switches.
 */

(function () {
  const Core = BrokenChordPaperFoldingCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    circle: board.layer("circle"),
    triangle: board.layer("triangle"),
    hint: board.layer("hint"),
    extra: board.layer("extra"),
    marks: board.layer("marks"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);

  /** Status line; "done" is how a demo tells the player's record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Each object is made once and re-set on every redraw, so a handle keeps its
     keyboard focus while the rest of the picture changes. */
  const circumcircle = board.circle(geometry.circle ? geometry.circle.O : { x: 0, y: 0 },
    1, "circumcircle", layers.circle);
  const sides = [
    board.segment(state.C, state.A, "side", layers.triangle),
    board.segment(state.C, state.B, "side", layers.triangle),
  ];
  const baseSide = board.segment(state.A, state.B, "hintside", layers.hint);
  const foldArc = [
    board.segment(state.A, state.M || state.A, "broken-first", layers.triangle),
    board.segment(state.A, state.M || state.A, "broken-second", layers.triangle),
    board.segment(state.A, state.B, "broken-second", layers.triangle),
  ];
  const perpendicular = board.segment(state.A, state.C, "perpendicular", layers.marks);
  const rightAngles = [
    board.rightAngle(state.A, state.C, state.A, 12, "rightmark", layers.marks),
    board.rightAngle(state.A, state.C, state.A, 12, "rightmark", layers.marks),
  ];
  const hintSides = [
    board.segment(state.C, state.A, "hintsideline", layers.hint),
    board.segment(state.A, state.A, "hintsideline", layers.hint),
    board.segment(state.B, state.A, "hintsideline", layers.hint),
  ];
  const foldLines = [
    board.segment(state.A, state.A, "foldline", layers.hint),
    board.segment(state.A, state.A, "foldline", layers.hint),
    board.segment(state.A, state.A, "foldline", layers.hint),
  ];
  const crease = board.line(state.A, state.B, "crease", layers.hint);
  const extraLines = [
    board.segment(state.A, state.A, "extraline", layers.extra),
    board.segment(state.A, state.A, "extraline", layers.extra),
    board.segment(state.A, state.A, "extraline", layers.extra),
  ];

  /** The applet's LineID: n short slashes across the middle of a segment. */
  function tickMarks(n) {
    const slashes = [];
    for (let i = 0; i < n; i++) slashes.push(board.segment(state.A, state.A, "tickmark", layers.marks));
    return {
      set(a, b) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const nx = -uy, ny = ux;
        for (let i = 0; i < n; i++) {
          const t = len / 2 + (i - (n - 1) / 2) * 6;
          const c = { x: a.x + ux * t, y: a.y + uy * t };
          slashes[i].set({ x: c.x - nx * 5, y: c.y - ny * 5 }, { x: c.x + nx * 5, y: c.y + ny * 5 });
        }
        return this;
      },
      show(on) { for (const s of slashes) s.show(on); return this; },
    };
  }
  const lengthMarks = {
    CF: tickMarks(2), CL: tickMarks(2),
    AP: tickMarks(3), BP: tickMarks(3), FP: tickMarks(3), GP: tickMarks(3),
  };

  /** The applet's ShowAngle marks; each pair of equal angles gets its own arc. */
  function angleMark(vertex, p, q, r) {
    const arc = board.angleArc(state.A, state.A, state.A, r, "anglemark", layers.marks);
    return {
      set(g) { arc.set(vertex(g), p(g), q(g), r); },
      show(on) { arc.show(on); },
    };
  }
  const at = (name) => (g) => g[name];
  const angleMarks = [
    angleMark(at("L"), at("P"), at("C"), 26),
    angleMark(at("K"), at("P"), at("C"), 34),
    angleMark(at("C"), at("P"), at("K"), 26),
    angleMark(at("L"), at("P"), at("K"), 34),
    angleMark(at("K"), at("C"), at("L"), 26),
    angleMark(at("P"), at("C"), at("L"), 34),
    angleMark(at("F"), at("P"), at("A"), 26),
    angleMark(at("P"), at("C"), at("F"), 34),
    angleMark(at("C"), at("F"), at("L"), 26),
    angleMark(at("G"), at("P"), at("C"), 42),
  ];
  const dots = {
    M: board.point(state.A, "constructiondot", 5, layers.dots),
    P: board.point(state.A, "constructiondot", 5, layers.dots),
    F: board.point(state.A, "folddot", 5.5, layers.dots),
    G: board.point(state.A, "folddot", 5.5, layers.dots),
  };
  const labelOffsets = {
    A: [-15, -12], B: [8, -12], C: [8, 20],
    M: [-20, 22], P: [-18, -16], F: [9, -12], G: [9, 22],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(state.A, name, "geom-label point-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  const clampToBoard = (q) => ({
    x: Math.max(8, Math.min(Core.WIDTH - 8, q.x)),
    y: Math.max(8, Math.min(Core.HEIGHT - 8, q.y)),
  });
  const handles = {};
  for (const name of Core.HANDLES) {
    const text = `Point ${name}. Drag it, or focus it and use the arrow keys to move the triangle`;
    handles[name] = board.handle(name, state[name], {
      r: 14,
      step: 3,
      shift: 5,
      layer: layers.handles,
      label: text,
      describe: (p) => `At board position ${Math.round(p.x)}, ${Math.round(p.y)}.`,
      clamp: clampToBoard,
      onMove: (p, which) => apply({ type: "point", name: which, point: p }, `Point ${which} moved.`),
    });
  }

  function show(shape, on) { shape.show(on); return shape; }

  function draw(g, flags) {
    for (const name of Core.HANDLES) handles[name].set(state[name]);
    if (!g.valid) {
      for (const shape of [circumcircle, ...sides, baseSide, ...foldArc, perpendicular,
        ...rightAngles, ...hintSides, ...foldLines, crease, ...extraLines]) show(shape, false);
      for (const shape of Object.values(lengthMarks)) shape.show(false);
      for (const shape of angleMarks) shape.show(false);
      for (const shape of Object.values(dots)) show(shape, false);
      for (const shape of Object.values(labels)) show(shape, false);
      return;
    }

    const { A, B, C, K, L, M, P, F, G, circle, linePC } = g;
    circumcircle.set(circle.O, circle.r).show(true);
    sides[0].set(C, A).show(true);
    sides[1].set(C, B).show(true);

    // The coloured broken line: K-M, M-C and C-L, with the right angle at M.
    foldArc[0].set(K, M).show(true);
    foldArc[1].set(M, C).show(true);
    foldArc[2].set(C, L).show(true);
    perpendicular.set(P, M).show(true);
    rightAngles[0].set(M, K, P, 12).show(true);
    rightAngles[1].set(M, P, C, 12).show(true);

    baseSide.set(K, L).show(flags.showHint);
    hintSides[0].set(C, P).show(flags.showHint);
    hintSides[1].set(K, P).show(flags.showHint);
    hintSides[2].set(L, P).show(flags.showHint);
    foldLines[0].set(P, F).show(flags.showHint);
    foldLines[1].set(L, F).show(flags.showHint);
    foldLines[2].set(C, F).show(flags.showHint);
    crease.show(Boolean(flags.showHint && linePC));
    if (linePC) crease.set(linePC.p, linePC.q);
    extraLines[0].set(K, G).show(flags.showExtra);
    extraLines[1].set(C, G).show(flags.showExtra);
    extraLines[2].set(P, G).show(flags.showExtra);

    lengthMarks.CF.set(C, F).show(flags.showLines);
    lengthMarks.CL.set(C, L).show(flags.showLines);
    lengthMarks.AP.set(A, P).show(flags.showLines);
    lengthMarks.BP.set(B, P).show(flags.showLines);
    lengthMarks.FP.set(F, P).show(flags.showLines);
    lengthMarks.GP.set(G, P).show(flags.showLines && flags.showExtra);
    for (let i = 0; i < angleMarks.length; i++) {
      angleMarks[i].set(g);
      angleMarks[i].show(flags.showAngles && (i < 9 || flags.showExtra));
    }

    dots.M.set(M).show(true);
    dots.P.set(P).show(true);
    dots.F.set(F).show(flags.showHint);
    dots.G.set(G).show(flags.showExtra);
    for (const name of Object.keys(labels)) {
      const at = { A, B, C, M, P, F, G }[name];
      labels[name].set(at);
    }
    labels.A.show(flags.showNames);
    labels.B.show(flags.showNames);
    labels.C.show(flags.showNames);
    labels.M.show(flags.showNames);
    labels.P.show(flags.showNames && Core.dist(P, A) > 1 && Core.dist(P, B) > 1 && Core.dist(P, C) > 1);
    labels.F.show(flags.showHint);
    labels.G.show(flags.showExtra);
  }

  function statusText(g, flags) {
    if (!g.valid) {
      return g.reason === "close"
        ? "Move A and B apart so the circle and the crease can be drawn."
        : "Put A, B and C in a triangle so the circle can be drawn.";
    }
    const { A, B, K, L, M, P, F, C } = g;
    const kn = K === A ? "A" : "B";
    const ln = L === A ? "A" : "B";
    const parts = flags.showHint
      ? [`The crease PC folds ${ln} onto F.`,
        `F lies past C on the line from ${kn} through C.`,
        `${kn}M = MC + C${ln}, so M splits the broken line in half.`]
      : ["P is the midpoint of the arc from A through C to B.",
        `PM is perpendicular to ${kn}C, and ${kn}M = MC + C${ln}.`,
        "Tick Show hint to see the fold."];
    return `${parts.join(" ")} (${kn}M ${Core.dist(K, M).toFixed(1)}, MC + C${ln} ${(Core.dist(M, C) + Core.dist(C, L)).toFixed(1)}; P ${Math.round(P.x)}, ${Math.round(P.y)}.)`;
  }

  /** Redraw, speak the result and save the position for the player's record. */
  function render(note) {
    geometry = Core.compute(state);
    draw(geometry, Core.canvasFlags(state));
    say((note ? note + " " : "") + statusText(geometry, Core.canvasFlags(state)), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one move; an illegal move leaves the picture as it was. */
  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) {
      say("That move is not allowed.");
      return;
    }
    state = next;
    render(note);
    gateOverlays();
  }

  const checkboxes = {
    showNames: document.getElementById("namesBox"),
    showHint: document.getElementById("hintBox"),
    showLines: document.getElementById("linesBox"),
    showAngles: document.getElementById("anglesBox"),
    showExtra: document.getElementById("extraBox"),
  };
  for (const key of Object.keys(checkboxes)) {
    const box = checkboxes[key];
    box.checked = state[key];
    box.addEventListener("change", () => {
      apply({ type: "option", key, value: box.checked },
        box.checked ? `Showing ${box.dataset.label}.` : `Hid ${box.dataset.label}.`);
    });
  }

  // The applet disables these three while "hint" is unticked, but keeps their ticks.
  function gateOverlays() {
    for (const key of ["showLines", "showAngles", "showExtra"]) {
      checkboxes[key].disabled = !state.showHint;
    }
  }

  document.getElementById("resetBtn").addEventListener("click", () => {
    apply({ type: "reset" }, "Back to the opening triangle.");
  });

  // Classes use CSS tokens, so a theme flip needs no new colours; redraw anyway
  // to keep the picture in step with the site's themechange event.
  board.onTheme(() => draw(Core.compute(state), Core.canvasFlags(state)));

  gateOverlays();
  render();
})();
