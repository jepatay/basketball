import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { savePlayerAvatar, addPlayer, loadPlayers } from '../firebase/api';
import { ALL_TAGS } from '../data/players';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

export default function Admin() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [ftPct, setFtPct] = useState(80);
  const [selectedTags, setSelectedTags] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewSrc, setPreviewSrc] = useState(null);

  // For regenerating avatar on an existing player
  const [regen, setRegen] = useState(false);
  const [existingPlayerId, setExistingPlayerId] = useState('');

  const slugify = (n) =>
    n.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const toggleTag = (tag) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const handleGenerate = async () => {
    if (!name.trim()) { setStatus('⚠ Please enter a player name'); return; }
    setLoading(true);
    setStatus('Calling DALL-E 3…');
    setPreviewSrc(null);

    const playerId = regen
      ? existingPlayerId.trim() || slugify(name)
      : slugify(name);

    try {
      // Server resizes the image to 300×300 JPEG and returns base64
      const res = await fetch(`${API_BASE}/api/generate-avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name.trim(), playerSlug: playerId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const { imageBase64 } = await res.json();
      setPreviewSrc(`data:image/jpeg;base64,${imageBase64}`);

      setStatus('Saving to Firestore…');

      if (regen) {
        await savePlayerAvatar(playerId, imageBase64);
        setStatus(`✅ Avatar updated for "${playerId}"!`);
      } else {
        const era = selectedTags.includes('nextgen') ? 'nextgen'
          : selectedTags.includes('modern') ? 'modern' : 'legends';
        await addPlayer(playerId, {
          name: name.trim(),
          ftPct: Number(ftPct),
          era,
          tags: selectedTags,
        }, imageBase64);
        setStatus(`✅ Player "${name.trim()}" added!`);
      }
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page--admin">
      <div className="page__header">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>← Back</button>
        <h1 className="page__title">⚙ Admin Panel</h1>
      </div>

      <div className="admin-card">
        <div className="admin-section">
          <h2 className="admin-section__title">Add / Update Player</h2>

          <div className="setup-row">
            <label className="setup-label">Mode</label>
            <div className="setup-options">
              <button
                className={`btn btn--option ${!regen ? 'btn--option-active' : ''}`}
                onClick={() => setRegen(false)}
              >Add New Player</button>
              <button
                className={`btn btn--option ${regen ? 'btn--option-active' : ''}`}
                onClick={() => setRegen(true)}
              >Regen Avatar</button>
            </div>
          </div>

          <div className="setup-row">
            <label className="setup-label">Player Name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. LeBron James"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {regen && (
            <div className="setup-row">
              <label className="setup-label">Player ID (slug)</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. lebron-james"
                value={existingPlayerId}
                onChange={(e) => setExistingPlayerId(e.target.value)}
              />
            </div>
          )}

          {!regen && (
            <>
              <div className="setup-row">
                <label className="setup-label">Career FT%</label>
                <div className="admin-ft-row">
                  <input
                    type="range" min={40} max={100} value={ftPct}
                    onChange={(e) => setFtPct(Number(e.target.value))}
                    className="admin-slider"
                  />
                  <span className="admin-ft-value">{ftPct}%</span>
                </div>
              </div>

              <div className="setup-row">
                <label className="setup-label">Tags</label>
                <div className="player-select__tags">
                  {ALL_TAGS.map((tag) => (
                    <button
                      key={tag}
                      className={`tag-chip ${selectedTags.includes(tag) ? 'tag-chip--active' : ''}`}
                      onClick={() => toggleTag(tag)}
                    >{tag}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {status && (
            <div className={`admin-status ${status.startsWith('✅') ? 'admin-status--success' : status.startsWith('❌') ? 'admin-status--error' : ''}`}>
              {status}
            </div>
          )}

          {previewSrc && (
            <div className="admin-preview">
              <img src={previewSrc} alt="Generated avatar" className="admin-preview__img" />
            </div>
          )}

          <button
            className="btn btn--primary btn--lg"
            onClick={handleGenerate}
            disabled={loading || !name.trim()}
          >
            {loading ? '⏳ Generating…' : '🎨 Generate Avatar with DALL-E 3'}
          </button>
        </div>
      </div>
    </div>
  );
}
