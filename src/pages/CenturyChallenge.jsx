import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PlayerSelect from '../components/players/PlayerSelect';
import GameEngine from '../components/game/GameEngine';
import AvatarDisplay from '../components/players/AvatarDisplay';
import { loadPlayers, seedPlayersIfNeeded, savePersonalBest, getPersonalBest, submitToLeaderboard, getLeaderboard } from '../firebase/api';
import { DIFFICULTIES } from '../utils/gameUtils';
import PLAYERS from '../data/players';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function LeaderboardRow({ entry, rank, isYou }) {
  return (
    <li className={`leaderboard__entry leaderboard__entry--rich ${isYou ? 'leaderboard__entry--you' : ''}`}>
      <span className="leaderboard__rank">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}</span>
      <span className="leaderboard__lb-score">{entry.score}<span className="leaderboard__lb-total">/100</span></span>
      <span className="leaderboard__streak">🔥{entry.bestStreak ?? '—'} ❄️{entry.worstStreak ?? '—'}</span>
      <span className="leaderboard__date">{formatDate(entry.submittedAt)}</span>
      <span className="leaderboard__user">{entry.username}</span>
      <span className="leaderboard__player-name">{entry.playerId?.replace(/-/g, ' ')}</span>
    </li>
  );
}

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

    // Compute best/worst streak and perfect shot count from shot history
    const shots = shotHistory?.[0] || [];
    let bestStreak = 0, worstStreak = 0, curMake = 0, curMiss = 0;
    let perfectShots = 0;
    for (const s of shots) {
      if (s.result === 'perfect') perfectShots++;
      if (s.madeShot) { curMake++; curMiss = 0; if (curMake > bestStreak) bestStreak = curMake; }
      else { curMiss++; curMake = 0; if (curMiss > worstStreak) worstStreak = curMiss; }
    }

    setGameResult({ score, totalShots, bestStreak, worstStreak, perfectShots });
    setStep('result');

    const extras = { bestStreak, worstStreak, perfectShots };
    try {
      const newBest = await savePersonalBest(username, selectedPlayer.id, score, totalShots, extras, difficulty);
      setIsNewBest(newBest);
    } catch (err) {
      console.error('savePersonalBest failed:', err);
    }
    try {
      await submitToLeaderboard('century', username, selectedPlayer.id, score, totalShots, extras, difficulty);
    } catch (err) {
      console.error('submitToLeaderboard failed:', err);
    }

    // Load leaderboard for this difficulty
    setLoadingLB(true);
    try {
      const lb = await getLeaderboard('century', 20, difficulty);
      setLeaderboard(lb);
    } catch (err) {
      console.error('getLeaderboard failed:', err);
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
              <span className="streak__label">⭐ Best streak</span>
              <span className="streak__value">{gameResult.bestStreak}</span>
            </div>
            <div className="streak streak--worst">
              <span className="streak__label">❄️ Worst streak</span>
              <span className="streak__value">{gameResult.worstStreak}</span>
            </div>
            <div className="streak streak--perfect">
              <span className="streak__label">🔥 Perfect shots</span>
              <span className="streak__value">{gameResult.perfectShots}</span>
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
                  <LeaderboardRow key={entry.id} entry={entry} rank={i + 1} isYou={entry.username === username && entry.score === gameResult.score} />
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
