/** Brief overlay shown after each shot: Perfect / Good / Miss */
export default function ShotResult({ result }) {
  if (!result) return null;

  const configs = {
    perfect: { label: '🔥 PERFECT!', className: 'shot-result--perfect' },
    good: { label: '✅ GOOD', className: 'shot-result--good' },
    miss: { label: '💨 MISS', className: 'shot-result--miss' },
  };

  const cfg = configs[result.result] ?? configs.miss;

  return (
    <div className={`shot-result ${cfg.className}`}>
      <span className="shot-result__label">{cfg.label}</span>
    </div>
  );
}
