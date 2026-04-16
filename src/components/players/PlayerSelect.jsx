import { useState } from 'react';
import PlayerCard from './PlayerCard';
import { ALL_TAGS } from '../../data/players';

const ERA_LABELS = {
  legends: 'Legends',
  modern: 'Modern Stars',
  nextgen: 'Next Gen',
};

/**
 * Full-screen player selection component with tag filters.
 *
 * Props:
 *   players:        array of player objects (from Firestore or local)
 *   onSelect:       callback(player)
 *   selectedId:     currently selected player ID (optional)
 *   title:          heading text
 *   exclude:        array of player IDs to hide (already selected)
 */
export default function PlayerSelect({ players = [], onSelect, selectedId, title = 'Choose Your Player', exclude = [], isThreePoint = false }) {
  const [activeTags, setActiveTags] = useState([]);
  const [search, setSearch] = useState('');

  const toggleTag = (tag) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const filtered = players
    .filter((p) => !exclude.includes(p.id))
    .filter((p) => activeTags.every((t) => p.tags.includes(t)))
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const byEra = filtered.reduce((acc, p) => {
    const era = p.era || 'legends';
    if (!acc[era]) acc[era] = [];
    acc[era].push(p);
    return acc;
  }, {});

  const TAG_DISPLAY = {
    legends: '🏅 Legends', modern: '⭐ Modern', nextgen: '⚡ Next Gen',
    '60s': '60s', '70s': '70s', '80s': '80s', '90s': '90s', '2000s': '2000s',
    usa: '🇺🇸 USA', international: '🌍 Intl', european: '🇪🇺 Euro', french: '🇫🇷 French',
    'bad-ft': '🧱 Bad FT', dreamteam: '🥇 Dream Team',
  };

  return (
    <div className="player-select">
      <h2 className="player-select__title">{title}</h2>

      {/* Search */}
      <div className="player-select__search-wrap">
        <input
          type="text"
          className="input player-select__search"
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tag filter chips */}
      <div className="player-select__tags">
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            className={`tag-chip ${activeTags.includes(tag) ? 'tag-chip--active' : ''}`}
            onClick={() => toggleTag(tag)}
          >
            {TAG_DISPLAY[tag] || tag}
          </button>
        ))}
        {activeTags.length > 0 && (
          <button className="tag-chip tag-chip--clear" onClick={() => setActiveTags([])}>
            Clear
          </button>
        )}
      </div>

      {/* Player grid grouped by era */}
      <div className="player-select__grid-container">
        {Object.entries(ERA_LABELS).map(([era, label]) => {
          const group = byEra[era];
          if (!group || group.length === 0) return null;
          return (
            <div key={era} className="player-select__era-group">
              <h3 className="player-select__era-label">{label}</h3>
              <div className="player-select__grid">
                {group.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    selected={p.id === selectedId}
                    onClick={onSelect}
                    isThreePoint={isThreePoint}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="player-select__empty">No players match your filters.</div>
        )}
      </div>
    </div>
  );
}
