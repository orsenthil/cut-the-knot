"use strict";

/*
 * The page for Euler and Fermat: drawing and input only; the geometry is in
 * euler-and-fermat-core.js. An SVG holds triangle ABC with three draggable
 * corners, the two Napoleon triangles, the two Fermat points and the three
 * Euler lines through the centroid G. The two checkboxes are the applet's
 * "names" and "special angles" boxes; both start unchecked.
 */

(function () {
  const Core = EulerAndFermatCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBox = document.getElementById("showNames");
  const anglesBox = document.getElementById("showAngles");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 12, view.x + view.width - 12),
    y: Geom.clamp(p.y, view.y + 12, view.y + view.height - 12),
  });
  const ok = (p) => Core.finite(p);

  let state = Core.start();
  const initial = Core.measure(state); // finite placeholders for the SVG objects

  const fillsLayer = board.layer("fills");
  const guidesLayer = board.layer("guides");
  const linesLayer = board.layer("lines");
  const dotsLayer = board.layer("dots");
  const anglesLayer = board.layer("angles");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  function polygon(points, cls) {
    return board.polygon(points, cls, fillsLayer);
  }
  function line(cls, layer) {
    return board.line(state.A, state.B, cls, layer || linesLayer);
  }
  function segment(cls, layer) {
    return board.segment(state.A, state.B, cls, layer || guidesLayer);
  }
  function dot(cls, r) {
    return board.point(state.A, cls, r, dotsLayer);
  }
  function label(text, dx, dy, cls) {
    return board.label(state.A, text, cls || "point-label", dx, dy, labelsLayer);
  }
  function setLine(shape, p, q, on) {
    if (ok(p) && ok(q)) { shape.set(p, q); shape.show(Boolean(on)); }
    else shape.show(false);
  }
  function setDot(shape, p, on) {
    if (ok(p)) { shape.set(p); shape.show(Boolean(on)); }
    else shape.show(false);
  }
  function setLabel(shape, p, text, on) {
    if (ok(p)) { shape.set(p, text); shape.show(Boolean(on)); }
    else shape.show(false);
  }

  /* The shaded triangles and the original ABC. */
  const outerFill = polygon([initial.Aq, initial.Bq, initial.Cq], "napoleon-fill outer");
  const innerFill = polygon([initial.aq, initial.bq, initial.cq], "napoleon-fill inner");
  const fermatFill = polygon([initial.C, initial.F, initial.f], "fermat-fill");
  const sides = [segment("abc-side"), segment("abc-side"), segment("abc-side")];
  const outerEdges = [segment("napoleon-edge outer"), segment("napoleon-edge outer"), segment("napoleon-edge outer")];
  const innerEdges = [segment("napoleon-edge inner"), segment("napoleon-edge inner"), segment("napoleon-edge inner")];

  /* The three Euler lines through G are the point of the picture. */
  const eulerLines = [line("euler-line"), line("euler-line"), line("euler-line")];
  const parallels = [line("guide-line"), line("guide-line"), line("guide-line")];
  const cevians = [line("cevian-line"), line("cevian-line")];

  /* Every dot the applet shows, split into the key points and the helpers. */
  const dotNames = ["G", "Gp", "O", "P", "F", "f", "Aq", "Bq", "Cq",
    "aq", "bq", "cq", "Cm", "fm", "Fp"];
  const dots = {};
  for (const name of dotNames) {
    dots[name] = dot(name === "G" || name === "Gp" || name === "O" || name === "P"
      ? "key-dot" : "aux-dot", name === "G" ? 6.5 : 5);
  }

  /* The five angle marks the "special angles" box adds in the applet. */
  const angleSpecs = [
    ["G", "Bq", "O"], ["aq", "Bq", "O"], ["cq", "Cq", "P"],
    ["Fp", "A", "f"], ["B", "f", "A"],
  ];
  const angleArcs = angleSpecs.map(() => board.angleArc(initial.G, initial.Bq, initial.O, 14, "angle-arc", anglesLayer));
  const angleTexts = angleSpecs.map(() => label("", 17, -11, "angle-label"));

  const labelSpecs = [
    ["A", "A", -18, 22], ["B", "B", -18, -10], ["C", "C", 10, 4],
    ["Aq", "A\u2032", 8, -8], ["Bq", "B\u2032", 8, -8], ["Cq", "C\u2032", 8, -8],
    ["aq", "a\u2032", 9, 15], ["bq", "b\u2032", -20, -10], ["cq", "c\u2032", 8, -8],
    ["G", "G", -17, -9], ["Gp", "G\u2032", 8, -8], ["Cm", "M", -18, 20],
    ["F", "F", -18, -9], ["f", "f", 8, -8], ["fm", "m", 8, 16],
    ["Fp", "F\u2032", 8, -8], ["P", "P", 8, -8], ["O", "O", -18, -9],
  ];
  const pointLabels = labelSpecs.map(([key, text, dx, dy]) => ({ key: key, text: text, node: label(text, dx, dy) }));

  /** Status line under the board. An illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measure(state);
    const usable = m.G && ok(m.F) && ok(m.f) && ok(m.O);

    function setPoly(shape, points, on) {
      if (points.every(ok)) { shape.set(points); shape.show(Boolean(on)); }
      else shape.show(false);
    }
    setPoly(outerFill, [m.Aq, m.Bq, m.Cq], true);
    setPoly(innerFill, [m.aq, m.bq, m.cq], true);
    setPoly(fermatFill, [m.C, m.F, m.f], true);

    setLine(sides[0], m.A, m.B, true);
    setLine(sides[1], m.B, m.C, true);
    setLine(sides[2], m.C, m.A, true);
    setLine(outerEdges[0], m.Aq, m.Bq, true);
    setLine(outerEdges[1], m.Bq, m.Cq, true);
    setLine(outerEdges[2], m.Cq, m.Aq, true);
    setLine(innerEdges[0], m.aq, m.bq, true);
    setLine(innerEdges[1], m.bq, m.cq, true);
    setLine(innerEdges[2], m.cq, m.aq, true);

    const eulers = [m.eulerA, m.eulerB, m.eulerC];
    for (let i = 0; i < 3; i++) {
      const e = eulers[i];
      setLine(eulerLines[i], e.center, e.circum, usable);
    }
    setLine(parallels[0], m.G, m.P, usable);
    setLine(parallels[1], m.Cm, m.fm, usable);
    setLine(parallels[2], m.Fp, m.f, usable);
    setLine(cevians[0], m.F, m.A, usable);
    setLine(cevians[1], m.F, m.B, usable);

    for (const name of dotNames) setDot(dots[name], m[name], usable);
    for (const spec of pointLabels) {
      setLabel(spec.node, m[spec.key], spec.text, state.showNames && usable && ok(m[spec.key]));
    }

    for (let i = 0; i < angleSpecs.length; i++) {
      const [a, b, c] = angleSpecs[i].map((key) => m[key]);
      const on = state.showAngles && usable && ok(a) && ok(b) && ok(c);
      if (on) {
        angleArcs[i].set(a, b, c, 14);
        angleTexts[i].set(a, `${Math.round(Core.angle(a, b, c) * 180 / Math.PI)}\u00b0`);
      }
      angleArcs[i].show(on);
      angleTexts[i].show(on);
    }

    namesBox.checked = state.showNames;
    anglesBox.checked = state.showAngles;
    if (!usable) {
      say("Those corners make the construction collapse. Drag one away to see the lines.", null);
    } else {
      const scale = Math.max(Core.distance(m.A, m.B), Core.distance(m.B, m.C), Core.distance(m.C, m.A));
      const err = Math.max(...eulers.map((e) => Math.abs(e.cross))) / (scale * scale);
      say(`The three drawn Euler lines pass through G (largest offset ${err.toExponential(1)} board units).`, null);
    }
    /* The position, for the player's record and the tutor. */
    if (window.Track) window.Track.state(state);
  }

  const handleOpts = (name) => ({
    r: 9, step: 4, shift: 14, layer: handlesLayer, clamp: inside,
    label: `Corner ${name}. Drag it, or focus it and use the arrow keys to move it.`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => {
      state = Core.withPoint(state, name, p);
      render();
    },
  });
  const hA = board.handle("A", state.A, handleOpts("A"));
  const hB = board.handle("B", state.B, handleOpts("B"));
  const hC = board.handle("C", state.C, handleOpts("C"));

  function reset() {
    state = Core.start();
    render();
    hA.node.focus();
  }
  newBtn.addEventListener("click", reset);
  namesBox.addEventListener("change", (e) => {
    state = Core.withOptions(state, { showNames: e.target.checked });
    render();
  });
  anglesBox.addEventListener("change", (e) => {
    state = Core.withOptions(state, { showAngles: e.target.checked });
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|BUTTON|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "1") hA.node.focus();
    if (e.key === "2") hB.node.focus();
    if (e.key === "3") hC.node.focus();
  });

  board.onTheme(render);
  render();
})();
