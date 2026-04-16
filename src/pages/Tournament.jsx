import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerSelect from '../components/players/PlayerSelect';
import BracketView from '../components/tournament/BracketView';
import GameEngine from '../components/game/GameEngine';
import { loadPlayers, seedPlayersIfNeeded, saveTournamentResult } from '../firebase/api';
import { generateBracket, advanceWinner, getNextHumanMatch, getNextCpuMatch, isTournamentComplete, getChampion, getRoundName } from '../utils/bracketUtils';
import { simulateCpuShot, calculateShotResult, calculateThreePointResult, DIFFICULTIES, getDifficulty, get3PTGamePct } from '../utils/gameUtils';

import PLAYERS from '../data/players';

const BRACKET_SIZES = [8, 16, 32];
const MATCH_LENGTHS = [10, 20, 50, 100];

export default function Tournament() {
  const navigate = useNavigate();
  const username = localStorage.getItem('ftl_username') || 'Player';

  // Config state
  const [bracketSize, setBracketSize] = useState(8);
  const [matchLength, setMatchLength] = useState(10);
  const [difficulty, setDifficulty] = useState('pro');
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [isThreePoint, setIsThreePoint] = useState(false);
  const [step, setStep] = useState('setup');

  // Player state
  const [players, setPlayers] = useState([]);
  const [pickingFor, setPickingFor] = useState(1);
  const [humanPlayer1, setHumanPlayer1] = useState(null);
  const [humanPlayer2, setHumanPlayer2] = useState(null);

  // Bracket state
  const [bracket, setBracket] = useState(null);
  const [currentMatch, setCurrentMatch] = useState(null);

  useEffect(() => {
    seedPlayersIfNeeded()
      .then(() => loadPlayers())
      .then(setPlayers)
      .catch(() => setPlayers(PLAYERS));
  }, []);

  // ── Step handlers ──────────────────────────────────────────────────────────

  const handleSetupNext = () => {
    setPickingFor(1);
    setStep('pick-player');
  };

  const handlePlayerPick = (player) => {
    if (pickingFor === 1) {
      setHumanPlayer1(player);
      if (isMultiplayer) {
        setPickingFor(2);
      } else {
        setStep('fill-bracket');
      }
    } else {
      setHumanPlayer2(player);
      setStep('fill-bracket');
    }
  };

  const handleRandomizeBracket = () => {
    const humanIds = [humanPlayer1?.id, humanPlayer2?.id].filter(Boolean);
    const newBracket = generateBracket(players, bracketSize, humanIds);
    setBracket(newBracket);
    setStep('bracket-view');
  };

  // Simulate all CPU-only matches quickly
  const simulateCpuMatches = useCallback((currentBracket) => {
    const { zoneMult, cpuSpread } = getDifficulty(difficulty);
    let b = currentBracket;
    let cpuMatch = getNextCpuMatch(b, [humanPlayer1?.id, humanPlayer2?.id].filter(Boolean));
    while (cpuMatch) {
      const { roundIdx, matchIdx, match } = cpuMatch;
      let score1 = 0, score2 = 0;

      const simPlayerShots = (player, n) => {
        let made = 0;
        const gamePct = isThreePoint
          ? get3PTGamePct(player.threePct ?? 33)
          : player.ftPct;
        for (let i = 0; i < n; i++) {
          const { hStop: h, vStop: v } = simulateCpuShot(gamePct, zoneMult, cpuSpread);
          if (isThreePoint) {
            const rVal = Math.min(99, Math.max(1, 28 * zoneMult * (0.5 + (Math.random() - 0.5) * 1.4 * cpuSpread)));
            if (calculateThreePointResult(h, v, rVal, zoneMult, gamePct).madeShot) made++;
          } else {
            if (calculateShotResult(h, v, gamePct, zoneMult).madeShot) made++;
          }
        }
        return made;
      };

      score1 = simPlayerShots(match.player1, matchLength);
      score2 = simPlayerShots(match.player2, matchLength);

      // Tiebreaker
      while (score1 === score2) {
        score1 += simPlayerShots(match.player1, 1);
        score2 += simPlayerShots(match.player2, 1);
      }

      const winner = score1 > score2 ? match.player1 : match.player2;
      b = advanceWinner(b, roundIdx, matchIdx, winner, score1, score2);
      cpuMatch = getNextCpuMatch(b, [humanPlayer1?.id, humanPlayer2?.id].filter(Boolean));
    }
    return b;
  }, [matchLength, difficulty, isThreePoint, humanPlayer1, humanPlayer2]);

  const handleStartBracket = () => {
    const simulated = simulateCpuMatches(bracket);
    setBracket(simulated);
    advanceToNextHumanMatch(simulated);
  };

  const advanceToNextHumanMatch = (b) => {
    const humanIds = [humanPlayer1?.id, humanPlayer2?.id].filter(Boolean);
    if (isTournamentComplete(b)) {
      setStep('complete');
      const champion = getChampion(b);
      saveTournamentResult(username, {
        bracketSize,
        matchLength,
        isThreePoint,
        champion: champion?.id,
        bracket: JSON.parse(JSON.stringify(b)),
      }).catch(() => {});
      return;
    }
    const next = getNextHumanMatch(b, humanIds);
    if (next) {
      setCurrentMatch(next);
      setStep('playing');
    } else {
      const final = simulateCpuMatches(b);
      setBracket(final);
      if (isTournamentComplete(final)) {
        setStep('complete');
      }
    }
  };

  const handleMatchComplete = useCallback(({ scores, winner }) => {
    if (!currentMatch) return;
    const { roundIdx, matchIdx, match } = currentMatch;
    const actualWinner = winner || (scores[0] >= scores[1] ? match.player1 : match.player2);
    const updated = advanceWinner(bracket, roundIdx, matchIdx, actualWinner, scores[0], scores[1]);

    const simulated = simulateCpuMatches(updated);
    setBracket(simulated);
    setCurrentMatch(null);
    setStep('bracket-view');
  }, [currentMatch, bracket, simulateCpuMatches]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (step === 'setup') {
    return (
      <div className="page page--setup">
        <div className="page__header">
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>← Back</button>
          <h1 className="page__title">🏆 Playoff Tournament</h1>
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
            <label className="setup-label">Bracket Size</label>
            <div className="setup-options">
              {BRACKET_SIZES.map((s) => (
                <button
                  key={s}
                  className={`btn btn--option ${bracketSize === s ? 'btn--option-active' : ''}`}
                  onClick={() => setBracketSize(s)}
                >{s} Players</button>
              ))}
            </div>
          </div>

          <div className="setup-row">
            <label className="setup-label">Match Length</label>
            <div className="setup-options">
              {MATCH_LENGTHS.map((l) => (
                <button
                  key={l}
                  className={`btn btn--option ${matchLength === l ? 'btn--option-active' : ''}`}
                  onClick={() => setMatchLength(l)}
                >{l} {isThreePoint ? '3s' : 'FTs'}</button>
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

          <div className="setup-row">
            <label className="setup-label">Mode</label>
            <div className="setup-options">
              <button
                className={`btn btn--option ${!isMultiplayer ? 'btn--option-active' : ''}`}
                onClick={() => setIsMultiplayer(false)}
              >1 Player</button>
              <button
                className={`btn btn--option ${isMultiplayer ? 'btn--option-active' : ''}`}
                onClick={() => setIsMultiplayer(true)}
              >2 Players</button>
            </div>
          </div>

          <div className="setup-row">
            <label className="setup-label">Format</label>
            <div className="setup-options">
              <button className="btn btn--option btn--option-active" disabled>
                1v1 Individual
              </button>
              <button
                className="btn btn--option"
                onClick={() => navigate('/team-playoff')}
              >
                5v5 Teams →
              </button>
            </div>
          </div>

          <button className="btn btn--primary btn--lg" onClick={handleSetupNext}>
            NEXT: Pick Your Player
          </button>
        </div>
      </div>
    );
  }

  if (step === 'pick-player') {
    const alreadyPicked = [humanPlayer1?.id, humanPlayer2?.id].filter(Boolean);
    const title = isMultiplayer
      ? `Player ${pickingFor}, Choose Your Player`
      : 'Choose Your Player';
    return (
      <div className="page">
        <div className="page__header">
          <button className="btn btn--ghost btn--sm" onClick={() => setStep('setup')}>← Back</button>
          <h1 className="page__title">{title}</h1>
        </div>
        <PlayerSelect
          players={players}
          selectedId={pickingFor === 1 ? humanPlayer1?.id : humanPlayer2?.id}
          onSelect={handlePlayerPick}
          exclude={alreadyPicked.filter((_, i) => (pickingFor === 1 ? i !== 0 : i !== 1))}
        />
      </div>
    );
  }

  if (step === 'fill-bracket') {
    return (
      <div className="page page--fill-bracket">
        <div className="page__header">
          <button className="btn btn--ghost btn--sm" onClick={() => setStep('pick-player')}>← Back</button>
          <h1 className="page__title">Fill the Bracket</h1>
        </div>
        <div className="setup-card">
          <div className="setup-row">
            <p className="setup-info">
              You are playing as <strong>{humanPlayer1?.name}</strong>
              {humanPlayer2 && <> & <strong>{humanPlayer2?.name}</strong></>}.
              The remaining {bracketSize - (isMultiplayer ? 2 : 1)} slots will be filled automatically.
            </p>
          </div>
          <button
            className="btn btn--primary btn--lg"
            onClick={handleRandomizeBracket}
            disabled={players.length === 0}
          >
            🎲 RANDOMIZE & START
          </button>
        </div>
      </div>
    );
  }

  if (step === 'bracket-view') {
    const humanIds = [humanPlayer1?.id, humanPlayer2?.id].filter(Boolean);
    const nextHuman = getNextHumanMatch(bracket, humanIds);
    return (
      <div className="page page--bracket">
        <div className="page__header">
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>✕ Exit</button>
          <h1 className="page__title">🏆 Bracket {isThreePoint ? '· 3PT' : '· FT'}</h1>
        </div>
        <BracketView bracket={bracket} humanPlayerIds={humanIds} />
        {nextHuman && (
          <div className="page__action-bar">
            <p className="page__action-text">
              Your next match: <strong>{nextHuman.match.player1?.name}</strong> vs <strong>{nextHuman.match.player2?.name}</strong>
            </p>
            <button className="btn btn--primary" onClick={handleStartBracket}>
              ▶ PLAY NOW
            </button>
          </div>
        )}
      </div>
    );
  }

  if (step === 'playing' && currentMatch) {
    const { match } = currentMatch;
    const gamePlayers = [];
    if (match.player1) {
      const isH = humanPlayer1?.id === match.player1.id || humanPlayer2?.id === match.player1.id;
      gamePlayers.push({ player: match.player1, isHuman: isH, label: isH ? `${username}` : match.player1.name });
    }
    if (match.player2) {
      const isH = humanPlayer1?.id === match.player2.id || humanPlayer2?.id === match.player2.id;
      const label2 = isH
        ? (isMultiplayer && humanPlayer2?.id === match.player2.id ? 'Player 2' : username)
        : match.player2.name;
      gamePlayers.push({ player: match.player2, isHuman: isH, label: label2 });
    }

    return (
      <div className="page page--playing">
        <div className="page__round-badge">
          {getRoundName(currentMatch.roundIdx, bracketSize)}
        </div>
        <GameEngine
          players={gamePlayers}
          totalShots={matchLength}
          difficulty={difficulty}
          isThreePoint={isThreePoint}
          onComplete={handleMatchComplete}
          onExit={() => setStep('bracket-view')}
        />
      </div>
    );
  }

  if (step === 'complete') {
    const champion = getChampion(bracket);
    return (
      <div className="page page--complete">
        <div className="complete-card">
          <div className="complete-card__trophy">🏆</div>
          <h1 className="complete-card__title">TOURNAMENT CHAMPION!</h1>
          <div className="complete-card__winner">{champion?.name}</div>
          <div className="complete-card__ft">
            {isThreePoint
              ? `${champion?.threePct}% 3PT Career`
              : `${champion?.ftPct}% FT Career`}
          </div>
          <div className="complete-card__actions">
            <button className="btn btn--primary" onClick={() => { setBracket(null); setStep('setup'); }}>
              Play Again
            </button>
            <button className="btn btn--ghost" onClick={() => navigate('/')}>
              Main Menu
            </button>
          </div>
        </div>
        <BracketView bracket={bracket} humanPlayerIds={[]} />
      </div>
    );
  }

  return null;
}
