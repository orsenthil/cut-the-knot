"use strict";

/*
 * Simple graphs, from Bogomolny's SimpleGraphs (Graphs) applet.
 *
 * Click to place vertices and drag from one to another to add an edge. The
 * graph is a multigraph: another edge between the same pair increases the
 * count. A loop is only allowed when that option is on and counts twice
 * towards the degree. Undo pops the last edge the applet put on its stack.
 *
 * Two facts are checked by the page and its test: the sum of all degrees is
 * twice the number of edges, and the number of odd-degree vertices is even.
 * Pure logic: one global, plain JSON positions, no DOM and no storage.
 */
const SimpleGraphsCore = (() => {
  function start(options = {}) {
    return {
      nodes: [],
      edges: [],
      history: [],
      nextId: 1,
      showDegrees: options.showDegrees !== false,
      allowLoops: !!options.allowLoops,
      moving: !!options.moving,
      message: "Click the board to add a vertex; drag from one vertex to another to add an edge.",
    };
  }

  function clone(state) {
    return {
      ...state,
      nodes: state.nodes.map((n) => ({ ...n })),
      edges: state.edges.map((e) => ({ ...e })),
      history: state.history.slice(),
    };
  }

  function addNode(state, x, y) {
    const next = clone(state);
    const id = next.nextId++;
    next.nodes.push({ id, x, y });
    next.message = `Vertex ${id} added.`;
    return next;
  }

  function findEdge(state, a, b) {
    return state.edges.find((e) => e.a === a && e.b === b);
  }

  function addEdge(state, a, b) {
    if (!state.nodes.some((n) => n.id === a) || !state.nodes.some((n) => n.id === b)) return state;
    if (a === b && !state.allowLoops) {
      return { ...state, message: "Loops not allowed." };
    }
    const next = clone(state);
    const pair = a <= b ? [a, b] : [b, a];
    const existing = findEdge(next, pair[0], pair[1]);
    if (existing) existing.count++;
    else next.edges.push({ a: pair[0], b: pair[1], count: 1 });
    next.history.push({ a: pair[0], b: pair[1] });
    next.message = a === b ? `A loop was added at vertex ${a}.`
      : `An edge ${existing ? "count now " + existing.count + " between" : "was added between"} ${a} and ${b}.`;
    return next;
  }

  function moveNode(state, id, x, y) {
    const node = state.nodes.find((n) => n.id === id);
    if (!node) return state;
    const next = clone(state);
    const target = next.nodes.find((n) => n.id === id);
    target.x = x;
    target.y = y;
    return next;
  }

  /** Undo the most recent edge, exactly as GraphsCanvas.Pop does. */
  function pop(state) {
    if (!state.history.length) return state;
    const next = clone(state);
    const { a, b } = next.history.pop();
    const edge = findEdge(next, a, b);
    if (!edge) return next;
    edge.count--;
    if (edge.count === 0) next.edges.splice(next.edges.indexOf(edge), 1);
    // Both endpoints lose a degree; an endpoint with none left is removed.
    const after = new Map(degrees(next).map((d) => [d.id, d.degree]));
    next.nodes = next.nodes.filter((node) =>
      !(node.id === a || node.id === b) || (after.get(node.id) ?? 0) > 0);
    next.message = edge.count > 0 ? "One copy of the last edge was removed."
      : "The last edge was removed.";
    return next;
  }

  function degrees(state) {
    const out = new Map(state.nodes.map((n) => [n.id, 0]));
    for (const e of state.edges) {
      out.set(e.a, (out.get(e.a) ?? 0) + e.count * (e.a === e.b ? 2 : 1));
      if (e.a !== e.b) out.set(e.b, (out.get(e.b) ?? 0) + e.count);
    }
    return [...out.entries()].map(([id, degree]) => ({ id, degree }));
  }

  function stats(state) {
    const deg = degrees(state);
    return {
      nodes: state.nodes.length,
      links: state.edges.reduce((sum, e) => sum + e.count, 0),
      totalDegree: deg.reduce((sum, d) => sum + d.degree, 0),
      even: deg.filter((d) => d.degree % 2 === 0).length,
      odd: deg.filter((d) => d.degree % 2 === 1).length,
      degrees: deg,
    };
  }

  function reset(state) {
    return {
      ...start({
        showDegrees: state.showDegrees,
        allowLoops: state.allowLoops,
        moving: state.moving,
      }),
      message: "The board is clear.",
    };
  }

  function toggle(state, key) {
    if (!["showDegrees", "allowLoops", "moving"].includes(key)) return state;
    return { ...state, [key]: !state[key], message: `${key} is now ${state[key] ? "off" : "on"}.` };
  }

  /** "done" once anything has been drawn. */
  function result(state) {
    return state.nodes.length || state.edges.length ? "done" : null;
  }

  return {
    start, clone, addNode, addEdge, moveNode, pop, degrees, stats,
    reset, toggle, result,
  };
})();
