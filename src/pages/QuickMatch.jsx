import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerSelect from '../components/players/PlayerSelect';
import GameEngine from '../components/game/GameEngine';
import AvatarDisplay from '../components/players/AvatarDisplay';
import { loadPlayers, seedPlayersIfNeeded, submitToLeaderboard } from '../firebase/api';
import PLAYERS from '../data/players';

const MATCH_LENGTHS = [10, 20, 50, 100];
const STEPS = ['setup', 'pick-p1', 'pick-p2', 'playing', 'result'];

export default function QuickMatch() {
  const navigate = useNavigate();

  const [step, setStep] = useState('setup');
  const [players, setPlayers] = useState([]);
  const [matchLength, setMatchLength] = useState(10);
  const [name1, setName1] = useState(() => localStorage.getItem('ftl_username') || 'Player 1');
  const [name2, setName2] = useState('Player 2');
  const [player1, setPlayer1] = useState(null);
  const [player2, setPlayer2] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    seedPlayersIfNeeded()
      .then(() => loadPlayers())
      .then(setPlayers)
      .catch(() => setPlayers(PLAYERS));
  }, []);

  const handleComplete = async ({ scores, winner, suddenDeath }) => {
    setResult({ scores, winner, suddenDeath });
    setStep('result');

    // Submit to 1v1 leaderboard
    const p1Score = scores[0];
    const p2Score = scores[1];
    try {
      await submitToLeaderboard('quickmatch', name1, player1.id, p1Score, matchLength);
      await submitToLeaderboard('quickmatch', name2, player2.id, p2Score, matchLength);
    } catch {
      // ignore
    }
  };

  if (step === 'setup') {
    return (
      <div className="page page--setup">
        <div className="page__header">
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>← Back</button>
          <h1 className="page__title">⚡ 1v1 Quick Match</h1>
        </div>
        <div className="setup-card">
          <div className="setup-row">
            <label className="setup-label">Player 1 Name</label>
            <input
              type="text"
              className="input"
              value={name1}
              maxLength={20}
              onChange={(e) => setName1(e.target.value)}
            />
          </div>
          <div className="setup-row">
            <label className="setup-label">Player 2 Name</label>
            <input
              type="text"
              className="input"
              value={name2}
              maxLength={20}
              onChange={(e) => setName2(e.target.value)}
            />
          </div>
          <div className="setup-row">
            <label className="setup-label">Match Length</label>
            <div className="setup-options">
              {MATCH_LENGTHS.map((l) => (
                <button
                  key={l}
                  className={`btn btn--option ${matchLength === l ? 'btn--option-active' : ''}`}
                  onClick={() => setMatchLength(l)}
                >{l} FTs</button>
              ))}
            </div>
          </div>
          <button className="btn btn--primary btn--lg" onClick={() => setStep('pick-p1')}>
            NEXT: {name1 || 'Player 1'} Picks
          </button>
        </div>
      </div>
    );
  }

  if (step === 'pick-p1') {
    return (
      <div className="page">
        <div className="page__header">
          <button className="btn btn--ghost btn--sm" onClick={() => setStep('setup')}>← Back</button>
          <h1 className="page__title">{name1}: Choose Your Player</h1>
        </div>
        <PlayerSelect
          players={players}
          selectedId={player1?.id}
          onSelect={(p) => { setPlayer1(p); setStep('pick-p2'); }}
          title={`${name1 || 'Player 1'}: Choose Your Player`}
        />
      </div>
    );
  }

  if (step === 'pick-p2') {
    return (
      <div className="page">
        <div className="page__header">
          <button className="btn btn--ghost btn--sm" onClick={() => setStep('pick-p1')}>← Back</button>
          <h1 className="page__title">{name2}: Choose Your Player</h1>
        </div>
        <PlayerSelect
          players={players}
          selectedId={player2?.id}
          onSelect={(p) => { setPlayer2(p); setStep('playing'); }}
          title={`${name2 || 'Player 2'}: Choose Your Player`}
          exclude={[player1?.id].filter(Boolean)}
        />
      </div>
    );
  }

  if (step === 'playing') {
    return (
      <div className="page page--playing">
        <div className="page__round-badge">⚡ 1v1 QUICK MATCH</div>
        <GameEngine
          players={[
            { player: player1, isHuman: true, label: name1 },
            { player: player2, isHuman: true, label: name2 },
          ]}
          totalShots={matchLength}
          onComplete={handleComplete}
          onExit={() => setStep('setup')}
        />
      </div>
    );
  }

  if (step === 'result') {
    const { scores, winner, suddenDeath } = result;
    const isTie = scores[0] === scores[1] && !winner;
    const winnerName = winner?.player?.id === player1?.id ? name1 : name2;
    const winnerPlayer = winner?.player?.id === player1?.id ? player1 : player2;

    return (
      <div className="page page--result">
        <div className="result-card">
          {!isTie ? (
            <>
              <div className="result-card__trophy">🏆</div>
              <div className="result-card__winner-label">WINNER{suddenDeath ? ' (Sudden Death)' : ''}!</div>
              <AvatarDisplay player={winnerPlayer} size="lg" />
              <div className="result-card__player">{winnerName}</div>
              <div className="result-card__player-sub">{winnerPlayer?.name}</div>
            </>
          ) : (
            <>
              <div className="result-card__trophy">🤝</div>
              <div className="result-card__winner-label">TIE GAME</div>
            </>
          )}

          <div className="result-card__scores">
            <div className="result-card__score-col">
              <div className="result-card__score-name">{name1}</div>
              <div className="result-card__score-num">{scores[0]}</div>
              <div className="result-card__score-player">{player1?.name}</div>
            </div>
            <div className="result-card__score-divider">vs</div>
            <div className="result-card__score-col">
              <div className="result-card__score-name">{name2}</div>
              <div className="result-card__score-num">{scores[1]}</div>
              <div className="result-card__score-player">{player2?.name}</div>
            </div>
          </div>

          <div className="result-card__actions">
            <button className="btn btn--primary" onClick={() => { setResult(null); setStep('setup'); }}>
              Rematch
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
