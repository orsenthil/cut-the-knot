"use strict";

/*
 * The page for Zeros and Nines: drawing and input only; the arithmetic and
 * the applet's digit-editing rules live in zeros-and-nines-core.js. The
 * table scrolls sideways inside .stage when it is wider than the screen,
 * and the blue top row's digits are buttons: the right half of a button
 * increases the digit, the left half decreases it, and Up/Down do the same
 * on the keyboard. The header of a column checks it for a 0 or the top
 * digit; the Column box offers the same action without a pointer.
 */

(function () {
  const Core = ZerosAndNinesCore;
  const tableEl = document.getElementById("table");
  const statusEl = document.getElementById("status");
  const digitsIn = document.getElementById("digitsIn");
  const baseIn = document.getElementById("baseIn");
  const autoIn = document.getElementById("autoIn");
  const colsIn = document.getElementById("colsIn");
  const colIn = document.getElementById("colIn");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");

  let state = Core.start({});
  let notice = {
    text: "Change a blue digit, then check a column of the table.",
    kind: null,
  };
  let focusIndex = null;

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

  function render() {
    const rs = Core.rows(state);
    const cols = rs[rs.length - 1].length;
    const table = document.createElement("table");

    const thead = document.createElement("thead");
    const head = thead.insertRow();
    const corner = document.createElement("th");
    corner.scope = "col";
    corner.textContent = "#";
    head.appendChild(corner);
    for (let c = 0; c < cols; c++) {
      const th = document.createElement("th");
      th.scope = "col";
      if (state.checkedColumn === c) th.className = "hit";
      if (state.showColumns && c > 0) th.classList.add("gridline");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "colBtn";
      btn.dataset.col = String(c);
      btn.textContent = c < 3 ? String(10 ** c) : `10^${c}`;
      btn.setAttribute("aria-label", `Check column ${c}, the ${Core.columnName(c)}, for a 0 or ${Core.DIGITS[state.base - 1]}`);
      th.appendChild(btn);
      head.appendChild(th);
    }
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rs.forEach((row, r) => {
      const tr = tbody.insertRow();
      if (r === 0) tr.className = "source";
      const th = document.createElement("th");
      th.scope = "row";
      th.textContent = r === 0 ? "S" : `${r + 1}S`;
      tr.appendChild(th);
      for (let c = 0; c < cols; c++) {
        const td = tr.insertCell();
        if (state.showColumns && c > 0) td.className = "gridline";
        if (state.checkedColumn === c) td.classList.add("hit");
        const i = row.length - 1 - c;
        if (i >= 0) {
          if (r === 0) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "digit";
            btn.dataset.index = String(i);
            btn.textContent = row[i];
            btn.setAttribute("aria-label", `Digit ${row[i]} in the ${Core.columnName(i)} column of S. Click the right half to increase it or the left half to decrease it; Up and Down arrow keys work too.`);
            td.appendChild(btn);
          } else {
            td.textContent = row[i];
          }
        }
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableEl.replaceChildren(table);

    if (focusIndex !== null) {
      const btn = tableEl.querySelector(`button.digit[data-index="${focusIndex}"]`);
      if (btn) btn.focus({ preventScroll: true });
      else focusIndex = null;
    }

    digitsIn.value = String(state.digits.length);
    baseIn.value = String(state.base);
    autoIn.checked = state.autonomous;
    colsIn.checked = state.showColumns;
    const maxCol = Math.max(0, cols - 1);
    colIn.max = String(maxCol);
    colIn.value = String(Core.intIn(colIn.value, 0, maxCol, 0));

    say(notice.text, notice.kind);
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function edit(index, direction) {
    notice = { text: "Change a blue digit, then check a column of the table.", kind: null };
    focusIndex = Core.intIn(index, 0, state.digits.length - 1, 0);
    state = Core.editDigit(state, focusIndex, direction);
    render();
  }

  function checkColumn(column) {
    const maxCol = Core.rows(state)[state.base - 1].length - 1;
    const col = Core.intIn(column, 0, maxCol, 0);
    state = { ...state, checkedColumn: col };
    colIn.value = String(col);
    render();
    const result = Core.checkColumn(state, col);
    const top = Core.DIGITS[result.base - 1];
    const figures = result.digits.map((d) => Core.DIGITS[d]).join(" ");
    const verdict = result.ok
      ? `contains ${result.hasZero && result.hasTop ? `a 0 and a ${top}` : result.hasZero ? "a 0" : `a ${top}`}.`
      : `has neither 0 nor ${top} — that is the warning in the math section.`;
    say(`Column ${col} (${Core.columnName(col)}) of S, 2S, … ${state.base}S: ${figures} — ${verdict}`, "done");
  }

  function options(patch) {
    notice = { text: "Change a blue digit, then check a column of the table.", kind: null };
    state = Core.withOptions(state, patch);
    focusIndex = null;
    render();
  }

  tableEl.addEventListener("pointerdown", (event) => {
    const btn = event.target.closest("button.digit");
    if (!btn) return;
    event.preventDefault();
    const rect = btn.getBoundingClientRect();
    edit(Number(btn.dataset.index), event.clientX > rect.left + rect.width / 2 ? 1 : -1);
  });

  tableEl.addEventListener("keydown", (event) => {
    const btn = event.target.closest("button.digit");
    if (!btn) return;
    const i = Number(btn.dataset.index);
    if (event.key === "ArrowUp") { event.preventDefault(); edit(i, 1); }
    else if (event.key === "ArrowDown") { event.preventDefault(); edit(i, -1); }
    else if (event.key === "Enter") { event.preventDefault(); edit(i, 1); }
    else if (event.key === " ") { event.preventDefault(); edit(i, -1); }
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const next = Core.intIn(i + (event.key === "ArrowLeft" ? 1 : -1), 0, state.digits.length - 1, i);
      const target = tableEl.querySelector(`button.digit[data-index="${next}"]`);
      if (target) { focusIndex = next; target.focus(); }
    }
  });

  tableEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button.colBtn");
    if (btn) checkColumn(Number(btn.dataset.col));
  });

  digitsIn.addEventListener("change", () => options({ digits: digitsIn.value }));
  baseIn.addEventListener("change", () => options({ base: baseIn.value }));
  autoIn.addEventListener("change", () => options({ autonomous: autoIn.checked }));
  colsIn.addEventListener("change", () => options({ showColumns: colsIn.checked }));
  newBtn.addEventListener("click", () => options({ newNumber: true }));
  checkBtn.addEventListener("click", () => checkColumn(colIn.value));
  colIn.addEventListener("change", () => checkColumn(colIn.value));

  render();
})();
