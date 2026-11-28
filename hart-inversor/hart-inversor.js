"use strict";

/*
 * The page for Hart's Inversor: drawing and input only. The linkage geometry
 * lives in hart-inversor-core.js. An SVG board shows the four rods (AB, BC,
 * CD, AD), the guide circle with centre S through O and P, the traced arc of
 * P and the straight line traced by Q; Geom handles let a pointer or the arrow
 * keys move A, B, D, O, P or S. Colours come only from the site's CSS tokens.
 */

(function () {
  const Core = HartInversorCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    guides: board.layer("guides"),
    trail: board.layer("trail"),
    rods: board.layer("rods"),
    marks: board.layer("marks"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);

  /** The record learns "explored" from the "done" class on #status. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* ------------------------------------------------------ drawn objects */

  const rods = {
    ab: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "rod rod-short", layers.rods),
    bd: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "rod rod-long", layers.rods),
    dc: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "rod rod-short", layers.rods),
    ca: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "rod rod-long", layers.rods),
    sp: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "pivot-rod", layers.rods),
  };
  const guides = {
    circle: board.circle({ x: 0, y: 0 }, 1, "guide-circle", layers.guides),
    sLine: board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "guide-line", layers.guides),
    inverse: board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "inverse-line", layers.guides),
    ae: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "helper-line", layers.guides),
    ef: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "helper-line", layers.guides),
    fc: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "helper-line", layers.guides),
  };
  const qDot = board.point({ x: 0, y: 0 }, "q-point", 5, layers.marks);
  const eDot = board.point({ x: 0, y: 0 }, "helper-point", 4, layers.marks);
  const fDot = board.point({ x: 0, y: 0 }, "helper-point", 4, layers.marks);
  const labelNames = ["A", "B", "C", "D", "O", "P", "Q", "S", "E", "F"];
  const labels = {};
  const labelOffsets = {
    A: [-15, -10], B: [7, -9], C: [8, -8], D: [7, -8], O: [6, -9],
    P: [-15, -9], Q: [7, -9], S: [7, 16], E: [-13, 15], F: [7, 15],
  };
  for (const name of labelNames) {
    const off = labelOffsets[name];
    labels[name] = board.label({ x: 0, y: 0 }, name, "point-label", off[0], off[1], layers.labels);
  }

  const traceSegs = [], traceDots = [];
  function poolTrace(n) {
    while (traceSegs.length < n) {
      traceSegs.push(board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "trace-line", layers.trail));
    }
    while (traceDots.length < n + 1) {
      traceDots.push(board.point({ x: 0, y: 0 }, "trace-dot", 3, layers.trail));
    }
    traceSegs.forEach((s, i) => s.show(i < n));
    traceDots.forEach((d, i) => d.show(i <= n));
  }

  const handleNames = ["A", "B", "D", "O", "P", "S"];
  const handles = {};
  for (const name of handleNames) {
    const noun = { A: "corner A", B: "corner B", D: "corner D", O: "divider O",
      P: "divider P", S: "pivot S" }[name];
    handles[name] = board.handle(name, state[name], {
      r: 10,
      step: 4,
      cls: "geom-handle joint-handle" + (name === "S" ? " pivot-handle" : ""),
      layer: layers.handles,
      label: noun + ". Drag it, or focus it and press the arrow keys to move it.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      onMove: (p, which) => apply({ type: "point", which: which, point: p },
        "Moved " + noun + " to (" + Math.round(p.x) + ", " + Math.round(p.y) + ")."),
    });
  }

  /* ------------------------------------------------------------- drawing */

  function draw() {
    geometry = Core.compute(state);
    const g = geometry;

    rods.ab.set(g.A, g.B);
    rods.bd.set(g.B, g.D);
    rods.dc.set(g.D, g.C);
    rods.ca.set(g.C, g.A);
    rods.sp.set(g.S, g.P);

    guides.circle.set(g.S, g.c);
    guides.sLine.set(g.sLine.a, g.sLine.b);
    guides.inverse.set(g.inverseLine.a, g.inverseLine.b);
    guides.ae.set(g.A, g.E);
    guides.ef.set(g.E, g.F);
    guides.fc.set(g.F, g.C);
    for (const key of ["ae", "ef", "fc"]) guides[key].show(state.showExtra);

    qDot.set(g.Q, 5);
    eDot.set(g.E, 4).show(state.showExtra);
    fDot.set(g.F, 4).show(state.showExtra);

    const points = { A: g.A, B: g.B, C: g.C, D: g.D, O: g.O, P: g.P,
      Q: g.Q, S: g.S, E: g.E, F: g.F };
    for (const name of labelNames) {
      const show = state.showNames && (name !== "E" && name !== "F" || state.showExtra);
      labels[name].set(points[name], name).show(show);
    }

    const qs = g.traceQ.slice(-120);
    poolTrace(Math.max(0, qs.length - 1));
    for (let i = 1; i < qs.length; i++) traceSegs[i - 1].set(qs[i - 1], qs[i]);
    g.traceP.slice(-120).forEach((p, i) => traceDots[i].set(p, 3));

    for (const name of handleNames) handles[name].set(g[name]);
  }

  function statusText(g) {
    if (!g.eligible) {
      return "The rods cannot reach that point. Tracing has stopped; move P back into the arc already drawn.";
    }
    const product = Math.round(g.op * g.oq);
    return "m = " + state.r.toFixed(2) + ". OP × OQ = " + Math.round(g.op) + " × " +
      Math.round(g.oq) + " = " + product + " = m(1−m)(AD²−AB²). SP = SO = " +
      Math.round(g.so) + ", so P's circle turns into Q's straight line." +
      (state.showExtra ? " E and F are the feet of the perpendiculars to BD." : "");
  }

  /** Redraw, speak what happened and save the position for the record/tutor. */
  function render() {
    draw();
    say(statusText(geometry), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one move; a refused drag restores the handles to the last position. */
  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) {
      for (const name of handleNames) handles[name].set(geometry[name]);
      say("That move is not possible here.");
      return false;
    }
    state = next;
    render();
    if (note) say(note + " " + statusText(geometry), Core.result(state));
    return true;
  }

  const namesBox = document.getElementById("showNames");
  const extraBox = document.getElementById("showExtra");
  namesBox.checked = state.showNames;
  extraBox.checked = state.showExtra;
  namesBox.addEventListener("change", () =>
    apply({ type: "option", key: "showNames", value: namesBox.checked }));
  extraBox.addEventListener("change", () =>
    apply({ type: "option", key: "showExtra", value: extraBox.checked }));

  document.getElementById("resetBtn").addEventListener("click", () =>
    apply({ type: "reset" }, "Back to the opening linkage."));
  document.getElementById("clearBtn").addEventListener("click", () =>
    apply({ type: "clearTrace" }, "Cleared the traced arc and line."));

  // Class-styled SVG needs no colour work on a theme flip, but recompute the
  // picture so the shared hook is used exactly like the other geom ports.
  board.onTheme(() => draw());

  render();
})();
