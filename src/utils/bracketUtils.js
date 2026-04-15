import { shuffle } from './gameUtils';

/**
 * Generates a randomized tournament bracket.
 * @param {Array} players  Full list of player objects
 * @param {number} size    8 | 16 | 32
 * @param {string} humanPlayerId  The player the human has chosen (always seeded in)
 * @returns {Object} bracket structure
 */
export function generateBracket(players, size, humanPlayerIds = []) {
  const pool = players.filter((p) => !humanPlayerIds.includes(p.id));
  const shuffled = shuffle(pool);
  const fillers = shuffled.slice(0, size - humanPlayerIds.length);
  const humanPlayers = players.filter((p) => humanPlayerIds.includes(p.id));
  const allParticipants = shuffle([...humanPlayers, ...fillers]);

  // Build initial matchups (round 1)
  const rounds = Math.log2(size); // 3 for 8, 4 for 16, 5 for 32
  const bracket = {
    size,
    rounds: rounds,
    participants: allParticipants,
    // Each round is an array of matches: { player1, player2, winner, score1, score2 }
    matchesByRound: [],
  };

  // Round 1 matchups
  const round1 = [];
  for (let i = 0; i < allParticipants.length; i += 2) {
    round1.push({
      id: `r1_m${i / 2}`,
      player1: allParticipants[i],
      player2: allParticipants[i + 1],
      winner: null,
      score1: 0,
      score2: 0,
      complete: false,
    });
  }
  bracket.matchesByRound.push(round1);

  // Placeholder subsequent rounds
  for (let r = 1; r < rounds; r++) {
    const matchCount = size / Math.pow(2, r + 1);
    const roundMatches = [];
    for (let m = 0; m < matchCount; m++) {
      roundMatches.push({
        id: `r${r + 1}_m${m}`,
        player1: null,
        player2: null,
        winner: null,
        score1: 0,
        score2: 0,
        complete: false,
      });
    }
    bracket.matchesByRound.push(roundMatches);
  }

  return bracket;
}

/** Advance winner to next round slot */
export function advanceWinner(bracket, roundIdx, matchIdx, winner, score1, score2) {
  const updated = { ...bracket };
  const round = [...updated.matchesByRound[roundIdx]];
  round[matchIdx] = { ...round[matchIdx], winner, score1, score2, complete: true };
  updated.matchesByRound[roundIdx] = round;

  if (roundIdx + 1 < updated.matchesByRound.length) {
    const nextRound = [...updated.matchesByRound[roundIdx + 1]];
    const nextMatchIdx = Math.floor(matchIdx / 2);
    const isFirstSlot = matchIdx % 2 === 0;
    nextRound[nextMatchIdx] = {
      ...nextRound[nextMatchIdx],
      [isFirstSlot ? 'player1' : 'player2']: winner,
    };
    updated.matchesByRound[roundIdx + 1] = nextRound;
  }

  return updated;
}

/** Find the next unplayed match involving human players */
export function getNextHumanMatch(bracket, humanPlayerIds) {
  for (let r = 0; r < bracket.matchesByRound.length; r++) {
    for (let m = 0; m < bracket.matchesByRound[r].length; m++) {
      const match = bracket.matchesByRound[r][m];
      if (!match.complete && match.player1 && match.player2) {
        const hasHuman =
          humanPlayerIds.includes(match.player1.id) ||
          humanPlayerIds.includes(match.player2.id);
        if (hasHuman) return { roundIdx: r, matchIdx: m, match };
      }
    }
  }
  return null;
}

/** Find any unplayed CPU-only match (to simulate automatically) */
export function getNextCpuMatch(bracket, humanPlayerIds) {
  for (let r = 0; r < bracket.matchesByRound.length; r++) {
    for (let m = 0; m < bracket.matchesByRound[r].length; m++) {
      const match = bracket.matchesByRound[r][m];
      if (!match.complete && match.player1 && match.player2) {
        const hasHuman =
          humanPlayerIds.includes(match.player1.id) ||
          humanPlayerIds.includes(match.player2.id);
        if (!hasHuman) return { roundIdx: r, matchIdx: m, match };
      }
    }
  }
  return null;
}

/** Is the tournament finished? */
export function isTournamentComplete(bracket) {
  const finalRound = bracket.matchesByRound[bracket.matchesByRound.length - 1];
  return finalRound.every((m) => m.complete);
}

/** Get the champion */
export function getChampion(bracket) {
  if (!isTournamentComplete(bracket)) return null;
  const finalRound = bracket.matchesByRound[bracket.matchesByRound.length - 1];
  return finalRound[0].winner;
}

export const ROUND_NAMES = {
  0: { 32: 'Round of 32', 16: 'Round of 16', 8: 'Quarterfinals' },
  1: { 32: 'Round of 16', 16: 'Quarterfinals', 8: 'Semifinals' },
  2: { 32: 'Quarterfinals', 16: 'Semifinals', 8: 'Finals' },
  3: { 32: 'Semifinals', 16: 'Finals' },
  4: { 32: 'Finals' },
};

export function getRoundName(roundIdx, bracketSize) {
  return ROUND_NAMES[roundIdx]?.[bracketSize] || `Round ${roundIdx + 1}`;
}
