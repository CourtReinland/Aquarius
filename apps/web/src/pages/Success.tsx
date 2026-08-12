import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Planet } from '../components/Planet';
import './success.css';

/** Success — mockup 05: fireworks over your newborn world. */
export function Success() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const name = params.get('name') ?? 'Your Community';
  const address = params.get('address') ?? '';
  const tx = params.get('tx') ?? '';
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // canvas fireworks
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const W = (canvas.width = canvas.offsetWidth);
    const H = (canvas.height = canvas.offsetHeight);

    interface P { x: number; y: number; vx: number; vy: number; life: number; hue: number }
    let parts: P[] = [];

    const burst = (x: number, y: number) => {
      const hue = Math.random() * 360;
      for (let i = 0; i < 46; i++) {
        const a = (Math.PI * 2 * i) / 46;
        const sp = 1.6 + Math.random() * 3;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, hue });
      }
    };

    let frame = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);
      if (frame % 55 === 1 && parts.length < 400) {
        burst(W * (0.15 + Math.random() * 0.7), H * (0.1 + Math.random() * 0.4));
      }
      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.025;
        p.life -= 0.012;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${p.life})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="success-stage">
      <canvas ref={canvasRef} className="success-fireworks" aria-hidden />
      <div className="success-card glass pop-in">
        <div className="success-banner">Success!</div>
        <div className="success-planet">
          <Planet seed={address || name} size={120} />
        </div>
        <h2 className="success-name pill aqua">{name.toUpperCase()}</h2>
        <p className="success-line">
          now exists on the blockchain — <b>permanently, unstoppably, yours.</b>
        </p>
        <div className="success-meta mono">
          <div>
            <span>world</span> {address ? `${address.slice(0, 10)}…${address.slice(-8)}` : '—'}
          </div>
          <div>
            <span>genesis tx</span> {tx ? `${tx.slice(0, 10)}…${tx.slice(-8)}` : '—'}
          </div>
        </div>
        <div className="success-actions">
          <button className="btn btn-primary" onClick={() => navigate(`/community/${address}`)}>
            Visit {name} →
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/explorer')}>
            Back to Explorer
          </button>
        </div>
      </div>
    </div>
  );
}
