import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resumeAudio } from '../utils/audioUtils';

const COURTS = ['nba-arena', 'outdoor', 'playground'];

export default function Home() {
  const navigate = useNavigate();
  const [username, setUsername] = useState(() => localStorage.getItem('ftl_username') || '');
  const [courtIdx, setCourtIdx] = useState(0);

  const saveUsername = () => {
    if (username.trim()) localStorage.setItem('ftl_username', username.trim());
  };

  const go = (path) => {
    resumeAudio();
    saveUsername();
    navigate(path);
  };

  return (
    <div className={`home court-bg court-bg--${COURTS[courtIdx]}`}>
      {/* Title */}
      <div className="home__title-wrap">
        <h1 className="home__title">FREE THROW</h1>
        <h2 className="home__subtitle">LEGENDS</h2>
        <div className="home__ball">🏀</div>
      </div>

      {/* Username */}
      <div className="home__username-wrap">
        <input
          type="text"
          className="input home__username-input"
          placeholder="Enter your name…"
          value={username}
          maxLength={20}
          onChange={(e) => setUsername(e.target.value)}
          onBlur={saveUsername}
        />
      </div>

      {/* Game modes */}
      <div className="home__modes">
        <button className="btn btn--mode btn--tournament" onClick={() => go('/tournament')}>
          <span className="btn__icon">🏆</span>
          <span className="btn__text">PLAYOFF TOURNAMENT</span>
          <span className="btn__sub">FT or 3PT · Bracket of 8–32 players</span>
        </button>

        <button className="btn btn--mode btn--century" onClick={() => go('/century')}>
          <span className="btn__icon">🎯</span>
          <span className="btn__text">CENTURY CHALLENGE</span>
          <span className="btn__sub">100 free throws, beat your best</span>
        </button>

        <button className="btn btn--mode btn--quickmatch" onClick={() => go('/quickmatch')}>
          <span className="btn__icon">⚡</span>
          <span className="btn__text">1v1 QUICK MATCH</span>
          <span className="btn__sub">Two players, same device</span>
        </button>

        <button className="btn btn--mode btn--teamplayoff" onClick={() => go('/team-playoff')}>
          <span className="btn__icon">👥</span>
          <span className="btn__text">5v5 TEAM PLAYOFF</span>
          <span className="btn__sub">Teams of 5 · Up to 8 teams · Bracket</span>
        </button>
      </div>

      {/* Footer links */}
      <div className="home__footer">
        <button className="btn btn--ghost btn--sm" onClick={() => go('/admin')}>
          ⚙ Admin
        </button>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => setCourtIdx((i) => (i + 1) % COURTS.length)}
        >
          🏟 Change Court
        </button>
      </div>
    </div>
  );
}
