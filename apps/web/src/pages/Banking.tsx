import { useState } from 'react';
import { useBlueStore } from '../state/blueStore';
import './banking.css';

/** Banking Setup — mockup 12. Token economy designer (UI; deploy wiring next). */
export function Banking() {
  const blue = useBlueStore();
  const [tokenAmount, setTokenAmount] = useState('33000000');
  const [style, setStyle] = useState<'austrian' | 'keynesian'>('austrian');
  const [arbitrary, setArbitrary] = useState(false);
  const [fractional, setFractional] = useState(false);
  const [leverage, setLeverage] = useState(1);

  return (
    <div className="page found-page">
      <div className="page-header bank">
        <h1>Banking Setup</h1>
        <div className="sub">Design your community's economy.</div>
      </div>

      <div className="card found-body">
        <label className="label">Starting Token Amount</label>
        <input
          className="input mono bank-amount"
          value={tokenAmount}
          onChange={(e) => setTokenAmount(e.target.value.replace(/[^\d]/g, ''))}
        />
        <div className="bank-amount-words mono">
          {Number(tokenAmount || 0).toLocaleString()} tokens at genesis
        </div>

        <label className="label">Banking Style</label>
        {(
          [
            ['austrian', 'Austrian (Strict)', 'Fixed supply. No leverage. Digital gold.'],
            ['keynesian', 'Keynesian (Fractional Reserve)', 'The bank can extend credit beyond reserves.'],
          ] as const
        ).map(([key, title, hint]) => (
          <button
            key={key}
            className={`option ${style === key ? 'selected' : ''}`}
            onClick={() => {
              setStyle(key);
              if (key === 'keynesian') setFractional(true);
              else {
                setFractional(false);
                setLeverage(1);
              }
            }}
          >
            <span className="tick">✓</span>
            <span>
              {title}
              <span className="option-hint"> — {hint}</span>
            </span>
          </button>
        ))}

        <div className="bank-toggles">
          <Toggle
            label="Allow Arbitrary Token Creation"
            hint="Mint more by community vote"
            value={arbitrary}
            onChange={setArbitrary}
          />
          <Toggle
            label="Allow Fractional Lending"
            hint="Requires Keynesian style"
            value={fractional}
            onChange={(v) => style === 'keynesian' && setFractional(v)}
            disabled={style !== 'keynesian'}
          />
        </div>

        <label className="label">Allowed Banking Leverage Ratio</label>
        <div className="bank-lev-row">
          {[1, 2, 4, 6, 9].map((r) => (
            <button
              key={r}
              className={`bank-lev mono ${leverage === r ? 'selected' : ''}`}
              disabled={style !== 'keynesian' && r !== 1}
              onClick={() => setLeverage(r)}
            >
              {r}/1
            </button>
          ))}
        </div>

        <div className="found-summary mono">
          <div className="found-summary-title">ECONOMY SUMMARY</div>
          <div>genesis supply: {Number(tokenAmount || 0).toLocaleString()}</div>
          <div>style: {style === 'austrian' ? 'Austrian (Strict)' : 'Keynesian (Fractional)'}</div>
          <div>arbitrary creation: {arbitrary ? 'yes' : 'no'}</div>
          <div>fractional lending: {fractional ? 'yes' : 'no'}</div>
          <div>leverage: {leverage}/1</div>
        </div>

        <button
          className="btn btn-violet bank-deploy"
          onClick={() =>
            blue.say(
              'Token deployment hooks into your community contract — pick the community in the next build and I will mint the genesis supply. The design is saved in spirit. 🪙'
            )
          }
        >
          🏛 Deploy Community Bank
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`bank-toggle ${value ? 'on' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={() => !disabled && onChange(!value)}
    >
      <span>
        <span className="bank-toggle-label">{label}</span>
        <span className="bank-toggle-hint">{hint}</span>
      </span>
      <span className="bank-switch">
        <span className="bank-knob" />
      </span>
    </button>
  );
}
