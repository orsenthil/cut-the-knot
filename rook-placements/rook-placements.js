"use strict";

/*
 * The page for Rooks and Matchings: drawing and input only; the counting is
 * in rook-placements-core.js. A board of buttons: grey squares are
 * blocked. Click an open square to put a rook there (only where no rook
 * already covers the row or column), click a rook to take it off. Each
 * full placement found is added to the list of small boards below.
 */

(function () {
  const Core = RookPlacementsCore;
  const boardEl = document.getElementById("board");
  const foundEl = document.getElementById("found");
  const statusEl = document.getElementById("status");
  const sizeIn = document.getElementById("sizeIn");

  const ROOK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3h2.5v2h2V3h3v2h2V3H16v4l-2 2v5l2 2v1H4v-1l2-2V9L4 7z"/></svg>';
  let state = Core.start({ n: 4, seed: 1 });
  let focusAt = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function mini(cols) {
    const n = state.n, c = 8;
    let s = `<svg viewBox="0 0 ${n * c} ${n * c}" width="${n * c}" height="${n * c}" aria-hidden="true">`;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) s += `<rect x="${j * c}" y="${i * c}" width="${c}" height="${c}" class="${!state.open[i][j] ? "blk" : cols[i] === j ? "rk" : "op"}"/>`;
    return s + "</svg>";
  }

  function render() {
    const n = state.n;
    boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    boardEl.textContent = "";
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const b = document.createElement("button");
      b.type = "button";
      const rook = state.rooks[i] === j, open = state.open[i][j];
      const covered = !rook && (state.rooks[i] >= 0 || state.rooks.includes(j));
      b.className = `sq ${open ? "open" : "blocked"}${rook ? " rook" : ""}${covered && open ? " covered" : ""}`;
      b.dataset.i = String(i); b.dataset.j = String(j);
      b.innerHTML = rook ? ROOK : "";
      b.setAttribute("aria-label", `Row ${i + 1}, column ${j + 1}: ${!open ? "blocked" : rook ? "rook" : covered ? "covered by a rook" : "open"}`);
      boardEl.appendChild(b);
    }
    if (focusAt) { const f = boardEl.querySelector(`[data-i="${focusAt[0]}"][data-j="${focusAt[1]}"]`); if (f) f.focus(); focusAt = null; }
    foundEl.innerHTML = state.found.map((f) => `<li>${mini(f)}</li>`).join("");
    const total = Core.total(state), k = state.found.length, placed = state.rooks.filter((c) => c >= 0).length;
    if (Core.result(state) === "win") say(`All ${total} placements found. That number is the permanent of this board.`, "win");
    else say(`Found ${k} of ${total} placements. ${placed === n ? "That one is on the list: take a rook off to look for another." : `${placed} of ${n} rooks placed.`}`);
    if (window.Track) window.Track.state({ n, seed: state.seed, rooks: state.rooks, found: state.found });
  }

  boardEl.addEventListener("click", (e) => {
    const b = e.target.closest(".sq");
    if (!b) return;
    const i = Number(b.dataset.i), j = Number(b.dataset.j);
    const s = Core.toggle(state, i, j);
    if (s) state = s;
    focusAt = [i, j];
    render();
  });
  boardEl.addEventListener("keydown", (e) => {
    const b = e.target.closest(".sq");
    const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (!b || !d) return;
    e.preventDefault();
    const i = Math.max(0, Math.min(state.n - 1, Number(b.dataset.i) + d[0])), j = Math.max(0, Math.min(state.n - 1, Number(b.dataset.j) + d[1]));
    boardEl.querySelector(`[data-i="${i}"][data-j="${j}"]`).focus();
  });
  const fresh = (seed) => { state = Core.start({ n: Number(sizeIn.value), seed }); render(); };
  sizeIn.addEventListener("change", () => fresh(1));
  document.getElementById("newBtn").addEventListener("click", () => fresh((state.seed % 12) + 1));
  document.getElementById("clearBtn").addEventListener("click", () => { state = Core.clear(state); render(); });

  render();
})();
