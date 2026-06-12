import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBlueStore, blueSpeak, type BlueChip } from '../state/blueStore';
import { routeScript, localAnswer } from './script';
import './blue.css';

/**
 * Blue — floating companion. Avatar in an animated cosmic aura, glass speech
 * bubble with typewriter text, quick chips, free-form "Ask Blue" (Claude via
 * API with local fallback), and optional browser-native voice.
 */

const visitedRoutes = new Set<string>();

export function BlueCompanion({ onAction }: { onAction?: (action: string) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const blue = useBlueStore();
  const [typed, setTyped] = useState('');
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const typeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── route-aware guidance ─────────────────────────────────────
  useEffect(() => {
    const path = location.pathname.startsWith('/community/')
      ? '/explorer'
      : location.pathname;
    const entry = routeScript[path];
    if (!entry) return;
    const revisit = visitedRoutes.has(path);
    visitedRoutes.add(path);
    if (blue.current) return; // don't interrupt active speech
    if (revisit && entry.short) {
      blue.say(entry.short[Math.floor(Math.random() * entry.short.length)], { chips: entry.chips });
    } else if (!revisit) {
      blue.say(entry.lines, { chips: entry.chips });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ── typewriter ───────────────────────────────────────────────
  useEffect(() => {
    if (typeTimer.current) clearInterval(typeTimer.current);
    if (!blue.current) {
      setTyped('');
      return;
    }
    const full = blue.current.text;
    setTyped('');
    blue.setBusy(true);
    if (blue.voiceOn) blueSpeak(full);
    let i = 0;
    typeTimer.current = setInterval(() => {
      i += 1 + Math.floor(Math.random() * 2);
      setTyped(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(typeTimer.current!);
        blue.setBusy(false);
      }
    }, 18);
    return () => {
      if (typeTimer.current) clearInterval(typeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blue.current]);

  const handleChip = useCallback(
    (chip: BlueChip) => {
      if (chip.reply) {
        blue.next();
        blue.say(chip.reply);
      } else if (chip.action) {
        blue.next();
        if (chip.action === 'go-found') navigate('/found');
        else onAction?.(chip.action);
      }
    },
    [blue, navigate, onAction]
  );

  const askBlue = useCallback(async () => {
    const q = question.trim();
    if (!q) return;
    setQuestion('');
    setAsking(true);
    blue.clear(); // replace whatever she was saying — the user asked something new
    blue.think(true);
    try {
      const res = await fetch('/api/blue/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, route: location.pathname }),
      });
      if (!res.ok) throw new Error(`api ${res.status}`);
      const data = (await res.json()) as { reply: string };
      blue.say(data.reply);
    } catch {
      blue.say(localAnswer(q));
    } finally {
      setAsking(false);
    }
  }, [question, blue, location.pathname]);

  // minimized orb
  if (blue.minimized) {
    return (
      <button
        className={`blue-orb ${blue.unread ? 'unread' : ''}`}
        onClick={blue.toggleMinimized}
        title="Blue is here"
      >
        <img src="/blue/blue-portrait.png" alt="Blue" />
      </button>
    );
  }

  const showBubble = blue.current !== null || blue.mood === 'thinking';

  return (
    <div className="blue-dock">
      {showBubble && (
        <div className={`blue-bubble glass mood-${blue.mood}`}>
          <div className="blue-bubble-head">
            <span className="blue-name mono">BLUE</span>
            <span className="blue-role mono">// aquarius guide</span>
            <span style={{ flex: 1 }} />
            <button
              className={`blue-icon-btn ${blue.voiceOn ? 'on' : ''}`}
              onClick={blue.toggleVoice}
              title={blue.voiceOn ? 'Voice on' : 'Voice off'}
            >
              {blue.voiceOn ? '🔊' : '🔇'}
            </button>
            <button className="blue-icon-btn" onClick={blue.clear} title="Dismiss">
              ✕
            </button>
          </div>

          <div className="blue-text">
            {blue.mood === 'thinking' && !blue.current ? (
              <span className="blue-thinking">
                <i /><i /><i />
              </span>
            ) : (
              <>
                {typed}
                {blue.busy && <span className="blue-caret">▍</span>}
              </>
            )}
          </div>

          {!blue.busy && blue.current?.chips && (
            <div className="blue-chips">
              {blue.current.chips.map((chip) => (
                <button key={chip.label} className="blue-chip" onClick={() => handleChip(chip)}>
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {!blue.busy && blue.queue.length > 0 && (
            <button className="blue-next" onClick={blue.next}>
              continue <span className="mono">→</span>
            </button>
          )}

          <div className="blue-ask">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && askBlue()}
              placeholder={asking ? 'Blue is thinking…' : 'Ask Blue anything…'}
              disabled={asking}
            />
            <button onClick={askBlue} disabled={asking || !question.trim()}>
              ↑
            </button>
          </div>
        </div>
      )}

      <button
        className={`blue-avatar mood-${blue.mood}`}
        onClick={blue.toggleMinimized}
        title="Minimize Blue"
      >
        <span className="blue-aura" />
        <img src="/blue/blue-portrait.png" alt="Blue" />
        {blue.mood === 'celebrating' && <span className="blue-sparkle">✦</span>}
      </button>
    </div>
  );
}
