"use strict";

/*
 * The page for Archimedes Quadruplets: drawing and input only; the geometry
 * is in archimedes-quadruplets-core.js. Three focusable handles A, C and B sit
 * on the diameter of an arbelos; the four Power circles, the two Archimedes
 * twins, their tangency dots and the construction lines are drawn once and
 * updated in place, so dragging never loses keyboard focus. The status line
 * shows that the four radii and areas always equal the twins'.
 */

(function () {
  const Core = ArchimedesQuadrupletsCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const midBtn = document.getElementById("midBtn");
  const labelsChk = document.getElementById("labelsChk");
  const twinsChk = document.getElementById("twinsChk");
  const linesChk = document.getElementById("linesChk");
  const board = Geom.board(document.getElementById("board"));

  const fills = board.layer("fills");
  const arcs = board.layer("arcs");
  const guides = board.layer("guides");
  const quads = board.layer("quads");
  const twinLayer = board.layer("twins");
  const markers = board.layer("markers");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  /** A filled upper semicircle of radius r, closed along its diameter. */
  function semiShape(cls, layer) {
    const node = board.el("path", null, cls, layer);
    return {
      node: node,
      set: (c, r) => {
        node.setAttribute("d",
          `M ${c.x - r} ${c.y} A ${r} ${r} 0 0 1 ${c.x + r} ${c.y} Z`);
        return node;
      },
    };
  }

  let state = Core.start({});
  const first = Core.geometry(state);

  const bigFill = semiShape("arbelos-big", fills);
  const leftFill = semiShape("arbelos-cut", fills);
  const rightFill = semiShape("arbelos-cut", fills);
  const bigArc = board.arc(first.O, first.r, Math.PI, 2 * Math.PI, "outline", arcs);
  const leftArc = board.arc(first.O1, first.r1, Math.PI, 2 * Math.PI, "outline", arcs);
  const rightArc = board.arc(first.O2, first.r2, Math.PI, 2 * Math.PI, "outline", arcs);

  const diameter = board.segment(first.A, first.B, "diameter", guides);
  const odLine = board.segment(first.O, first.D, "guide", guides);
  const oeLine = board.segment(first.O, first.E, "guide", guides);
  const leftRadius = board.segment(first.D, first.O1, "guide", guides);
  const rightRadius = board.segment(first.E, first.O2, "guide", guides);

  const quadShapes = [0, 1, 2, 3].map(() =>
    board.circle(first.O, first.radius, "quad-circle", quads));
  const twinShapes = [0, 1].map(() =>
    board.circle(first.O, first.radius, "twin-circle", twinLayer));
  const contactDots = [0, 1, 2, 3].map(() =>
    board.point(first.O, "contact-dot", 3, markers));
  const apexDots = [0, 1].map(() => board.point(first.D, "apex-dot", 3, markers));

  const labelA = board.label(first.A, "A", "point-label", -6, 17, labels);
  const labelB = board.label(first.B, "B", "point-label", -2, 17, labels);
  const labelC = board.label(first.C, "C", "point-label", -6, 17, labels);
  const labelD = board.label(first.D, "D", "point-label", -13, -6, labels);
  const labelE = board.label(first.E, "E", "point-label", -13, -6, labels);
  const labelO = board.label(first.O, "O", "point-label", -6, 17, labels);

  /** Keep a dragged or arrow-keyed point on the baseline and in its order. */
  function clampPoint(q, name) {
    const next = Core.setPoint(state, name, q.x);
    const s = Core.start(next);
    return {
      x: name === "A" ? s.ax : name === "B" ? s.bx : s.cx,
      y: Core.BASE_Y,
    };
  }

  function onMove(p, name) {
    state = Core.setPoint(state, name, p.x);
    render();
  }

  const aHandle = board.handle("A", first.A, {
    r: 9, step: 4, shift: 20, layer: handles, clamp: clampPoint, onMove: onMove,
    label: "Point A, the left end of the diameter. Drag it, or focus it and press the arrow keys.",
  });
  const cHandle = board.handle("C", first.C, {
    r: 9, step: 4, shift: 20, layer: handles, clamp: clampPoint, onMove: onMove,
    label: "Point C, where the two small semicircles meet. Drag it, or focus it and press the arrow keys.",
  });
  const bHandle = board.handle("B", first.B, {
    r: 9, step: 4, shift: 20, layer: handles, clamp: clampPoint, onMove: onMove,
    label: "Point B, the right end of the diameter. Drag it, or focus it and press the arrow keys.",
  });

  /**
   * The shared status line. `kind` is "win", "lose" or "done" and tells the
   * player's record a play ended; this is a picture with no win or loss, so
   * the measurements are reported with no kind.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (v) => v.toFixed(1);

  function render() {
    const g = Core.geometry(state);
    const quadsAll = g.left.concat(g.right);
    const contacts = quadsAll.map((o) => o.contact);

    bigFill.set(g.O, g.r);
    leftFill.set(g.O1, g.r1);
    rightFill.set(g.O2, g.r2);
    bigArc.set(g.O, g.r, Math.PI, 2 * Math.PI);
    leftArc.set(g.O1, g.r1, Math.PI, 2 * Math.PI);
    rightArc.set(g.O2, g.r2, Math.PI, 2 * Math.PI);

    diameter.set(g.A, g.B);
    odLine.set(g.O, g.D);
    oeLine.set(g.O, g.E);
    leftRadius.set(g.D, g.O1);
    rightRadius.set(g.E, g.O2);
    guides.style.display = linesChk.checked ? "" : "none";

    quadsAll.forEach((o, i) => quadShapes[i].set(o.center, g.radius));
    contacts.forEach((p, i) => contactDots[i].set(p));
    g.twins.forEach((t, i) => twinShapes[i].set(t.center, t.radius));
    twinLayer.style.display = twinsChk.checked ? "" : "none";
    apexDots[0].set(g.D);
    apexDots[1].set(g.E);

    labelA.set(g.A, "A", -6, 17);
    labelB.set(g.B, "B", -2, 17);
    labelC.set(g.C, "C", -6, 17);
    labelD.set(g.D, "D", -13, -6);
    labelE.set(g.E, "E", -13, -6);
    labelO.set(g.O, "O", -6, 17);
    labels.style.display = labelsChk.checked ? "" : "none";

    aHandle.set(g.A);
    cHandle.set(g.C);
    bHandle.set(g.B);

    say("AC " + fmt(g.a) + ", CB " + fmt(g.b) + ", big radius " + fmt(g.r) +
      ". Archimedes' twins radius " + fmt(g.radius) +
      "; Power's four circles radius " + fmt(g.radius) +
      ", each area " + fmt(g.circleArea) + ".");

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start({});
    render();
  });
  midBtn.addEventListener("click", () => {
    state = Core.setPoint(state, "C", (state.ax + state.bx) / 2);
    render();
  });
  labelsChk.addEventListener("change", render);
  twinsChk.addEventListener("change", render);
  linesChk.addEventListener("change", render);
  board.onTheme(() => render());

  render();
})();
