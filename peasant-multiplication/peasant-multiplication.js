"use strict";

/*
 * The page for Peasant Multiplication: drawing and input only. Two numbers
 * whose digits have arrows, the table of halves and doubles (red beside odd
 * halves) and the sum. The columns are in peasant-multiplication-core.js.
 */

(function () {
  const Core = PeasantCore;
  const statusEl = document.getElementById("status");
  const tbl = document.getElementById("tbl"), sumEl = document.getElementById("sum");
  const digitsSel = document.getElementById("digitsSel");
  const autoIn = document.getElementById("autoIn"), binIn = document.getElementById("binIn");
  const newBtn = document.getElementById("newBtn");
  const boxes = { a: document.getElementById("numA"), b: document.getElementById("numB") };

  let state = Core.start({});

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function button(label, aria, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.setAttribute("aria-label", aria);
    b.addEventListener("click", fn);
    return b;
  }

  function drawNumber(key, name) {
    const box = boxes[key];
    box.textContent = "";
    Core.digitsOf(state[key], state.digits).forEach((d, place) => {
      const col = document.createElement("div");
      col.className = "digit";
      const span = document.createElement("span");
      span.className = "d";
      span.textContent = String(d);
      const bump = (delta) => () => {
        state = Object.assign({}, state, { [key]: Core.bump(state[key], state.digits, place, delta, state.autonomous) });
        render();
      };
      col.append(button("▲", `${name}: digit ${place + 1} up`, bump(1)), span, button("▼", `${name}: digit ${place + 1} down`, bump(-1)));
      box.appendChild(col);
    });
  }

  function cell(tag, text, cls) {
    const c = document.createElement(tag);
    c.textContent = text;
    if (cls) c.className = cls;
    return c;
  }

  function render() {
    drawNumber("a", "First number");
    drawNumber("b", "Second number");
    const r = Core.multiply(state.a, state.b);
    tbl.textContent = "";
    const head = document.createElement("tr");
    if (state.binary) head.append(cell("th", "2^k"), cell("th", "bit"));
    head.append(cell("th", "halves"), cell("th", "doubles"), cell("th", "added"));
    tbl.appendChild(head);
    r.rows.forEach((row) => {
      const tr = document.createElement("tr");
      const cls = row.odd ? "odd" : "even";
      if (state.binary) tr.append(cell("td", "2^" + row.power), cell("td", row.odd ? "1" : "0", "bit " + cls));
      tr.append(cell("td", String(row.half), cls), cell("td", String(row.dbl), cls), cell("td", row.odd ? String(row.dbl) : "", "odd"));
      tbl.appendChild(tr);
    });
    sumEl.textContent = `${r.parts.join(" + ")} = ${r.product}` + (state.binary ? `   (${state.a} = ${Core.binary(state.a)} in binary)` : "");
    digitsSel.value = String(state.digits);
    autoIn.checked = state.autonomous;
    binIn.checked = state.binary;
    say(`${state.a} × ${state.b} = ${r.product} in ${r.rows.length} rows.`, "done");
    if (window.Track) window.Track.state({ a: state.a, b: state.b, digits: state.digits, binary: state.binary, autonomous: state.autonomous });
  }

  digitsSel.addEventListener("change", () => { state = Core.start({ digits: digitsSel.value, a: state.a, b: state.b, binary: state.binary, autonomous: state.autonomous }); render(); });
  autoIn.addEventListener("change", () => { state = Object.assign({}, state, { autonomous: autoIn.checked }); render(); });
  binIn.addEventListener("change", () => { state = Object.assign({}, state, { binary: binIn.checked }); render(); });
  newBtn.addEventListener("click", () => {
    const top = Math.pow(10, state.digits) - 1;
    state = Core.start({ digits: state.digits, a: 1 + Math.floor(Math.random() * top), b: 1 + Math.floor(Math.random() * top), binary: state.binary, autonomous: state.autonomous });
    render();
  });

  render();
})();
