"use strict";

/*
 * Coin Change page: drawing and input only; all the maths is in
 * coin-change-core.js. The play area is a bar chart of the number of ways to
 * change each amount, showing a window of amounts that ends at the one you
 * chose. Eight checkboxes pick the coins, a number box sets the amount and
 * Compute fills the chart. Click a bar or use the arrow keys to read any
 * amount; the canvas keeps focus while the readout changes.
 */

(function () {
  const Core = CoinChangeCore;
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const readoutEl = document.getElementById("readout");
  const amountInput = document.getElementById("amount");
  const computeBtn = document.getElementById("computeBtn");
  const newBtn = document.getElementById("newBtn");
  const denomBoxes = Array.from(document.querySelectorAll(".denom"));

  let state = Core.start({});
  let cursor = 0; // index into the displayed window of amounts

  /** Resolve a CSS custom property on the canvas element at draw time. */
  function token(name) {
    const probe = document.createElement("div");
    probe.style.color = name;
    canvas.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are also how the player's record learns that a play
   * has ended (assets/progress.js), so use them for that and nothing else.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** The window of amounts drawn: at most 40, always ending at the target. */
  function displayRange() {
    const last = state.amount;
    const first = Math.max(1, last - 39);
    return { first, last, count: last - first + 1 };
  }

  function resetCursor() {
    cursor = displayRange().count - 1; // start on the chosen amount
  }

  /** Draw the chart into the canvas, in device pixels. */
  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const stage = token("var(--stage)");
    const ink = token("var(--ink)");
    const muted = token("var(--muted)");
    const accent = token("var(--accent)");
    const border = token("var(--border-strong)");

    ctx.fillStyle = stage;
    ctx.fillRect(0, 0, w, h);

    const padL = 10 * dpr;
    const padR = 10 * dpr;
    const padT = 26 * dpr;
    const padB = 30 * dpr;
    const left = padL;
    const right = Math.max(left + 1, w - padR);
    const top = padT;
    const bottom = Math.max(top + 1, h - padB);

    if (!state.explored) {
      ctx.fillStyle = ink;
      ctx.font = `${14 * dpr}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Press Compute to see the counts", (left + right) / 2, (top + bottom) / 2);
      return;
    }

    const table = Core.ways(state.amount, state.denoms);
    const { first, last, count } = displayRange();
    let max = 0n;
    for (let n = first; n <= last; n++) if (table[n] > max) max = table[n];
    const maxNum = Number(max) || 1;

    ctx.strokeStyle = border;
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(left, bottom + 0.5);
    ctx.lineTo(right, bottom + 0.5);
    ctx.stroke();

    const barW = (right - left) / count;
    const gap = Math.min(2 * dpr, barW * 0.18);
    for (let i = 0; i < count; i++) {
      const n = first + i;
      const bh = (Number(table[n]) / maxNum) * (bottom - top);
      const x = left + i * barW + gap / 2;
      ctx.fillStyle = i === cursor ? accent : muted;
      ctx.globalAlpha = i === cursor ? 1 : 0.62;
      ctx.fillRect(x, bottom - bh, Math.max(1, barW - gap), Math.max(1, bh));
    }
    ctx.globalAlpha = 1;

    const sel = first + Math.min(cursor, count - 1);
    ctx.textAlign = "center";
    ctx.fillStyle = ink;
    ctx.font = `${13 * dpr}px system-ui, sans-serif`;
    ctx.fillText(`Amount ${sel}: ${table[sel].toString()} ${table[sel] === 1n ? "way" : "ways"}`,
      (left + right) / 2, 16 * dpr);
    ctx.fillStyle = muted;
    ctx.font = `${11 * dpr}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(String(first), left, bottom + 16 * dpr);
    ctx.textAlign = "right";
    ctx.fillText(String(last), right, bottom + 16 * dpr);
    ctx.textAlign = "center";
    ctx.fillText("amount →", (left + right) / 2, h - 3 * dpr);
  }

  function syncControls() {
    amountInput.value = String(state.amount);
    for (const box of denomBoxes) box.checked = state.denoms.indexOf(Number(box.value)) !== -1;
    if (!state.explored) {
      readoutEl.textContent = "Choose the coins and an amount, then press Compute.";
      return;
    }
    const { first, count } = displayRange();
    const n = first + Math.min(cursor, count - 1);
    const w = Core.ways(state.amount, state.denoms);
    readoutEl.textContent = `Amount ${n}: ${w[n].toString()} ${w[n] === 1n ? "way" : "ways"} ` +
      `with coins ${state.denoms.join(", ")}.`;
  }

  function render() {
    if (cursor > displayRange().count - 1) resetCursor();
    syncControls();
    draw();
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function reportSelection() {
    if (!state.explored) return;
    const { first, count } = displayRange();
    const n = first + Math.min(cursor, count - 1);
    const w = Core.ways(state.amount, state.denoms);
    say(`Amount ${n}: ${w[n].toString()} ${w[n] === 1n ? "way" : "ways"}.`);
  }

  function onOptions() {
    const denoms = denomBoxes.filter((b) => b.checked).map((b) => Number(b.value));
    const amount = Number(amountInput.value);
    state = Core.setAmount(Core.setDenoms(state, denoms), amount);
    resetCursor();
    render();
    say("Options changed. Press Compute to fill the chart again.");
  }

  computeBtn.addEventListener("click", () => {
    state = Core.explore(state);
    resetCursor();
    render();
    if (state.denoms.length === 0) {
      say("With no coins chosen there is no way to change any amount — 0 ways. Pick a coin to continue.", "done");
    } else {
      say(`There are ${Core.countWays(state.amount, state.denoms)} ways to change ` +
        `${state.amount} with your ${state.denoms.length} kinds of coin.`, "done");
    }
  });

  newBtn.addEventListener("click", () => {
    state = Core.start({});
    resetCursor();
    render();
    say("Back to the default coins and amount 100. Press Compute to begin.");
  });

  for (const box of denomBoxes) box.addEventListener("change", onOptions);
  amountInput.addEventListener("change", onOptions);

  canvas.addEventListener("pointerdown", (event) => {
    if (!state.explored) return;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const px = (event.clientX - rect.left) * sx;
    const dpr = window.devicePixelRatio || 1;
    const left = 10 * dpr;
    const right = Math.max(left + 1, canvas.width - 10 * dpr);
    const count = displayRange().count;
    cursor = Math.max(0, Math.min(count - 1, Math.floor((px - left) / ((right - left) / count))));
    render();
    reportSelection();
  });

  canvas.addEventListener("keydown", (event) => {
    if (!state.explored) return;
    const count = displayRange().count;
    let delta = 0;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") delta = -1;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") delta = 1;
    else if (event.key === "Home") delta = -count;
    else if (event.key === "End") delta = count;
    else return;
    event.preventDefault();
    cursor = Math.max(0, Math.min(count - 1, cursor + delta));
    render();
    reportSelection();
  });

  window.addEventListener("themechange", render);
  window.addEventListener("resize", render);

  resetCursor();
  render();
  say("Choose the coins and an amount, then press Compute to see how many ways each amount can be made.");
})();
