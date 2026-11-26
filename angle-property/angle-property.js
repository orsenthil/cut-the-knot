"use strict";

/*
 * The page for Angle Property: drawing and input only. The inversion and all
 * the angle readings live in angle-property-core.js.
 *
 * The stage is the applet's 400 by 300 drawing. O is the centre of inversion,
 * S sets its radius; P and R set the second circle; T sets the line through O.
 * The red circle is the inverse of the green one. The two checkboxes are the
 * applet's own "Show names" and "Hint" (tangent lines). Every object is made
 * once and then moved with .set(), so a dot keeps keyboard focus while it is
 * dragged or nudged with the arrow keys.
 */

(() => {
  const C = AnglePropertyCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesCheck");
  const hintBox = document.getElementById("hintCheck");
  const resetBtn = document.getElementById("resetBtn");

  let state = C.start({});

  /** Write the line under the picture. An illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers in paint order: guides, circles, line, hints, crossings, text, dots. */
  const guides = board.layer("guides");
  const circles = board.layer("circles");
  const rays = board.layer("rays");
  const hints = board.layer("hints");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const tops = board.layer("handles");

  const opLine = board.line(state.O, state.P, "op-line", guides);
  const invCircle = board.circle(state.O, 1, "inv-circle", circles);
  const targetCircle = board.circle(state.P, 1, "target-circle", circles);
  const imageCircle = board.circle(state.O, 1, "image-circle", circles);
  const imageLine = board.line(state.O, state.T, "image-line", circles);
  const otLine = board.line(state.O, state.T, "ot-line", rays);

  /* Each crossing gets a tangent segment when Hint is ticked. */
  const tangents = Array.from({ length: 4 }, () =>
    board.segment(state.O, state.T, "tangent-line", hints));
  const dots = Array.from({ length: 4 }, () =>
    board.point(state.O, "cross-dot", 3.5, marks));
  const names = ["A", "B", "B\u2032", "A\u2032"].map((text) =>
    board.label(state.O, text, "pt-label", 7, -8, labels));

  const describe = (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down in the drawing`;
  const labelsForHandles = {
    O: "Point O, centre of inversion. Drag it, or focus it and use the arrow keys",
    S: "Point S, on the inversion circle. Drag it, or focus it and use the arrow keys",
    P: "Point P, centre of the second circle. Drag it, or focus it and use the arrow keys",
    R: "Point R, on the second circle. Drag it, or focus it and use the arrow keys",
    T: "Point T, sets the line through O. Drag it, or focus it and use the arrow keys",
  };
  const handles = {};
  for (const name of C.HANDLE_NAMES) {
    handles[name] = board.handle(name, state[name], {
      r: 8, step: 4, cls: "geom-handle", layer: tops,
      label: labelsForHandles[name],
      describe,
      onMove: (p, which) => {
        state = C.moveVertex(state, which, p);
        render();
      },
    });
  }

  function render() {
    const g = C.geometry(state);

    opLine.set(state.O, state.P);
    otLine.set(state.O, state.T);
    invCircle.set(g.inversion.center, g.inversion.radius);
    targetCircle.set(g.target.center, g.target.radius);

    if (g.image.kind === "circle") {
      imageCircle.show(true).set(g.image.center, g.image.radius);
      imageLine.show(false);
    } else if (g.image.kind === "line" && g.image.point && g.image.direction) {
      imageCircle.show(false);
      imageLine.show(true).set(g.image.point, {
        x: g.image.point.x + g.image.direction.x,
        y: g.image.point.y + g.image.direction.y,
      });
    } else {
      imageCircle.show(false);
      imageLine.show(false);
    }

    /* The applet names the original crossings A, B and the image crossings
       B', A' - inversion swaps the near and far ends of the line. */
    const crossings = [
      ...g.originalHits.map((p, i) => ({ p, text: i === 0 ? "A" : "B" })),
      ...g.imageHits.map((p, i) => ({ p, text: i === 0 ? "B\u2032" : "A\u2032" })),
    ];
    for (let i = 0; i < dots.length; i++) {
      const hit = crossings[i];
      dots[i].show(Boolean(hit));
      names[i].show(Boolean(hit) && state.options.names);
      if (hit) {
        dots[i].set(hit.p);
        if (state.options.names) names[i].set(hit.p, hit.text);
      }
    }
    for (let i = 0; i < tangents.length; i++) {
      const source = crossings[i];
      const circle = i < g.originalHits.length ? g.target : g.image;
      tangents[i].show(Boolean(source) && state.options.hint &&
        circle.kind === "circle");
      if (source && circle.kind === "circle") {
        const ends = C.tangentEnds(source.p, circle);
        tangents[i].set(ends[0], ends[1]);
      }
    }

    for (const name of C.HANDLE_NAMES) handles[name].set(state[name]);
    namesBox.checked = state.options.names;
    hintBox.checked = state.options.hint;
    say(C.status(state, g));

    // The position, for the player's record and the tutor (board units).
    if (window.Track) window.Track.state(state);
  }

  function reset() {
    state = C.start({ names: state.options.names, hint: state.options.hint });
    render();
  }

  resetBtn.addEventListener("click", reset);
  namesBox.addEventListener("change", () => {
    state = C.setOption(state, "names", namesBox.checked);
    render();
  });
  hintBox.addEventListener("change", () => {
    state = C.setOption(state, "hint", hintBox.checked);
    render();
  });

  board.onTheme(render);
  render();
})();
