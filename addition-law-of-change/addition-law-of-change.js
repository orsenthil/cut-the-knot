"use strict";

/*
 * Browser UI for the Rule of Change of Addends: draw the equation and the dot
 * patterns, and take clicks. The sum is recomputed by the core from the two
 * addends, so it always matches the dots.
 *
 * Each addend is a button with a minus side and a plus side, echoing the
 * applet's click-left / click-right behaviour. The three rows of dots show the
 * first group, the second group and their union.
 */

(() => {
  const C = AdditionLawOfChangeCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const maxInput = document.getElementById("maxInput");
  const resetBtn = document.getElementById("resetBtn");

  let state = null;
  let note = "";
  let focusKey = null;

  function say(text) {
    status.textContent = text;
  }

  function render() {
    if (!focusKey) {
      const el = document.activeElement;
      if (el && el.dataset && el.dataset.part) focusKey = { part: el.dataset.part, side: el.dataset.side };
    }
    stage.replaceChildren();

    const equation = document.createElement("div");
    equation.className = "equation";
    for (const part of ["a", "b"]) {
      const group = document.createElement("div");
      group.className = " addend";
      const down = document.createElement("button");
      down.type = "button";
      down.className = "nudge";
      down.dataset.part = part;
      down.dataset.side = "left";
      down.textContent = "−";
      down.disabled = state[part] <= C.MIN;
      down.setAttribute("aria-label", `Decrease addend ${part === "a" ? "one" : "two"}`);
      down.addEventListener("click", () => nudge(part, -1));

      const value = document.createElement("span");
      value.className = "value";
      value.textContent = String(state[part]);

      const up = document.createElement("button");
      up.type = "button";
      up.className = "nudge";
      up.dataset.part = part;
      up.dataset.side = "right";
      up.textContent = "+";
      up.disabled = state[part] >= C.MAX;
      up.setAttribute("aria-label", `Increase addend ${part === "a" ? "one" : "two"}`);
      up.addEventListener("click", () => nudge(part, 1));

      group.append(down, value, up);
      equation.appendChild(group);
      if (part === "a") {
        const plus = document.createElement("span");
        plus.className = "operator";
        plus.textContent = "+";
        equation.appendChild(plus);
      }
    }
    const equals = document.createElement("span");
    equals.className = "operator";
    equals.textContent = "=";
    equation.appendChild(equals);
    const total = document.createElement("span");
    total.className = "value total";
    total.textContent = String(C.sum(state));
    equation.appendChild(total);
    stage.appendChild(equation);

    const d = C.dots(state);
    for (const [name, label, color] of [["a", "First group", "blue"], ["b", "Second group", "warm"], ["sum", "Together", "total"]]) {
      const row = document.createElement("div");
      row.className = "dots-row";
      const title = document.createElement("span");
      title.className = "dots-label";
      title.textContent = label;
      row.appendChild(title);
      const dots = document.createElement("div");
      dots.className = "dots";
      const shown = Math.min(d[name], state.maxNum * 4);
      for (let i = 0; i < shown; i++) {
        const dot = document.createElement("span");
        dot.className = `dot ${color}`;
        dots.appendChild(dot);
      }
      if (d[name] > shown) {
        const rest = document.createElement("span");
        rest.className = "dots-more";
        rest.textContent = `+${d[name] - shown} more`;
        dots.appendChild(rest);
      }
      row.appendChild(dots);
      stage.appendChild(row);
    }

    maxInput.value = String(state.maxNum);
    say(note || `${state.a} + ${state.b} = ${C.sum(state)}. Changing one addend changes the sum by the same amount.`);

    if (window.Track) window.Track.state({ a: state.a, b: state.b, sum: C.sum(state), maxNum: state.maxNum });
    if (focusKey) {
      const target = stage.querySelector(`.nudge[data-part="${focusKey.part}"][data-side="${focusKey.side}"]`);
      if (target && !target.disabled) {
        focusKey = null;
        target.focus();
      }
    }
  }

  function nudge(part, delta) {
    if (state[part] + delta < C.MIN || state[part] + delta > C.MAX) return;
    const before = C.sum(state);
    focusKey = { part, side: delta < 0 ? "left" : "right" };
    state = C.change(state, part, delta);
    const after = C.sum(state);
    note = `${part === "a" ? "First" : "Second"} addend changed by ${after - before}; the sum changed by ${after - before} too.`;
    render();
  }

  maxInput.addEventListener("change", () => {
    state = { ...state, maxNum: Math.max(1, Math.min(20, Number(maxInput.value) || 10)) };
    render();
  });
  resetBtn.addEventListener("click", () => {
    focusKey = null;
    note = "";
    state = C.start({ maxNum: state.maxNum });
    render();
  });

  state = C.start();
  render();
})();
