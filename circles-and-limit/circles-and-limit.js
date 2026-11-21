"use strict";

/*
 * Browser page for the Two Circles and a Limit demo. All of the mathematics
 * lives in circles-and-limit-core.js; this file only draws and takes input.
 *
 * The canvas shows the fixed circle (radius 3 at (3,0)), the small variable
 * circle at the origin, the point A where it meets the positive y-axis, the
 * upper crossing B, and the line AB extended to E on the x-axis. A marker on
 * the axis shows the limit at x = 12. Drag the top of the small circle (point
 * A) or use the slider to change its radius; arrow keys do the same when the
 * picture has focus. The "hint" and "names" checkboxes and the proof picker
 * add the geometric construction and the point labels.
 */

(function () {
  const Core = CirclesAndLimitCore;
  const el = (id) => document.getElementById(id);
  const canvas = el("plot");
  const ctx = canvas.getContext("2d");
  const statusEl = el("status");
  const rInput = el("rInput");
  const rReadout = el("rReadout");
  const eReadout = el("eReadout");
  const namesCheck = el("namesCheck");
  const hintCheck = el("hintCheck");
  const proofSelect = el("proofSelect");
  const newBtn = el("newBtn");

  let state = Core.start({});
  let dragging = false;

  /** A line under the picture. "done" tells the record a demo was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function colour(styles, name, fallback) {
    return styles.getPropertyValue(name).trim() || fallback;
  }

  /** The rectangle of mathematical space shown in the canvas, for a given a. */
  function view() {
    const a = state.a;
    return { xMin: -a - 1, xMax: 4 * a + 1, yMin: -2 * a - 1, yMax: 2 * a + 1 };
  }

  function scaleFor(v) {
    return Math.min(canvas.width / (v.xMax - v.xMin), canvas.height / (v.yMax - v.yMin));
  }

  function toPx(p, v, k) {
    return { x: (p.x - v.xMin) * k, y: (v.yMax - p.y) * k };
  }

  function dot(p, v, k, radius, fill, stroke) {
    const q = toPx(p, v, k);
    ctx.beginPath();
    ctx.arc(q.x, q.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function label(p, v, k, text, colourValue, dx, dy) {
    const q = toPx(p, v, k);
    ctx.fillStyle = colourValue;
    ctx.font = "600 16px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, q.x + (dx || 9), q.y + (dy || -10));
  }

  function circle(centre, radius, v, k, stroke, dash) {
    const q = toPx(centre, v, k);
    ctx.beginPath();
    ctx.arc(q.x, q.y, radius * k, 0, Math.PI * 2);
    ctx.setLineDash(dash || []);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function segment(p, q, v, k, stroke, dash, width) {
    const a = toPx(p, v, k);
    const b = toPx(q, v, k);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.setLineDash(dash || []);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width || 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function draw() {
    const styles = getComputedStyle(document.documentElement);
    const stage = colour(styles, "--stage", "#f3f5f8");
    const ink = colour(styles, "--ink", "#1f2430");
    const muted = colour(styles, "--muted", "#5d6472");
    const accent = colour(styles, "--accent", "#5b4ee8");
    const good = colour(styles, "--good", "#15803d");
    const highlight = colour(styles, "--highlight", "rgba(255,214,10,0.35)");

    const v = view();
    const k = scaleFor(v);
    const pic = Core.compute(state);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = stage;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // The two axes through the origin.
    segment({ x: v.xMin, y: 0 }, { x: v.xMax, y: 0 }, v, k, muted, [], 1.5);
    segment({ x: 0, y: v.yMin }, { x: 0, y: v.yMax }, v, k, muted, [5, 6], 1.5);

    // The fixed circle (accent) and the shrinking circle (good).
    circle(pic.S, state.a, v, k, accent);
    circle(pic.O, state.r, v, k, good);

    // The line AB, extended to E on the axis.
    if (pic.valid) {
      segment(pic.A, pic.E, v, k, ink, [7, 5], 2);
    }

    // The limit marker at x = 4a, with its label.
    segment(pic.limit, { x: pic.limit.x, y: 0.55 * state.a }, v, k, muted, [3, 5], 1.5);
    dot(pic.limit, v, k, 6, highlight, muted);
    label(pic.limit, v, k, "limit = " + Core.limitX(state.a), muted, -8, -18);

    // The geometric proof: auxiliary points D and F and their helper lines.
    if (state.showHint && pic.valid && pic.D && pic.F) {
      segment(pic.B, pic.D, v, k, accent, [4, 4], 1.5);
      segment(pic.O, pic.F, v, k, accent, [4, 4], 1.5);
      dot(pic.D, v, k, 5, accent, ink);
      dot(pic.F, v, k, 5, accent, ink);
      if (state.showNames) {
        label(pic.D, v, k, "D", accent);
        label(pic.F, v, k, "F", accent);
      }
    }

    // The named points. E and the drag handle get their own colours.
    if (pic.valid) {
      dot(pic.B, v, k, 5, ink);
    }
    dot(pic.A, v, k, 8, highlight, good); // the drag handle at the top
    dot({ x: 0, y: -state.r }, v, k, 4, good);
    dot(pic.E, v, k, 6, good, ink);
    dot(pic.O, v, k, 4, ink);
    dot(pic.S, v, k, 4, ink);

    if (state.showNames) {
      if (pic.valid) label(pic.B, v, k, "B", ink);
      label(pic.A, v, k, "A", good, 10, -12);
      label({ x: 0, y: -state.r }, v, k, "C", good, 9, 10);
      label(pic.E, v, k, "E", good, 9, 16);
      label(pic.O, v, k, "O", ink, -18, 14);
      label(pic.S, v, k, "S", ink, 8, 14);
    }
  }

  function render() {
    rInput.value = String(state.r);
    rReadout.textContent = state.r.toFixed(2);
    const pic = Core.compute(state);
    eReadout.textContent = pic.E.x.toFixed(2);
    namesCheck.checked = state.showNames;
    hintCheck.checked = state.showHint;
    proofSelect.value = String(state.proof);
    draw();
    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        a: state.a,
        r: state.r,
        proof: state.proof,
        showNames: state.showNames,
        showHint: state.showHint,
        E: { x: +pic.E.x.toFixed(4), y: +pic.E.y.toFixed(4) },
        explored: state.explored,
      });
    }
  }

  function change(next, action) {
    if (next === state) return;
    state = next;
    render();
    say(Core.describe(action, state), "done");
  }

  function pointer(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function setRFromPointer(p) {
    const v = view();
    const k = scaleFor(v);
    const y = v.yMax - p.y / k; // invert the y mapping; A = (0, r)
    const r = Math.min(Core.R_MAX, Math.max(Core.R_MIN, +y.toFixed(2)));
    change(Core.setR(state, r), "r");
  }

  canvas.addEventListener("pointerdown", (e) => {
    const p = pointer(e);
    const v = view();
    const k = scaleFor(v);
    const handle = toPx({ x: 0, y: state.r }, v, k);
    if (Math.hypot(p.x - handle.x, p.y - handle.y) > 30) return;
    e.preventDefault();
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    e.preventDefault();
    setRFromPointer(pointer(e));
  });
  function endDrag() { dragging = false; }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 0.5 : 0.1;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        change(Core.setR(state, Math.min(Core.R_MAX, +(state.r + step).toFixed(2))), "r"); break;
      case "ArrowDown":
      case "ArrowLeft":
        change(Core.setR(state, Math.max(Core.R_MIN, +(state.r - step).toFixed(2))), "r"); break;
      case "Home":
        change(Core.setR(state, Core.R_MIN), "r"); break;
      case "End":
        change(Core.setR(state, Core.R_MAX), "r"); break;
      case "Enter":
        e.preventDefault();
        change(Core.setShowHint(state, !state.showHint), "hint"); break;
      default: return;
    }
    e.preventDefault();
  });

  rInput.addEventListener("input", () => change(Core.setR(state, Number(rInput.value)), "r"));
  namesCheck.addEventListener("change", () =>
    change(Core.setShowNames(state, namesCheck.checked), "names"));
  hintCheck.addEventListener("change", () =>
    change(Core.setShowHint(state, hintCheck.checked), "hint"));
  proofSelect.addEventListener("change", () =>
    change(Core.setProof(state, Number(proofSelect.value)), "proof"));

  newBtn.addEventListener("click", () => {
    state = Core.start({});
    render();
    say(Core.describe("reset", state));
  });

  window.addEventListener("themechange", draw);

  render();
  say("Drag the top of the small circle, or use the slider, to shrink it. Watch where the point E goes.");
})();
