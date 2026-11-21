"use strict";

/*
 * Life-like Automaton With Definable Rules, from Bogomolny's applet LifeG.
 *
 * A cell is born when its number of live neighbours lies in a chosen birth
 * set B, and survives when the count lies in a chosen survival set S. Conway's
 * Life is B3/S23; other choices give HighLife, Seeds, Replicator and many more.
 *
 * The key idea is that the same neighbourhood count drives both decisions, so
 * changing the two sets explores a whole family of automata. The logic test
 * checks Conway against the standard rules, several named variants, rule
 * toggling and the encoded rule string.
 *
 * No document, no window, no storage: one global, LifeLikeAutomatonCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const LifeLikeAutomatonCore = (() => {
  const MIN_SIDE = 8;
  const MAX_SIDE = 40;

  const clamp = (v, lo, hi, fb) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb;
  };

  const PRESETS = {
    conway: { birth: [3], survival: [2, 3], label: "Conway's Life (B3/S23)" },
    highlife: { birth: [3, 6], survival: [2, 3], label: "HighLife (B36/S23)" },
    seeds: { birth: [2], survival: [], label: "Seeds (B2/S)" },
    replicator: { birth: [1, 3, 5], survival: [1, 3, 5], label: "Replicator (B135/S135)" },
    lifeWithoutDeath: { birth: [3], survival: [0, 1, 2, 3, 4, 5, 6, 7, 8], label: "Life without Death (B3/S012345678)" },
  };

  function empty(size) {
    return Array.from({ length: size }, () => Array(size).fill(false));
  }

  function start(options) {
    const opts = options || {};
    const size = clamp(opts.size === undefined ? 20 : opts.size, MIN_SIDE, MAX_SIDE, 20);
    const preset = PRESETS[opts.preset] || PRESETS.conway;
    return {
      size,
      cells: opts.cells ? opts.cells.map((row) => row.map(Boolean)) : empty(size),
      birth: preset.birth.slice(),
      survival: preset.survival.slice(),
      generation: 0,
      history: [],
      preset: PRESETS[opts.preset] ? opts.preset : "conway",
    };
  }

  function neighbours(cells, x, y) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ny = y + dy;
        const nx = x + dx;
        if (ny >= 0 && ny < cells.length && nx >= 0 && nx < cells[0].length && cells[ny][nx]) count++;
      }
    }
    return count;
  }

  function step(state) {
    const cells = state.cells.map((row, y) => row.map((cell, x) => {
      const n = neighbours(state.cells, x, y);
      return cell ? state.survival.includes(n) : state.birth.includes(n);
    }));
    return {
      ...state,
      cells,
      generation: state.generation + 1,
      history: state.history.concat([state.cells.map((row) => row.slice())]),
    };
  }

  function reverse(state) {
    if (!state.history.length) return state;
    const history = state.history.slice();
    return { ...state, cells: history.pop(), generation: Math.max(0, state.generation - 1), history };
  }

  function toggle(state, x, y) {
    if (x < 0 || y < 0 || x >= state.size || y >= state.size) return state;
    const cells = state.cells.map((row) => row.slice());
    cells[y][x] = !cells[y][x];
    return { ...state, cells };
  }

  function setRule(state, kind, n) {
    const key = kind === "birth" ? "birth" : "survival";
    const set = state[key].slice();
    const at = set.indexOf(n);
    if (at < 0) set.push(n);
    else set.splice(at, 1);
    set.sort((a, b) => a - b);
    return { ...state, [key]: set, preset: null };
  }

  function setPreset(state, name) {
    if (!PRESETS[name]) return state;
    return { ...state, ...PRESETS[name], cells: state.cells, generation: 0, history: [], preset: name };
  }

  function randomize(state, count, random) {
    const rnd = random || Math.random;
    const cells = empty(state.size);
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 30) {
      const x = Math.floor(rnd() * state.size);
      const y = Math.floor(rnd() * state.size);
      if (!cells[y][x]) { cells[y][x] = true; placed++; }
    }
    return { ...state, cells, generation: 0, history: [] };
  }

  function ruleString(state) {
    const fmt = (set) => set.length ? set.join("") : "";
    return `B${fmt(state.birth)}/S${fmt(state.survival)}`;
  }

  function population(state) {
    return state.cells.reduce((s, row) => s + row.filter(Boolean).length, 0);
  }

  function analyze(state) {
    return {
      size: state.size,
      generation: state.generation,
      population: population(state),
      birth: state.birth.slice(),
      survival: state.survival.slice(),
      rule: ruleString(state),
      preset: state.preset,
    };
  }

  return {
    MIN_SIDE, MAX_SIDE, PRESETS, clamp, empty, start, neighbours, step,
    reverse, toggle, setRule, setPreset, randomize, ruleString, population, analyze,
  };
})();
