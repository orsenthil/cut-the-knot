"use strict";

/*
 * The page for Euler Line Simple: drawing and input only. The geometry lives
 * in euler-line-simple-core.js. An SVG board holds the triangle, its
 * circumcircle, the Euler line through O, G and H, and — with Hint on — one
 * of the three parallelograms from Nikolin's proof. The three corners are
 * Geom handles, so a pointer or the arrow keys can move them. Five checkboxes
 * and three Highlight buttons reproduce the applet's switches and the way it
 * picks a vertex; Reset brings back the opening picture.
 */

(function () {
  const Core = EulerLineSimpleCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    fills: board.layer("fills"),
    guides: board.layer("guides"),
    circle: board.layer("circle"),
    euler: board.layer("euler"),
    triangle: board.layer("triangle"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);

  /** Status line; "done" tells the player's record that the demo was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const here = { x: 180, y: 120 };
  const parallelogram = board.polygon([here, here, here, here], "parallelogram", layers.fills);
  const circum = board.circle(here, 60, "circumcircle", layers.circle);
  const euler = board.line(here, here, "eulerline", layers.euler);
  const triangle = board.polygon([state.A, state.B, state.C], "triangle", layers.triangle);

  const bisectors = Core.NAMES.map(() => board.line(here, here, "bisector", layers.guides));
  const medians = Core.NAMES.map(() => board.line(here, here, "median", layers.guides));
  const altitudes = Core.NAMES.map(() => board.line(here, here, "altitude", layers.guides));
  const altitudeParts = Core.NAMES.map(() => board.line(here, here, "altitude-part", layers.guides));
  const spokes = Core.NAMES.map(() => board.segment(here, here, "spoke", layers.guides));
  const vertexToH = Core.NAMES.map(() => board.line(here, here, "hintline", layers.guides));
  const hintMedian = board.line(here, here, "hint-median", layers.guides);
  const hintDiagonal = board.line(here, here, "hint-diagonal", layers.guides);

  const centerDot = board.point(here, "centerdot", 3.5, layers.dots);
  const gDot = board.point(here, "centroiddot", 4, layers.dots);
  const hDot = board.point(here, "orthodot", 4.5, layers.dots);
  const footDots = Core.NAMES.map(() => board.point(here, "footdot", 3, layers.dots));
  const midDots = Core.NAMES.map(() => board.point(here, "middot", 3.5, layers.dots));
  const antiDots = Core.NAMES.map(() => board.point(here, "antidot", 4, layers.dots));

  const labelOffsets = {
    A: [-5, -11], B: [-12, 16], C: [8, 4], H: [7, -8], G: [7, 15], O: [7, -8],
    Ma: [-16, 16], Mb: [7, -8], Mc: [-17, -8], D: [7, -7], E: [7, -7], F: [7, -7],
    Ha: [7, 14], Hb: [7, 14], Hc: [7, 14],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(here, name, "geom-label point-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, state[name], {
      r: 10,
      step: 3,
      cls: "geom-handle corner-handle",
      layer: layers.handles,
      label: "Corner " + name + ". Drag it, or focus it and use the arrow keys to move it.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: (q, which) => {
        const inside = Core.clampPoint(q);
        return Core.NAMES.some((other) => other !== which && Core.dist(inside, state[other]) < 12)
          ? state[which] : inside;
      },
      onMove: (p, which) => apply({ type: "point", name: which, point: p },
        "Moved corner " + which + " to (" + Math.round(p.x) + ", " + Math.round(p.y) + ")."),
    });
  }

  function statusText(g) {
    if (g.degenerate) return "Move the corners apart: the circle and the Euler line need a real triangle.";
    const chosen = state.selected;
    if (!chosen) return "Drag a corner, or press Highlight A, B or C, to see one of the parallelograms.";
    const others = Core.NAMES.filter((n) => n !== chosen).join(" and ");
    const anti = Core.ANTIPODE[chosen], mid = Core.MIDPOINT[chosen];
    if (!state.showHint) {
      return chosen + " is chosen. Tick Hint to show the parallelogram made by "
        + others + ", H and " + anti + ".";
    }
    return others + ", H and " + anti + " make a parallelogram; its diagonals meet at " + mid
      + ". H, G and O are in a straight line, with GH twice GO.";
  }

  function show(shape, on) { shape.show(on); return shape; }
  function showLabel(name, on) { labels[name].show(on && state.showNames); }

  function draw() {
    geometry = Core.compute(state);
    triangle.set([state.A, state.B, state.C]);
    for (const name of Core.NAMES) handles[name].set(state[name]);
    for (const name of Object.keys(labels)) showLabel(name, false);

    const g = geometry;
    if (g.degenerate) {
      for (const shape of [parallelogram, circum, euler, centerDot, gDot, hDot, hintMedian, hintDiagonal,
        ...bisectors, ...medians, ...altitudes, ...altitudeParts, ...spokes, ...vertexToH,
        ...footDots, ...midDots, ...antiDots]) show(shape, false);
      for (const name of Core.NAMES) showLabel(name, true);
      return;
    }

    const pts = { A: state.A, B: state.B, C: state.C };
    circum.set(g.O, g.r).show(true);
    centerDot.set(g.O).show(true);
    gDot.set(g.G).show(true);
    hDot.set(g.H).show(true);
    euler.set(g.O, g.H).show(Core.dist(g.O, g.H) > 1e-6);

    for (let i = 0; i < Core.NAMES.length; i++) {
      const name = Core.NAMES[i];
      const chosen = state.selected === name;
      const anti = g.antipodes[name], mid = g.midpoints[name];

      bisectors[i].set(mid, g.O).show(state.showBisectors);
      medians[i].set(pts[name], mid).show(state.showMedians);
      altitudes[i].set(pts[name], g.feet[name]).show(state.showAltitudes);
      altitudeParts[i].set(g.feet[name], g.H).show(state.showAltitudes);
      footDots[i].set(g.feet[name]).show(state.showAltitudes);
      midDots[i].set(mid).show(state.showHint && chosen);
      antiDots[i].set(anti).show(state.showHint && chosen);
      spokes[i].set(pts[name], anti).show(state.showHint && chosen);
      vertexToH[i].set(pts[name], g.H).show(state.showHint);
      showLabel(["Ma", "Mb", "Mc"][i], state.showHint && chosen);
      showLabel(["D", "E", "F"][i], state.showHint && chosen);
      showLabel(["Ha", "Hb", "Hc"][i], state.showAltitudes);
    }

    if (state.showHint && state.selected) {
      const n = state.selected;
      // Same four points as the applet's FillPoly, in the order of the page's
      // proof: A,F,B,H for vertex C (the other two are the same parallelogram).
      const order = {
        A: [state.B, g.D, state.C, g.H],
        B: [state.C, g.E, state.A, g.H],
        C: [state.A, g.F, state.B, g.H],
      }[n];
      parallelogram.set(order).show(true);
      // The page's C/Mc median: the applet draws A-Ma here, a copy-paste slip.
      hintMedian.set(pts[n], g.midpoints[n]).show(true);
      hintDiagonal.set(g.antipodes[n], g.H).show(true);
    } else {
      show(parallelogram, false);
      show(hintMedian, false);
      show(hintDiagonal, false);
    }

    showLabel("A", true); showLabel("B", true); showLabel("C", true);
    showLabel("H", true); showLabel("G", true); showLabel("O", true);
    const all = {
      A: state.A, B: state.B, C: state.C, H: g.H, G: g.G, O: g.O,
      Ma: g.Ma, Mb: g.Mb, Mc: g.Mc, D: g.D, E: g.E, F: g.F,
      Ha: g.Ha, Hb: g.Hb, Hc: g.Hc,
    };
    for (const name of Object.keys(labels)) labels[name].set(all[name]);
  }

  /** Redraw, speak the result, and save the position for the player's record. */
  function render() {
    draw();
    say(statusText(geometry), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; an illegal one leaves the picture as it was. */
  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) {
      if (m.type === "point") handles[m.name].set(state[m.name]);
      say("That spot is too close to another corner.");
      return false;
    }
    state = next;
    render();
    if (note) say(note, Core.result(state));
    return true;
  }

  const checkboxes = {
    showAltitudes: document.getElementById("altitudesBox"),
    showMedians: document.getElementById("mediansBox"),
    showBisectors: document.getElementById("bisectorsBox"),
    showHint: document.getElementById("hintBox"),
    showNames: document.getElementById("namesBox"),
  };
  for (const key of Object.keys(checkboxes)) {
    const box = checkboxes[key];
    box.checked = state[key];
    box.addEventListener("change", () => apply({ type: "option", key, value: box.checked },
      box.checked ? "Showing " + box.dataset.label + "." : "Hid " + box.dataset.label + "."));
  }
  for (const name of Core.NAMES) {
    document.getElementById("select" + name).addEventListener("click", () =>
      apply({ type: "select", name }, "Highlighting the parallelogram for " + name + "."));
  }
  document.getElementById("resetBtn").addEventListener("click", () =>
    apply({ type: "reset" }, "Back to the opening triangle."));

  // Colours are CSS classes, so a theme flip needs only a redraw of the SVG.
  board.onTheme(() => draw());

  render();
})();
