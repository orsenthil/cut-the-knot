"use strict";

/*
 * The page for Chvatal's Art Gallery theorem: drawing and input only.
 *
 * The play area is a square canvas holding the polygon, its drawn diagonals
 * and (once it is triangulated) a ring round every corner of the least
 * frequent colour. A transparent layer of real buttons sits exactly on top of
 * each vertex, so a corner can be pressed with a mouse, a touch or the
 * keyboard. The rules and the colouring live in chvatal-core.js.
 */

(function () {
  const Core = ChvatalCore;
  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const popBtn = document.getElementById("popBtn");
  const nSpin = document.getElementById("nSpin");
  const drawRadio = document.getElementById("modeDraw");
  const moveRadio = document.getElementById("modeMove");

  const canvas = document.getElementById("polyCanvas");
  const ctx = canvas.getContext("2d");
  const vertexLayer = document.getElementById("vertices");
  const countEl = document.getElementById("diagCount");

  let state = null;
  let selected = null; // the first corner of the diagonal being drawn
  let vertexButtons = [];
  let dragging = null; // index of the corner being moved, in rearrange mode
  let size = 240;
  let scale = 1;
  const CX = 160;
  const CY = 100;
  const R = 70;

  /**
   * Shows a line under the game. "done" also tells the record the demo ended.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** The shared colours, read from the site's tokens at draw time. */
  function readTokens() {
    const cs = getComputedStyle(document.documentElement);
    const token = (name) => cs.getPropertyValue(name).trim();
    return {
      ink: token("--ink"),
      border: token("--border-strong"),
      accent: token("--accent"),
      soft: token("--accent-soft"),
      good: token("--good"),
      highlight: token("--highlight"),
      surface: token("--surface"),
    };
  }

  /** Core polygon coordinates -> canvas pixels. */
  function toCanvas(p) {
    return { x: size / 2 + (p.x - CX) * scale, y: size / 2 + (p.y - CY) * scale };
  }

  /** Canvas pixels -> core polygon coordinates (for dragging a corner). */
  function toCore(x, y) {
    return { x: CX + (x - size / 2) / scale, y: CY + (y - size / 2) / scale };
  }

  /** Size the board so even 40 corners keep room around them. */
  function layout() {
    size = Math.max(240, state.n * 9);
    canvas.width = size;
    canvas.height = size;
    canvas.style.aspectRatio = "1 / 1";
    scale = (size / 2 - 22) / R;
  }

  function line(a, b, color, width, dash) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Draw the polygon, the diagonals and the guard corners. */
  function draw() {
    const tok = readTokens();
    const pts = state.points.map(toCanvas);
    ctx.clearRect(0, 0, size, size);

    // The polygon's interior, lightly tinted.
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = tok.soft;
    ctx.fill();

    // The outline of the polygon.
    for (let i = 0; i < state.n; i++) {
      line(pts[i], pts[(i + 1) % state.n], tok.ink, 2);
    }

    // The diagonals already drawn.
    for (const d of state.diagonals) line(pts[d.a], pts[d.b], tok.accent, 2.5, [6, 4]);

    // The guard corners, ringed once the triangulation is finished.
    if (state.analysis) {
      for (const g of state.analysis.guards) {
        const p = pts[g];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = tok.good;
        ctx.globalAlpha = 0.28;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Build the transparent row of vertex buttons (only when N changes). */
  function buildVertices() {
    vertexLayer.textContent = "";
    vertexButtons = [];
    for (let i = 0; i < state.n; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.id = "v" + i;
      b.className = "vertex";
      b.setAttribute("aria-label", "Vertex " + (i + 1) + " of " + state.n);
      b.dataset.index = String(i);
      b.addEventListener("click", () => pressVertex(i));
      b.addEventListener("pointerdown", (e) => startDrag(e, i));
      b.addEventListener("pointermove", moveDrag);
      b.addEventListener("pointerup", endDrag);
      b.addEventListener("pointercancel", endDrag);
      b.addEventListener("keydown", onVertexKey);
      vertexLayer.appendChild(b);
      vertexButtons.push(b);
    }
  }

  /** Put the buttons where their vertices are, and say what each one is. */
  function placeVertices() {
    const pts = state.points.map(toCanvas);
    vertexButtons.forEach((b, i) => {
      b.style.left = (pts[i].x / size) * 100 + "%";
      b.style.top = (pts[i].y / size) * 100 + "%";
      b.setAttribute("aria-label", "Vertex " + (i + 1) + " of " + state.n +
        (state.analysis && state.analysis.guards.indexOf(i) >= 0
          ? ", a guard corner" : ""));
      b.classList.toggle("selected", selected === i);
      b.classList.toggle("guard", !!(state.analysis && state.analysis.guards.indexOf(i) >= 0));
    });
  }

  function progressText() {
    const need = Core.neededDiagonals(state.n);
    const have = state.diagonals.length;
    if (state.finished) {
      const g = state.analysis.guards.map((i) => i + 1).join(", ");
      return "Triangulated! The " + state.analysis.guardCount +
        " marked corner" + (state.analysis.guardCount === 1 ? "" : "s") +
        " (" + g + ") can see the whole polygon.";
    }
    return "Diagonal " + have + " of " + need + ".";
  }

  function render() {
    draw();
    placeVertices();
    countEl.textContent = state.finished
      ? "A complete triangulation"
      : state.diagonals.length + " of " + Core.neededDiagonals(state.n) + " diagonals";
    popBtn.disabled = state.diagonals.length === 0;

    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        n: state.n,
        diagonals: state.diagonals,
        mode: state.mode,
        finished: state.finished,
        guards: state.analysis ? state.analysis.guards : [],
        message: state.message,
      });
    }
  }

  /** A vertex was pressed: choose it, or complete the diagonal. */
  function pressVertex(i) {
    if (state.mode === "move") return; // dragging is handled by pointer events
    if (selected === null) {
      selected = i;
      say("Corner " + (i + 1) + " chosen. Now choose another corner.", null);
      render();
      return;
    }
    const from = selected;
    selected = null;
    const next = Core.move(state, { type: "diagonal", a: from, b: i });
    if (!next) return;
    state = next;
    render();
    if (state.message) {
      say(state.message);
    } else if (Core.result(state) === "done") {
      say(progressText(), "done");
    } else {
      say(progressText());
    }
  }

  /** Left/Right wander between corners; Enter/Space presses the focused one. */
  function onVertexKey(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      const next = (i + step + state.n) % state.n;
      vertexButtons[next].focus();
    }
  }

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function startDrag(e, i) {
    if (state.mode !== "move") return;
    dragging = i;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function moveDrag(e) {
    if (dragging === null) return;
    const p = toCore(pointerPos(e).x, pointerPos(e).y);
    state = Core.move(state, { type: "setPoint", index: dragging, x: p.x, y: p.y });
    render();
  }

  function endDrag() {
    if (dragging === null) return;
    dragging = null;
    if (state.message) say(state.message);
    else say("Corner moved. " + progressText());
    render();
  }

  function newGame() {
    const n = Core.clampN(Number(nSpin.value));
    nSpin.value = String(n);
    state = Core.start({ n, seed: n + Date.now() % 1000 });
    selected = null;
    dragging = null;
    if (drawRadio.checked) state = Core.move(state, { type: "mode", mode: "draw" });
    else state = Core.move(state, { type: "mode", mode: "move" });
    layout();
    buildVertices();
    say("Draw diagonals between corners that do not touch.");
    render();
  }

  newBtn.addEventListener("click", newGame);
  popBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "pop" });
    selected = null;
    say("Last diagonal removed. " + progressText());
    render();
  });
  nSpin.addEventListener("change", newGame);
  drawRadio.addEventListener("change", () => {
    state = Core.move(state, { type: "mode", mode: "draw" });
    selected = null;
    say("Draw diagonals between corners that do not touch.");
    render();
  });
  moveRadio.addEventListener("change", () => {
    state = Core.move(state, { type: "mode", mode: "move" });
    selected = null;
    say("Drag a corner to reshape the polygon.");
    render();
  });
  window.addEventListener("themechange", draw);

  newGame();
})();
