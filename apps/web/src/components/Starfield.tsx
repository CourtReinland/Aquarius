import { useEffect, useRef } from 'react';

/**
 * Canvas starfield — three parallax layers, slow drift, occasional
 * shooting star. Sits fixed behind everything.
 */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let w = 0;
    let h = 0;

    interface Star { x: number; y: number; r: number; tw: number; layer: number }
    interface Shooter { x: number; y: number; vx: number; vy: number; life: number }

    let stars: Star[] = [];
    let shooters: Shooter[] = [];

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const count = Math.min(340, Math.floor((w * h) / 4200));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + Math.random() * 1.4,
        tw: Math.random() * Math.PI * 2,
        layer: 1 + Math.floor(Math.random() * 3),
      }));
    };
    resize();
    window.addEventListener('resize', resize);

    let t = 0;
    const tick = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);

      // nebula glows
      const neb = ctx.createRadialGradient(w * 0.82, h * 0.18, 0, w * 0.82, h * 0.18, w * 0.45);
      neb.addColorStop(0, 'rgba(76, 29, 149, 0.12)');
      neb.addColorStop(1, 'transparent');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, w, h);
      const neb2 = ctx.createRadialGradient(w * 0.1, h * 0.85, 0, w * 0.1, h * 0.85, w * 0.4);
      neb2.addColorStop(0, 'rgba(13, 148, 136, 0.08)');
      neb2.addColorStop(1, 'transparent');
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        s.x -= 0.014 * s.layer;
        if (s.x < -2) s.x = w + 2;
        const alpha = 0.35 + 0.45 * Math.abs(Math.sin(t * 0.7 + s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 235, 255, ${alpha})`;
        ctx.fill();
      }

      // shooting stars: rare
      if (Math.random() < 0.0035 && shooters.length < 2) {
        shooters.push({
          x: Math.random() * w * 0.7 + w * 0.2,
          y: Math.random() * h * 0.3,
          vx: -(5 + Math.random() * 5),
          vy: 2.4 + Math.random() * 2,
          life: 1,
        });
      }
      shooters = shooters.filter((sh) => sh.life > 0);
      for (const sh of shooters) {
        sh.x += sh.vx;
        sh.y += sh.vy;
        sh.life -= 0.018;
        ctx.strokeStyle = `rgba(153, 246, 228, ${sh.life * 0.8})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x - sh.vx * 7, sh.y - sh.vy * 7);
        ctx.stroke();
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      aria-hidden
    />
  );
}
