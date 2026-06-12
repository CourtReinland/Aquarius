import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../state/walletStore';
import { useBlueStore } from '../state/blueStore';
import { eventScript } from '../blue/script';
import './landing.css';

/**
 * Landing — "Link ETH wallet" (mockup 01) reimagined as Blue's welcome.
 */
export function Landing() {
  const navigate = useNavigate();
  const { address, generateDevWallet, importPrivateKey } = useWalletStore();
  const blue = useBlueStore();
  const [importing, setImporting] = useState(false);
  const [pk, setPk] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const onGenerate = () => {
    const addr = generateDevWallet();
    blue.clear();
    blue.say(eventScript.walletCreated(addr), {
      chips: [
        { label: 'Explore communities', action: 'go-explorer' },
        { label: 'Found my own', action: 'go-found' },
      ],
    });
    navigate('/explorer');
  };

  const onImport = () => {
    try {
      setErr(null);
      const addr = importPrivateKey(pk.trim());
      blue.clear();
      blue.say(eventScript.walletImported(addr));
      navigate('/explorer');
    } catch {
      setErr('That key is not valid — expected 64 hex chars.');
    }
  };

  return (
    <div className="landing">
      <div className="landing-hero pop-in">
        <img className="landing-blue" src="/blue/blue-cosmic.png" alt="Blue, your Aquarius guide" />
        <div className="landing-copy">
          <div className="landing-kicker mono">/// COMMUNITY GOVERNANCE ON THE BLOCKCHAIN</div>
          <h1>
            Found a world.
            <br />
            <span className="grad-text">Live in it with friends.</span>
          </h1>
          <p className="landing-sub">
            What Bitcoin is to money, Aquarius is to community. Charter, currency,
            governance, institutions — all on-chain. Blue will guide you.
          </p>

          {address ? (
            <div className="landing-actions">
              <button className="btn btn-primary" onClick={() => navigate('/explorer')}>
                Enter the Explorer →
              </button>
            </div>
          ) : importing ? (
            <div className="landing-import pop-in">
              <label className="label">Private key</label>
              <input
                className="input mono"
                type="password"
                placeholder="0x…"
                value={pk}
                onChange={(e) => setPk(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onImport()}
              />
              {err && <div className="landing-err mono">{err}</div>}
              <div className="landing-actions">
                <button className="btn btn-primary" onClick={onImport}>
                  Import & Link
                </button>
                <button className="btn btn-ghost" onClick={() => setImporting(false)}>
                  Back
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="landing-actions">
                <button className="btn btn-primary" onClick={onGenerate}>
                  ✦ Generate Dev Wallet
                </button>
                <button className="btn btn-ghost" onClick={() => setImporting(true)}>
                  Import Private Key
                </button>
              </div>
              <div className="landing-note mono">Anvil testnet · no real funds needed</div>
            </>
          )}
        </div>
      </div>

      <div className="landing-tiles">
        {[
          ['⚖', 'Charter & Bylaws', 'Constitutional templates from the U.S. Constitution to the Magna Carta — amendable only by vote.'],
          ['🪙', 'Your Own Currency', 'Mint a community token with Austrian-strict or Keynesian-fractional banking rules.'],
          ['🤝', 'Humans + AI', 'AI agents join as registered members with their own wallets — ERC-8004 style.'],
        ].map(([icon, title, body]) => (
          <div key={title} className="card landing-tile pop-in">
            <div className="landing-tile-icon">{icon}</div>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
