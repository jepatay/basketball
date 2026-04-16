import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GameEngine from '../components/game/GameEngine';
import AvatarDisplay from '../components/players/AvatarDisplay';
import { loadPlayers, seedPlayersIfNeeded } from '../firebase/api';
import { generateBracket, advanceWinner, getNextHumanMatch, getNextCpuMatch, isTournamentComplete, getChampion, getRoundName } from '../utils/bracketUtils';
import { simulateCpuShot, calculateShotResult, calculateThreePointResult, DIFFICULTIES, getDifficulty, get3PTGamePct, shuffle } from '../utils/gameUtils';
import PLAYERS from '../data/players';

/**
 * 5v5 Team Playoff
 *
 * Setup  → teams generated → bracket-view → playing → complete
 *
 * Each team has 5 randomly assigned players.
 * In each match the human team's 5 players take shotsPerPlayer shots each
 * (all isHuman:true so the user plays every one).
 * CPU teams are fully simulated.
 * Team with the higher total made shots wins.
 */

const TEAM_COUNTS = [2, 4, 8];
const MATCH_LENGTHS = [10, 20, 50, 100]; // total shots per match
// shotsPerPlayer = matchLength / 5 (each of the 5 players takes this many shots)

const TEAM_NAMES = [
  'Dream Team', 'Showtime', 'Bad Boys', 'Heatles',
  'Splash Bros', 'Triangle', 'Banana Boat', 'The Banana Split',
];

export default function TeamPlayoff() {
  const navigate = useNavigate();
  const username = localStorage.getItem('ftl_username') || 'Player';

  // Config
  const [numTeams, setNumTeams]     = useState(4);
  const [matchLength, setMatchLength] = useState(10); // total shots per match
  const [difficulty, setDifficulty] = useState('pro');
  const [isThreePoint, setIsThreePoint] = useState(false);
  const [step, setStep]             = useState('setup');

  // Players pool
  const [allPlayers, setAllPlayers] = useState([]);

  // Teams: array of { id, name, players: [] }
  const [teams, setTeams]           = useState([]);
  const [humanTeamId, setHumanTeamId] = useState(null);

  // Bracket (uses teams as "players" in bracketUtils)
  const [bracket, setBracket]       = useState(null);
  const [currentMatch, setCurrentMatch] = useState(null);

  useEffect(() => {
    seedPlayersIfNeeded()
      .then(() => loadPlayers())
      .then(setAllPlayers)
      .catch(() => setAllPlayers(PLAYERS));
  }, []);

  const shotsPerPlayer = Math.max(1, Math.floor(matchLength / 5));

  // ── Team generation ──────────────────────────────────────────────────────

  const generateTeams = useCallback(() => {
    const pool = shuffle(allPlayers.length >= numTeams * 5 ? allPlayers : PLAYERS);
    const generated = [];
    const shuffledNames = shuffle([...TEAM_NAMES]);
    for (let i = 0; i < numTeams; i++) {
      const teamPlayers = pool.slice(i * 5, i * 5 + 5);
      generated.push({
        id: `team-${i}`,
        name: i === 0 ? `${username}'s Team` : (shuffledNames[i] || `Team ${i + 1}`),
        players: teamPlayers,
        // For bracketUtils compatibility (uses .id, .name — no ftPct needed by utils)
        ftPct: Math.round(teamPlayers.reduce((s, p) => s + p.ftPct, 0) / teamPlayers.length),
        threePct: Math.round(teamPlayers.reduce((s, p) => s + (p.threePct ?? 33), 0) / teamPlayers.length),
      });
    }
    return generated;
  }, [allPlayers, numTeams, username]);

  const handleStart = () => {
    const newTeams = generateTeams();
    setTeams(newTeams);
    const humanId = newTeams[0].id;
    setHumanTeamId(humanId);

    // Build bracket using teams as participants
    const newBracket = generateBracket(newTeams, numTeams, [humanId]);
    const simulated = simulateCpuMatchesForBracket(newBracket, newTeams, [humanId]);
    setBracket(simulated);
    setStep('bracket-view');
  };

  // ── CPU simulation ───────────────────────────────────────────────────────

  const simulateTeamMatch = useCallback((team1, team2) => {
    const { zoneMult, cpuSpread } = getDifficulty(difficulty);
    let score1 = 0, score2 = 0;

    const simTeam = (team) => {
      let made = 0;
      for (const player of team.players) {
        const gamePct = isThreePoint
          ? get3PTGamePct(player.threePct ?? 33)
          : player.ftPct;
        for (let i = 0; i < shotsPerPlayer; i++) {
          const { hStop: h, vStop: v } = simulateCpuShot(gamePct, zoneMult, cpuSpread);
          if (isThreePoint) {
            const rVal = Math.min(99, Math.max(1,
              28 * zoneMult * (0.5 + (Math.random() - 0.5) * 1.4 * cpuSpread)
            ));
            if (calculateThreePointResult(h, v, rVal, zoneMult, gamePct).madeShot) made++;
          } else {
            if (calculateShotResult(h, v, gamePct, zoneMult).madeShot) made++;
          }
        }
      }
      return made;
    };

    score1 = simTeam(team1);
    score2 = simTeam(team2);

    // Tiebreaker: keep adding single shots per player until tie breaks
    while (score1 === score2) {
      score1 += simTeam(team1);
      score2 += simTeam(team2);
    }

    return { score1, score2, winner: score1 > score2 ? team1 : team2 };
  }, [difficulty, isThreePoint, shotsPerPlayer]);

  const simulateCpuMatchesForBracket = useCallback((b, currentTeams, humanIds) => {
    const teamsById = Object.fromEntries((currentTeams || teams).map((t) => [t.id, t]));
    let current = b;
    let cpuMatch = getNextCpuMatch(current, humanIds);
    while (cpuMatch) {
      const { roundIdx, matchIdx, match } = cpuMatch;
      const team1 = teamsById[match.player1.id] || match.player1;
      const team2 = teamsById[match.player2.id] || match.player2;
      const { score1, score2, winner } = simulateTeamMatch(team1, team2);
      current = advanceWinner(current, roundIdx, matchIdx, winner, score1, score2);
      cpuMatch = getNextCpuMatch(current, humanIds);
    }
    return current;
  }, [teams, simulateTeamMatch]);

  // ── Bracket navigation ───────────────────────────────────────────────────

  const advanceToNextHumanMatch = useCallback((b) => {
    if (isTournamentComplete(b)) {
      setStep('complete');
      return;
    }
    const next = getNextHumanMatch(b, [humanTeamId]);
    if (next) {
      setCurrentMatch(next);
      setStep('playing');
    } else {
      const final = simulateCpuMatchesForBracket(b, teams, [humanTeamId]);
      setBracket(final);
      if (isTournamentComplete(final)) setStep('complete');
    }
  }, [humanTeamId, teams, simulateCpuMatchesForBracket]);

  const handleMatchComplete = useCallback(({ scores, winner }) => {
    if (!currentMatch) return;
    const { roundIdx, matchIdx, match } = currentMatch;

    // Determine which team is human and sum their scores
    const humanTeam = teams.find((t) => t.id === humanTeamId);
    const cpuTeam   = teams.find((t) => t.id !== humanTeamId &&
      (match.player1.id === t.id || match.player2.id === t.id));

    // scores[0..4] = human team players, scores[5..9] = CPU team players
    const humanScore = scores.slice(0, 5).reduce((a, b) => a + b, 0);
    const cpuScore   = scores.slice(5, 10).reduce((a, b) => a + b, 0);

    const isHumanFirst = match.player1.id === humanTeamId;
    const s1 = isHumanFirst ? humanScore : cpuScore;
    const s2 = isHumanFirst ? cpuScore : humanScore;
    const winningTeam = winner
      ? (winner.id === humanTeamId ? humanTeam : cpuTeam)
      : (s1 >= s2 ? match.player1 : match.player2);

    const updated = advanceWinner(bracket, roundIdx, matchIdx, winningTeam || match.player1, s1, s2);
    const simulated = simulateCpuMatchesForBracket(updated, teams, [humanTeamId]);
    setBracket(simulated);
    setCurrentMatch(null);
    setStep('bracket-view');
  }, [currentMatch, bracket, teams, humanTeamId, simulateCpuMatchesForBracket]);

  // ── Render helpers ───────────────────────────────────────────────────────

  const humanTeam = teams.find((t) => t.id === humanTeamId);

  // ── Render ───────────────────────────────────────────────────────────────

  if (step === 'setup') {
    return (
      <div className="page page--setup">
        <div className="page__header">
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>← Back</button>
          <h1 className="page__title">👥 5v5 Team Playoff</h1>
        </div>
        <div className="setup-card">
          <div className="setup-row">
            <label className="setup-label">Challenge Type</label>
            <div className="setup-options">
              <button
                className={`btn btn--option ${!isThreePoint ? 'btn--option-active' : ''}`}
                onClick={() => setIsThreePoint(false)}
              >🎯 Free Throw</button>
              <button
                className={`btn btn--option ${isThreePoint ? 'btn--option-active' : ''}`}
                onClick={() => setIsThreePoint(true)}
              >🎳 3-Point</button>
            </div>
          </div>

          <div className="setup-row">
            <label className="setup-label">Number of Teams</label>
            <div className="setup-options">
              {TEAM_COUNTS.map((n) => (
                <button
                  key={n}
                  className={`btn btn--option ${numTeams === n ? 'btn--option-active' : ''}`}
                  onClick={() => setNumTeams(n)}
                >{n} Teams</button>
              ))}
            </div>
          </div>

          <div className="setup-row">
            <label className="setup-label">Match Shots</label>
            <div className="setup-options">
              {MATCH_LENGTHS.map((l) => (
                <button
                  key={l}
                  className={`btn btn--option ${matchLength === l ? 'btn--option-active' : ''}`}
                  onClick={() => setMatchLength(l)}
                >
                  {l} total · {Math.floor(l / 5)}/player
                </button>
              ))}
            </div>
          </div>

          <div className="setup-row">
            <label className="setup-label">Difficulty</label>
            <div className="setup-options setup-options--difficulty">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  className={`btn btn--option btn--difficulty ${difficulty === d.id ? 'btn--option-active' : ''}`}
                  onClick={() => setDifficulty(d.id)}
                >{d.label}</button>
              ))}
            </div>
          </div>

          <p className="setup-info">
            {numTeams} teams × 5 players = {numTeams * 5} players randomly drawn.
            Your team plays manually; all CPU teams are simulated.
          </p>

          <button
            className="btn btn--primary btn--lg"
            onClick={handleStart}
            disabled={allPlayers.length < numTeams * 5 && PLAYERS.length < numTeams * 5}
          >
            🎲 DRAW TEAMS & START
          </button>
        </div>
      </div>
    );
  }

  if (step === 'bracket-view') {
    const nextHuman = bracket ? getNextHumanMatch(bracket, [humanTeamId]) : null;
    return (
      <div className="page page--bracket">
        <div className="page__header">
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>✕ Exit</button>
          <h1 className="page__title">👥 Team Bracket</h1>
        </div>

        {/* Show human team roster */}
        {humanTeam && (
          <div className="team-roster-card">
            <div className="team-roster-card__title">Your Team — {humanTeam.name}</div>
            <div className="team-roster-card__players">
              {humanTeam.players.map((p) => (
                <div key={p.id} className="team-roster-card__player">
                  <AvatarDisplay player={p} size="sm" />
                  <span className="team-roster-card__name">{p.name}</span>
                  <span className="team-roster-card__pct">
                    {isThreePoint ? `${p.threePct ?? '?'}% 3PT` : `${p.ftPct}% FT`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simple bracket display — reuse BracketView if teams fit as "players" */}
        {bracket && <TeamBracketView bracket={bracket} humanTeamId={humanTeamId} />}

        {nextHuman && (
          <div className="page__action-bar">
            <p className="page__action-text">
              Your next match: <strong>{nextHuman.match.player1?.name}</strong> vs <strong>{nextHuman.match.player2?.name}</strong>
            </p>
            <button className="btn btn--primary" onClick={() => advanceToNextHumanMatch(bracket)}>
              ▶ PLAY NOW
            </button>
          </div>
        )}
        {!nextHuman && bracket && !isTournamentComplete(bracket) && (
          <div className="page__action-bar">
            <button className="btn btn--primary" onClick={() => advanceToNextHumanMatch(bracket)}>
              ▶ Continue
            </button>
          </div>
        )}
      </div>
    );
  }

  if (step === 'playing' && currentMatch) {
    const { match } = currentMatch;
    const humanT = teams.find((t) => t.id === humanTeamId);
    const cpuT   = teams.find((t) => t.id !== humanTeamId &&
      (match.player1.id === t.id || match.player2.id === t.id));

    // Build 10 players: human team (isHuman:true) then CPU team (isHuman:false)
    const isHumanTeam1 = match.player1.id === humanTeamId;
    const orderedTeams = isHumanTeam1
      ? [humanT, cpuT]
      : [cpuT, humanT];

    // Interleave: all 5 from first team then all 5 from second team
    // Actually we want sequential: all human team plays first, then CPU (or interleaved)
    // Let's do: human team players first (all human), then CPU players
    const gamePlayers = [
      ...(humanT?.players || []).map((p) => ({
        player: p,
        isHuman: true,
        label: p.name,
      })),
      ...(cpuT?.players || []).map((p) => ({
        player: p,
        isHuman: false,
        label: p.name,
      })),
    ];

    return (
      <div className="page page--playing">
        <div className="page__round-badge">
          {getRoundName(currentMatch.roundIdx, numTeams)} · {match.player1?.name} vs {match.player2?.name}
        </div>
        <GameEngine
          players={gamePlayers}
          totalShots={shotsPerPlayer}
          difficulty={difficulty}
          isThreePoint={isThreePoint}
          onComplete={handleMatchComplete}
          onExit={() => setStep('bracket-view')}
        />
      </div>
    );
  }

  if (step === 'complete') {
    const champion = bracket ? getChampion(bracket) : null;
    const champTeam = teams.find((t) => t.id === champion?.id) || champion;
    const isHumanChamp = champion?.id === humanTeamId;

    return (
      <div className="page page--complete">
        <div className="complete-card">
          <div className="complete-card__trophy">{isHumanChamp ? '🏆' : '😔'}</div>
          <h1 className="complete-card__title">
            {isHumanChamp ? 'YOUR TEAM WINS!' : 'TEAM CHAMPION!'}
          </h1>
          <div className="complete-card__winner">{champion?.name}</div>

          {champTeam?.players && (
            <div className="team-roster-card team-roster-card--compact">
              {champTeam.players.map((p) => (
                <div key={p.id} className="team-roster-card__player">
                  <AvatarDisplay player={p} size="sm" />
                  <span className="team-roster-card__name">{p.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="complete-card__actions">
            <button className="btn btn--primary" onClick={() => { setBracket(null); setTeams([]); setStep('setup'); }}>
              Play Again
            </button>
            <button className="btn btn--ghost" onClick={() => navigate('/')}>
              Main Menu
            </button>
          </div>
        </div>

        {bracket && <TeamBracketView bracket={bracket} humanTeamId={humanTeamId} />}
      </div>
    );
  }

  return null;
}

// ── Simple team bracket view ─────────────────────────────────────────────────

function TeamBracketView({ bracket, humanTeamId }) {
  if (!bracket) return null;
  return (
    <div className="bracket-scroll">
      {bracket.matchesByRound.map((round, rIdx) => (
        <div key={rIdx} className="bracket-round">
          <div className="bracket-round__label">Round {rIdx + 1}</div>
          {round.map((match) => (
            <div
              key={match.id}
              className={`bracket-match${match.complete ? ' bracket-match--done' : ''}`}
            >
              <div className={`bracket-match__player${match.winner?.id === match.player1?.id ? ' bracket-match__player--winner' : ''}${match.player1?.id === humanTeamId ? ' bracket-match__player--human' : ''}`}>
                <span className="bracket-match__name">{match.player1?.name ?? '?'}</span>
                {match.complete && <span className="bracket-match__score">{match.score1}</span>}
              </div>
              <div className="bracket-match__vs">vs</div>
              <div className={`bracket-match__player${match.winner?.id === match.player2?.id ? ' bracket-match__player--winner' : ''}${match.player2?.id === humanTeamId ? ' bracket-match__player--human' : ''}`}>
                <span className="bracket-match__name">{match.player2?.name ?? '?'}</span>
                {match.complete && <span className="bracket-match__score">{match.score2}</span>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
