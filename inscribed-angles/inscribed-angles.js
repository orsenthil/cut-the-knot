"use strict";

/*
 * Inscribed Angles — the drawing and input only; the applet's geometry and
 * its two tolerances live in inscribed-angles-core.js.
 *
 * The stage holds a 400 x 300 SVG. A, C and D define the circle; B can be
 * dragged anywhere, on or off it. Four chords, the circle, the centre O, the
 * two angles at A and B, and the applet's Hint overlay are redrawn from the
 * core on every move. Handles are Geom's focusable SVG dots, so arrow keys and
 * pointer drags both work and focus survives a redraw.
 */

(function () {
  const Core = InscribedAnglesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Layers back to front: circle and chords, the angle marks and the Hint
   * rings, dots and names, then the four handles that keep keyboard focus. */
  const back = board.layer("back");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const circle = board.circle(Core.CENTER, Core.RADIUS, "circum", back);
  const chordA = board.segment(state.A, state.C, "chord-a", back);
  const chordD = board.segment(state.A, state.D, "chord-a", back);
  const chordB = board.segment(state.B, state.C, "chord-b", back);
  const chordBD = board.segment(state.B, state.D, "chord-b", back);
  const centerDot = board.point(Core.CENTER, "center-dot", 3, dots);

  // The applet's Hint overlay: equal angles are marked with arcs; otherwise
  // three small concentric rings appear about O.
  const arcA = board.angleArc(state.A, state.C, state.D, 22, "angle-a", marks);
  const arcB = board.angleArc(state.B, state.C, state.D, 22, "angle-b", marks);
  const rings = [3, 7, 11].map((r) => board.circle(Core.CENTER, r, "hint-ring", marks));

  const labels = {};
  for (const name of Core.NAMES) {
    labels[name] = board.label(state[name], name, "point-label", -14, -11, names);
  }
  const labelO = board.label(Core.CENTER, "O", "point-label", 6, -10, names);

  /* Every handle says what it is and how to move it; `describe` adds its
   * current position so a screen-reader user can follow a drag. */
  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, state[name], {
      step: 3, shift: 12, r: 11, layer: top,
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
      describe: (p) => `at (${Math.round(p.x)}, ${Math.round(p.y)}). ` +
        (name === "B" ? "Bring B onto the circle through A, C and D to compare the angles."
          : "The circle through A, C and D follows this point."),
      onMove: (p, which) => {
        state = Core.move(state, which, p);
        render();
      },
    });
  }

  /** `#status` is how the player's record sees that a drawing was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = state.measured || Core.measure(state);
    const equal = m.onCircle && state.equal;

    circle.set(m.circle.c, m.circle.r);
    chordA.set(state.A, state.C);
    chordD.set(state.A, state.D);
    chordB.set(state.B, state.C);
    chordBD.set(state.B, state.D);
    centerDot.set(m.circle.c);
    centerDot.show(state.hint && state.onCircle);

    arcA.set(state.A, state.C, state.D, 22);
    arcB.set(state.B, state.C, state.D, 22);
    arcA.show(state.hint && equal);
    arcB.show(state.hint && equal);
    rings.forEach((ring, i) => {
      ring.set(m.circle.c, [3, 7, 11][i]); // the applet's three small rings
      ring.show(state.hint && state.onCircle && !equal);
    });

    for (const name of Core.NAMES) {
      handles[name].set(state[name]);
      labels[name].set(state[name]);
      labels[name].show(state.showNames);
    }
    labelO.set(m.circle.c);
    labelO.show(state.showNames && state.hint && state.onCircle);

    // The Hint box is enabled exactly when the applet's IsOnCircle test passes.
    hintBox.disabled = !state.onCircle;
    namesBox.checked = state.showNames;
    hintBox.checked = state.hint;

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: state.A, B: state.B, C: state.C, D: state.D,
        circle: m.circle, onCircle: state.onCircle, equal,
        angles: { CAD: m.angleCAD, CBD: m.angleCBD },
        options: { showNames: state.showNames, hint: state.hint },
      });
    }
  }

  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "showNames", namesBox.checked);
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
