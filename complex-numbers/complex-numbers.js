"use strict";

/*
 * The page for Complex Numbers: drawing and input only; the arithmetic lives
 * in complex-numbers-core.js. One canvas shows the plane (400 by 300 logical
 * pixels, 20 to the unit, like the applet) with the two numbers A and B as
 * draggable dots. Drag with a pointer, or focus the canvas, press A or B and
 * move with the arrow keys (half a unit a step). Two groups of radio buttons
 * choose what is shown and what is fixed. A table underneath gives every value
 * in numbers so nothing depends on seeing the picture.
 */

(function () {
  const Core = ComplexNumbersCore;
  const board = document.getElementById("board");
  const ctx = board.getContext("2d");
  const statusEl = document.getElementById("status");
  const readout = document.getElementById("readout");
  const newBtn = document.getElementById("newBtn");
  const W = Core.WIDTH, H = Core.HEIGHT, S = Core.SCALE;
  const RED = "#d4565a", BLUE = "#4c9be0", GREEN = "#3aa675";

  let state = Core.start();
  let selected = "a";
  let dragging = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const px = (z) => ({ x: W / 2 + S * z.x, y: H / 2 - S * z.y });
  const unit = (p) => ({ x: (p.x - W / 2) / S, y: -(p.y - H / 2) / S });
  const colour = (styles, name, fallback) => styles.getPropertyValue(name).trim() || fallback;

  function dot(p, fill, r, ring) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function seg(p, q, colourValue, width, dash) {
    ctx.beginPath();
    ctx.setLineDash(dash || []);
    ctx.strokeStyle = colourValue;
    ctx.lineWidth = width;
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function label(text, p, colourValue) {
    ctx.fillStyle = colourValue;
    ctx.font = "bold 15px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(text, Math.max(2, Math.min(W - 18, p.x + 8)), Math.max(16, Math.min(H - 2, p.y - 6)));
  }

  function draw() {
    const styles = getComputedStyle(document.documentElement);
    const stage = colour(styles, "--stage", "#f3f5f8");
    const ink = colour(styles, "--ink", "#1f2430");
    const muted = colour(styles, "--muted", "#5d6472");
    const accent = colour(styles, "--accent", "#5b4ee8");
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = stage;
    ctx.fillRect(0, 0, W, H);

    // Axes with a tick at every unit, as the applet draws them.
    seg({ x: 0, y: H / 2 }, { x: W, y: H / 2 }, muted, 1);
    seg({ x: W / 2, y: 0 }, { x: W / 2, y: H }, muted, 1);
    for (let k = -10; k <= 10; k++) {
      seg({ x: W / 2 + S * k, y: H / 2 - 3 }, { x: W / 2 + S * k, y: H / 2 + 3 }, muted, 1);
      if (Math.abs(k) <= 7) seg({ x: W / 2 - 3, y: H / 2 - S * k }, { x: W / 2 + 3, y: H / 2 - S * k }, muted, 1);
    }
    ctx.fillStyle = muted;
    ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("real", W - 4, H / 2 + 6);
    ctx.textAlign = "left";
    ctx.fillText("imaginary", W / 2 + 6, 4);

    const O = px({ x: 0, y: 0 });
    const A = px(state.a), B = px(state.b);

    // What the fixing choice looks like: the circles, or the lines through the origin.
    if (state.constraint === "radius") {
      for (const w of ["a", "b"]) { ctx.beginPath(); ctx.setLineDash([4, 4]); ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.arc(O.x, O.y, state.lock[w] * S, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]); }
      if (state.mode === "common") {
        ctx.beginPath(); ctx.setLineDash([2, 4]); ctx.strokeStyle = GREEN; ctx.lineWidth = 1;
        ctx.arc(O.x, O.y, state.lock.a * state.lock.b * S, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
      }
    } else if (state.constraint === "angle") {
      for (const w of ["a", "b"]) {
        const t = state.lock[w];
        seg(px({ x: -50 * Math.cos(t), y: -50 * Math.sin(t) }), px({ x: 50 * Math.cos(t), y: 50 * Math.sin(t) }), accent, 1, [4, 4]);
      }
    }

    // The shown result.
    const shown = Core.shown(state);
    if (state.mode === "conjugate") {
      shown.points.forEach((z, i) => { const p = px(z); seg(O, p, muted, 1, [3, 3]); dot(p, null, 6, i ? BLUE : RED); label(i ? "B̄" : "Ā", p, i ? BLUE : RED); });
    } else if (state.mode === "sum") {
      const p = px(shown.points[0]);
      seg(A, p, muted, 1, [3, 3]); seg(B, p, muted, 1, [3, 3]); seg(O, p, GREEN, 2);
      dot(p, GREEN, 5); label("A + B", p, GREEN);
    } else if (shown.points.length) {
      const p = px(shown.points[0]);
      seg(O, p, GREEN, 2); dot(p, GREEN, 5); label(shown.name, p, GREEN);
    }

    // The two numbers and the vectors to them.
    seg(O, A, RED, 2); seg(O, B, BLUE, 2);
    dot(A, RED, 7, selected === "a" ? ink : null);
    dot(B, BLUE, 7, selected === "b" ? ink : null);
    label("A", A, RED); label("B", B, BLUE);
  }

  function rowsHtml() {
    const sh = Core.shown(state);
    const rows = [["A", state.a, RED], ["B", state.b, BLUE]];
    rows.forEach(() => {});
    const out = [];
    const add = (name, z) => out.push([name, Core.fmt(z), Core.modulus(z).toFixed(2), (Core.argument(z) * 180 / Math.PI).toFixed(1) + "°"]);
    add("A", state.a); add("B", state.b);
    add("A + B", Core.add(state.a, state.b));
    add("A × B", Core.commonProduct(state.a, state.b));
    add("real product", Core.realProduct(state.a, state.b));
    add("complex product", Core.complexProduct(state.a, state.b));
    return { rows: out, shown: sh };
  }

  function updateReadout() {
    const { rows, shown } = rowsHtml();
    readout.textContent = "";
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      r.forEach((cell, i) => {
        const td = document.createElement(i === 0 ? "th" : "td");
        if (i === 0) td.scope = "row";
        td.textContent = cell;
        tr.appendChild(td);
      });
      if (shown.name && r[0] === shown.name) tr.className = "shown";
      readout.appendChild(tr);
    });
    document.getElementById("axA").value = state.a.x.toFixed(2);
    document.getElementById("ayA").value = state.a.y.toFixed(2);
    document.getElementById("axB").value = state.b.x.toFixed(2);
    document.getElementById("ayB").value = state.b.y.toFixed(2);
  }

  function describe() {
    const fm = Core.fmt;
    const sh = Core.shown(state);
    let s = `A = ${fm(state.a)}, B = ${fm(state.b)}.`;
    if (state.mode === "conjugate") s += ` Conjugates: ${fm(sh.points[0])} and ${fm(sh.points[1])}.`;
    else if (sh.points.length) s += ` ${sh.name} = ${fm(sh.points[0])}.`;
    return s;
  }

  function render() {
    draw();
    updateReadout();
    document.querySelector(`input[name="mode"][value="${state.mode}"]`).checked = true;
    document.querySelector(`input[name="fix"][value="${state.constraint}"]`).checked = true;
    if (window.Track) window.Track.state(state);
  }

  function apply(m, announce) {
    const next = Core.move(state, m);
    if (!next) return;
    state = next;
    render();
    say(describe(), Core.result(state));
  }

  function toPlane(e) {
    const rect = board.getBoundingClientRect();
    return unit({ x: ((e.clientX - rect.left) * board.width) / rect.width, y: ((e.clientY - rect.top) * board.height) / rect.height });
  }

  board.addEventListener("pointerdown", (e) => {
    const z = toPlane(e);
    const da = Math.hypot(z.x - state.a.x, z.y - state.a.y), db = Math.hypot(z.x - state.b.x, z.y - state.b.y);
    const reach = (14 / S) * (board.width / board.getBoundingClientRect().width);
    if (Math.min(da, db) > reach) return;
    dragging = da <= db ? "a" : "b";
    selected = dragging;
    board.setPointerCapture(e.pointerId);
    board.focus();
    e.preventDefault();
    draw();
  });
  board.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const z = toPlane(e);
    apply({ type: "move", which: dragging, x: z.x, y: z.y });
  });
  const stop = () => { dragging = null; };
  board.addEventListener("pointerup", stop);
  board.addEventListener("pointercancel", stop);

  board.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "a" || k === "b") { selected = k; draw(); say("Selected " + k.toUpperCase() + ". Arrow keys move it."); e.preventDefault(); return; }
    const d = { arrowleft: [-0.5, 0], arrowright: [0.5, 0], arrowup: [0, 0.5], arrowdown: [0, -0.5] }[k];
    if (!d) return;
    e.preventDefault();
    const z = state[selected];
    apply({ type: "move", which: selected, x: z.x + d[0], y: z.y + d[1] });
  });

  document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", () => apply({ type: "mode", mode: r.value })));
  document.querySelectorAll('input[name="fix"]').forEach((r) => r.addEventListener("change", () => apply({ type: "constraint", constraint: r.value })));
  [["axA", "a", "x"], ["ayA", "a", "y"], ["axB", "b", "x"], ["ayB", "b", "y"]].forEach(([id, which, axis]) => {
    document.getElementById(id).addEventListener("change", (e) => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) { updateReadout(); return; }
      const z = { x: state[which].x, y: state[which].y };
      z[axis] = v;
      apply({ type: "move", which, x: z.x, y: z.y });
      updateReadout(); // show the value the board actually took
    });
  });

  newBtn.addEventListener("click", () => {
    state = Core.start();
    selected = "a";
    render();
    say("");
  });
  window.addEventListener("themechange", draw);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);

  render();
})();
