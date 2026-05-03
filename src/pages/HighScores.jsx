import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLeaderboard } from '../firebase/api';
import { DIFFICULTIES } from '../utils/gameUtils';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function LeaderboardRow({ entry, rank }) {
  return (
    <li className={`leaderboard__entry leaderboard__entry--rich`}>
      <span className="leaderboard__rank">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}</span>
      <span className="leaderboard__lb-score">{entry.score}<span className="leaderboard__lb-total">/100</span></span>
      <span className="leaderboard__streak">🔥{entry.bestStreak ?? '—'} ❄️{entry.worstStreak ?? '—'}</span>
      <span className="leaderboard__date">{formatDate(entry.submittedAt)}</span>
      <span className="leaderboard__user">{entry.username}</span>
      <span className="leaderboard__player-name">{entry.playerId?.replace(/-/g, ' ')}</span>
    </li>
  );
}

export default function HighScores() {
  const navigate = useNavigate();
  const [activeDifficulty, setActiveDifficulty] = useState('pro');
  const [scoresByDiff, setScoresByDiff] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});

  const loadDifficulty = (diffId) => {
    if (scoresByDiff[diffId] !== undefined) return;
    setLoading((prev) => ({ ...prev, [diffId]: true }));
    getLeaderboard('century', 50, diffId)
      .then((data) => {
        setScoresByDiff((prev) => ({ ...prev, [diffId]: data }));
        setErrors((prev) => ({ ...prev, [diffId]: null }));
      })
      .catch((err) => {
        console.error('getLeaderboard error:', err);
        setScoresByDiff((prev) => ({ ...prev, [diffId]: [] }));
        setErrors((prev) => ({ ...prev, [diffId]: err?.message || 'Load failed' }));
      })
      .finally(() => setLoading((prev) => ({ ...prev, [diffId]: false })));
  };

  useEffect(() => { loadDifficulty('pro'); }, []);

  const handleTabClick = (diffId) => {
    setActiveDifficulty(diffId);
    loadDifficulty(diffId);
  };

  const scores = scoresByDiff[activeDifficulty];
  const isLoading = loading[activeDifficulty];
  const errorMsg = errors[activeDifficulty];

  return (
    <div className="page page--highscores">
      <div className="page__header">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>← Back</button>
        <h1 className="page__title">🏅 High Scores</h1>
      </div>

      <div className="highscores-card">
        <div className="highscores-game-title">🎯 Century Challenge</div>

        <div className="highscores-tabs">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              className={`highscores-tab ${activeDifficulty === d.id ? 'highscores-tab--active' : ''}`}
              onClick={() => handleTabClick(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="leaderboard__loading">Loading…</div>
        ) : errorMsg ? (
          <div className="leaderboard__loading" style={{ color: '#ff6b6b' }}>Error: {errorMsg}</div>
        ) : !scores || scores.length === 0 ? (
          <div className="leaderboard__loading">No scores yet for this difficulty — be the first!</div>
        ) : (
          <ol className="leaderboard__list leaderboard__list--full">
            {scores.map((entry, i) => (
              <LeaderboardRow key={entry.id} entry={entry} rank={i + 1} />
            ))}
          </ol>
        )}

        <button className="btn btn--primary" onClick={() => navigate('/century')}>
          🎯 Play Century Challenge
        </button>
      </div>
    </div>
  );
}
