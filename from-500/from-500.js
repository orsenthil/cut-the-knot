"use strict";

/*
 * The page for From 500: drawing and input only. The construction is in
 * from-500-core.js. An SVG board holds the semicircle, its diameter AB, the
 * tangents at A, X and B, the two secants through X, and the line YZ. O and X
 * are draggable Geom handles; the two checkboxes are the applet's "Show names"
 * and "Show hint" switches. The arc follows X to the side of AB where the
 * player put it, as the cut-the-knot page's AXB describes.
 */

(function () {
  const Core = From500Core;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    base: board.layer("base"),
    secants: board.layer("secants"),
    tangents: board.layer("tangents"),
    hint: board.layer("hint"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geom = Core.compute(state);

  /** The status line. "done" is how a demo tells the player's record that it
   *  has been explored; there is no win or loss in this picture. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const diameter = board.segment(geom.A, geom.B, "diameter", layers.base);
  const arc = board.arc(geom.O, geom.r, Math.PI, 2 * Math.PI, "semicircle", layers.base);
  const tangentA = board.line(geom.TA.p, geom.TA.q, "tangent", layers.tangents);
  const tangentB = board.line(geom.TB.p, geom.TB.q, "tangent", layers.tangents);
  const tangentX = board.line(geom.TX.p, geom.TX.q, "tangent-x", layers.tangents);
  const secantA = board.line(geom.XA.p, geom.XA.q, "secant", layers.secants);
  const secantB = board.line(geom.XB.p, geom.XB.q, "secant", layers.secants);
  const yz = board.line(geom.YZ.p, geom.YZ.q, "meeting-line", layers.tangents);

  // LineID(2,4,4) in the applet marks AU, UY and UX with 2, 4 and 4 slashes.
  const tickSpecs = [
    { from: "A", to: "U", count: 2 },
    { from: "U", to: "Y", count: 4 },
    { from: "U", to: "X", count: 4 },
  ];
  const ticks = tickSpecs.flatMap((spec) =>
    Array.from({ length: spec.count }, () => board.segment(geom.A, geom.B, "hint-mark", layers.hint)));

  const dotU = board.point(geom.U, "aux-dot", 4, layers.dots);
  const dotV = board.point(geom.V, "aux-dot", 4, layers.dots);
  const dotY = board.point(geom.Y, "aux-dot", 4, layers.dots);
  const dotZ = board.point(geom.Z, "aux-dot", 4, layers.dots);
  const dotP = board.point(geom.O, "meet-dot", 5, layers.dots);

  const labelOffsets = {
    A: [-14, 17], B: [7, 17], O: [-7, -12], X: [8, -8],
    Y: [-15, -8], Z: [8, -8], U: [-16, -8], V: [8, -8], P: [8, -10],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(geom.O, name, "geom-label point-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  const clampToBoard = (p) => Core.clampToBoard(p);
  const handles = {};
  for (const name of Core.HANDLES) {
    handles[name] = board.handle(name, state[name], {
      r: 11,
      step: 4,
      shift: 5,
      layer: layers.handles,
      label: name === "O"
        ? "Point O, the centre. Drag it, or focus it and use the arrow keys to move the circle"
        : "Point X on the circle. Drag it, or focus it and use the arrow keys to move it around the circle",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: (p) => {
        const q = clampToBoard(p);
        return name === "X" ? clampToBoard(Core.clampRadius(q, state.O, Core.MIN_RADIUS))
          : clampToBoard(Core.clampRadius(state.X, q, Core.MIN_RADIUS));
      },
      onMove: (p, which) => apply({ type: "point", name: which, point: p },
        which === "O" ? "Centre moved." : "X moved."),
    });
  }

  /** The width-4 slash marks of the applet's LineID(2,4,4). */
  function setTicks(g) {
    let i = 0;
    for (const spec of tickSpecs) {
      const p = g[spec.from], q = g[spec.to];
      const usable = Core.finite(p) && Core.finite(q) && Core.dist(p, q) > 1e-6;
      for (let k = 0; k < spec.count; k++) {
        const mark = ticks[i++];
        if (!usable) { mark.show(false); continue; }
        const along = Core.sub(q, p);
        const u = { x: along.x / Core.dist(p, q), y: along.y / Core.dist(p, q) };
        const n = { x: -u.y * 4, y: u.x * 4 };
        const at = Core.add(p, Core.mul(along, (k + 1) / (spec.count + 1)));
        mark.set(Core.add(at, n), Core.sub(at, n)).show(true);
      }
    }
  }

  function show(shape, on) { shape.show(on); return shape; }

  function draw(g) {
    for (const name of Core.HANDLES) handles[name].set(state[name]);
    if (!Core.finite(g.O) || !Core.finite(g.X) || !Number.isFinite(g.r)) return;

    diameter.set(g.A, g.B).show(true);
    // The Java applet always drew the lower half with drawArc(0,180) even
    // though X starts above AB; the page says AXB is the semicircle, so the
    // arc here is the half that actually contains X.
    const above = g.X.y <= g.O.y;
    arc.set(g.O, g.r, above ? Math.PI : 0, above ? 2 * Math.PI : Math.PI).show(true);
    tangentA.set(g.TA.p, g.TA.q).show(true);
    tangentB.set(g.TB.p, g.TB.q).show(true);
    tangentX.set(g.TX.p, g.TX.q).show(true);
    show(secantA, g.valid);
    show(secantB, g.valid);
    if (g.valid) {
      secantA.set(g.XA.p, g.XA.q);
      secantB.set(g.XB.p, g.XB.q);
    }
    show(yz, g.valid);
    if (g.valid) yz.set(g.Y, g.Z);

    for (const dot of [dotU, dotV, dotY, dotZ]) show(dot, g.valid);
    if (g.valid) {
      dotU.set(g.U); dotV.set(g.V); dotY.set(g.Y); dotZ.set(g.Z);
    }
    show(dotP, g.valid && !g.parallel);
    if (g.valid && !g.parallel) dotP.set(g.P);

    if (state.showHint && g.valid) setTicks(g);
    else for (const mark of ticks) show(mark, false);

    const at = { A: g.A, B: g.B, O: g.O, X: g.X, U: g.U, V: g.V, Y: g.Y, Z: g.Z, P: g.P };
    for (const name of Object.keys(labels)) {
      const always = name === "O" || name === "X";
      const use = state.showNames && (always || (g.valid && (name !== "P" || !g.parallel)));
      const here = at[name];
      // Never write NaN coordinates to an SVG attribute, even on a hidden
      // label: browsers report that as a console error.
      if (Core.finite(here)) labels[name].set(here);
      labels[name].show(use && Core.finite(here));
    }
  }

  function statusText(g) {
    if (!Core.finite(g.O) || !g.valid) {
      return "Move X off the diameter AB so the two crossing lines can be drawn.";
    }
    if (g.parallel) {
      return "X is halfway along the arc: the tangent at X, YZ and AB are parallel, so they never meet.";
    }
    const p = `The tangent at X, YZ and AB all meet at P (${Math.round(g.P.x)}, ${Math.round(g.P.y)}).`;
    if (!state.showHint) return p + " Tick Show hint to see the equal-length marks.";
    return p + " U is halfway from A to Y and V from B to Z, so the three marked lengths at each of U and V are equal.";
  }

  /** Redraw, speak the status and save the position for the player's record. */
  function render(note) {
    geom = Core.compute(state);
    draw(geom);
    say((note ? note + " " : "") + statusText(geom), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; an illegal one leaves the picture as it was. */
  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) {
      say("That spot is not allowed.");
      return false;
    }
    state = next;
    render(note);
    return true;
  }

  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  for (const [box, key, label] of [
    [namesBox, "showNames", "names"],
    [hintBox, "showHint", "the equal-length marks"],
  ]) {
    box.checked = state[key];
    box.addEventListener("change", () => apply({ type: "option", key, value: box.checked },
      box.checked ? "Showing " + label + "." : "Hid " + label + "."));
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    apply({ type: "reset" }, "Back to the opening circle.");
  });

  // Class colours follow the site's theme; redraw anyway to keep the picture
  // and the status in step with a theme flip.
  board.onTheme(() => draw(Core.compute(state)));

  render();
})();
