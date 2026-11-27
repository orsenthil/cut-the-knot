"use strict";

/*
 * Browser UI for Circular Poggendorf: drawing and input only. The applet's
 * geometry and parameter ranges live in circular-poggendorf-core.js.
 *
 * The SVG shows the applet's one circle, then paints a strip in the panel's
 * background colour over it and outlines the strip's two parallel edges. Three
 * draggable points stand in for the applet's three scrollbars: one on the
 * circle sets its radius, two on the strip's edges set X0 and the bar width.
 * "Show hidden circle" draws the complete circle over the strip so the player
 * can compare what is there with what the eye reports. There is nothing to win.
 */

(() => {
  const Core = CircularPoggendorfCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const revealBtn = document.getElementById("revealBtn");

  const circleLayer = board.layer("circle");
  const barLayer = board.layer("bar");
  const revealLayer = board.layer("reveal");
  const marksLayer = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /** A named SVG element with Geom's shape interface, for markup Geom omits. */
  function shapeEl(tag, cls, layer) {
    const node = board.el(tag, null, cls, layer);
    return {
      node: node,
      set: function (attrs) {
        for (const k in attrs) node.setAttribute(k, attrs[k]);
        return this;
      },
      show: function (on) { node.style.display = on ? "" : "none"; return this; },
    };
  }

  const circle = board.circle(Core.CENTER, 1, "illusion-circle", circleLayer);
  const barFill = shapeEl("rect", "bar-fill", barLayer);
  const barOutline = shapeEl("rect", "bar-outline", barLayer);
  const wholeCircle = board.circle(Core.CENTER, 1, "whole-circle", revealLayer);
  const cutDots = [0, 1, 2, 3].map((i) => board.point(Core.CENTER, "cut-dot", 4, marksLayer));

  let state = Core.start();

  /**
   * Shows a line under the picture. `kind` is "win", "lose", "done" or nothing;
   * those classes are how the record sees a finished play. This illustration
   * has no winner, so no kind is ever passed here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const clampHandle = (p, name) => name === "radius"
    ? Core.clampRadiusHandle(p)
    : Core.clampEdgeHandle(state, name, p);

  const describe = (name) => (p) => {
    if (name === "radius") return `Radius ${state.radius} drawing units.`;
    if (name === "x0") return `The bar starts at x ${state.x0}.`;
    return `The bar is ${state.barWidth} drawing units wide.`;
  };

  const onMove = (p, name) => {
    const change = Core.paramFromHandle(state, name, p);
    if (!change) return;
    state = Core.setParam(state, change.name, change.value);
    render();
  };

  const radiusH = board.handle("radius", Core.radiusHandle(state), {
    r: 10, step: 3, layer: handlesLayer, clamp: clampHandle, onMove,
    cls: "geom-handle radius-handle",
    describe: describe("radius"),
    label: "Circle radius point. Drag it away from or towards the centre, or focus it and use the arrow keys.",
  });
  const leftH = board.handle("x0", Core.edgeHandles(state)[0].point, {
    r: 9, step: 2, layer: handlesLayer, clamp: clampHandle, onMove,
    describe: describe("x0"),
    label: "Bar's left edge. Drag it left or right, or focus it and use the arrow keys.",
  });
  const rightH = board.handle("barWidth", Core.edgeHandles(state)[1].point, {
    r: 9, step: 2, layer: handlesLayer, clamp: clampHandle, onMove,
    describe: describe("barWidth"),
    label: "Bar's right edge. Drag it left or right to change the bar's width, or focus it and use the arrow keys.",
  });

  function render() {
    const g = Core.geometry(state);
    const edges = Core.edgeHandles(state);

    circle.set(g.center, g.radius);
    barFill.set(g.bar);
    barOutline.set(g.bar);
    wholeCircle.show(state.reveal).set(g.center, g.radius);

    const cs = Core.cuts(state);
    cutDots.forEach((dot, i) => {
      dot.show(state.reveal && i < cs.length);
      if (i < cs.length) dot.set(cs[i]);
    });

    radiusH.set(Core.radiusHandle(state));
    leftH.set(edges[0].point);
    rightH.set(edges[1].point);

    revealBtn.setAttribute("aria-pressed", String(state.reveal));
    revealBtn.textContent = state.reveal ? "Hide hidden circle" : "Show hidden circle";

    if (state.reveal) {
      say(`The dashes continue the same circle under the bar: all ${cs.length} cut ends are on it. ` +
        "The circle is whole; only the strip hides part of it.", null);
    } else if (g.hidesWholeCircle) {
      say("The bar covers the whole circle, so no pieces are showing. Drag an edge back.", null);
    } else if (cs.length === 0) {
      say("The bar misses the circle, so nothing is hidden: the circle is in one piece.", null);
    } else {
      say(`The bar's two edges are parallel and cut the circle in ${cs.length} places. ` +
        "The pieces are from one circle, even where they seem not to join.", null);
    }

    // The position, for the player's record and the tutor (board units).
    if (window.Track) window.Track.state(state);
  }

  revealBtn.addEventListener("click", () => {
    state = Core.setReveal(state, !state.reveal);
    render();
  });

  newBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });

  board.onTheme(render);
  render();
})();
