"use strict";

/*
 * Diagonal Count - the UI. The rules are all in diagonals-core.js; this file
 * draws the polygon and turns pointing at vertices into attempted diagonals.
 *
 * Two ways to join a pair of vertices, because the applet's drag is awkward
 * on a phone and impossible with a keyboard: drag from one to the other, or
 * tap one and then the other. A vertex is also a focusable button, so Enter
 * or Space does the same thing as a tap.
 *
 * Hit testing is "nearest vertex within a radius", like the applet's
 * FindNearest, rather than relying on the drawn circles: it keeps a 40-gon
 * usable with a fingertip.
 */

(function () {
  const svg = document.getElementById("poly");
  const sidesEl = document.getElementById("sides");
  const diagEl = document.getElementById("diags");
  const rubberEl = document.getElementById("rubber");
  const vertsEl = document.getElementById("verts");
  const statusEl = document.getElementById("status");
  const countEl = document.getElementById("count");
  const sizeIn = document.getElementById("sizeIn");
  const resetBtn = document.getElementById("resetBtn");

  const SVG_NS = "http://www.w3.org/2000/svg";
  const CENTER = 200;

  /* The applet's four refusals, from DiagonalsCanvas.m_Results. */
  const REFUSAL = {
    same: "A diagonal of zero length? Indeed!",
    side: "That one is a side of the polygon, not a diagonal.",
    crosses: "Diagonals are not allowed to cross.",
    duplicate: "That diagonal is already drawn.",
    finished: "No more will fit. Press Reset to start again.",
  };

  let state = null;
  let points = [];
  let hitR = 20;
  let selected = null; // a vertex waiting for its partner
  let dragFrom = null; // the vertex the current press started on
  let dragging = false;

  function el(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    for (const k in attrs) node.setAttribute(k, String(attrs[k]));
    return node;
  }

  /* --------------------------------------------------------------- layout */

  function build() {
    const n = state.n;
    const spacing = 2 * 155 * Math.sin(Math.PI / n);
    // Shrink the dots on a crowded polygon so the sides stay visible. The hit
    // radius below does not shrink with them, so they stay easy to tap.
    const r = Math.max(4, Math.min(9, spacing * 0.28));
    const ring = 155 - r;
    hitR = Math.max(11, Math.min(24, spacing * 0.5));

    points = [];
    for (let i = 0; i < n; i++) {
      const t = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      points.push({ x: CENTER + ring * Math.cos(t), y: CENTER + ring * Math.sin(t) });
    }

    sidesEl.setAttribute("points", points.map((p) => p.x.toFixed(2) + "," + p.y.toFixed(2)).join(" "));

    while (vertsEl.firstChild) vertsEl.removeChild(vertsEl.firstChild);
    for (let i = 0; i < n; i++) {
      const dot = el("circle", {
        class: "vertex",
        cx: points[i].x,
        cy: points[i].y,
        r: r,
        tabindex: "0",
        role: "button",
        "aria-label": "Vertex " + (i + 1) + " of " + n,
      });
      dot.dataset.i = String(i);
      vertsEl.appendChild(dot);
    }
    svg.setAttribute("aria-label", "A convex polygon with " + n + " vertices");
  }

  function render() {
    while (diagEl.firstChild) diagEl.removeChild(diagEl.firstChild);
    for (const [a, b] of state.diagonals) {
      diagEl.appendChild(el("line", {
        class: "diagonal",
        x1: points[a].x, y1: points[a].y, x2: points[b].x, y2: points[b].y,
      }));
    }
    for (const dot of vertsEl.children) {
      dot.classList.toggle("picked", Number(dot.dataset.i) === selected);
    }
    const drawn = state.diagonals.length;
    const max = DiagonalsCore.maxDiagonals(state.n);
    countEl.textContent = "Diagonals: " + drawn + " / " + max;
    svg.classList.toggle("done", DiagonalsCore.isComplete(state));
  }

  function say(text, cls) {
    statusEl.className = cls || "";
    statusEl.textContent = text;
  }

  function showRubber(to) {
    if (dragFrom === null || !to) {
      rubberEl.setAttribute("class", "hidden");
      return;
    }
    const from = points[dragFrom];
    rubberEl.setAttribute("class", "");
    rubberEl.setAttribute("x1", from.x);
    rubberEl.setAttribute("y1", from.y);
    rubberEl.setAttribute("x2", to.x);
    rubberEl.setAttribute("y2", to.y);
  }

  /* ------------------------------------------------------------- pointing */

  /** Where an event landed, in the SVG's own coordinates. */
  function svgPoint(ev) {
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    return {
      x: ((ev.clientX - box.left) * 400) / box.width,
      y: ((ev.clientY - box.top) * 400) / box.height,
    };
  }

  /** The nearest vertex within hitR, or null. Mirrors FindNearest. */
  function nearest(p) {
    if (!p) return null;
    let best = null;
    let bestD = hitR;
    for (let i = 0; i < points.length; i++) {
      const d = Math.hypot(points[i].x - p.x, points[i].y - p.y);
      if (d <= bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function attempt(a, b) {
    const verdict = DiagonalsCore.add(state, a, b);
    if (verdict !== "ok") {
      say(REFUSAL[verdict] || "That one is not allowed.", "");
      return;
    }
    if (DiagonalsCore.isComplete(state)) {
      const n = state.n;
      say(
        "Finished with " + DiagonalsCore.maxDiagonals(n) + " diagonals, cutting the polygon into " +
          DiagonalsCore.triangleCount(n) + " triangles. Press Reset and draw them in a completely " +
          "different order — you will get the same two numbers.",
        "win",
      );
    } else {
      say("", "");
    }
  }

  /** A tap, a click or a keypress on a vertex: pick it, or join it up. */
  function choose(i) {
    if (selected !== null && selected !== i) {
      attempt(selected, i);
      selected = null;
    } else {
      // Only picking a corner up or putting it down: clear any refusal still
      // on screen from the last attempt, so it does not look like a reply.
      selected = selected === i ? null : i;
      if (!DiagonalsCore.isComplete(state)) say("", "");
    }
    render();
  }

  svg.addEventListener("pointerdown", function (ev) {
    // A size still being typed commits on blur, and that rebuilds the polygon.
    // Get it over with before the gesture reads any coordinates, or the
    // vertices move underneath it.
    if (document.activeElement === sizeIn) sizeIn.blur();
    const i = nearest(svgPoint(ev));
    if (i === null) {
      selected = null;
      render();
      return;
    }
    dragFrom = i;
    dragging = true;
    // preventDefault() below stops the drag selecting text, but it also stops
    // the browser moving focus here - so move it by hand. Leaving focus in the
    // size box would mean its change event fired later, mid-game.
    const dot = vertsEl.children[i];
    if (dot && dot !== document.activeElement) dot.focus({ preventScroll: true });
    ev.preventDefault();
  });

  svg.addEventListener("pointermove", function (ev) {
    if (!dragging) return;
    showRubber(svgPoint(ev));
    ev.preventDefault();
  });

  function endDrag(ev) {
    showRubber(null);
    if (dragFrom === null) return;
    const from = dragFrom;
    dragFrom = null;
    dragging = false;
    const to = nearest(svgPoint(ev));
    if (to !== null && to !== from) {
      // Dragged across to another vertex.
      selected = null;
      attempt(from, to);
      render();
    } else if (to === from) {
      // Pressed and released on the same vertex: treat it as a tap.
      choose(from);
    }
  }

  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", function () {
    showRubber(null);
    dragFrom = null;
    dragging = false;
  });

  vertsEl.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const i = Number(ev.target.dataset.i);
    if (!Number.isInteger(i)) return;
    ev.preventDefault();
    choose(i);
  });

  /* --------------------------------------------------------------- resets */

  /** Rebuild only when the polygon really changed, so a stray change event
   *  from the number input cannot wipe a game in progress. */
  function resize() {
    const n = readSize();
    if (state && n === state.n) return;
    reset();
  }

  function readSize() {
    let n = parseInt(sizeIn.value, 10);
    if (!Number.isFinite(n)) n = DiagonalsCore.MIN_N;
    n = Math.min(DiagonalsCore.MAX_N, Math.max(DiagonalsCore.MIN_N, n));
    if (String(n) !== sizeIn.value) sizeIn.value = String(n);
    return n;
  }

  function reset() {
    state = DiagonalsCore.create(readSize());
    selected = null;
    dragFrom = null;
    dragging = false;
    showRubber(null);
    build();
    render();
    say(
      "Join two corners that are not neighbours. How many diagonals do you think will fit?",
      "",
    );
  }

  sizeIn.addEventListener("change", resize);
  resetBtn.addEventListener("click", reset);

  reset();
})();
