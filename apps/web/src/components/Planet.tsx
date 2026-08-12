import { planetFor } from '../lib/planet';

/**
 * A community rendered as a small procedural world.
 * Pure CSS — colors, ring, and moons derive from the address hash.
 */
export function Planet({ seed, size = 84 }: { seed: string; size?: number }) {
  const p = planetFor(seed);
  const moonDots = Array.from({ length: p.moons });

  return (
    <div
      className="planet-wrap"
      style={{ width: size * 1.5, height: size * 1.5, position: 'relative', display: 'grid', placeItems: 'center' }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          position: 'relative',
          background:
            p.surface === 'bands'
              ? `repeating-linear-gradient(168deg, ${p.base}, ${p.base} ${size / 7}px, ${p.accent} ${size / 7}px, ${p.accent} ${size / 4.2}px)`
              : p.surface === 'swirl'
                ? `radial-gradient(circle at 32% 30%, ${p.base}, ${p.accent} 75%)`
                : `radial-gradient(circle at 30% 28%, ${p.base} 60%, ${p.accent} 100%)`,
          boxShadow: `inset -${size / 5.5}px -${size / 7}px ${size / 3.2}px rgba(0,0,0,0.55), 0 0 ${size / 2.4}px ${p.glow}`,
        }}
      >
        {p.surface === 'craters' && (
          <>
            <span style={craterStyle(size * 0.18, '22%', '58%', p.accent)} />
            <span style={craterStyle(size * 0.11, '60%', '30%', p.accent)} />
            <span style={craterStyle(size * 0.08, '48%', '70%', p.accent)} />
          </>
        )}
      </div>

      {p.hasRing && (
        <div
          style={{
            position: 'absolute',
            width: size * 1.65,
            height: size * 0.5,
            border: `2px solid ${p.base}`,
            opacity: 0.55,
            borderRadius: '50%',
            transform: `rotate(${p.ringTilt}deg)`,
            pointerEvents: 'none',
          }}
        />
      )}

      {moonDots.map((_, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            width: 7 + i * 2,
            height: 7 + i * 2,
            borderRadius: '50%',
            background: '#cbd5e1',
            top: `${12 + i * 16}%`,
            right: `${4 + i * 7}%`,
            boxShadow: 'inset -2px -1px 3px rgba(0,0,0,0.5)',
          }}
        />
      ))}
    </div>
  );
}

function craterStyle(s: number, top: string, left: string, color: string): React.CSSProperties {
  return {
    position: 'absolute',
    width: s,
    height: s,
    top,
    left,
    borderRadius: '50%',
    background: color,
    opacity: 0.5,
    boxShadow: 'inset 1px 2px 3px rgba(0,0,0,0.45)',
  };
}
