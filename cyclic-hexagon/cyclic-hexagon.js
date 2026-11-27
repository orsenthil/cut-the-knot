"use strict";

/*
 * The page for Cyclic Hexagon: drawing and input only. The geometry is in
 * cyclic-hexagon-core.js. The board holds a circle, two triangles made from
 * six draggable points, the six perpendiculars to the opposite triangle's
 * sides, and (when asked for) the twelve circles from the applet's proof.
 * It is an illustration, so there is no win or loss.
 */

(function () {
  const Core = CyclicHexagonCore;
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const sidesBox = document.getElementById("sidesBox");
  const radiiBox = document.getElementById("radiiBox");
  const resetBtn = document.getElementById("resetBtn");
  const board = Geom.board(document.getElementById("board"));

  let state = Core.start({});

  /**
   * Shows the line below the picture. `kind` is "win", "lose", "done" or
   * nothing; those three classes are how the player's record learns that a
   * play has ended (assets/progress.js). This illustration never ends, so no
   * kind is ever passed.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers in paint order: proof circles, guides, hexagon, perpendiculars,
     feet, names, handles. */
  const proof = board.layer("proof");
  const guides = board.layer("guides");
  const hexagon = board.layer("hexagon");
  const perp = board.layer("perp");
  const feet = board.layer("feet");
  const labels = board.layer("labels");
  const tops = board.layer("tops");

  const circum = board.circle(state.center, state.radius, "circumcircle", guides);
  const centre = board.point(state.center, "centre-dot", 3, guides);
  const sideCircles = [], halfCircles = [];
  const triA = [], triB = [], hexA = [], hexB = [], perpA = [], perpB = [];
  const footK = [], footL = [], midP = [], midQ = [];
  const nameA = [], nameB = [], nameK = [], nameL = [], nameP = [], nameQ = [];
  for (let i = 0; i < Core.N; i++) {
    sideCircles.push(board.circle(state.center, 1, "side-circle", proof));
    sideCircles.push(board.circle(state.center, 1, "side-circle-b", proof));
    halfCircles.push(board.circle(state.center, 1, "half-circle", proof));
    halfCircles.push(board.circle(state.center, 1, "half-circle-b", proof));
    triA.push(board.segment(state.center, state.center, "triangle-a", guides));
    triB.push(board.segment(state.center, state.center, "triangle-b", guides));
    hexA.push(board.segment(state.center, state.center, "hex-side-a", hexagon));
    hexB.push(board.segment(state.center, state.center, "hex-side-b", hexagon));
    perpA.push(board.segment(state.center, state.center, "perp-a", perp));
    perpB.push(board.segment(state.center, state.center, "perp-b", perp));
    footK.push(board.point(state.center, "foot-k", 3.2, feet));
    footL.push(board.point(state.center, "foot-l", 3.2, feet));
    midP.push(board.point(state.center, "mid-p", 3, feet));
    midQ.push(board.point(state.center, "mid-q", 3, feet));
    nameA.push(board.label(state.center, "A" + i, "pt-label a-label", 8, -9, labels));
    nameB.push(board.label(state.center, "B" + i, "pt-label b-label", 8, -9, labels));
    nameK.push(board.label(state.center, "K" + i, "pt-label k-label", 7, -7, labels));
    nameL.push(board.label(state.center, "L" + i, "pt-label l-label", 7, -7, labels));
    nameP.push(board.label(state.center, "P" + i, "pt-label p-label", 7, -7, labels));
    nameQ.push(board.label(state.center, "Q" + i, "pt-label q-label", 7, -7, labels));
  }
  const nameO = board.label(state.center, "O", "pt-label", 8, -8, labels);

  /* The handle only moves along the circle, as in the applet's
     RestrictToCircle/Mover.UpdateLocation. The core does the projection. */
  const clampToCircle = (q, name) => Core.movePoint(state, name, q)[name[0]][Number(name[1])];
  const handles = [];
  for (const kind of ["A", "B"]) {
    for (let i = 0; i < Core.N; i++) {
      const name = kind + i;
      handles.push(board.handle(name, state[kind][i], {
        r: 10, step: 4, shift: 5, cls: "geom-handle " + (kind === "A" ? "a-handle" : "b-handle"),
        layer: tops, clamp: clampToCircle,
        label: `Point ${name} on the circle. Drag it round the circle, or focus it and use the arrow keys.`,
        describe: (p) => {
          const deg = Math.round(((Math.atan2(p.y - state.center.y, p.x - state.center.x) * 180 / Math.PI) + 360) % 360);
          return `at ${deg} degrees on the circle`;
        },
        onMove: (p, which) => { state = Core.movePoint(state, which, p); render(); },
      }));
    }
  }
  const handleNamed = (name) => handles.find((h) => h.name === name);

  function render() {
    const g = Core.compute(state);
    const n = Core.N;
    const next = (i) => (i + 1) % n, prev = (i) => (i + n - 1) % n;

    circum.set(state.center, state.radius);
    centre.set(state.center, 3);

    for (let i = 0; i < n; i++) {
      sideCircles[2 * i].set(g.circleA[i].center, g.circleA[i].radius);
      sideCircles[2 * i + 1].set(g.circleB[i].center, g.circleB[i].radius);
      halfCircles[2 * i].set(g.circleOA[i].center, g.circleOA[i].radius);
      halfCircles[2 * i + 1].set(g.circleOB[i].center, g.circleOB[i].radius);
      sideCircles[2 * i].show(state.showCircles1);
      sideCircles[2 * i + 1].show(state.showCircles1);
      halfCircles[2 * i].show(state.showCircles2);
      halfCircles[2 * i + 1].show(state.showCircles2);

      triA[i].set(state.A[prev(i)], state.A[next(i)]);
      triB[i].set(state.B[prev(i)], state.B[next(i)]);
      hexA[i].set(state.A[i], state.B[next(i)]);
      hexB[i].set(state.B[i], state.A[next(i)]);
      perpA[i].set(state.A[i], g.K[i]);
      perpB[i].set(state.B[i], g.L[i]);
      footK[i].set(g.K[i], 3.2);
      footL[i].set(g.L[i], 3.2);
      midP[i].set(g.P[i], 3);
      midQ[i].set(g.Q[i], 3);
      midP[i].show(state.showCircles1);
      midQ[i].show(state.showCircles1);

      /* Push each name outwards from the circle centre so labels of nearby
         points do not sit on top of each other. */
      const place = (label, at, text) => {
        const dx = at.x < state.center.x ? -18 : 8;
        const dy = at.y < state.center.y ? -8 : 16;
        label.set(at, text, dx, dy);
      };
      place(nameA[i], state.A[i], "A" + i);
      place(nameB[i], state.B[i], "B" + i);
      place(nameK[i], g.K[i], "K" + i);
      place(nameL[i], g.L[i], "L" + i);
      place(nameP[i], g.P[i], "P" + i);
      place(nameQ[i], g.Q[i], "Q" + i);
      for (const label of [nameA[i], nameB[i], nameK[i], nameL[i], nameP[i], nameQ[i]]) {
        label.show(state.showNames && (label !== nameP[i] && label !== nameQ[i] || state.showCircles1));
      }
      handleNamed("A" + i).set(state.A[i]);
      handleNamed("B" + i).set(state.B[i]);
    }
    centre.show(state.showCircles2);
    nameO.set(state.center);
    nameO.show(state.showNames && state.showCircles2);

    namesBox.checked = state.showNames;
    sidesBox.checked = state.showCircles1;
    radiiBox.checked = state.showCircles2;
    say(Core.describe(state));

    // The six points in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  resetBtn.addEventListener("click", () => { state = Core.reset(state); render(); });
  namesBox.addEventListener("change", () => { state = Core.toggle(state, "showNames"); render(); });
  sidesBox.addEventListener("change", () => { state = Core.toggle(state, "showCircles1"); render(); });
  radiiBox.addEventListener("change", () => { state = Core.toggle(state, "showCircles2"); render(); });

  board.onTheme(render);
  render();
})();
