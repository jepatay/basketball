import { useState, useEffect } from 'react';
import { getAvatarFromStorage } from '../../firebase/api';

const avatarCache = {}; // local in-memory cache: playerId → url

/** Displays a player's avatar (loads from Firebase Storage or shows placeholder) */
export default function AvatarDisplay({ player, size = 'md' }) {
  const [url, setUrl] = useState(player?.avatarUrl || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!player) return;

    // 1. Already have a URL
    if (player.avatarUrl) {
      setUrl(player.avatarUrl);
      return;
    }

    // 2. Check in-memory cache
    if (avatarCache[player.id]) {
      setUrl(avatarCache[player.id]);
      return;
    }

    // 3. Check Firebase Storage
    setLoading(true);
    getAvatarFromStorage(player.id)
      .then((storageUrl) => {
        if (storageUrl) {
          avatarCache[player.id] = storageUrl;
          setUrl(storageUrl);
        }
      })
      .finally(() => setLoading(false));
  }, [player?.id, player?.avatarUrl]);

  const sizeClass = `avatar--${size}`;
  const initials = player?.name
    ? player.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  if (loading) {
    return (
      <div className={`avatar avatar--loading ${sizeClass}`}>
        <div className="avatar__spinner" />
      </div>
    );
  }

  if (url) {
    return (
      <div className={`avatar ${sizeClass}`}>
        <img src={url} alt={player?.name} className="avatar__img" />
      </div>
    );
  }

  // Placeholder with initials
  return (
    <div className={`avatar avatar--placeholder ${sizeClass}`}>
      <span className="avatar__initials">{initials}</span>
    </div>
  );
}
