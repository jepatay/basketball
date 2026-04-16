import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { savePlayerAvatar, addPlayer, loadPlayers, seedPlayersIfNeeded } from '../firebase/api';
import PLAYERS, { ALL_TAGS } from '../data/players';
import { resizeBase64Image } from '../utils/imageUtils';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

async function generateAndSave(playerName, playerId, playerAttrs = {}) {
  const res = await fetch(`${API_BASE}/api/generate-avatar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName, ...playerAttrs }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const { imageBase64: rawBase64 } = await res.json();
  const imageBase64 = await resizeBase64Image(rawBase64, 300, 0.82);
  await savePlayerAvatar(playerId, imageBase64);
  return imageBase64;
}

export default function Admin() {
  const navigate = useNavigate();

  // ── Single player ────────────────────────────────────────────────────────
  const [name, setName]                     = useState('');
  const [ftPct, setFtPct]                   = useState(80);
  const [selectedTags, setSelectedTags]     = useState([]);
  const [status, setStatus]                 = useState('');
  const [loading, setLoading]               = useState(false);
  const [previewSrc, setPreviewSrc]         = useState(null);
  const [regen, setRegen]                   = useState(false);
  const [existingPlayerId, setExistingPlayerId] = useState('');

  // ── Bulk generation ──────────────────────────────────────────────────────
  // avatarStatus: map of playerId → true (has avatar) | false (missing)
  // We always use the static PLAYERS list as the source of truth (45 players).
  // Firestore is only checked to know which already have avatarBase64 saved.
  const [avatarStatus, setAvatarStatus]     = useState({});       // { [id]: bool }
  const [bulkLoading, setBulkLoading]       = useState(false);
  const [bulkRunning, setBulkRunning]       = useState(false);
  const [bulkDone, setBulkDone]             = useState(0);
  const [bulkTotal, setBulkTotal]           = useState(0);
  const [bulkCurrent, setBulkCurrent]       = useState('');
  const [bulkLog, setBulkLog]               = useState([]);
  const cancelRef                           = useRef(false);

  const refreshAvatarStatus = () => {
    setBulkLoading(true);
    seedPlayersIfNeeded()
      .then(() => loadPlayers())
      .then((ps) => {
        const map = {};
        ps.forEach((p) => { map[p.id] = !!p.avatarBase64; });
        setAvatarStatus(map);
      })
      .catch(() => {
        // Firestore unavailable — mark all as missing so bulk can still run
        const map = {};
        PLAYERS.forEach((p) => { map[p.id] = false; });
        setAvatarStatus(map);
      })
      .finally(() => setBulkLoading(false));
  };

  useEffect(() => { refreshAvatarStatus(); }, []);

  const hasAvatarCount = PLAYERS.filter((p) => avatarStatus[p.id]).length;
  const missingCount   = PLAYERS.length - hasAvatarCount;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const slugify = (n) =>
    n.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const toggleTag = (tag) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  // ── Single player handler ────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!name.trim()) { setStatus('⚠ Please enter a player name'); return; }
    setLoading(true);
    setStatus('Calling DALL-E 3…');
    setPreviewSrc(null);

    const playerId = regen
      ? existingPlayerId.trim() || slugify(name)
      : slugify(name);

    try {
      setStatus('Resizing image…');
      const era = selectedTags.includes('nextgen') ? 'nextgen'
        : selectedTags.includes('modern') ? 'modern' : 'legends';
      const imageBase64 = await generateAndSave(name.trim(), playerId, { era, tags: selectedTags, ftPct: Number(ftPct) });
      setPreviewSrc(`data:image/jpeg;base64,${imageBase64}`);

      if (!regen) {
        await addPlayer(playerId, {
          name: name.trim(), ftPct: Number(ftPct), era, tags: selectedTags,
        }, imageBase64);
        setStatus(`✅ Player "${name.trim()}" added!`);
      } else {
        setStatus(`✅ Avatar updated for "${playerId}"!`);
      }

      // Refresh avatar status so counts update
      setAvatarStatus((prev) => ({ ...prev, [playerId]: true }));
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Bulk handler ─────────────────────────────────────────────────────────
  const handleBulkGenerate = async (onlyMissing = true) => {
    const queue = onlyMissing
      ? PLAYERS.filter((p) => !avatarStatus[p.id])
      : [...PLAYERS];

    if (queue.length === 0) return;

    cancelRef.current = false;
    setBulkRunning(true);
    setBulkDone(0);
    setBulkTotal(queue.length);
    setBulkLog([]);
    setBulkCurrent('');

    let done = 0;
    for (const player of queue) {
      if (cancelRef.current) {
        setBulkCurrent('Cancelled.');
        break;
      }

      setBulkCurrent(`Generating ${player.name}…`);
      try {
        await generateAndSave(player.name, player.id, { era: player.era, tags: player.tags, ftPct: player.ftPct });
        done++;
        setBulkDone(done);
        setBulkLog((prev) => [{ name: player.name, ok: true }, ...prev]);
        // Mark as done in local status map immediately
        setAvatarStatus((prev) => ({ ...prev, [player.id]: true }));
      } catch (err) {
        done++;
        setBulkDone(done);
        setBulkLog((prev) => [{ name: player.name, ok: false, err: err.message }, ...prev]);
      }

      // Small delay between calls to avoid rate limiting
      if (!cancelRef.current) await new Promise((r) => setTimeout(r, 800));
    }

    setBulkCurrent('');
    setBulkRunning(false);
  };

  const pct = bulkTotal > 0 ? Math.round((bulkDone / bulkTotal) * 100) : 0;

  return (
    <div className="page page--admin">
      <div className="page__header">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>← Back</button>
        <h1 className="page__title">⚙ Admin Panel</h1>
      </div>

      {/* ── Bulk generation ── */}
      <div className="admin-card">
        <div className="admin-section">
          <h2 className="admin-section__title">Generate All Avatars</h2>

          {bulkLoading ? (
            <div className="admin-status">Loading players…</div>
          ) : (
            <div className="admin-bulk-info">
              <span className="admin-bulk-stat admin-bulk-stat--ok">
                ✅ {hasAvatarCount} / {PLAYERS.length} have avatars
              </span>
              {missingCount > 0 && (
                <span className="admin-bulk-stat admin-bulk-stat--missing">
                  ⚠ {missingCount} missing
                </span>
              )}
            </div>
          )}

          {bulkRunning && (
            <>
              <div className="admin-progress-bar">
                <div className="admin-progress-bar__fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="admin-progress-label">
                {bulkCurrent || `${bulkDone} / ${bulkTotal} done`}
              </div>
            </>
          )}

          {bulkLog.length > 0 && (
            <div className="admin-log">
              {bulkLog.slice(0, 8).map((entry, i) => (
                <div key={i} className={`admin-log__entry ${entry.ok ? 'admin-log__entry--ok' : 'admin-log__entry--err'}`}>
                  {entry.ok ? '✅' : '❌'} {entry.name}
                  {!entry.ok && <span className="admin-log__err"> — {entry.err}</span>}
                </div>
              ))}
            </div>
          )}

          <div className="admin-bulk-actions">
            {!bulkRunning ? (
              <>
                <button
                  className="btn btn--primary"
                  onClick={() => handleBulkGenerate(true)}
                  disabled={bulkLoading || missingCount === 0}
                >
                  🎨 Generate {missingCount} Missing
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => handleBulkGenerate(false)}
                  disabled={bulkLoading}
                >
                  ↺ Regenerate All {PLAYERS.length}
                </button>
              </>
            ) : (
              <button
                className="btn btn--ghost"
                onClick={() => { cancelRef.current = true; }}
              >
                ⏹ Stop
              </button>
            )}
          </div>

          <p className="admin-bulk-note">
            Each avatar costs ~$0.04 (DALL-E 3). {missingCount} missing = ~${(missingCount * 0.04).toFixed(2)}.
          </p>
        </div>
      </div>

      {/* ── Single player ── */}
      <div className="admin-card">
        <div className="admin-section">
          <h2 className="admin-section__title">Add / Update Single Player</h2>

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
