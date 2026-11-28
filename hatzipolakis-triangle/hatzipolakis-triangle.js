"use strict";

/*
 * The page for Hatzipolakis Triangle: drawing and input only. The geometry and
 * the page's claims live in hatzipolakis-triangle-core.js. The SVG shows the
 * triangle ABC, its incircle and contact points X, Y, Z, the midpoints E and F,
 * and the feet M and N. A, B and C are draggable and arrow-key movable; the
 * four buttons repeat the applet's four "Show" checkboxes and check the claims.
 */

(function () {
  const Core = HatzipolakisTriangleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 12, view.x + view.width - 12),
    y: Geom.clamp(p.y, view.y + 12, view.y + view.height - 12),
  });

  const buttons = {
    names: document.getElementById("namesBtn"),
    premise: document.getElementById("premiseBtn"),
    claim: document.getElementById("claimBtn"),
    hint: document.getElementById("hintBtn"),
  };

  let state = Core.start();
  let showNames = true;
  let showPremise = false;
  let showClaim = false;
  let showHint = false;
  let checked = false;

  /* Paint order matches the applet: guides and incircle first, then sides,
     the three claimed lines, the hint, the premise marks and the names. */
  const guides = board.layer("guides");
  const circles = board.layer("circles");
  const sides = board.layer("sides");
  const claims = board.layer("claims");
  const hints = board.layer("hints");
  const premise = board.layer("premise");
  const dotLayer = board.layer("dots");
  const text = board.layer("text");
  const tops = board.layer("handles");

  const incircle = board.circle(state.A, 1, "incircle", circles);
  const yz = board.line(state.A, state.B, "contact-line", guides);
  const am = board.segment(state.A, state.A, "drop-line", guides);
  const an = board.segment(state.A, state.A, "drop-line", guides);
  const bisB = board.line(state.A, state.B, "bisector", guides);
  const bisC = board.line(state.A, state.B, "bisector", guides);
  const sidesAB = board.segment(state.A, state.B, "side", sides);
  const sidesBC = board.segment(state.B, state.C, "side", sides);
  const sidesCA = board.segment(state.C, state.A, "side", sides);
  const claimEF = board.line(state.A, state.B, "claim-line", claims);
  const claimXY = board.line(state.A, state.B, "claim-line", claims);
  const claimZX = board.line(state.A, state.B, "claim-line", claims);
  const hintEdges = [
    board.segment(state.A, state.A, "hint-edge", hints),
    board.segment(state.A, state.A, "hint-edge", hints),
    board.segment(state.A, state.A, "hint-edge", hints),
    board.segment(state.A, state.A, "hint-edge", hints),
    board.segment(state.A, state.A, "hint-edge", hints),
    board.segment(state.A, state.A, "hint-edge extra", hints),
    board.segment(state.A, state.A, "hint-edge extra", hints),
  ];
  const rightM = board.rightAngle(state.A, state.B, state.C, 12, "right-mark", premise);
  const rightN = board.rightAngle(state.A, state.B, state.C, 12, "right-mark", premise);
  const ticks = [
    board.segment(state.A, state.A, "tick-mark", premise),
    board.segment(state.A, state.A, "tick-mark", premise),
    board.segment(state.A, state.A, "tick-mark two", premise),
    board.segment(state.A, state.A, "tick-mark two", premise),
  ];
  const dots = {
    I: board.point(state.A, "aux-dot", 3.5, dotLayer),
    X: board.point(state.A, "contact-dot", 4, dotLayer),
    Y: board.point(state.A, "contact-dot", 4, dotLayer),
    Z: board.point(state.A, "contact-dot", 4, dotLayer),
    M: board.point(state.A, "foot-dot", 4, dotLayer),
    N: board.point(state.A, "foot-dot", 4, dotLayer),
    E: board.point(state.A, "mid-dot", 4, dotLayer),
    F: board.point(state.A, "mid-dot", 4, dotLayer),
  };
  const labels = {
    A: board.label(state.A, "A", "pt-label", -17, -12, text),
    B: board.label(state.B, "B", "pt-label", -16, 20, text),
    C: board.label(state.C, "C", "pt-label", 8, 20, text),
    E: board.label(state.A, "E", "pt-label small", 8, -8, text),
    F: board.label(state.A, "F", "pt-label small", -17, -8, text),
    X: board.label(state.A, "X", "pt-label small", -16, 18, text),
    Y: board.label(state.A, "Y", "pt-label small", 8, -9, text),
    Z: board.label(state.A, "Z", "pt-label small", 8, -9, text),
    I: board.label(state.A, "I", "pt-label small", 8, -8, text),
    M: board.label(state.A, "M", "pt-label small", 8, -9, text),
    N: board.label(state.A, "N", "pt-label small", -18, -9, text),
  };

  /** The line under the game. "done" marks a finished check for the record. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** One little cross-stroke marking equal halves of a side. */
  function tick(p, q, shape, size) {
    const v = Core.sub(q, p);
    const n = Math.hypot(v.x, v.y) || 1;
    const mid = Core.midpoint(p, q);
    const off = { x: (-v.y / n) * size, y: (v.x / n) * size };
    shape.set(Core.sub(mid, off), Core.add(mid, off));
  }

  function render() {
    const c = Core.construction(state);

    incircle.show(c.ok);
    yz.show(c.ok);
    am.show(c.ok);
    an.show(c.ok);
    bisB.show(c.ok);
    bisC.show(c.ok);
    sidesAB.show(c.ok);
    sidesBC.show(c.ok);
    sidesCA.show(c.ok);
    claimEF.show(c.ok && showClaim);
    claimXY.show(c.ok && showClaim);
    claimZX.show(c.ok && showClaim);
    rightM.show(c.ok && showPremise);
    rightN.show(c.ok && showPremise);
    for (const t of ticks) t.show(c.ok && showPremise);

    for (const h of hintEdges) h.show(false);
    for (const key in dots) dots[key].show(c.ok);
    for (const key in labels) labels[key].show(c.ok && showNames);

    if (!c.ok) {
      say("Move the corners apart into a proper triangle: every side must be at least 2 units.");
      if (window.Track) window.Track.state({ A: state.A, B: state.B, C: state.C });
      return;
    }

    incircle.set(c.I, c.radius);
    yz.set(c.Y, c.Z);
    am.set(state.A, c.M);
    an.set(state.A, c.N);
    bisB.set(state.B, c.I);
    bisC.set(state.C, c.I);
    sidesAB.set(state.A, state.B);
    sidesBC.set(state.B, state.C);
    sidesCA.set(state.C, state.A);
    claimEF.set(c.E, c.F);
    claimXY.set(c.X, c.Y);
    claimZX.set(c.Z, c.X);

    const hintPairs = showHint
      ? [[c.E, c.M], [c.E, state.C], [c.F, c.N], [c.F, state.B], [state.B, state.C],
         [c.M, c.X], [c.N, c.X]]
      : [];
    for (let i = 0; i < hintEdges.length; i++) {
      hintEdges[i].show(Boolean(hintPairs[i]));
      if (hintPairs[i]) hintEdges[i].set(hintPairs[i][0], hintPairs[i][1]);
    }

    rightM.set(c.M, state.A, state.B, 12);
    rightN.set(c.N, state.A, state.C, 12);
    tick(state.A, c.E, ticks[0], 5);
    tick(c.E, state.C, ticks[1], 5);
    tick(state.A, c.F, ticks[2], 5);
    tick(c.F, state.B, ticks[3], 5);

    for (const key in dots) dots[key].set(c[key]);
    labels.A.set(state.A);
    labels.B.set(state.B);
    labels.C.set(state.C);
    for (const key of ["E", "F", "X", "Y", "Z", "I", "M", "N"]) labels[key].set(c[key]);

    if (checked) {
      const cl = Core.claims(state);
      say(cl.mnEfCollinear && cl.xyMCollinear && cl.xzNCollinear
        ? "Checked: M, N, E and F lie on one line, and X–Y–M and X–Z–N are straight lines."
        : "Drag the corners back into a proper triangle, then check again.", "done");
    } else {
      say("Drag A, B or C. Press Check the claims to see the three straight lines.");
    }

    // The position, for the player's record and the tutor, in board units.
    if (window.Track) window.Track.state({ A: state.A, B: state.B, C: state.C });
  }

  const handles = {
    A: board.handle("A", state.A, {
      r: 11, step: 3, shift: 12, layer: tops, clamp: inside,
      label: "Point A, top corner of the triangle. Drag it, or focus it and use the arrow keys.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("A", p),
    }),
    B: board.handle("B", state.B, {
      r: 11, step: 3, shift: 12, layer: tops, clamp: inside,
      label: "Point B, left corner of the triangle. Drag it, or focus it and use the arrow keys.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("B", p),
    }),
    C: board.handle("C", state.C, {
      r: 11, step: 3, shift: 12, layer: tops, clamp: inside,
      label: "Point C, right corner of the triangle. Drag it, or focus it and use the arrow keys.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("C", p),
    }),
  };

  function syncHandles() {
    for (const key in handles) handles[key].set(state[key]);
  }

  function move(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    syncHandles();
    render();
  }

  function reset() {
    state = Core.start();
    checked = false;
    syncHandles();
    render();
    handles.A.node.focus();
  }

  function checkClaims() {
    checked = Core.construction(state).ok;
    render();
  }

  function toggle(name) {
    if (name === "names") showNames = !showNames;
    else if (name === "premise") showPremise = !showPremise;
    else if (name === "claim") showClaim = !showClaim;
    else if (name === "hint") showHint = !showHint;
    const pressed = { names: showNames, premise: showPremise, claim: showClaim, hint: showHint }[name];
    buttons[name].setAttribute("aria-pressed", String(pressed));
    buttons[name].textContent = ({
      names: ["Show names", "Hide names"],
      premise: ["Show premises", "Hide premises"],
      claim: ["Show claim", "Hide claim"],
      hint: ["Show hint", "Hide hint"],
    })[name][pressed ? 1 : 0];
    render();
  }

  document.getElementById("newBtn").addEventListener("click", reset);
  document.getElementById("checkBtn").addEventListener("click", checkClaims);
  buttons.names.addEventListener("click", () => toggle("names"));
  buttons.premise.addEventListener("click", () => toggle("premise"));
  buttons.claim.addEventListener("click", () => toggle("claim"));
  buttons.hint.addEventListener("click", () => toggle("hint"));
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "c") checkClaims();
    else if (k === "n") toggle("names");
    else if (k === "p") toggle("premise");
    else if (k === "l") toggle("claim");
    else if (k === "h") toggle("hint");
  });

  syncHandles();
  board.onTheme(render);
  render();
})();
