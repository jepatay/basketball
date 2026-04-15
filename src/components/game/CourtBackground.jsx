/**
 * NBA arena background — perspective view from behind the free throw line.
 * Pure SVG + CSS, no images needed.
 */
export default function CourtBackground() {
  return (
    <div className="court-bg-arena" aria-hidden="true">
      <svg
        className="court-svg"
        viewBox="0 0 400 700"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Arena ceiling spotlight */}
          <radialGradient id="ceiling-light" cx="50%" cy="0%" r="70%">
            <stop offset="0%"  stopColor="#fff5d0" stopOpacity="0.18" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>

          {/* Floor wood texture via gradient */}
          <linearGradient id="floor-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#7a3d00" />
            <stop offset="40%" stopColor="#9f5200" />
            <stop offset="100%" stopColor="#c47800" />
          </linearGradient>

          {/* Floor perspective fade */}
          <linearGradient id="floor-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#0d0d0d" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0d0d0d" stopOpacity="0" />
          </linearGradient>

          {/* Hoop glow */}
          <radialGradient id="hoop-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#ff6b00" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ff6b00" stopOpacity="0" />
          </radialGradient>

          {/* Crowd gradient */}
          <linearGradient id="crowd-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#0d0d0d" />
            <stop offset="100%" stopColor="#1a0a00" />
          </linearGradient>
        </defs>

        {/* ── Arena background ── */}
        <rect width="400" height="700" fill="#080810" />

        {/* ── Crowd stands — upper tier ── */}
        <rect x="0" y="0" width="400" height="220" fill="url(#crowd-fade)" />

        {/* Crowd silhouette rows */}
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <g key={row} opacity={0.12 + row * 0.04}>
            {Array.from({ length: 22 }).map((_, i) => (
              <circle
                key={i}
                cx={10 + i * 18 + (row % 2) * 9}
                cy={30 + row * 32}
                r={7}
                fill={`hsl(${25 + i * 7},60%,${30 + row * 5}%)`}
              />
            ))}
          </g>
        ))}

        {/* ── Arena lights — two big spotlights ── */}
        <ellipse cx="120" cy="80" rx="60" ry="40" fill="#fffbe0" opacity="0.06" />
        <ellipse cx="280" cy="80" rx="60" ry="40" fill="#fffbe0" opacity="0.06" />
        <line x1="120" y1="80" x2="200" y2="260" stroke="#fffbe0" strokeWidth="1" opacity="0.04" />
        <line x1="280" y1="80" x2="200" y2="260" stroke="#fffbe0" strokeWidth="1" opacity="0.04" />

        {/* ── Scoreboard ── */}
        <rect x="145" y="20" width="110" height="50" rx="6" fill="#111" stroke="#ff6b00" strokeWidth="1.5" />
        <text x="200" y="40" textAnchor="middle" fill="#ff6b00" fontSize="10" fontFamily="monospace" fontWeight="bold">FREE THROW</text>
        <text x="200" y="55" textAnchor="middle" fill="#ffd700" fontSize="9" fontFamily="monospace">LEGENDS</text>
        <rect x="155" y="62" width="40" height="1" fill="#333" />
        <rect x="205" y="62" width="40" height="1" fill="#333" />

        {/* ── Backboard + support ── */}
        {/* Support pole from ceiling */}
        <line x1="200" y1="90" x2="200" y2="145" stroke="#555" strokeWidth="3" />
        {/* Backboard */}
        <rect x="163" y="145" width="74" height="48" rx="2"
          fill="rgba(180,220,255,0.15)" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        {/* Inner rectangle on backboard */}
        <rect x="181" y="163" width="38" height="24" rx="1"
          fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />

        {/* ── Hoop ── */}
        {/* Glow behind hoop */}
        <ellipse cx="200" cy="204" rx="22" ry="8" fill="url(#hoop-glow)" />
        {/* Hoop ring */}
        <ellipse cx="200" cy="200" rx="17" ry="6"
          fill="none" stroke="#FF6B00" strokeWidth="3" />
        {/* Net lines */}
        {[-12, -6, 0, 6, 12].map((x) => (
          <line key={x}
            x1={200 + x} y1="203"
            x2={200 + x * 0.6} y2="225"
            stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        ))}
        <path d="M188,225 Q200,230 212,225" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />

        {/* ── Court floor (perspective trapezoid) ── */}
        <polygon
          points="0,700 400,700 340,260 60,260"
          fill="url(#floor-grad)"
        />

        {/* Floor wood grain lines */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => {
          const xLeft  = 60  + i * 28;
          const xRight = 340 - i * 0;
          const yTop   = 260;
          const yBot   = 700;
          const xBotL  = i * 40;
          const xBotR  = i * 40;
          return (
            <line key={i}
              x1={60 + i * 28} y1={260}
              x2={i * 40} y2={700}
              stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
          );
        })}

        {/* Floor horizon shadow */}
        <polygon
          points="60,260 340,260 360,290 40,290"
          fill="rgba(0,0,0,0.25)"
        />

        {/* ── Lane / key markings ── */}
        {/* Lane rectangle (perspective) */}
        <polygon
          points="155,260 245,260 290,700 110,700"
          fill="rgba(0,0,0,0.12)"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />

        {/* Free throw circle at lane top */}
        <ellipse cx="200" cy="260" rx="72" ry="22"
          fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />

        {/* Hash marks on lane */}
        {[0.3, 0.55, 0.75].map((t, i) => {
          const y = 260 + t * 440;
          const halfW = 90 + t * 90;
          const laneW = 45 + t * 45;
          return (
            <g key={i}>
              <line x1={200 - laneW - 12} y1={y} x2={200 - laneW} y2={y}
                stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
              <line x1={200 + laneW} y1={y} x2={200 + laneW + 12} y2={y}
                stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
            </g>
          );
        })}

        {/* Center circle at bottom (shooter's feet) */}
        <ellipse cx="200" cy="660" rx="120" ry="28"
          fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />

        {/* ── Floor fade overlay ── */}
        <polygon
          points="0,700 400,700 340,260 60,260"
          fill="url(#floor-fade)"
        />

        {/* ── Ceiling spotlight fill ── */}
        <rect width="400" height="700" fill="url(#ceiling-light)" />
      </svg>
    </div>
  );
}
