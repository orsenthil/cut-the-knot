"use strict";

/*
 * Calendar Magic - the UI. The maths lives in calendar-core.js.
 *
 * Two modes, as in the original applet's Set / Play button: first you choose a
 * square of dates (the applet dragged a rectangle and snapped it to a square;
 * here you click the top left corner and the size comes from the picker), then
 * you pick one date in each row and each column of it. The prediction is shown
 * as soon as the square is set, because that is the point: it depends on the
 * square alone.
 */

(function () {
  const C = CalendarCore;

  const cal = document.getElementById("cal");
  const monthLabel = document.getElementById("monthLabel");
  const statusEl = document.getElementById("status");
  const predictionEl = document.getElementById("prediction");
  const totalEl = document.getElementById("total");
  const predictionLine = document.getElementById("predictionLine");
  const totalLine = document.getElementById("totalLine");
  const sizeLabel = document.getElementById("sizeLabel");

  const SIZE_MIN = 2;
  const SIZE_MAX = 5;

  const today = new Date();
  const state = {
    year: Math.min(Math.max(today.getFullYear(), C.MIN_YEAR), C.MAX_YEAR),
    month: today.getMonth(),
    size: 4,
    grid: null,
    round: null,      // a CalendarCore.Round once a square is set
    preview: null,    // {row, col} while choosing
    buttons: [],      // buttons[row][col], null for a blank cell
  };

  /* ------------------------------------------------------------ the calendar */

  function buildMonth() {
    state.grid = C.monthGrid(state.year, state.month);
    state.round = null;
    state.preview = null;
    cal.textContent = "";
    state.buttons = [];

    for (const name of C.DAY_NAMES) {
      const head = document.createElement("div");
      head.className = "dow";
      head.setAttribute("aria-hidden", "true");
      head.textContent = name;
      cal.appendChild(head);
    }

    for (let r = 0; r < state.grid.rows; r++) {
      state.buttons.push(new Array(7).fill(null));
      for (let c = 0; c < 7; c++) {
        const date = state.grid.cells[r][c];
        if (date === null) {
          const blank = document.createElement("div");
          blank.className = "blank";
          cal.appendChild(blank);
          continue;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "day";
        btn.textContent = String(date);
        btn.dataset.row = String(r);
        btn.dataset.col = String(c);
        btn.addEventListener("click", () => onCellClick(r, c));
        btn.addEventListener("pointerenter", () => showPreview(r, c));
        btn.addEventListener("focus", () => showPreview(r, c));
        cal.appendChild(btn);
        state.buttons[r][c] = btn;
      }
    }

    monthLabel.textContent = `${C.MONTH_NAMES[state.month]} ${state.year}`;
    render();
    say(chooseHint());
  }

  function shiftMonth(delta) {
    let m = state.month + delta;
    let y = state.year + Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    if (y < C.MIN_YEAR || y > C.MAX_YEAR) return;
    state.year = y;
    state.month = m;
    buildMonth();
  }

  /* ---------------------------------------------------------------- the play */

  function chooseHint() {
    return `Click a date to put the top left corner of your ${state.size}×${state.size} square there.`;
  }

  function onCellClick(row, col) {
    if (!state.round) {
      if (!C.squareFits(state.grid, row, col, state.size)) {
        say(`A ${state.size}×${state.size} square of dates does not fit with its corner there.`);
        return;
      }
      state.round = new C.Round(state.grid, row, col, state.size);
      state.preview = null;
      render();
      say(`Square set. I predict your total will be ${state.round.prediction}. Pick one date in each row and each column.`);
      return;
    }

    const res = state.round.pick(row, col);
    if (!res.ok) {
      say(res.message, "lose");
      render();
      return;
    }
    render();
    if (res.finished) {
      say(`${res.total} — exactly as predicted.`, "win");
    } else {
      const left = state.round.n - state.round.picks.length;
      say(`Running total ${res.total}. ${left} more to pick.`);
    }
  }

  function showPreview(row, col) {
    if (state.round) return;
    const next = C.squareFits(state.grid, row, col, state.size) ? { row, col } : null;
    const same = (!next && !state.preview)
      || (next && state.preview && next.row === state.preview.row && next.col === state.preview.col);
    if (same) return;
    state.preview = next;
    render();
  }

  /* ------------------------------------------------------------- the drawing */

  function render() {
    const round = state.round;
    const usedRows = new Set();
    const usedCols = new Set();
    if (round) {
      for (const p of round.picks) { usedRows.add(p.row); usedCols.add(p.col); }
    }

    for (let r = 0; r < state.buttons.length; r++) {
      for (let c = 0; c < 7; c++) {
        const btn = state.buttons[r][c];
        if (!btn) continue;
        const date = state.grid.cells[r][c];
        btn.classList.remove("preview", "inside", "picked", "blocked", "outside");
        btn.removeAttribute("aria-pressed");

        if (round) {
          const inside = round.contains(r, c);
          const picked = round.picks.some((p) => p.row === r && p.col === c);
          if (picked) btn.classList.add("picked");
          else if (inside) btn.classList.add("inside");
          else btn.classList.add("outside");
          if (inside && !picked && (usedRows.has(r) || usedCols.has(c))) btn.classList.add("blocked");
          if (inside) btn.setAttribute("aria-pressed", picked ? "true" : "false");
          btn.setAttribute("aria-label", label(date, picked ? "picked" : inside ? "in the square" : "outside the square"));
        } else {
          const p = state.preview;
          if (p && r >= p.row && r < p.row + state.size && c >= p.col && c < p.col + state.size) {
            btn.classList.add("preview");
          }
          btn.setAttribute("aria-label", label(date, null));
        }
      }
    }

    sizeLabel.textContent = `${state.size}×${state.size}`;
    predictionEl.textContent = round ? String(round.prediction) : "—";
    totalEl.textContent = round && round.picks.length ? String(round.total) : "—";
    const matched = Boolean(round && round.finished);
    predictionLine.classList.toggle("match", matched);
    totalLine.classList.toggle("match", matched);
  }

  function label(date, note) {
    const base = `${C.MONTH_NAMES[state.month]} ${date}`;
    return note ? `${base}, ${note}` : base;
  }

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.toggle("win", kind === "win");
    statusEl.classList.toggle("lose", kind === "lose");
  }

  /* ------------------------------------------------------------- the buttons */

  function setSize(n) {
    const next = Math.min(Math.max(n, SIZE_MIN), SIZE_MAX);
    if (next === state.size) return;
    state.size = next;
    state.round = null;
    state.preview = null;
    render();
    say(chooseHint());
  }

  document.getElementById("prevBtn").addEventListener("click", () => shiftMonth(-1));
  document.getElementById("nextBtn").addEventListener("click", () => shiftMonth(1));
  document.getElementById("smallerBtn").addEventListener("click", () => setSize(state.size - 1));
  document.getElementById("biggerBtn").addEventListener("click", () => setSize(state.size + 1));

  document.getElementById("clearBtn").addEventListener("click", () => {
    if (!state.round) { say(chooseHint()); return; }
    state.round.clearPicks();
    render();
    say(`Picks cleared. The prediction is still ${state.round.prediction}.`);
  });

  document.getElementById("newBtn").addEventListener("click", () => {
    state.round = null;
    state.preview = null;
    render();
    say(chooseHint());
  });

  cal.addEventListener("pointerleave", () => {
    if (state.round || !state.preview) return;
    state.preview = null;
    render();
  });

  buildMonth();
})();
