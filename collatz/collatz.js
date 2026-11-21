"use strict";

/*
 * Browser page for the Collatz trail demo. All of the mathematics is in
 * collatz-core.js; this file only draws and takes input.
 *
 * The canvas is a hailstone chart: each step of the trail is one point, at a
 * height set by the size of the number. Next step reveals one more point, Show
 * all reveals the whole trail, and the list under the chart writes every
 * revealed number out in words. Typing a start or changing an even/odd option
 * recomputes the trail, as clicking the digits did in the original applet.
 */

(function () {
  const Core = CollatzCore;
  const el = (id) => document.getElementById(id);
  const canvas = el("plot");
  const ctx = canvas.getContext("2d");
  const numberInput = el("numberInput");
  const digitsInput = el("digitsInput");
  const divideRadio = el("divideRadio");
  const stripRadio = el("stripRadio");
  const shortenCheck = el("shortenCheck");
  const stepReadout = el("stepReadout");
  const seqList = el("seqList");
  const statusEl = el("status");

  let state = Core.start({ digits: Core.DEFAULT_DIGITS });

  /** A line under the game. "done" tells the record a demo was explored. */
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
    const grid = colour(styles, "--border", "#c9cdd6");

    const w = canvas.width;
    const h = canvas.height;
    const left = 46;
    const right = 14;
    const top = 24;
    const bottom = 34;
    const plotW = w - left - right;
    const plotH = h - top - bottom;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = stage;
    ctx.fillRect(0, 0, w, h);

    const shown = state.sequence.slice(0, state.index + 1);
    const logs = shown.map((v) => Math.log10(Math.max(1, v)));
    const lo = Math.min.apply(null, logs);
    const hi = Math.max.apply(null, logs);
    const span = Math.max(0.25, hi - lo);
    const xAt = (i) => left + (plotW * i) / Math.max(1, state.sequence.length - 1);
    const yAt = (v) => top + plotH - ((Math.log10(Math.max(1, v)) - lo) / span) * plotH;

    // Two faint guides: the size of the smallest and the largest so far.
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    for (const value of [lo, hi]) {
      const y = top + plotH - ((value - lo) / span) * plotH;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(w - right, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = muted;
    ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(Math.round(Math.pow(10, hi))), left - 6, top);
    ctx.fillText(String(Math.round(Math.pow(10, lo))), left - 6, top + plotH);

    // The hailstone path. The part that closes a loop is drawn in --good.
    if (shown.length > 1) {
      for (let i = 1; i < shown.length; i++) {
        const inCycle = state.stop === "cycle" && state.cycleFrom !== null && i > state.cycleFrom;
        ctx.strokeStyle = inCycle ? good : accent;
        ctx.globalAlpha = inCycle ? 0.95 : 0.55;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xAt(i - 1), yAt(shown[i - 1]));
        ctx.lineTo(xAt(i), yAt(shown[i]));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    shown.forEach((v, i) => {
      const current = i === state.index;
      ctx.beginPath();
      ctx.arc(xAt(i), yAt(v), current ? 7 : 3, 0, Math.PI * 2);
      ctx.fillStyle = current ? highlight : (i === 0 ? muted : accent);
      ctx.fill();
      ctx.strokeStyle = current ? accent : ink;
      ctx.lineWidth = current ? 2.5 : 1;
      ctx.stroke();
    });

    // Say the current value out loud on the picture as well as in #status.
    ctx.fillStyle = ink;
    ctx.font = "600 16px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const cx = xAt(state.index);
    const cy = yAt(shown[shown.length - 1]);
    ctx.fillText(String(shown[shown.length - 1]), Math.max(left + 28, Math.min(w - right - 28, cx)), Math.max(18, cy - 14));
    ctx.textAlign = "left";
    ctx.fillStyle = muted;
    ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("step " + state.index + " of " + (state.sequence.length - 1), left, h - 10);
  }

  function render() {
    numberInput.value = String(state.number);
    digitsInput.value = String(state.digits);
    divideRadio.checked = state.mode === "divide";
    stripRadio.checked = state.mode === "strip";
    shortenCheck.checked = state.shorten;
    stepReadout.textContent = String(state.index);

    seqList.textContent = "";
    state.sequence.slice(0, state.index + 1).forEach((value, i) => {
      const chip = document.createElement("span");
      chip.className = "num" + (i === state.index ? " here" : "");
      chip.textContent = String(value);
      seqList.appendChild(chip);
    });
    draw();

    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        number: state.number,
        digits: state.digits,
        mode: state.mode,
        shorten: state.shorten,
        index: state.index,
        step: state.index,
        shown: state.sequence.slice(0, state.index + 1),
        stop: state.stop,
      });
    }
  }

  /** Reveal one more value; announce a finished trail with the shared class. */
  function advance() {
    const next = Core.step(state);
    if (next === state) return;
    state = next;
    render();
    if (Core.result(state) === "done") say(Core.summary(state), "done");
    else say(Core.describe("step", state));
  }

  function retreat() {
    const next = Core.back(state);
    if (next === state) return;
    state = next;
    render();
    say(Core.describe("back", state));
  }

  function showAll() {
    state = Core.showAll(state);
    render();
    say(Core.summary(state), "done");
  }

  function rebuild(changes, action) {
    state = Core.rebuild(state, changes);
    render();
    say(Core.describe(action, state));
  }

  function newNumber() {
    const raw = Number(digitsInput.value);
    const digits = Number.isFinite(raw) && raw >= 1 && raw <= Core.MAX_DIGITS
      ? Math.floor(raw) : Core.DEFAULT_DIGITS;
    const number = Core.randomNumber(digits);
    if (number === null) {
      say("The string is too long. Sorry.");
      return;
    }
    rebuild({ number, digits }, "new");
  }

  function pointer(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (pointer(e).x < canvas.width / 3) retreat();
    else if (pointer(e).x > (2 * canvas.width) / 3) showAll();
    else advance();
  });

  canvas.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowRight":
      case " ":
      case "Enter": advance(); break;
      case "ArrowLeft": retreat(); break;
      case "End": showAll(); break;
      case "Home": state = Core.rebuild(state, {}); render(); say(Core.describe("reset", state)); break;
      default: return;
    }
    e.preventDefault();
  });

  numberInput.addEventListener("change", () => rebuild({ number: numberInput.value }, "number"));
  digitsInput.addEventListener("change", newNumber);
  divideRadio.addEventListener("change", () => rebuild({ mode: "divide" }, "mode"));
  stripRadio.addEventListener("change", () => rebuild({ mode: "strip" }, "mode"));
  shortenCheck.addEventListener("change", () => rebuild({ shorten: shortenCheck.checked }, "shorten"));

  el("newBtn").addEventListener("click", newNumber);
  el("stepBtn").addEventListener("click", advance);
  el("allBtn").addEventListener("click", showAll);
  el("resetBtn").addEventListener("click", () => {
    state = Core.rebuild(state, {});
    render();
    say(Core.describe("reset", state));
  });

  window.addEventListener("themechange", draw);

  render();
  say(Core.describe("start", state));
})();
