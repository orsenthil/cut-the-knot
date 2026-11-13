"use strict";

/*
 * Mastermind - the page.
 *
 * MastermindCore owns scoring and win/loss; this file draws the guess board.
 * Click a peg to cycle its colour, then Submit. Exact matches show as dark
 * dots, near matches as light ones (the applet's red / pink).
 */

(function () {
  const H = MastermindCore;

  // Mid-tone peg colours that read on both --stage backgrounds.
  const PALETTE = [
    "#c0362c", "#d4a017", "#2c5fc0", "#3d9a5c",
    "#7c3aed", "#db2777", "#0d9488", "#ea580c",
    "#64748b", "#0891b2",
  ];

  const boardEl = document.getElementById("board");
  const pegsInput = document.getElementById("pegsInput");
  const colorsInput = document.getElementById("colorsInput");
  const repeatsInput = document.getElementById("repeatsInput");
  const submitBtn = document.getElementById("submitBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");
  const secretEl = document.getElementById("secret");

  let state = null;
  let current = []; // in-progress guess, -1 = empty

  function fillSelect(sel, def) {
    sel.innerHTML = "";
    for (let n = H.MIN; n <= H.MAX; n++) {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      if (n === def) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  function pegBtn(color, opts) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "peg" + (opts && opts.empty ? " empty" : "");
    if (color >= 0) {
      b.style.background = PALETTE[color % PALETTE.length];
      b.style.borderColor = "var(--ink)";
    }
    if (opts && opts.disabled) b.disabled = true;
    if (opts && opts.label) b.setAttribute("aria-label", opts.label);
    if (opts && opts.onClick) b.addEventListener("click", opts.onClick);
    return b;
  }

  function hintDots(exact, near) {
    const wrap = document.createElement("div");
    wrap.className = "hints";
    wrap.setAttribute("aria-label", exact + " exact, " + near + " near");
    for (let i = 0; i < exact; i++) {
      const d = document.createElement("span");
      d.className = "dot exact";
      wrap.appendChild(d);
    }
    for (let i = 0; i < near; i++) {
      const d = document.createElement("span");
      d.className = "dot near";
      wrap.appendChild(d);
    }
    return wrap;
  }

  function render() {
    boardEl.innerHTML = "";
    const done = state.won || state.lost;

    state.guesses.forEach((g, gi) => {
      const row = document.createElement("div");
      row.className = "row";
      g.guess.forEach((c, i) => {
        row.appendChild(pegBtn(c, {
          disabled: true,
          label: "Guess " + (gi + 1) + ", peg " + (i + 1) + ": colour " + (c + 1),
        }));
      });
      row.appendChild(hintDots(g.exact, g.near));
      boardEl.appendChild(row);
    });

    if (!done && state.guesses.length < state.rows) {
      const row = document.createElement("div");
      row.className = "row active";
      for (let i = 0; i < state.pegs; i++) {
        const c = current[i];
        row.appendChild(pegBtn(c, {
          empty: c < 0,
          label: c < 0
            ? "Peg " + (i + 1) + ": empty, click to set a colour"
            : "Peg " + (i + 1) + ": colour " + (c + 1) + ", click to change",
          onClick: () => {
            current[i] = c < 0 ? 0 : (c + 1) % state.colors;
            statusEl.textContent = "";
            statusEl.className = "";
            render();
          },
        }));
      }
      const spacer = document.createElement("div");
      spacer.className = "hints";
      row.appendChild(spacer);
      boardEl.appendChild(row);
    }

    // Remaining empty rows, for the P+C-1 board feel.
    const left = state.rows - state.guesses.length - (done ? 0 : 1);
    for (let r = 0; r < left; r++) {
      const row = document.createElement("div");
      row.className = "row muted";
      for (let i = 0; i < state.pegs; i++) {
        row.appendChild(pegBtn(-1, { empty: true, disabled: true, label: "Empty row" }));
      }
      row.appendChild(document.createElement("div")).className = "hints";
      boardEl.appendChild(row);
    }

    if (done) {
      secretEl.hidden = false;
      secretEl.innerHTML = "";
      const lab = document.createElement("span");
      lab.textContent = "Secret: ";
      secretEl.appendChild(lab);
      state.code.forEach((c, i) => {
        secretEl.appendChild(pegBtn(c, {
          disabled: true,
          label: "Secret peg " + (i + 1) + ": colour " + (c + 1),
        }));
      });
    } else {
      secretEl.hidden = true;
      secretEl.innerHTML = "";
    }

    submitBtn.disabled = done;
    pegsInput.disabled = state.guesses.length > 0;
    colorsInput.disabled = state.guesses.length > 0;
    repeatsInput.disabled = state.guesses.length > 0;
  }

  function submit() {
    if (state.won || state.lost) return;
    if (current.some((c) => c < 0)) {
      statusEl.textContent = "Fill every peg before submitting.";
      statusEl.className = "";
      return;
    }
    const result = H.guess(state, current);
    if (!result) return;
    if (result.error) {
      statusEl.textContent = result.error;
      statusEl.className = "";
      return;
    }
    current = Array(state.pegs).fill(-1);
    if (state.won) {
      statusEl.textContent = "You broke the code in " + state.guesses.length + " guess" +
        (state.guesses.length === 1 ? "" : "es") + "!";
      statusEl.className = "win";
    } else if (state.lost) {
      statusEl.textContent = "Out of guesses. The secret is revealed below.";
      statusEl.className = "lose";
    } else {
      statusEl.textContent = result.exact + " exact, " + result.near + " near.";
      statusEl.className = "";
    }
    render();
  }

  function reset() {
    const P = Number(pegsInput.value);
    const C = Number(colorsInput.value);
    state = H.start(P, C, repeatsInput.checked);
    current = Array(state.pegs).fill(-1);
    statusEl.textContent = "";
    statusEl.className = "";
    render();
  }

  fillSelect(pegsInput, H.DEFAULT_PEGS);
  fillSelect(colorsInput, H.DEFAULT_COLORS);

  pegsInput.addEventListener("change", reset);
  colorsInput.addEventListener("change", reset);
  repeatsInput.addEventListener("change", reset);
  resetBtn.addEventListener("click", reset);
  submitBtn.addEventListener("click", submit);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !submitBtn.disabled) submit();
  });

  reset();
})();
