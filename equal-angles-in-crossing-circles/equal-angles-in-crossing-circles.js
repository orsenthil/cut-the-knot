"use strict";

/*
 * Browser page for Equal Chords in Crossing Circles. The construction is in
 * equal-angles-in-crossing-circles-core.js; this file only draws and takes input.
 *
 * Four focusable handles reproduce the applet's mouse: P and Q set the common
 * chord and the two circles; A and D set the two lines through P. In "Adjust
 * chord" mode A and D slide along their circles (as RestrictToCircle does);
 * in "Adjust circles" mode they move freely and redefine the circles. The
 * three checkboxes are the applet's names, statement and hint switches.
 */

(() => {
  const C = EqualAnglesInCrossingCirclesCore;
  const statusEl = document.getElementById("status");
  const statementEl = document.getElementById("statementText");
  const board = Geom.board("board");

  const layers = {
    circles: board.layer("circles"),
    guides: board.layer("guides"),
    chords: board.layer("chords"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = C.start();

  /** The status line; only "win", "lose" and "done" mean anything to Track. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const circleE = board.circle(state.P, 1, "given-circle first-circle", layers.circles);
  const circleF = board.circle(state.P, 1, "given-circle second-circle", layers.circles);
  const pq = board.line(state.P, state.Q, "chord-line", layers.chords);
  const ab = board.line(state.P, state.Q, "chord-line", layers.chords);
  const cd = board.line(state.P, state.Q, "chord-line", layers.chords);
  const translated = board.line(state.P, state.Q, "hint-line", layers.guides);
  const cc = board.line(state.P, state.Q, "hint-line", layers.guides);
  const dd = board.line(state.P, state.Q, "hint-line", layers.guides);
  const ef = board.line(state.P, state.Q, "centre-line", layers.guides);
  const arcAB = board.angleArc(state.P, state.A, state.Q, 22, "angle-mark", layers.guides);
  const arcCD = board.angleArc(state.P, state.D, state.Q, 29, "angle-mark second-angle", layers.guides);

  const dots = {};
  for (const name of ["B", "C", "Cp", "Dp", "E", "F"]) {
    dots[name] = board.point(state.P, name.startsWith("Cp") || name.startsWith("Dp")
      ? "hint-dot" : "end-dot", 4, layers.dots);
  }
  const offsets = {
    P: [-16, -11], Q: [-16, 17], A: [-16, -11], B: [8, -11],
    C: [-16, -11], D: [8, 17], E: [8, -9], F: [8, 17],
    Cp: [8, -9], Dp: [8, 17],
  };
  const labels = {};
  for (const name of Object.keys(offsets)) {
    const text = name === "Cp" ? "C'" : name === "Dp" ? "D'" : name;
    labels[name] = board.label(state.P, text, "pt-label", offsets[name][0], offsets[name][1], layers.labels);
  }

  const handleLabels = {
    P: "Point P, one of the two circle crossings. Drag it, or focus it and press the arrow keys, to move both circles.",
    Q: "Point Q, the other circle crossing. Drag it, or focus it and press the arrow keys, to turn the common chord.",
    A: "Point A on the first circle. Drag it, or focus it and press the arrow keys, to set the line through P.",
    D: "Point D on the second circle. Drag it, or focus it and press the arrow keys, to set the other line through P.",
  };
  const notes = {
    P: "P moved. ", Q: "Q moved. ", A: "A moved. ", D: "D moved. ",
  };
  const handles = {};
  for (const name of Object.keys(handleLabels)) {
    const h = board.handle(name, state[name], {
      r: 8, step: 3, shift: 15,
      layer: layers.handles,
      label: handleLabels[name],
      clamp: (p, which) => {
        if (state.options.mode !== "chord" || (which !== "A" && which !== "D")) return p;
        const g = C.geometry(state);
        if (!g.valid) return p;
        return which === "A"
          ? C.onCircle(g.E.center, g.E.radius, p)
          : C.onCircle(g.F.center, g.F.radius, p);
      },
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      onMove: (p, which) => {
        state = C.movePoint(state, which, p);
        render(notes[which]);
      },
    });
    h.node.setAttribute("id", "handle-" + name);
    handles[name] = h;
  }

  function showPoint(name, point, on) {
    labels[name].show(Boolean(on && point));
    if (on && point) labels[name].set(point);
  }

  function statusText(g) {
    if (!g.valid) {
      return "The circles cannot be drawn now. Move P, Q, A or D apart, or reset the picture.";
    }
    if (g.cd < 3) {
      return "The second line is tangent at P, so it has no chord. Move D or Q to open it out.";
    }
    return "AB = " + g.ab.toFixed(1) + " and CD = " + g.cd.toFixed(1) +
      " drawing units. The two lines make equal angles with PQ, so the chords are equal.";
  }

  /** Redraw, speak the result and save the position for the player's record. */
  function render(prefix) {
    const g = C.geometry(state);
    for (const name in handles) handles[name].set(state[name]);
    circleE.show(false);
    circleF.show(false);
    pq.set(state.P, state.Q).show(g.valid);
    ab.show(false);
    cd.show(false);
    translated.show(false);
    cc.show(false);
    dd.show(false);
    ef.show(false);
    arcAB.show(false);
    arcCD.show(false);
    for (const name in dots) dots[name].show(false);
    for (const name in labels) labels[name].show(false);

    if (g.valid) {
      circleE.set(g.E.center, g.E.radius).show(true);
      circleF.set(g.F.center, g.F.radius).show(true);
      pq.show(true);
      ab.set(g.A, g.B).show(true);
      cd.set(g.C, g.D).show(true);
      if (g.cd >= 3) {
        arcAB.set(state.P, g.A, state.Q, 22).show(true);
        arcCD.set(state.P, g.D, state.Q, 29).show(true);
      }
      dots.B.set(g.B).show(true);
      dots.C.set(g.C).show(true);
      dots.E.set(g.E.center).show(true);
      dots.F.set(g.F.center).show(true);
      if (state.options.names) {
        showPoint("P", state.P, true);
        showPoint("Q", state.Q, true);
        showPoint("A", g.A, true);
        showPoint("B", g.B, true);
        showPoint("C", g.C, true);
        showPoint("D", g.D, true);
        showPoint("E", g.E.center, true);
        showPoint("F", g.F.center, true);
      }
      if (state.options.hint && g.translation) {
        const t = g.translation;
        translated.set(t.Cprime, t.Dprime).show(true);
        cc.set(g.C, t.Cprime).show(true);
        dd.set(g.D, t.Dprime).show(true);
        ef.set(g.E.center, g.F.center).show(true);
        dots.Cp.set(t.Cprime).show(true);
        dots.Dp.set(t.Dprime).show(true);
        if (state.options.names) {
          showPoint("Cp", t.Cprime, true);
          showPoint("Dp", t.Dprime, true);
        }
      }
    }
    statementEl.hidden = !state.options.statement;
    say((prefix || "") + statusText(g), null);
    if (window.Track) window.Track.state(state);
  }

  const toggles = {
    names: document.getElementById("namesCheck"),
    hint: document.getElementById("hintCheck"),
    statement: document.getElementById("statementCheck"),
  };
  const toggleNotes = {
    names: "names", hint: "the hint", statement: "the statement",
  };
  for (const key in toggles) {
    const box = toggles[key];
    box.checked = state.options[key];
    box.addEventListener("change", () => {
      state = C.setOption(state, key, box.checked);
      render((box.checked ? "Showing " : "Hid ") + toggleNotes[key] + ". ");
    });
  }
  const modes = document.querySelectorAll("input[name='adjust-mode']");
  for (const radio of modes) {
    radio.checked = radio.value === state.options.mode;
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state = C.setOption(state, "mode", radio.value);
      render(radio.value === "circles" ? "Adjusting circles. " : "Adjusting the chord. ");
    });
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = C.start(state.options);
    for (const name in handles) handles[name].set(state[name]);
    render("Back to the opening picture. ");
  });

  // The SVG uses CSS classes, so a theme flip only needs a fresh status read.
  board.onTheme(() => render());
  render();
})();
