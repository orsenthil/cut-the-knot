"use strict";

/*
 * The page for Hippocrates: drawing and input only. hippocrates-core.js owns
 * the geometry, the one-unit match test and the fixed-y drag rules. The stage
 * is the applet's picture in SVG: A, C and E are draggable (or arrow-key
 * movable) handles; B is fixed. K is the point 2*AC from E along EA; the
 * puzzle is to slide E until K sits on H. A match is a "done" exploration,
 * not a win: the original applet has no score and no losing move.
 */

(function () {
  const Core = HippocratesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const limit = 6;

  let state = Core.start({});

  /**
   * Shows a line under the picture. "done" is the only kind this illustration
   * ever uses: the player's record reads the class when K has reached H.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Paint order: guides, construction lines, tick marks, arcs, labels, dots. */
  const guides = board.layer("guides");
  const lines = board.layer("lines");
  const marks = board.layer("marks");
  const text = board.layer("text");
  const dots = board.layer("dots");
  const handles = board.layer("handles");

  const circle = board.circle(state.circle, state.radius, "hippo-circle", guides);
  const ab = board.segment(state.A, state.B, "hippo-line", lines);
  const ac = board.segment(state.A, state.C, "hippo-line", lines);
  const af = board.segment(state.A, state.F || state.A, "hippo-line", lines);
  const fe = board.segment(state.F || state.A, state.E, "hippo-line", lines);
  const cd = board.segment(state.C, state.C, "hippo-line", lines);
  const ae = board.segment(state.A, state.E, "hippo-line main-line", lines);
  const extra = [0, 1, 2, 3].map(() => board.segment(state.A, state.A, "hippo-line extra", lines));
  const ticks = [0, 1, 2].map(() => board.segment(state.A, state.A, "hippo-tick", marks));
  const rightMark = board.rightAngle(state.C, state.E, state.C, 10, "hippo-right", marks);
  const arcBig = board.angleArc(state.A, state.B, state.C, 26, "hippo-arc", marks);
  const arcSmall = board.angleArc(state.A, state.B, state.E, 16, "hippo-arc small-arc", marks);
  const arcHint = board.angleArc(state.A, state.C, state.E, 34, "hippo-arc hint-arc", marks);

  const dotB = board.point(state.B, "hippo-dot", 3.5, dots);
  const dotF = board.point(state.C, "hippo-dot", 3.5, dots);
  const dotD = board.point(state.C, "hippo-dot", 3.5, dots);
  const dotG = board.point(state.C, "hippo-dot", 3.5, dots);
  const dotK = board.point(state.C, "hippo-dot special", 5, dots);
  const dotH = board.point(state.C, "hippo-dot special", 5, dots);

  const names = {};
  ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((name) => {
    names[name] = board.label(state.A, name, "hippo-label", name === "B" ? -16 : 8,
      name === "B" ? 18 : -8, text);
  });

  const clampA = (q) => ({ x: Geom.clamp(q.x, limit, state.width - limit), y: state.A.y });
  const clampE = (q) => ({ x: Geom.clamp(q.x, limit, state.width - limit), y: state.E.y });
  const clampC = (q) => ({
    x: Geom.clamp(q.x, limit, state.width - limit),
    y: Geom.clamp(q.y, limit, state.height - limit),
  });

  const aHandle = board.handle("A", state.A, {
    r: 9, step: 1, shift: 5, cls: "geom-handle", layer: handles,
    label: "Point A, left end of the bottom line. Drag it sideways, or focus it and use the left and right arrow keys.",
    describe: (p) => `at ${Math.round(p.x)} across; its height stays fixed`,
    clamp: clampA,
    onMove: (p) => { state = Core.move(state, "A", p); render(); },
  });
  const cHandle = board.handle("C", state.C, {
    r: 9, step: 1, shift: 5, cls: "geom-handle", layer: handles,
    label: "Point C, above the bottom line. Drag it, or focus it and use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    clamp: clampC,
    onMove: (p) => { state = Core.move(state, "C", p); render(); },
  });
  const eHandle = board.handle("E", state.E, {
    r: 9, step: 1, shift: 5, cls: "geom-handle", layer: handles,
    label: "Point E on the top line. Drag it sideways, or focus it and use the left and right arrow keys to slide it towards point H.",
    describe: (p) => `at ${Math.round(p.x)} across; its height follows point C`,
    clamp: clampE,
    onMove: (p) => { state = Core.move(state, "E", p); render(); },
  });

  /** One small crossbar at the middle of a segment, like the applet's marks. */
  function tick(p, q, size) {
    const m = Core.midPoint(p, q);
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * size, ny = (dx / len) * size;
    return [{ x: m.x - nx, y: m.y - ny }, { x: m.x + nx, y: m.y + ny }];
  }

  function setTick(node, p, q) {
    const ends = tick(p, q, 5);
    node.set(ends[0], ends[1]);
    node.show(!!p && !!q && Number.isFinite(p.x) && Number.isFinite(q.x) &&
      Number.isFinite(p.y) && Number.isFinite(q.y));
  }

  function render() {
    const sh = Core.compute(state);
    const { A, B, C, E } = state;
    const D = sh.D, F = sh.F, H = sh.H, K = sh.K, G = sh.G;
    const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

    circle.set(state.circle, state.radius);
    ab.set(A, B);
    ac.set(A, C);
    af.set(A, F);
    fe.set(F, E);
    if (finite(D)) cd.set(C, D);
    const mirrored = C.x < A.x;
    ae.show(!mirrored);
    if (!mirrored) ae.set(A, E);
    const legs = [
      [C, E], [C, H], [H, E], [A, D],
    ];
    extra.forEach((node, i) => {
      node.show(mirrored && finite(legs[i][1]));
      if (mirrored && finite(legs[i][1])) node.set(legs[i][0], legs[i][1]);
    });

    setTick(ticks[0], A, C);
    setTick(ticks[1], K, G);
    setTick(ticks[2], G, E);
    rightMark.show(finite(D) && finite(E));
    if (finite(D) && finite(E)) rightMark.set(C, E, D, 10);

    arcBig.set(A, B, C, 26);
    arcBig.show(Number.isFinite(sh.BAC));
    arcSmall.set(A, B, E, 16);
    arcSmall.show(sh.solved);
    arcHint.set(A, C, E, 34);
    arcHint.show(sh.solved && state.showHint);

    dotB.set(B, 3.5);
    dotF.set(F, 3.5);
    dotD.set(D, 3.5);
    dotG.set(G, 3.5);
    dotK.set(K, 5);
    dotH.set(H, 5);
    dotF.show(finite(F));
    dotD.show(finite(D));
    dotG.show(finite(G) && (state.showHint || sh.solved));
    dotK.show(finite(K));
    dotH.show(finite(H));
    dotK.node.classList.toggle("matched", sh.solved);
    dotH.node.classList.toggle("matched", sh.solved);

    const labelled = {
      A: true, B: true, C: true, D: state.showNames,
      E: true, F: state.showNames, G: state.showHint, H: true,
    };
    Object.keys(names).forEach((name) => {
      const at = { A, B, C, D, E, F, G, H }[name];
      names[name].show(labelled[name] && finite(at));
      if (labelled[name] && finite(at)) names[name].set(at, name);
    });

    aHandle.set(A);
    cHandle.set(C);
    eHandle.set(E);
    hintBox.disabled = !state.hintEnabled;
    hintBox.checked = state.hint;
    namesBox.checked = state.showNames;

    say(Core.describe(state, sh), sh.solved ? "done" : "");
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  newBtn.addEventListener("click", () => {
    state = Core.start({ showNames: state.showNames });
    render();
  });
  namesBox.addEventListener("change", () => {
    if (namesBox.checked !== state.showNames) state = Core.toggleNames(state);
    render();
  });
  hintBox.addEventListener("change", () => {
    if (hintBox.checked !== state.hint) state = Core.toggleHint(state);
    render();
  });

  board.onTheme(render);
  render();
})();
