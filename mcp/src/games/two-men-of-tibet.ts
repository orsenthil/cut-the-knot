/*
 * run_game_logic actions and saved-position reader for The Two Men of Tibet. The core lives in
 * two-men-of-tibet/ and is copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 */
import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["two-men-of-tibet"].TwoMenOfTibetCore;
type Pt = { x: number; h: number; corner: number | null };
type Step = { white: Pt; black: Pt };

function analyse(heights: number[]) {
  const C = core();
  const s = C.start({ heights });
  const P = C.named(s) as Pt[];
  const letter = (p: Pt) => { const i = P.findIndex((q) => q.x === p.x && q.h === p.h); return i < 26 ? String.fromCharCode(65 + i) : `#${i + 1}`; };
  const base = { heights: s.heights, namedPoints: P.map((p) => `${letter(p)} (height ${p.h}${p.corner === null ? "" : ", corner"})`) };
  if (C.plateau(s)) return { ...base, plateau: true, note: "Two neighbouring corners are at one height; the page asks for plateaus to be removed." };
  const path = C.journey(s) as Step[];
  return {
    ...base, plateau: false,
    steps: path.length - 1,
    walk: path.map((st) => `(${letter(st.white)}, ${letter(st.black)})`),
    turnsBack: { white: C.turns(path, "white"), black: C.turns(path, "black") },
    note: "Positions are pairs (white man, black man) of named points at one height; (A, Z) and (Z, A) are the only pairs with an odd number of steps.",
  };
}

export function actions(): GameActions {
  return {
    journey: {
      describe: "For a mountain range given as corner heights (the first and last 0, the others in (0, 1], 3..12 corners): the named points, and the shortest level walk taking the men from (A, Z) to (Z, A), with how often each turns back.",
      args: '{ "heights": [0, 0.3, 0.1, 0.9, 0] }',
      run: (args) => {
        const h = numArray(args, "heights");
        if (!h || h.length < 3 || h.length > 12) throw new Error("heights must list 3 to 12 corner heights");
        return analyse(h);
      },
    },
  };
}

export function position(state: Json): unknown {
  const h = numArray(state, "heights") ?? core().start({}).heights;
  return { ...analyse(h), walking: state.walking === true };
}
