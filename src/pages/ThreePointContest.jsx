import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerSelect from '../components/players/PlayerSelect';
import GameEngine from '../components/game/GameEngine';
import AvatarDisplay from '../components/players/AvatarDisplay';
import { loadPlayers, seedPlayersIfNeeded, submitToLeaderboard, getLeaderboard } from '../firebase/api';
import { DIFFICULTIES } from '../utils/gameUtils';
import PLAYERS from '../data/players';

const SHOT_COUNTS = [10, 25, 50];

export default function ThreePointContest() {
  const navigate = useNavigate();
  const username = localStorage.getItem('ftl_username') || 'Player';

  const [step, setStep] = useState('pick');       // pick | playing | result
  const [players, setPlayers] = useState([]);
  const [difficulty, setDifficulty] = useState('rookie');
  const [shotCount, setShotCount] = useState(25);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLB, setLoadingLB] = useState(false);

  useEffect(() => {
    seedPlayersIfNeeded()
      .then(() => loadPlayers())
      .then(setPlayers)
      .catch(() => setPlayers(PLAYERS));
  }, []);

  const handleComplete = async ({ scores }) => {
    const score = scores[0];
    setGameResult({ score, total: shotCount });
    setStep('result');

    try {
      await submitToLeaderboard('threepoint', username, selectedPlayer.id, score, shotCount);
    } catch { /* ignore */ }

    setLoadingLB(true);
    try {
      const lb = await getLeaderboard('threepoint');
      setLeaderboard(lb);
    } catch { setLeaderboard([]); }
    finally { setLoadingLB(false); }
  };

  if (step === 'pick') {
    return (
      <div className="page">
        <div className="page__header">
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>← Back</button>
          <h1 className="page__title">🎳 3-Point Contest</h1>
        </div>

        {selectedPlayer ? (
          <div className="century-pick-confirm">
            <AvatarDisplay player={selectedPlayer} size="lg" />
            <div className="century-pick-confirm__name">{selectedPlayer.name}</div>
            <div className="century-pick-confirm__ft">{selectedPlayer.ftPct}% FT Career Average</div>

            <div className="setup-row setup-row--inline">
              <label className="setup-label">Shots</label>
              <div className="setup-options">
                {SHOT_COUNTS.map((n) => (
                  <button
                    key={n}
                    className={`btn btn--option ${shotCount === n ? 'btn--option-active' : ''}`}
                    onClick={() => setShotCount(n)}
                  >{n} shots</button>
                ))}
              </div>
            </div>

            <div className="setup-row setup-row--inline">
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

            <div className="century-pick-confirm__actions">
              <button className="btn btn--primary btn--lg" onClick={() => setStep('playing')}>
                🎳 SHOOT {shotCount} THREE-POINTERS
              </button>
              <button className="btn btn--ghost" onClick={() => setSelectedPlayer(null)}>
                Change Player
              </button>
            </div>
          </div>
        ) : (
          <PlayerSelect
            players={players}
            onSelect={setSelectedPlayer}
            title="Pick Any Player"
          />
        )}
      </div>
    );
  }

  if (step === 'playing') {
    return (
      <div className="page page--playing">
        <div className="page__round-badge">🎳 3-POINT CONTEST</div>
        <GameEngine
          players={[{ player: selectedPlayer, isHuman: true, label: username }]}
          totalShots={shotCount}
          difficulty={difficulty}
          isThreePoint={true}
          onComplete={handleComplete}
          onExit={() => setStep('pick')}
        />
      </div>
    );
  }

  if (step === 'result') {
    const pct = Math.round((gameResult.score / gameResult.total) * 100);
    return (
      <div className="page page--result">
        <div className="result-card">
          <AvatarDisplay player={selectedPlayer} size="lg" />
          <div className="result-card__player">{selectedPlayer?.name}</div>
          <div className="result-card__winner-label">3-POINT CONTEST</div>

          <div className="result-card__score-wrap">
            <span className="result-card__score">{gameResult.score}</span>
            <span className="result-card__total">/ {gameResult.total}</span>
          </div>
          <div className="result-card__pct">{pct}% success rate</div>

          <div className="leaderboard">
            <h3 className="leaderboard__title">🌍 Global Top 10 — 3PT</h3>
            {loadingLB ? (
              <div className="leaderboard__loading">Loading…</div>
            ) : (
              <ol className="leaderboard__list">
                {leaderboard.slice(0, 10).map((entry, i) => (
                  <li key={entry.id} className="leaderboard__entry">
                    <span className="leaderboard__rank">#{i + 1}</span>
                    <span className="leaderboard__user">{entry.username}</span>
                    <span className="leaderboard__player-name">{entry.playerId?.replace(/-/g, ' ')}</span>
                    <span className="leaderboard__lb-score">{entry.score}/{entry.totalShots}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="result-card__actions">
            <button className="btn btn--primary" onClick={() => { setGameResult(null); setStep('pick'); }}>
              Play Again
            </button>
            <button className="btn btn--ghost" onClick={() => navigate('/')}>
              Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
