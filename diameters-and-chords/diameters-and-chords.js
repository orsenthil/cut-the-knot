"use strict";

/*
 * The picture and the controls for Diameters And Chords.  Every crossing,
 * antipode and secant comes from diameters-and-chords-core.js; this file only
 * draws the position and takes input.  Six handles can be dragged or moved
 * with the arrow keys: Ab, Ac, B, C, Mt and Nt.  Moving either end of the
 * third diameter keeps the two ends opposite, exactly as the applet did.
 */
(function () {
  const Core = DiametersAndChordsCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({ names: namesBox.checked, hint: hintBox.checked });
  const g = Core.geometry(state);
  const onBoard = (p) => Core.finite(p) && p.x >= -10 && p.x <= 410 && p.y >= -10 && p.y <= 370;
  const centre = { x: g.circle.c.x + 12, y: g.circle.c.y - 6 };

  // Back to front: the circle and diameters, the two chords, the auxiliary
  // secants, the Pascal hexagon hint, the computed points, then the labels
  // and the six handles (which keep focus when everything else is redrawn).
  const back = board.layer("back");
  const chords = board.layer("chords");
  const aux = board.layer("aux");
  const hint = board.layer("hint");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const circum = board.circle(g.circle.c, g.circle.r, "circum", back);
  const diamB = board.segment(g.B, g.Bt, "diameter", back);
  const diamC = board.segment(g.C, g.Ct, "diameter", back);
  const diamM = board.segment(g.Mt, g.Nt, "diameter", back);
  const chordB = board.segment(g.Ab, g.B, "chord", chords);
  const chordC = board.segment(g.Ac, g.C, "chord", chords);
  const extB = board.line(g.Ab, g.B, "extension", chords);
  const extC = board.line(g.Ac, g.C, "extension", chords);
  const extM = board.line(g.Mt, g.Nt, "extension", chords);
  const secB = board.line(g.Bt, g.N, "aux", aux);
  const secC = board.line(g.Ct, g.M, "aux", aux);
  const crossCBt = board.segment(g.C, g.Bt, "aux", aux);
  const crossBCt = board.segment(g.B, g.Ct, "aux", aux);
  const hexagon = board.polygon([g.Ab, g.B, g.Bt, g.Kb, g.Ct, g.C], "hexagon", hint);

  const dotBt = board.point(g.Bt, "aux-dot", 3, dots);
  const dotCt = board.point(g.Ct, "aux-dot", 3, dots);
  const dotM = board.point(g.M, "cross-dot", 3.5, dots);
  const dotN = board.point(g.N, "cross-dot", 3.5, dots);
  const dotL = board.point(g.L, "cross-dot", 3, dots);
  const dotKb = board.point(g.Kb, "k-dot", 5, dots);
  const dotKc = board.point(g.Kc, "k-dot", 5, dots);
  const dotO = board.point(g.circle.c, "centre-dot", 3, dots);

  const labelOffsets = {
    Ab: [-19, -8], Ac: [6, -8], B: [-16, 17], C: [7, 16],
    Mt: [-22, 5], Nt: [7, 5], Bt: [-22, -7], Ct: [7, -7],
    Kb: [-24, -9], Kc: [8, -9], M: [-20, 15], N: [7, 15], O: [6, -7],
  };
  const labelKeys = Object.keys(labelOffsets);
  const label = {};
  for (const key of labelKeys) {
    label[key] = board.label(g.circle.c, key, key === "Kb" || key === "Kc" ? "point-label k-label" : "point-label",
      labelOffsets[key][0], labelOffsets[key][1], labels);
  }

  const handleNames = Core.NAMES;
  const handles = {};
  for (const name of handleNames) {
    handles[name] = board.handle(name, g[name], {
      r: 13, step: 3, shift: 12, layer: top,
      label: `Point ${name} on the circle. Drag it, or focus it and use the arrow keys to move it around the circle.`,
      describe: (p) => `at (${Math.round(p.x)}, ${Math.round(p.y)}).`,
      clamp: (p) => Core.clamp(p),
      onMove: (p, moved) => {
        state = Core.movePoint(state, moved, p);
        render();
      },
    });
    handles[name].node.setAttribute("id", "handle-" + name.toLowerCase());
  }

  /** `#status` is how the player's record sees an explored picture. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const s = Core.geometry(state);
    for (const name of handleNames) handles[name].set(s[name]);

    circum.set(s.circle.c, s.circle.r);
    diamB.set(s.B, s.Bt);
    diamC.set(s.C, s.Ct);
    diamM.set(s.Mt, s.Nt);
    chordB.set(s.Ab, s.B);
    chordC.set(s.Ac, s.C);
    extB.set(s.Ab, s.B).show(Core.finite(s.M));
    extC.set(s.Ac, s.C).show(Core.finite(s.N));
    extM.set(s.Mt, s.Nt);
    if (s.Bt && Core.finite(s.N)) secB.set(s.Bt, s.N).show(true); else secB.show(false);
    if (s.Ct && Core.finite(s.M)) secC.set(s.Ct, s.M).show(true); else secC.show(false);
    if (s.Bt) crossCBt.set(s.C, s.Bt).show(true); else crossCBt.show(false);
    if (s.Ct) crossBCt.set(s.B, s.Ct).show(true); else crossBCt.show(false);
    const hex = s.Bt && s.Kb && s.Ct ? [s.Ab, s.B, s.Bt, s.Kb, s.Ct, s.C] : null;
    if (hex) hexagon.set(hex).show(state.options.hint); else hexagon.show(false);

    dotBt.set(s.Bt || centre).show(!!s.Bt);
    dotCt.set(s.Ct || centre).show(!!s.Ct);
    dotM.set(s.M).show(onBoard(s.M));
    dotN.set(s.N).show(onBoard(s.N));
    dotL.set(s.L).show(onBoard(s.L));
    dotKb.set(s.Kb || centre).show(onBoard(s.Kb));
    dotKc.set(s.Kc || centre).show(onBoard(s.Kc));
    dotO.set(s.circle.c);

    // The names checkbox reproduces the applet's "names" checkbox.  The
    // applet merges the A and K labels when the points are under 2px apart
    // and drops M or N when it sits on top of a chord endpoint.
    label.Ab.set(s.Ab, s.aCoincide ? "A" : "A_b").show(state.options.names && !s.aCoincide);
    label.Ac.set(s.Ac, "A_c").show(state.options.names && !s.aCoincide);
    if (s.aCoincide) label.Ab.set(s.Ab, "A").show(state.options.names);
    label.B.set(s.B).show(state.options.names);
    label.C.set(s.C).show(state.options.names);
    label.Mt.set(s.Mt).show(state.options.names);
    label.Nt.set(s.Nt).show(state.options.names);
    label.Bt.set(s.Bt || centre).show(state.options.names && !!s.Bt);
    label.Ct.set(s.Ct || centre).show(state.options.names && !!s.Ct);
    label.Kb.set(s.Kb || centre, s.kCoincide ? "K" : "K_b")
      .show(state.options.names && !!s.Kb && !s.kCoincide);
    label.Kc.set(s.Kc || centre, "K_c").show(state.options.names && !!s.Kc && !s.kCoincide);
    if (s.kCoincide && s.Kb) label.Kb.set(s.Kb, "K").show(state.options.names);
    label.M.set(s.M).show(state.options.names && onBoard(s.M) &&
      (!s.B || Core.dist(s.B, s.M) > 10) && (!s.Ab || Core.dist(s.Ab, s.M) > 10));
    label.N.set(s.N).show(state.options.names && onBoard(s.N) &&
      (!s.C || Core.dist(s.C, s.N) > 10) && (!s.Ac || Core.dist(s.Ac, s.N) > 10));
    label.O.set(s.circle.c).show(state.options.names);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        angles: state.angles, options: state.options, circle: s.circle,
        points: { Ab: s.Ab, Ac: s.Ac, B: s.B, C: s.C, Mt: s.Mt, Nt: s.Nt,
          Bt: s.Bt, Ct: s.Ct, Kb: s.Kb, Kc: s.Kc, M: s.M, N: s.N, L: s.L, O: s.circle.c },
        aDistance: s.aDistance, kDistance: s.kDistance, finished: s.finished,
      });
    }
  }

  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    namesBox.checked = state.options.names;
    hintBox.checked = state.options.hint;
    render();
  });

  // SVG colours come from the site's tokens, so a theme flip needs no new
  // geometry; redraw anyway to keep the shared helper's hook.
  board.onTheme(render);
  render();
})();
