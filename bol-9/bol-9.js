"use strict";

/*
 * The page for BOL9: drawing and input only; the geometry is in bol-9-core.js.
 *
 * The SVG holds the fixed circle, one horizontal chord AB and one vertical
 * chord CD. Each chord is dragged as a whole line by its own handle, exactly
 * as the applet lets a player drag AB left-right and CD up-down; the core keeps
 * the crossing inside the circle. The four coloured arcs, the crossing O and
 * the endpoint names follow from the core's Arc.SetAngle transcription. The
 * applet's only control was "Show names"; New arrangement and Check the claim
 * are added so a player can start again and mark the illustration explored.
 */

(function () {
  const Core = Bol9Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBtn = document.getElementById("namesBtn");

  let state = Core.start();
  let showNames = true; // the applet's "show" parameter defaults to "1"
  let checked = false;

  const center0 = { x: state.cx, y: state.cy };
  const arcsLayer = board.layer("arcs");
  const shapes = board.layer("shapes");
  const dots = board.layer("dots");
  const letters = board.layer("letters");
  const handlesLayer = board.layer("handles");

  const circleShape = board.circle(center0, state.r, "bol-circle", shapes);
  const chordAB = board.line({ x: 0, y: state.abY }, { x: state.width, y: state.abY }, "chord", shapes);
  const chordCD = board.line({ x: state.cdX, y: 0 }, { x: state.cdX, y: state.height }, "chord", shapes);

  /* One path per arc. Its start and signed sweep come straight from the
     applet's Arc.Start and Arc.Value, so even the direction of colour matches. */
  const arcShapes = {
    AD: board.arc(center0, 1, 0, 0, "arc arc-ad", arcsLayer),
    BC: board.arc(center0, 1, 0, 0, "arc arc-bc", arcsLayer),
    AC: board.arc(center0, 1, 0, 0, "arc arc-ac", arcsLayer),
    BD: board.arc(center0, 1, 0, 0, "arc arc-bd", arcsLayer),
  };

  const centerDot = board.point(center0, "center-dot", 3.5, dots);
  const endpointDots = ["A", "B", "C", "D"].map(() => board.point(center0, "marked-dot", 4, dots));
  const centerLabel = board.label(center0, "O", "glabel center-label", 8, -8, letters);
  const endpointLabels = {
    A: board.label(center0, "A", "glabel", -19, -9, letters),
    B: board.label(center0, "B", "glabel", 7, -9, letters),
    C: board.label(center0, "C", "glabel", 7, 19, letters),
    D: board.label(center0, "D", "glabel", 7, -9, letters),
  };

  const degrees = (rad) => (rad * 180 / Math.PI).toFixed(1);

  /**
   * Shows a line under the picture. "done" marks an explored illustration for
   * the player's record (assets/progress.js); there is no win or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    circleShape.set(g.circle, g.circle.r);
    chordAB.set({ x: 0, y: state.abY }, { x: state.width, y: state.abY });
    chordCD.set({ x: state.cdX, y: 0 }, { x: state.cdX, y: state.height });

    for (const name of ["AD", "BC", "AC", "BD"]) {
      const a = g.arcs[name];
      arcShapes[name].show(!g.degenerate);
      arcShapes[name].set(g.circle, g.circle.r, a.start, a.start + a.value);
    }

    centerDot.set(g.circle);
    centerLabel.set(g.circle);
    const ends = { A: g.A, B: g.B, C: g.C, D: g.D };
    const names = ["A", "B", "C", "D"];
    endpointDots.forEach((dot, i) => {
      dot.show(!g.degenerate);
      dot.set(ends[names[i]]);
    });
    for (const name of names) {
      endpointLabels[name].show(showNames && !g.degenerate);
      endpointLabels[name].set(ends[name]);
    }
    centerLabel.show(showNames);

    /* Keep the handles on the chord lines after a clamped move. */
    hAB.set({ x: state.cx, y: state.abY });
    hCD.set({ x: state.cdX, y: state.cy });

    const all = Object.values(Core.claims(state)).every(Boolean);
    const sums = `arc AD + arc CB = ${degrees(g.sumADCB)}°; arc AC + arc DB = ${degrees(g.sumACDB)}°.`;
    if (checked && all) {
      say(`Checked: both sums are half a turn. ${sums}`, "done");
    } else if (checked) {
      say("Move the chords away from the edge of the circle, then check again.", null);
    } else {
      say(`${sums} Drag a chord, or press Check the claim.`, null);
    }

    // The position, for the player's record and the tutor, in board units.
    if (window.Track) window.Track.state(state);
  }

  function move(name, p) {
    state = Core.withChord(state, name, name === "AB" ? p.y : p.x);
    checked = false;
    render();
  }

  const clampAB = (p) => {
    const next = Core.withChord(state, "AB", p.y);
    return { x: state.cx, y: next.abY };
  };
  const clampCD = (p) => {
    const next = Core.withChord(state, "CD", p.x);
    return { x: next.cdX, y: state.cy };
  };

  const hAB = board.handle("AB", { x: state.cx, y: state.abY }, {
    r: 11, step: 3, shift: 12, layer: handlesLayer, clamp: clampAB,
    label: "Horizontal chord AB. Drag up or down, or focus and use the up and down arrow keys.",
    describe: (p) => `at y ${Math.round(p.y)}`,
    onMove: (p, name) => move(name, p),
  });
  const hCD = board.handle("CD", { x: state.cdX, y: state.cy }, {
    r: 11, step: 3, shift: 12, layer: handlesLayer, clamp: clampCD,
    label: "Vertical chord CD. Drag left or right, or focus and use the left and right arrow keys.",
    describe: (p) => `at x ${Math.round(p.x)}`,
    onMove: (p, name) => move(name, p),
  });

  function reset() {
    state = Core.start();
    checked = false;
    render();
    hAB.node.focus();
  }

  function checkClaim() {
    checked = true;
    render();
  }

  function toggleNames() {
    showNames = !showNames;
    namesBtn.setAttribute("aria-pressed", String(showNames));
    namesBtn.textContent = showNames ? "Hide point names" : "Show point names";
    render();
  }

  newBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", checkClaim);
  namesBtn.addEventListener("click", toggleNames);
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    if (key === "c") checkClaim();
    if (key === "n") toggleNames();
  });

  board.onTheme(render);
  render();
})();
