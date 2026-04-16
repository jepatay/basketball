/** Brief overlay shown after each shot: Perfect / Good / Rimmed Out / Miss */
export default function ShotResult({ result }) {
  if (!result) return null;

  // Rimout: aimed in zone but random variance caused a miss
  const isRimout = !result.madeShot && result.aimZone && result.aimZone !== 'miss';

  const configs = {
    perfect: { label: '🔥 PERFECT!',   className: 'shot-result--perfect' },
    good:    { label: '✅ GOOD',        className: 'shot-result--good'    },
    miss:    { label: '💨 MISS',        className: 'shot-result--miss'    },
  };

  if (isRimout) {
    return (
      <div className="shot-result shot-result--rimout">
        <span className="shot-result__label">💫 RIMMED OUT</span>
      </div>
    );
  }

  const cfg = configs[result.result] ?? configs.miss;

  return (
    <div className={`shot-result ${cfg.className}`}>
      <span className="shot-result__label">{cfg.label}</span>
    </div>
  );
}
