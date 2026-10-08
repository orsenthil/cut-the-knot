"use strict";

/*
 * Pure logic for Four By Four (no DOM), ported from Sun Microsystems' Java3D
 * demo applet of the same name (bundled as classes/FourByFour/, hosted --
 * not authored -- by Alexander Bogomolny at
 * cut-the-knot.org/Curriculum/Games/FourByFour.shtml). 3D tic-tac-toe on a
 * 4x4x4 cube: get four of your marks in a straight line (orthogonal, face
 * diagonal, or space diagonal) before the computer does.
 *
 * Cells are numbered 0-63 as index = x + 4*y + 16*z, x/y/z each 0-3.
 *
 * COMB and FACES below are not hand-transcribed: they were extracted
 * verbatim (every `this.combinations[i][j] = v` / `this.faces[i][j] = v`
 * assignment) from Board.class decompiled with CFR, then independently
 * cross-checked in Node/Python against a from-scratch enumeration of every
 * straight 4-in-a-row line in a 4x4x4 cube -- the 76 extracted lines are
 * exactly that full set, and the corner cells and the central 2x2x2 "core"
 * each sit on exactly 7 of them, matching classes/FourByFour/instructions.txt
 * ("the outer four corners and the inner core of eight have the most
 * winning combinations, 7 each"). FACES holds the 18 planar 16-cell
 * cross-sections of the cube (12 orthogonal slices + 6 diagonal slices) that
 * the original's 2D window drew side by side; OUTSIDE_FOUR (each face's 4
 * corner cells) and INSIDE_FOUR (each face's 4 centre cells) are the
 * per-face corner/centre groups the AI's "chair" and "central four" heuristics
 * reason about, derived from FACES exactly as Board.java derives them.
 *
 * The AI (choose_move / block_* / check_* / take_* below) is not minimax --
 * it's the original's own hand-tuned cascade of named tactical checks, tried
 * in a different order per skill level, falling back to pick_best_position
 * (most-open-lines-wins) when none fire. It's translated close to
 * line-for-line from the decompiled source, including a few of its own
 * quirks (variables that persist stale values across loop iterations,
 * indices reused for the wrong array) that classes/FourByFour/instructions.txt
 * itself admits to: "there are... faults in its logic that can be exploited.
 * Thus the human player can win even at the highest skill level." Those are
 * called out inline where they occur rather than silently fixed.
 */
const FourByFourCore = (() => {
  const HUMAN = 1;
  const MACHINE = 2;
  const END = 3;

  const COMB = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 10, 11],
    [12, 13, 14, 15],
    [16, 17, 18, 19],
    [20, 21, 22, 23],
    [24, 25, 26, 27],
    [28, 29, 30, 31],
    [32, 33, 34, 35],
    [36, 37, 38, 39],
    [40, 41, 42, 43],
    [44, 45, 46, 47],
    [48, 49, 50, 51],
    [52, 53, 54, 55],
    [56, 57, 58, 59],
    [60, 61, 62, 63],
    [0, 4, 8, 12],
    [1, 5, 9, 13],
    [2, 6, 10, 14],
    [3, 7, 11, 15],
    [16, 20, 24, 28],
    [17, 21, 25, 29],
    [18, 22, 26, 30],
    [19, 23, 27, 31],
    [32, 36, 40, 44],
    [33, 37, 41, 45],
    [34, 38, 42, 46],
    [35, 39, 43, 47],
    [48, 52, 56, 60],
    [49, 53, 57, 61],
    [50, 54, 58, 62],
    [51, 55, 59, 63],
    [0, 5, 10, 15],
    [16, 21, 26, 31],
    [32, 37, 42, 47],
    [48, 53, 58, 63],
    [3, 6, 9, 12],
    [19, 22, 25, 28],
    [35, 38, 41, 44],
    [51, 54, 57, 60],
    [51, 35, 19, 3],
    [55, 39, 23, 7],
    [59, 43, 27, 11],
    [63, 47, 31, 15],
    [50, 34, 18, 2],
    [54, 38, 22, 6],
    [58, 42, 26, 10],
    [62, 46, 30, 14],
    [49, 33, 17, 1],
    [53, 37, 21, 5],
    [57, 41, 25, 9],
    [61, 45, 29, 13],
    [48, 32, 16, 0],
    [52, 36, 20, 4],
    [56, 40, 24, 8],
    [60, 44, 28, 12],
    [51, 39, 27, 15],
    [50, 38, 26, 14],
    [49, 37, 25, 13],
    [48, 36, 24, 12],
    [3, 23, 43, 63],
    [2, 22, 42, 62],
    [1, 21, 41, 61],
    [0, 20, 40, 60],
    [63, 46, 29, 12],
    [59, 42, 25, 8],
    [55, 38, 21, 4],
    [51, 34, 17, 0],
    [15, 30, 45, 60],
    [11, 26, 41, 56],
    [7, 22, 37, 52],
    [3, 18, 33, 48],
    [0, 21, 42, 63],
    [3, 22, 41, 60],
    [12, 25, 38, 51],
    [15, 26, 37, 48],
  ];

  // Each row: 16 cell indices for one planar cross-section of the cube.
  const FACES = [
    [12, 8, 4, 0, 13, 9, 5, 1, 14, 10, 6, 2, 15, 11, 7, 3],
    [28, 24, 20, 16, 29, 25, 21, 17, 30, 26, 22, 18, 31, 27, 23, 19],
    [44, 40, 36, 32, 45, 41, 37, 33, 46, 42, 38, 34, 47, 43, 39, 35],
    [60, 56, 52, 48, 61, 57, 53, 49, 62, 58, 54, 50, 63, 59, 55, 51],
    [12, 8, 4, 0, 28, 24, 20, 16, 44, 40, 36, 32, 60, 56, 52, 48],
    [13, 9, 5, 1, 29, 25, 21, 17, 45, 41, 37, 33, 61, 57, 53, 49],
    [14, 10, 6, 2, 30, 26, 22, 18, 46, 42, 38, 34, 62, 58, 54, 50],
    [15, 11, 7, 3, 31, 27, 23, 19, 47, 43, 39, 35, 63, 59, 55, 51],
    [12, 13, 14, 15, 28, 29, 30, 31, 44, 45, 46, 47, 60, 61, 62, 63],
    [8, 9, 10, 11, 24, 25, 26, 27, 40, 41, 42, 43, 56, 57, 58, 59],
    [4, 5, 6, 7, 20, 21, 22, 23, 36, 37, 38, 39, 52, 53, 54, 55],
    [0, 1, 2, 3, 16, 17, 18, 19, 32, 33, 34, 35, 48, 49, 50, 51],
    [12, 24, 36, 48, 13, 25, 37, 49, 14, 26, 38, 50, 15, 27, 39, 51],
    [0, 20, 40, 60, 1, 21, 41, 61, 2, 22, 42, 62, 3, 23, 43, 63],
    [12, 9, 6, 3, 28, 25, 22, 19, 44, 41, 38, 35, 60, 57, 54, 51],
    [15, 10, 5, 0, 31, 26, 21, 16, 47, 42, 37, 32, 63, 58, 53, 48],
    [12, 8, 4, 0, 29, 25, 21, 17, 46, 42, 38, 34, 63, 59, 55, 51],
    [15, 11, 7, 3, 30, 26, 22, 18, 45, 41, 37, 33, 60, 56, 52, 48],
  ];

  function create() {
    const faces = FACES.map((f) => [0, 0, ...f]);
    const combinations = COMB.map((c) => [0, 0, c[0], c[1], c[2], c[3], 0]);
    const outside_four = faces.map((f) => [0, 0, f[2], f[5], f[14], f[17]]);
    const inside_four = faces.map((f) => [0, 0, f[7], f[8], f[11], f[12]]);

    const B = {
      occupied: new Array(64).fill(0),
      combinations,
      faces,
      outside_four,
      inside_four,
      pos_to_comb: [],
      best_picks: [],
      player: HUMAN,
      skill_level: 4,
      nmoves: 0,
      moves: [],
      undoFlag: false,
      inside_four_flag: false,
      outside_four_flag: false,
      block_chair_flag: false,
      block_chair_next_move: 0,
      block_chair_face: 0,
      face_index: 0,
      begTime: Date.now(),
      onWin: null, // (winner, skillLevel, nmoves, elapsedSeconds) => void
    };
    setupPosToComb(B);
    updateBestPicks(B);
    return B;
  }

  function setupPosToComb(B) {
    for (let pos = 0; pos < 64; pos++) {
      const list = [0];
      for (let ci = 0; ci < 76; ci++) {
        for (let k = 2; k < 6; k++) {
          if (B.combinations[ci][k] === pos) {
            list[0]++;
            list.push(ci);
          }
        }
      }
      B.pos_to_comb[pos] = list;
    }
  }

  // Recomputed after every move: for each empty cell, every still-winnable
  // (untouched, or owned by the machine) line through it.
  function updateBestPicks(B) {
    for (let pos = 0; pos < 64; pos++) {
      const list = [0];
      if (B.occupied[pos] === 0) {
        for (let ci = 0; ci < 76; ci++) {
          if (B.combinations[ci][0] === 0 || B.combinations[ci][1] === MACHINE) {
            for (let k = 2; k < 6; k++) {
              if (B.combinations[ci][k] === pos) {
                list[0]++;
                list.push(ci);
              }
            }
          }
        }
      }
      B.best_picks[pos] = list;
    }
  }

  function unoccupied(B, n) {
    return B.occupied[n] === 0;
  }

  // Records a placement already written to B.occupied[n], updates every
  // tracking structure, detects a win, and returns whose turn is next
  // (HUMAN/MACHINE), or END if `n` just completed a 4-in-a-row.
  function updateLogicArrays(B, n) {
    if (!B.undoFlag) B.moves[B.nmoves++] = n;

    const touching = B.pos_to_comb[n];
    const count = touching[0];
    for (let i = 0; i < count; i++) {
      const row = B.combinations[touching[i + 1]];
      if (row[1] !== B.player && row[1] !== 0) {
        row[0] = -1;
      } else {
        row[0] = row[0] + 1;
        if (row[0] === 4) {
          const elapsedSeconds = (Date.now() - B.begTime) / 1000;
          if (B.onWin) B.onWin(B.player, B.skill_level, B.nmoves, elapsedSeconds);
          return END;
        }
        row[1] = B.player;
      }
    }

    updateBestPicks(B);

    for (let f = 0; f < 18; f++) {
      for (let k = 2; k < 6; k++) {
        if (n === B.inside_four[f][k]) {
          if (B.inside_four[f][0] === 0) {
            B.inside_four[f][0] = 1;
            B.inside_four[f][1] = B.player;
          } else if (B.inside_four[f][1] === B.player) {
            B.inside_four[f][0] = B.inside_four[f][0] + 1;
            B.inside_four[f][1] = B.player;
          } else {
            B.inside_four[f][0] = -1;
          }
        }
      }
    }

    for (let f = 0; f < 18; f++) {
      for (let k = 2; k < 6; k++) {
        if (n === B.outside_four[f][k]) {
          if (B.outside_four[f][0] === 0) {
            B.outside_four[f][0] = 1;
            B.outside_four[f][1] = B.player;
          } else if (B.outside_four[f][1] === B.player) {
            B.outside_four[f][0] = B.outside_four[f][0] + 1;
            B.outside_four[f][1] = B.player;
          } else {
            B.outside_four[f][0] = -1;
          }
        }
      }
    }

    for (let f = 0; f < 18; f++) {
      for (let k = 2; k < 18; k++) {
        if (n === B.faces[f][k]) {
          if (B.faces[f][0] === 0) {
            B.faces[f][0] = 1;
            B.faces[f][1] = B.player;
          } else if (B.faces[f][1] === B.player) {
            B.faces[f][0] = B.faces[f][0] + 1;
          } else {
            B.faces[f][0] = -1;
          }
        }
      }
    }

    return B.player === HUMAN ? MACHINE : HUMAN;
  }

  function place(B, cell) {
    B.occupied[cell] = MACHINE;
    B.player = updateLogicArrays(B, cell);
  }

  // --- AI heuristics, in the original's own names. Each returns true and
  // makes a move if its pattern fires, else returns false. ---

  // Doubles as both "complete my own 4-in-a-row" and "block the human's":
  // it just looks for any still-alive line with exactly 3 marks, regardless
  // of whose they are (a line that ever got touched by both players was
  // already marked dead (-1) and can't reach 3 here).
  function blockWinningMove(B) {
    for (let i = 0; i < 76; i++) {
      if (B.combinations[i][0] === 3) {
        for (let k = 2; k < 6; k++) {
          const cell = B.combinations[i][k];
          if (B.occupied[cell] === 0) {
            place(B, cell);
            return true;
          }
        }
      }
    }
    return false;
  }

  function blockOutsideFour(B) {
    let best = 0,
      bestCount = 0;
    for (let f = 0; f < 18; f++) {
      if (B.outside_four[f][0] > 0 && B.outside_four[f][1] === HUMAN && B.outside_four[f][0] > bestCount) {
        best = f;
        bestCount = B.outside_four[f][0];
      }
    }
    if (bestCount > 0) {
      for (let k = 2; k < 6; k++) {
        const cell = B.outside_four[best][k];
        if (B.occupied[cell] === 0) {
          place(B, cell);
          return true;
        }
      }
    }
    return false;
  }

  // NOTE: faithfully reproduces the original's loop bound (f starts at 1,
  // not 0, and stops at 3) -- block_inside_four below is the same check over
  // the full 0..17 range. Two near-duplicate functions, called at different
  // points in the skill-4 cascade; neither "fixes" the other.
  function blockCentralFour(B) {
    let best = 0,
      bestCount = 0;
    for (let f = 1; f < 3; f++) {
      if (B.inside_four[f][0] > 0 && B.inside_four[f][1] === HUMAN && B.inside_four[f][0] > bestCount) {
        best = f;
        bestCount = B.inside_four[f][0];
      }
    }
    if (bestCount > 0) {
      for (let k = 2; k < 6; k++) {
        const cell = B.inside_four[best][k];
        if (B.occupied[cell] === 0) {
          place(B, cell);
          return true;
        }
      }
    }
    return false;
  }

  function blockInsideFour(B) {
    let best = 0,
      bestCount = 0;
    for (let f = 0; f < 18; f++) {
      if (B.inside_four[f][0] > 0 && B.inside_four[f][1] === HUMAN && B.inside_four[f][0] > bestCount) {
        best = f;
        bestCount = B.inside_four[f][0];
      }
    }
    if (bestCount > 0) {
      for (let k = 2; k < 6; k++) {
        const cell = B.inside_four[best][k];
        if (B.occupied[cell] === 0) {
          place(B, cell);
          return true;
        }
      }
    }
    return false;
  }

  // NOTE: faithfully reproduces an index mix-up in the original -- it reuses
  // the face index `f` (0..17) as if it were a line index into `combinations`
  // (0..75, a differently-sized, differently-meant array), and compares
  // against combinations[f][0..3], which includes the count/owner slots, not
  // just the two real cell slots. The original also wraps this in a 76-time
  // loop whose body never actually depends on the loop variable (so it either
  // fires on the first pass or never); that dead repetition is dropped here
  // since it can't change the outcome.
  function checkFaceThree(B) {
    for (let f = 0; f < 18; f++) {
      if (B.outside_four[f][0] !== -1) continue;
      let human = 0,
        machine = 0;
      for (let k = 2; k < 6; k++) {
        const c = B.occupied[B.outside_four[f][k]];
        if (c === MACHINE) machine++;
        else if (c === HUMAN) human++;
      }
      if (human === 3 && machine === 1) {
        for (let k = 2; k < 18; k++) {
          const cell = B.faces[f][k];
          if (B.occupied[cell] !== 0) continue;
          const row = B.combinations[f];
          if (row[0] === 2 && row[1] === HUMAN) {
            for (let j = 0; j < 4; j++) {
              if (row[j] === cell) {
                place(B, cell);
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }

  // The "chair" pattern: three corners of a face held by the human, the
  // fourth already the machine's own (not merely empty -- confirmed by
  // re-reading Board.java, which only ever sets the "open corner" variable
  // on occupied===MACHINE), plus one specific edge-adjacent human piece with
  // several named cells still empty. Recognises each rotation of the
  // pattern by hand and plays the cell that blocks it.
  function blockChairMove(B) {
    let human = 0,
      openCorner = 0;
    for (let f = 0; f < 18; f++) {
      if (B.occupied[B.faces[f][2]] === HUMAN) human++;
      else if (B.occupied[B.faces[f][2]] === MACHINE) openCorner = 2;
      if (B.occupied[B.faces[f][5]] === HUMAN) human++;
      else if (B.occupied[B.faces[f][5]] === MACHINE) openCorner = 5;
      if (B.occupied[B.faces[f][14]] === HUMAN) human++;
      else if (B.occupied[B.faces[f][14]] === MACHINE) openCorner = 14;
      if (B.occupied[B.faces[f][17]] === HUMAN) human++;
      else if (B.occupied[B.faces[f][17]] === MACHINE) openCorner = 17;

      if (human === 3) {
        const fc = B.faces[f];
        const occ = B.occupied;
        if (openCorner === 2) {
          if (occ[fc[3]] === HUMAN && occ[fc[7]] === 0 && occ[fc[8]] === 0 && occ[fc[11]] === 0 && occ[fc[15]] === 0 && occ[fc[16]] === 0) {
            place(B, fc[11]);
            return true;
          }
          if (occ[fc[4]] === HUMAN && occ[fc[8]] === 0 && occ[fc[11]] === 0 && occ[fc[12]] === 0 && occ[fc[15]] === 0 && occ[fc[16]] === 0) {
            place(B, fc[12]);
            return true;
          }
          if (occ[fc[6]] === HUMAN && occ[fc[7]] === 0 && occ[fc[8]] === 0 && occ[fc[9]] === 0 && occ[fc[11]] === 0 && occ[fc[13]] === 0) {
            place(B, fc[8]);
            return true;
          }
          if (occ[fc[10]] === HUMAN && occ[fc[8]] === 0 && occ[fc[9]] === 0 && occ[fc[11]] === 0 && occ[fc[12]] === 0 && occ[fc[13]] === 0) {
            place(B, fc[11]);
            return true;
          }
          if (occ[fc[7]] === HUMAN && occ[fc[3]] === 0 && occ[fc[8]] === 0 && occ[fc[11]] === 0 && occ[fc[15]] === 0 && occ[fc[16]] === 0) {
            place(B, fc[11]);
            return true;
          }
          if (occ[fc[12]] === HUMAN && occ[fc[4]] === 0 && occ[fc[8]] === 0 && occ[fc[11]] === 0 && occ[fc[15]] === 0 && occ[fc[16]] === 0) {
            place(B, fc[16]);
            return true;
          }
        } else if (openCorner === 5) {
          if (occ[fc[9]] === HUMAN && occ[fc[6]] === 0 && occ[fc[7]] === 0 && occ[fc[8]] === 0 && occ[fc[10]] === 0 && occ[fc[12]] === 0) {
            place(B, fc[7]);
            return true;
          }
          if (occ[fc[13]] === HUMAN && occ[fc[7]] === 0 && occ[fc[10]] === 0 && occ[fc[11]] === 0 && occ[fc[12]] === 0) {
            place(B, fc[12]);
            return true;
          }
          if (occ[fc[4]] === HUMAN && occ[fc[8]] === 0 && occ[fc[11]] === 0 && occ[fc[12]] === 0 && occ[fc[15]] === 0 && occ[fc[16]] === 0) {
            place(B, fc[12]);
            return true;
          }
          if (occ[fc[3]] === HUMAN && occ[fc[7]] === 0 && occ[fc[11]] === 0 && occ[fc[12]] === 0 && occ[fc[15]] === 0 && occ[fc[16]] === 0) {
            place(B, fc[7]);
            return true;
          }
          if (occ[fc[8]] === HUMAN && occ[fc[4]] === 0 && occ[fc[11]] === 0 && occ[fc[12]] === 0 && occ[fc[15]] === 0 && occ[fc[16]] === 0) {
            place(B, fc[12]);
            return true;
          }
          if (occ[fc[11]] === HUMAN && occ[fc[3]] === 0 && occ[fc[7]] === 0 && occ[fc[12]] === 0 && occ[fc[15]] === 0 && occ[fc[16]] === 0) {
            place(B, fc[7]);
            return true;
          }
        } else if (openCorner === 14) {
          if (occ[fc[6]] === HUMAN && occ[fc[7]] === 0 && occ[fc[8]] === 0 && occ[fc[9]] === 0 && occ[fc[11]] === 0 && occ[fc[13]] === 0) {
            place(B, fc[7]);
            return true;
          }
          if (occ[fc[10]] === HUMAN && occ[fc[8]] === 0 && occ[fc[9]] === 0 && occ[fc[11]] === 0 && occ[fc[12]] === 0 && occ[fc[13]] === 0) {
            place(B, fc[12]);
            return true;
          }
          if (occ[fc[15]] === HUMAN && occ[fc[3]] === 0 && occ[fc[4]] === 0 && occ[fc[7]] === 0 && occ[fc[11]] === 0 && occ[fc[12]] === 0) {
            place(B, fc[3]);
            return true;
          }
          if (occ[fc[16]] === HUMAN && occ[fc[3]] === 0 && occ[fc[4]] === 0 && occ[fc[7]] === 0 && occ[fc[8]] === 0 && occ[fc[12]] === 0) {
            place(B, fc[12]);
            return true;
          }
          if (occ[fc[11]] === HUMAN && occ[fc[3]] === 0 && occ[fc[4]] === 0 && occ[fc[7]] === 0 && occ[fc[12]] === 0 && occ[fc[15]] === 0) {
            place(B, fc[7]);
            return true;
          }
          if (occ[fc[8]] === HUMAN && occ[fc[6]] === 0 && occ[fc[7]] === 0 && occ[fc[9]] === 0 && occ[fc[12]] === 0 && occ[fc[13]] === 0) {
            place(B, fc[7]);
            return true;
          }
        } else if (openCorner === 17) {
          if (occ[fc[9]] === HUMAN && occ[fc[6]] === 0 && occ[fc[7]] === 0 && occ[fc[8]] === 0 && occ[fc[10]] === 0 && occ[fc[11]] === 0) {
            place(B, fc[8]);
            return true;
          }
          if (occ[fc[13]] === HUMAN && occ[fc[6]] === 0 && occ[fc[8]] === 0 && occ[fc[10]] === 0 && occ[fc[11]] === 0 && occ[fc[12]] === 0) {
            place(B, fc[11]);
            return true;
          }
          if (occ[fc[15]] === HUMAN && occ[fc[3]] === 0 && occ[fc[4]] === 0 && occ[fc[7]] === 0 && occ[fc[8]] === 0 && occ[fc[11]] === 0) {
            place(B, fc[11]);
            return true;
          }
          if (occ[fc[16]] === HUMAN && occ[fc[3]] === 0 && occ[fc[4]] === 0 && occ[fc[8]] === 0 && occ[fc[11]] === 0 && occ[fc[12]] === 0) {
            place(B, fc[8]);
            return true;
          }
          if (occ[fc[12]] === HUMAN && occ[fc[3]] === 0 && occ[fc[4]] === 0 && occ[fc[8]] === 0 && occ[fc[11]] === 0 && occ[fc[16]] === 0) {
            place(B, fc[8]);
            return true;
          }
          if (occ[fc[7]] === HUMAN && occ[fc[3]] === 0 && occ[fc[4]] === 0 && occ[fc[8]] === 0 && occ[fc[11]] === 0 && occ[fc[15]] === 0) {
            place(B, fc[11]);
            return true;
          }
        }
      }
      human = 0;
      openCorner = -1;
    }
    return false;
  }

  // The "walk" pattern: named block_walk_move in the original -- a face with
  // four human marks in a specific recognised shape and several named cells
  // still empty. Checked per face, in each of 8 rotations/reflections, each
  // translated directly from its own if-block in Board.java.
  //
  // NOTE: faithfully reproduces an out-of-range array read in the original
  // (faces[n][18] -- faces rows only hold indices 0..17). In the original
  // Java that throws; here it's treated as "no such cell" so this one
  // pattern silently fails to fire instead of crashing the page.
  function blockWalkMove(B) {
    const occ = B.occupied;
    for (let f = 0; f < 18; f++) {
      const fc = B.faces[f];
      const at = (i) => (i >= 0 && i < fc.length ? fc[i] : undefined);
      const o = (i) => {
        const cell = at(i);
        return cell === undefined ? undefined : occ[cell];
      };

      if (o(2) === HUMAN && o(14) === HUMAN && o(3) === HUMAN && o(15) === HUMAN && o(6) === 0 && o(10) === 0 && o(7) === 0 && o(11) === 0) {
        if (o(8) === HUMAN && o(9) === 0) {
          place(B, fc[6]);
          return true;
        }
        if (o(12) === HUMAN && o(13) === 0) {
          place(B, fc[10]);
          return true;
        }
      }
      if (o(14) === HUMAN && o(17) === HUMAN && o(10) === HUMAN && o(13) === HUMAN && o(15) === 0 && o(16) === 0 && o(11) === 0 && o(12) === 0) {
        if (o(7) === HUMAN && o(3) === 0) {
          place(B, fc[15]);
          return true;
        }
        if (o(8) === HUMAN && o(4) === 0) {
          place(B, fc[16]);
          return true;
        }
      }
      if (o(4) === HUMAN && o(16) === HUMAN && o(5) === HUMAN && o(17) === HUMAN && o(8) === 0 && o(12) === 0 && o(9) === 0 && o(13) === 0) {
        if (o(11) === HUMAN && o(10) === 0) {
          const cell = at(18);
          if (cell !== undefined && occ[cell] === 0) {
            place(B, cell);
            return true;
          }
        }
        if (o(7) === HUMAN && o(6) === 0) {
          place(B, fc[9]);
          return true;
        }
      }
      if (o(6) === HUMAN && o(9) === HUMAN && o(2) === HUMAN && o(5) === HUMAN && o(7) === 0 && o(8) === 0 && o(3) === 0 && o(4) === 0) {
        if (o(11) === HUMAN && o(15) === 0) {
          place(B, fc[3]);
          return true;
        }
        if (o(12) === HUMAN && o(16) === 0) {
          place(B, fc[4]);
          return true;
        }
      }
      if (o(2) === HUMAN && o(14) === HUMAN && o(4) === HUMAN && o(16) === HUMAN && o(6) === 0 && o(10) === 0 && o(8) === 0 && o(12) === 0) {
        if ((o(7) === HUMAN && o(9) === 0) || (o(9) === HUMAN && o(7) === 0)) {
          place(B, fc[6]);
          return true;
        }
        if ((o(11) === HUMAN && o(13) === 0) || (o(13) === HUMAN && o(11) === 0)) {
          place(B, fc[10]);
          return true;
        }
      }
      if (o(14) === HUMAN && o(17) === HUMAN && o(6) === HUMAN && o(9) === HUMAN && o(15) === 0 && o(16) === 0 && o(7) === 0 && o(8) === 0) {
        if ((o(11) === HUMAN && o(3) === 0) || (o(3) === HUMAN && o(11) === 0)) {
          place(B, fc[15]);
          return true;
        }
        if ((o(12) === HUMAN && o(4) === 0) || (o(4) === HUMAN && o(12) === 0)) {
          place(B, fc[16]);
          return true;
        }
      }
      if (o(3) === HUMAN && o(15) === HUMAN && o(5) === HUMAN && o(17) === HUMAN && o(7) === 0 && o(11) === 0 && o(9) === 0 && o(13) === 0) {
        if ((o(6) === HUMAN && o(8) === 0) || (o(8) === HUMAN && o(6) === 0)) {
          place(B, fc[9]);
          return true;
        }
        if ((o(10) === HUMAN && o(12) === 0) || (o(12) === HUMAN && o(10) === 0)) {
          place(B, fc[13]);
          return true;
        }
      }
      if (o(10) === HUMAN && o(13) === HUMAN && o(2) === HUMAN && o(5) === HUMAN && o(11) === 0 && o(12) === 0 && o(3) === 0 && o(4) === 0) {
        if ((o(7) === HUMAN && o(15) === 0) || (o(15) === HUMAN && o(7) === 0)) {
          place(B, fc[3]);
          return true;
        }
        if ((o(8) === HUMAN && o(16) === 0) || (o(16) === HUMAN && o(8) === 0)) {
          place(B, fc[4]);
          return true;
        }
      }
    }
    return false;
  }

  function takeInsideFour(B) {
    const spots = [21, 22, 25, 26, 37, 38, 41, 42];
    for (const cell of spots) {
      if (B.occupied[cell] === 0) {
        place(B, cell);
        return true;
      }
    }
    return false;
  }

  function takeOutsideFour(B) {
    const spots = [0, 3, 12, 15, 48, 51, 60, 63];
    for (const cell of spots) {
      if (B.occupied[cell] === 0) {
        place(B, cell);
        return true;
      }
    }
    return false;
  }

  // NOTE: faithfully reproduces a stale-variable bug in the original: the
  // candidate cell found while `outside_four_flag` carries over from a
  // previous call isn't reset at the top of the search loop below, so a
  // follow-up corner-search can occasionally act on a leftover cell from an
  // earlier face rather than the current one.
  function checkOutsideFour(B) {
    let cand = 0;
    if (B.outside_four_flag) {
      const fc = B.faces[B.face_index];
      if (B.occupied[fc[7]] === 0) cand = fc[7];
      else if (B.occupied[fc[6]] === 0) cand = fc[6];
      if (B.occupied[cand] === 0) {
        place(B, cand);
        return true;
      }
    }

    for (let f = 0; f < 18; f++) {
      if (B.outside_four[f][0] === 4 && B.outside_four[f][1] === MACHINE && B.faces[f][0] > 0 && B.faces[f][1] === MACHINE) {
        if (B.occupied[B.faces[f][8]] === 0) {
          cand = B.faces[f][8];
          B.outside_four_flag = true;
          B.face_index = f;
        }
        if (B.occupied[cand] === 0) {
          place(B, cand);
          return true;
        }
      }
    }

    for (let f = 0; f < 18; f++) {
      if (B.outside_four[f][0] > 0 && B.outside_four[f][1] === MACHINE && B.faces[f][0] > 0 && B.faces[f][1] === MACHINE) {
        for (let k = 2; k < 6; k++) {
          const cell = B.outside_four[f][k];
          if (B.occupied[cell] === 0) {
            place(B, cell);
            return true;
          }
        }
      }
    }

    for (let f = 0; f < 18; f++) {
      if (B.outside_four[f][0] === 0 || (B.outside_four[f][0] > 0 && B.outside_four[f][1] === MACHINE)) {
        if (B.outside_four[f][1] === MACHINE) B.outside_four_flag = true;
        for (let k = 2; k < 6; k++) {
          const cell = B.outside_four[f][k];
          if (B.occupied[cell] === 0) {
            place(B, cell);
            return true;
          }
        }
      }
    }
    return false;
  }

  function blockIntersectingRows(B) {
    for (let i = 0; i < 76; i++) {
      if (B.combinations[i][0] === 2 && B.combinations[i][1] === HUMAN) {
        B.combinations[i][6] = 1;
        for (let k = 2; k < 6; k++) {
          const cell = B.combinations[i][k];
          if (B.occupied[cell] === 0) {
            for (let j = 0; j < 76; j++) {
              if (B.combinations[j][0] === 2 && B.combinations[j][1] === HUMAN && B.combinations[j][6] === 0) {
                for (let m = 2; m < 6; m++) {
                  if (cell === B.combinations[j][m]) {
                    B.combinations[i][6] = 0;
                    place(B, cell);
                    return true;
                  }
                }
              }
            }
          }
        }
        B.combinations[i][6] = 0;
      }
    }
    return false;
  }

  // Same idea as block_intersecting_rows, but (skill 4 only) prefers a
  // blocking cell that also sits on a second, weaker (1-mark) human line.
  function checkIntersectingRows2(B) {
    for (let i = 0; i < 76; i++) {
      if (B.combinations[i][0] === 2 && B.combinations[i][1] === HUMAN) {
        B.combinations[i][6] = 1;
        for (let k = 2; k < 6; k++) {
          const cell = B.combinations[i][k];
          if (B.occupied[cell] === 0) {
            for (let j = 0; j < 76; j++) {
              if (B.combinations[j][0] === 1 && B.combinations[j][1] === HUMAN && B.combinations[j][6] === 0) {
                for (let m = 2; m < 6; m++) {
                  if (cell === B.combinations[j][m]) {
                    B.combinations[i][6] = 0;
                    place(B, cell);
                    return true;
                  }
                }
              }
            }
          }
        }
        B.combinations[i][6] = 0;
      }
    }
    return false;
  }

  function pick7(B) {
    for (let pos = 0; pos < 64; pos++) {
      if (B.best_picks[pos][0] === 7) {
        place(B, pos);
        return true;
      }
    }
    return false;
  }

  // Fallback for every skill level: the empty cell that still sits on the
  // most live lines.
  function pickBestPosition(B) {
    let best = 0,
      bestCount = 0;
    for (let pos = 0; pos < 64; pos++) {
      if (B.best_picks[pos][0] > bestCount && B.occupied[pos] === 0) {
        best = pos;
        bestCount = B.best_picks[pos][0];
      }
    }
    place(B, best);
  }

  // skill 0 = "Babe in the Woods" .. 4 = "Be afraid, be very afraid"
  // (the original's own skill-level button labels).
  function chooseMove(B) {
    if (B.player !== MACHINE) return;
    let acted;
    if (B.skill_level === 0) {
      acted = blockWinningMove(B) || pick7(B) || checkOutsideFour(B);
    } else if (B.skill_level === 1) {
      acted = blockWinningMove(B) || blockIntersectingRows(B) || blockInsideFour(B) || blockOutsideFour(B);
    } else if (B.skill_level === 2) {
      acted = blockWinningMove(B) || blockIntersectingRows(B) || blockInsideFour(B) || blockOutsideFour(B) || pick7(B);
    } else if (B.skill_level === 3) {
      acted =
        blockWinningMove(B) ||
        blockIntersectingRows(B) ||
        blockChairMove(B) ||
        checkFaceThree(B) ||
        blockCentralFour(B) ||
        blockInsideFour(B) ||
        blockOutsideFour(B) ||
        takeInsideFour(B) ||
        takeOutsideFour(B) ||
        pick7(B) ||
        checkOutsideFour(B);
    } else {
      acted =
        blockWinningMove(B) ||
        blockIntersectingRows(B) ||
        blockChairMove(B) ||
        blockWalkMove(B) ||
        blockCentralFour(B) ||
        blockInsideFour(B) ||
        blockOutsideFour(B) ||
        checkFaceThree(B) ||
        checkIntersectingRows2(B) ||
        takeInsideFour(B) ||
        takeOutsideFour(B) ||
        pick7(B) ||
        checkOutsideFour(B);
    }
    if (!acted) pickBestPosition(B);
  }

  // The human plays `cell`; if the game isn't over, the machine replies.
  function selection(B, cell) {
    if (B.occupied[cell] !== 0) return;
    B.player = HUMAN;
    B.occupied[cell] = HUMAN;
    B.player = updateLogicArrays(B, cell);
    chooseMove(B);
  }

  function setSkillLevel(B, level) {
    B.skill_level = level;
  }

  function newGame(B) {
    B.inside_four_flag = false;
    B.outside_four_flag = false;
    B.block_chair_flag = false;
    for (let f = 0; f < 18; f++) {
      B.inside_four[f][0] = 0;
      B.inside_four[f][1] = 0;
      B.outside_four[f][0] = 0;
      B.outside_four[f][1] = 0;
      B.faces[f][0] = 0;
      B.faces[f][1] = 0;
    }
    for (let pos = 0; pos < 64; pos++) B.occupied[pos] = 0;
    for (let i = 0; i < 76; i++) {
      B.combinations[i][0] = 0;
      B.combinations[i][1] = 0;
    }
    updateBestPicks(B);
    B.player = HUMAN;
    B.nmoves = 0;
    B.moves = [];
    B.begTime = Date.now();
  }

  // Undoes a full round (the human's move and the machine's reply) by
  // clearing all state and replaying every earlier move from scratch.
  function undoMove(B) {
    if (B.nmoves === 0) return;
    B.undoFlag = true;
    B.nmoves--;
    B.nmoves--;
    B.inside_four_flag = false;
    B.outside_four_flag = false;
    B.block_chair_flag = false;
    for (let pos = 0; pos < 64; pos++) B.occupied[pos] = 0;
    for (let f = 0; f < 18; f++) {
      B.inside_four[f][0] = 0;
      B.inside_four[f][1] = 0;
      B.outside_four[f][0] = 0;
      B.outside_four[f][1] = 0;
      B.faces[f][0] = 0;
      B.faces[f][1] = 0;
    }
    for (let i = 0; i < 76; i++) {
      B.combinations[i][0] = 0;
      B.combinations[i][1] = 0;
    }
    if (B.nmoves === 0) {
      B.undoFlag = false;
      B.player = HUMAN;
      return;
    }
    B.player = HUMAN;
    const remaining = B.moves.slice(0, B.nmoves);
    for (const cell of remaining) {
      B.occupied[cell] = B.player;
      B.player = updateLogicArrays(B, cell);
    }
    B.moves = remaining;
    updateBestPicks(B);
    B.player = HUMAN;
    B.undoFlag = false;
  }

  function xyz(cell) {
    return { x: cell % 4, y: Math.floor(cell / 4) % 4, z: Math.floor(cell / 16) };
  }

  return {
    HUMAN,
    MACHINE,
    END,
    COMB,
    FACES,
    create,
    selection,
    setSkillLevel,
    newGame,
    undoMove,
    // Exposed only for the Node verification script (scratchpad, not
    // shipped UI code) to exercise individual heuristics directly.
    _test: {
      updateLogicArrays,
      chooseMove,
      blockWinningMove,
      blockIntersectingRows,
      checkIntersectingRows2,
      blockChairMove,
      blockWalkMove,
      blockCentralFour,
      blockInsideFour,
      blockOutsideFour,
      checkFaceThree,
      takeInsideFour,
      takeOutsideFour,
      checkOutsideFour,
      pick7,
      pickBestPosition,
    },
    unoccupied,
    xyz,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = FourByFourCore;
