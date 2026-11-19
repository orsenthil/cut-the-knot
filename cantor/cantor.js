"use strict";

/*
 * Browser page for the Cantor tent-map demo. All of the mathematics is in
 * cantor-core.js; this file only draws and takes input.
 *
 * The canvas holds the red tent, its blue draggable peak at x = 1/2, the
 * numbered height axis and the vertical marks left by a backwards orbit.
 * Dragging the peak near the top changes `a` (the applet only accepts a < 2
 * while dragging); the slider also reaches the opening setting a = 3.
 * "Iterate" runs the orbit on a timer, "One step" advances it by hand, and
 * the canvas has arrow/Home/End/Enter keys so the same things work without a
 * mouse. Every change is reported in words in #status.
 */

(function () {
  const Core = CantorCore;
  const el = (id) => document.getElementById(id);
  const canvas = el("plot");
  const ctx = canvas.getContext("2d");
  const statusEl = el("status");
  const aInput = el("aInput");
  const aReadout = el("aReadout");
  const stepReadout = el("stepReadout");
  const iterateCheck = el("iterateCheck");
  const stepBtn = el("stepBtn");
  const resetBtn = el("resetBtn");

  const rect = {
    x: canvas.width * 0.06,
    y: canvas.height * 0.06,
    width: canvas.width * 0.88,
    height: canvas.height * 0.84,
  };
  const TICK_MS = 90;
  let state = Core.start({});
  let timer = null;
  let dragging = false;
  let grabDY = 0;

  /** A line under the game. "done" is how the record learns a demo was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function colour(styles, name, fallback) {
    return styles.getPropertyValue(name).trim() || fallback;
  }

  function draw() {
    const styles = getComputedStyle(document.documentElement);
    const stage = colour(styles, "--stage", "#f3f5f8");
    const ink = colour(styles, "--ink", "#1f2430");
    const muted = colour(styles, "--muted", "#5d6472");
    const accent = colour(styles, "--accent", "#5b4ee8");
    const good = colour(styles, "--good", "#15803d");
    const highlight = colour(styles, "--highlight", "rgba(255,214,10,0.35)");
    const bottom = rect.y + rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = stage;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Value axis: 0 at the base, 2 at the top.
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y);
    ctx.lineTo(rect.x, bottom);
    ctx.lineTo(rect.x + rect.width, bottom);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.font = "16px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const v of [0, 0.5, 1, 1.5, 2]) {
      const y = Core.convert(v, rect);
      ctx.beginPath();
      ctx.moveTo(rect.x - 7, y);
      ctx.lineTo(rect.x, y);
      ctx.stroke();
      ctx.fillText(String(v), rect.x - 12, y);
    }

    // The red tent, modernised to the site's accent colour, and its handle.
    const peak = Core.tentPeak(state.a, rect);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(rect.x, bottom);
    ctx.lineTo(peak.x, peak.y);
    ctx.lineTo(rect.x + rect.width, bottom);
    ctx.stroke();

    // Marks from the backwards orbit: position = the new value, height = the
    // value it came from (Convert in the applet).
    state.marks.forEach((m, i) => {
      const x = rect.x + m.x * rect.width;
      const top = Core.convert(m.top, rect);
      ctx.strokeStyle = i === state.marks.length - 1 ? good : ink;
      ctx.globalAlpha = i === state.marks.length - 1 ? 0.95 : 0.45;
      ctx.lineWidth = i === state.marks.length - 1 ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(x, bottom);
      ctx.lineTo(x, top);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = highlight;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(peak.x, peak.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = ink;
    ctx.font = "600 18px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("a = " + state.a.toFixed(2), peak.x + 16, peak.y - 12);
  }

  function render() {
    aInput.value = String(state.a);
    aReadout.textContent = state.a.toFixed(2);
    stepReadout.textContent = String(state.step);
    iterateCheck.checked = state.running;
    draw();
    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        a: state.a,
        running: state.running,
        step: state.step,
        x: state.x,
        y: state.y,
        marks: state.marks.slice(-6),
      });
    }
  }

  function advance(coin) {
    state = Core.tick(state, coin);
    render();
    if (Core.explored(state)) say(Core.describe("step", state), "done");
  }

  function stopTimer() {
    if (timer !== null) { clearInterval(timer); timer = null; }
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(() => advance(Math.random() < 0.5 ? 1 : 0), TICK_MS);
  }

  function setA(a) {
    const next = Core.setA(state, a);
    if (next === state) return;
    state = next;
    render();
    say(Core.describe("a", state), "done");
  }

  function pointer(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    const p = pointer(e);
    const peak = Core.tentPeak(state.a, rect);
    if (Math.hypot(p.x - peak.x, p.y - peak.y) > 28) return;
    e.preventDefault();
    grabDY = peak.y - p.y;
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    if (state.running) {
      state = Core.setRunning(state, false);
      stopTimer();
    }
    render();
    say("You took hold of the peak. Drag it up or down to change a.", "done");
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const p = pointer(e);
    const a = Core.dragA(p.y, grabDY, rect);
    if (!Core.validDrag(p.y, a)) return; // the applet ignores a drag to a >= 2
    setA(a);
  });

  function endDrag() { dragging = false; }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 0.2 : 0.05;
    let a = state.a;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight": a = Math.min(3, +(a + step).toFixed(2)); break;
      case "ArrowDown":
      case "ArrowLeft": a = Math.max(0.05, +(a - step).toFixed(2)); break;
      case "Home": a = 0.05; break;
      case "End": a = 3; break;
      case " ":
      case "Enter":
        e.preventDefault();
        iterateCheck.checked = !iterateCheck.checked;
        iterateCheck.dispatchEvent(new Event("change"));
        return;
      default: return;
    }
    e.preventDefault();
    setA(a);
  });

  aInput.addEventListener("input", () => setA(Number(aInput.value)));

  iterateCheck.addEventListener("change", () => {
    const on = iterateCheck.checked;
    state = Core.setRunning(state, on);
    if (on) startTimer(); else stopTimer();
    render();
    say(Core.describe(on ? "iterate-on" : "iterate-off", state), "done");
  });

  stepBtn.addEventListener("click", () => advance(Math.random() < 0.5 ? 1 : 0));

  resetBtn.addEventListener("click", () => {
    stopTimer();
    dragging = false;
    state = Core.start({});
    render();
    say(Core.describe("reset", state));
  });

  window.addEventListener("themechange", draw);

  render();
  say("Drag the blue peak or press Iterate. At a = 3 the marks gather on the Cantor set.");
})();
