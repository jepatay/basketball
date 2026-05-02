import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PlayerSelect from '../components/players/PlayerSelect';
import GameEngine from '../components/game/GameEngine';
import AvatarDisplay from '../components/players/AvatarDisplay';
import { loadPlayers, seedPlayersIfNeeded, savePersonalBest, getPersonalBest, submitToLeaderboard, getLeaderboard } from '../firebase/api';
import { DIFFICULTIES } from '../utils/gameUtils';
import PLAYERS from '../data/players';

const STEPS = ['pick', 'playing', 'result'];

export default function CenturyChallenge() {
  const navigate = useNavigate();
  const username = localStorage.getItem('ftl_username') || 'Player';

  const [step, setStep] = useState('pick');
  const [players, setPlayers] = useState([]);
  const [difficulty, setDifficulty] = useState('pro');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [personalBest, setPersonalBest] = useState(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLB, setLoadingLB] = useState(false);

  useEffect(() => {
    seedPlayersIfNeeded()
      .then(() => loadPlayers())
      .then(setPlayers)
      .catch(() => setPlayers(PLAYERS));
  }, []);

  const handlePlayerSelect = async (player) => {
    setSelectedPlayer(player);
    try {
      const pb = await getPersonalBest(username, player.id, difficulty);
      setPersonalBest(pb);
    } catch {
      setPersonalBest(null);
    }
  };

  const handleDifficultyChange = async (d) => {
    setDifficulty(d);
    if (selectedPlayer) {
      try {
        const pb = await getPersonalBest(username, selectedPlayer.id, d);
        setPersonalBest(pb);
      } catch {
        setPersonalBest(null);
      }
    }
  };

  const handleStart = () => {
    if (!selectedPlayer) return;
    setStep('playing');
  };

  const handleComplete = async ({ scores, shotHistory }) => {
    const score = scores[0];
    const totalShots = 100;

    // Compute best/worst streak from shot history
    const shots = shotHistory?.[0] || [];
    let bestStreak = 0, worstStreak = 0, curMake = 0, curMiss = 0;
    for (const s of shots) {
      if (s.madeShot) { curMake++; curMiss = 0; if (curMake > bestStreak) bestStreak = curMake; }
      else { curMiss++; curMake = 0; if (curMiss > worstStreak) worstStreak = curMiss; }
    }

    setGameResult({ score, totalShots, bestStreak, worstStreak });
    setStep('result');

    const extras = { bestStreak, worstStreak };
    try {
      const newBest = await savePersonalBest(username, selectedPlayer.id, score, totalShots, extras, difficulty);
      setIsNewBest(newBest);
      await submitToLeaderboard('century', username, selectedPlayer.id, score, totalShots, extras, difficulty);
    } catch {
      // ignore
    }

    // Load leaderboard for this difficulty
    setLoadingLB(true);
    try {
      const lb = await getLeaderboard('century', 20, difficulty);
      setLeaderboard(lb);
    } catch {
      setLeaderboard([]);
    } finally {
      setLoadingLB(false);
    }
  };

  if (step === 'pick') {
    return (
      <div className="page">
        <div className="page__header">
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>← Back</button>
          <h1 className="page__title">🎯 Century Challenge</h1>
        </div>

        {selectedPlayer ? (
          <div className="century-pick-confirm">
            <AvatarDisplay player={selectedPlayer} size="lg" />
            <div className="century-pick-confirm__name">{selectedPlayer.name}</div>
            <div className="century-pick-confirm__ft">{selectedPlayer.ftPct}% FT Career Average</div>
            {personalBest && (
              <div className="century-pick-confirm__pb">
                Personal Best: <strong>{personalBest.score}/100</strong> ({personalBest.pct}%)
              </div>
            )}
            <div className="setup-row setup-row--inline">
              <label className="setup-label">Difficulty</label>
              <div className="setup-options setup-options--difficulty">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    className={`btn btn--option btn--difficulty ${difficulty === d.id ? 'btn--option-active' : ''}`}
                    onClick={() => handleDifficultyChange(d.id)}
                  >{d.label}</button>
                ))}
              </div>
            </div>
            <div className="century-pick-confirm__actions">
              <button className="btn btn--primary btn--lg" onClick={handleStart}>
                🎯 SHOOT 100 FREE THROWS
              </button>
              <button className="btn btn--ghost" onClick={() => setSelectedPlayer(null)}>
                Change Player
              </button>
            </div>
          </div>
        ) : (
          <PlayerSelect
            players={players}
            onSelect={handlePlayerSelect}
            title="Pick Any Player"
          />
        )}
      </div>
    );
  }

  if (step === 'playing') {
    return (
      <div className="page page--playing">
        <div className="page__round-badge">🎯 CENTURY CHALLENGE</div>
        <GameEngine
          players={[{ player: selectedPlayer, isHuman: true, label: username }]}
          totalShots={100}
          difficulty={difficulty}
          onComplete={handleComplete}
          onExit={() => setStep('pick')}
        />
      </div>
    );
  }

  if (step === 'result') {
    const pct = Math.round((gameResult.score / gameResult.totalShots) * 100);
    return (
      <div className="page page--result">
        <div className="result-card">
          <AvatarDisplay player={selectedPlayer} size="lg" />
          <div className="result-card__player">{selectedPlayer?.name}</div>

          {isNewBest && <div className="result-card__new-best">🌟 NEW PERSONAL BEST!</div>}

          <div className="result-card__score-wrap">
            <span className="result-card__score">{gameResult.score}</span>
            <span className="result-card__total">/ 100</span>
          </div>
          <div className="result-card__pct">{pct}% success rate</div>

          <div className="result-card__streaks">
            <div className="streak streak--best">
              <span className="streak__label">🔥 Best streak</span>
              <span className="streak__value">{gameResult.bestStreak}</span>
            </div>
            <div className="streak streak--worst">
              <span className="streak__label">❄️ Worst streak</span>
              <span className="streak__value">{gameResult.worstStreak}</span>
            </div>
          </div>

          {personalBest && !isNewBest && (
            <div className="result-card__pb">
              Personal Best: {personalBest.score}/100
              {personalBest.bestStreak != null && ` · 🔥${personalBest.bestStreak}`}
            </div>
          )}

          {/* Leaderboard */}
          <div className="leaderboard">
            <div className="leaderboard__header">
              <h3 className="leaderboard__title">🌍 Top 10 — {difficulty.charAt(0).toUpperCase() + difficulty.slice(1).replace('allstar','All-Star')}</h3>
              <Link to="/highscores" className="leaderboard__see-all">See all →</Link>
            </div>
            {loadingLB ? (
              <div className="leaderboard__loading">Loading…</div>
            ) : (
              <ol className="leaderboard__list">
                {leaderboard.slice(0, 10).map((entry, i) => (
                  <li key={entry.id} className={`leaderboard__entry ${entry.username === username && entry.score === gameResult.score ? 'leaderboard__entry--you' : ''}`}>
                    <span className="leaderboard__rank">#{i + 1}</span>
                    <span className="leaderboard__user">{entry.username}</span>
                    <span className="leaderboard__player-name">{entry.playerId?.replace(/-/g, ' ')}</span>
                    <span className="leaderboard__lb-score">{entry.score}/100</span>
                    {entry.bestStreak != null && <span className="leaderboard__streak">🔥{entry.bestStreak}</span>}
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
