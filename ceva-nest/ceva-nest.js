"use strict";

/*
 * The page for Ceva Nest: drawing and input only; the nested construction is
 * in ceva-nest-core.js. An SVG holds a triangle, the cevian triangle of a
 * draggable point P, the cevian triangle of a second draggable point Q, and
 * the three lines joining matching corners of the outer and inner triangles.
 * The "proof points" button shows S and T, the feet the article uses.
 */

(function () {
  const Core = CevaNestCore;
  const board = Geom.board(document.getElementById("board"));
  const view = board.viewBox;
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const proofBtn = document.getElementById("proofBtn");
  const checkBtn = document.getElementById("checkBtn");

  let state = Core.start();
  let showNames = false; // the applet's "Show names" checkbox starts unchecked
  let showProof = false; // and so does "Show extra"
  let checked = false;

  const shapes = board.layer("shapes");
  const aux = board.layer("aux");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const outerSides = [0, 1, 2].map(() => board.segment(state.V[0], state.V[1], "outer-side", shapes));
  const qSides = [0, 1, 2].map(() => board.segment(state.V[0], state.V[1], "q-side", shapes));
  const rSides = [0, 1, 2].map(() => board.segment(state.V[0], state.V[1], "r-side", shapes));
  const pCevians = [0, 1, 2].map(() => board.segment(state.V[0], state.V[1], "p-cevian", shapes));
  const qCevians = [0, 1, 2].map(() => board.segment(state.V[0], state.V[1], "q-cevian", shapes));
  const joinLines = [0, 1, 2].map(() => board.segment(state.V[0], state.V[1], "join-line", shapes));
  const proofLines = [0, 1, 2].map(() => [
    board.line(state.V[0], state.V[1], "proof-line", aux),
    board.line(state.V[0], state.V[1], "proof-line alt", aux),
  ]);
  const qDots = [0, 1, 2].map(() => board.point(state.V[0], "q-dot", 3.5, marks));
  const rDots = [0, 1, 2].map(() => board.point(state.V[0], "r-dot", 4, marks));
  const sDots = [0, 1, 2].map(() => board.point(state.V[0], "s-dot", 3, aux));
  const tDots = [0, 1, 2].map(() => board.point(state.V[0], "t-dot", 3, aux));
  const xDot = board.point(state.V[0], "x-dot", 5.5, marks);
  const xLabel = board.label(state.V[0], "X", "glabel x-label", 8, -8, labelsLayer);

  const vLabels = [0, 1, 2].map((i) =>
    board.label(state.V[i], "P" + (i + 1), "glabel v-label", -9, -9, labelsLayer));
  const qLabels = [0, 1, 2].map((i) =>
    board.label(state.V[i], "Q" + (i + 1), "glabel q-label", -9, 17, labelsLayer));
  const rLabels = [0, 1, 2].map((i) =>
    board.label(state.V[i], "R" + (i + 1), "glabel r-label", 6, -7, labelsLayer));
  const sLabels = [0, 1, 2].map((i) =>
    board.label(state.V[i], "S" + (i + 1), "glabel proof-label", -14, 14, aux));
  const tLabels = [0, 1, 2].map((i) =>
    board.label(state.V[i], "T" + (i + 1), "glabel proof-label", -14, -9, aux));

  /**
   * Shows a line under the diagram. `kind` is "done" once the claim has been
   * checked; this illustration has no win or loss, and no other kind is used.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.construct(state);
    const V = state.V;

    for (let k = 0; k < 3; k++) {
      const n = (k + 1) % 3;
      outerSides[k].set(V[k], V[n]);
      qSides[k].set(m.q[k] || V[k], m.q[n] || V[n]);
      rSides[k].set(m.r[k] || V[k], m.r[n] || V[n]);
      pCevians[k].set(V[k], m.q[k] || state.P);
      qCevians[k].set(m.q[k] || state.Q, m.r[k] || state.Q);
      joinLines[k].set(V[k], m.r[k] || V[k]);
    }

    const drawn = m.ok;
    [qSides, rSides, pCevians, qCevians, joinLines].forEach((group) =>
      group.forEach((shape) => shape.show(drawn)));
    qDots.forEach((dot, k) => { dot.show(drawn); if (drawn) dot.set(m.q[k]); });
    rDots.forEach((dot, k) => { dot.show(drawn); if (drawn) dot.set(m.r[k]); });
    xDot.show(drawn && Boolean(m.W));
    xLabel.show(drawn && Boolean(m.W) && showNames);
    if (drawn && m.W) { xDot.set(m.W); xLabel.set(m.W); }

    for (let k = 0; k < 3; k++) {
      vLabels[k].show(showNames);
      qLabels[k].show(showNames && drawn);
      rLabels[k].show(showNames && drawn);
      vLabels[k].set(V[k]);
      if (drawn) { qLabels[k].set(m.q[k]); rLabels[k].set(m.r[k]); }

      const useProof = drawn && showProof && m.S[k] && m.T[k];
      proofLines[k][0].show(Boolean(useProof));
      proofLines[k][1].show(Boolean(useProof));
      sDots[k].show(Boolean(useProof));
      tDots[k].show(Boolean(useProof));
      sLabels[k].show(Boolean(useProof) && showNames);
      tLabels[k].show(Boolean(useProof) && showNames);
      if (useProof) {
        proofLines[k][0].set(V[k], m.S[k]);
        proofLines[k][1].set(V[k], m.T[k]);
        sDots[k].set(m.S[k]);
        tDots[k].set(m.T[k]);
        sLabels[k].set(m.S[k]);
        tLabels[k].set(m.T[k]);
      }
    }

    if (!drawn) {
      say("Move the dots apart so every line has a clear crossing.", null);
    } else if (checked) {
      say("Checked: P1R1, P2R2 and P3R3 meet at X, just as the article says.", "done");
    } else if (showProof) {
      say("S and T are where the cevians cut the opposite sides. The three P–R lines still meet at X.", null);
    } else {
      say("The three lines from P1, P2 and P3 to R1, R2 and R3 meet at X. Press Check the claim to test it.", null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  const clamp = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });
  const handles = [0, 1, 2].map((i) => board.handle("V" + i, state.V[i], {
    r: 8.5, step: 2, shift: 8, layer: handlesLayer, clamp,
    label: `Vertex P${i + 1}. Drag, or focus and use the arrow keys to move it.`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("V" + i, p),
  }));
  const handleP = board.handle("P", state.P, {
    r: 9, step: 2, shift: 8, cls: "geom-handle inner-handle", layer: handlesLayer, clamp,
    label: "Point P. Drag, or focus and use the arrow keys to move the first cevian point.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("P", p),
  });
  const handleQ = board.handle("Q", state.Q, {
    r: 9, step: 2, shift: 8, cls: "geom-handle inner-handle", layer: handlesLayer, clamp,
    label: "Point Q. Drag, or focus and use the arrow keys to move the second cevian point.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("Q", p),
  });

  function newDiagram() {
    state = Core.start();
    checked = false;
    [handles[0], handles[1], handles[2], handleP, handleQ].forEach((h, i) => {
      const p = i < 3 ? state.V[i] : i === 3 ? state.P : state.Q;
      h.set(p);
    });
    render();
    handles[0].node.focus();
  }

  function toggleNames() {
    showNames = !showNames;
    namesBtn.setAttribute("aria-pressed", String(showNames));
    namesBtn.textContent = showNames ? "Hide names" : "Show names";
    render();
  }

  function toggleProof() {
    showProof = !showProof;
    proofBtn.setAttribute("aria-pressed", String(showProof));
    proofBtn.textContent = showProof ? "Hide proof points" : "Show proof points";
    render();
  }

  function checkClaim() {
    const m = Core.construct(state);
    checked = m.ok && m.concurrent;
    render();
    if (!checked) say("Move the dots apart, then check again.", null);
  }

  newBtn.addEventListener("click", newDiagram);
  namesBtn.addEventListener("click", toggleNames);
  proofBtn.addEventListener("click", toggleProof);
  checkBtn.addEventListener("click", checkClaim);
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === "r") newDiagram();
    else if (key === "n") toggleNames();
    else if (key === "e") toggleProof();
    else if (key === "c") checkClaim();
  });

  board.onTheme(render);
  render();
})();
