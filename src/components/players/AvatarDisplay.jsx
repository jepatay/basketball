/** Displays a player's avatar.
 *  Avatar is stored as a base64 JPEG string in the Firestore player doc
 *  (avatarBase64 field). No Firebase Storage required.
 */
export default function AvatarDisplay({ player, size = 'md' }) {
  const sizeClass = `avatar--${size}`;

  const initials = player?.name
    ? player.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  // base64 image stored directly in Firestore
  const src = player?.avatarBase64
    ? `data:image/jpeg;base64,${player.avatarBase64}`
    : null;

  if (src) {
    return (
      <div className={`avatar ${sizeClass}`}>
        <img src={src} alt={player?.name} className="avatar__img" />
      </div>
    );
  }

  // Placeholder with initials + a color derived from player name
  const hue = player?.name
    ? [...player.name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
    : 0;

  return (
    <div
      className={`avatar avatar--placeholder ${sizeClass}`}
      style={{ '--avatar-hue': hue }}
    >
      <span className="avatar__initials">{initials}</span>
    </div>
  );
}
