import { useNavigate } from 'react-router-dom';
import { useChainData } from '../hooks/useChainData';
import { Planet } from '../components/Planet';
import { shortAddr } from '../lib/clients';
import './memberships.css';

/** My Memberships — mockup 06: holdings, positions, roles per world. */
export function Memberships() {
  const { address, mine, ethBalance, loading } = useChainData();
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page-header data">
        <h1>My Memberships</h1>
        <div className="sub mono">
          {address ? `${shortAddr(address)} · ${Number(ethBalance).toFixed(4)} ETH` : 'no wallet linked'}
        </div>
      </div>

      {loading && mine.length === 0 && (
        <div className="skeleton" style={{ height: 180, borderRadius: 14 }} />
      )}

      {!loading && mine.length === 0 && (
        <div className="card explorer-empty">
          <div className="explorer-empty-art">🛸</div>
          <h3>You belong to no world yet</h3>
          <p>Found one, or visit the Explorer and request admission.</p>
          <button className="btn btn-primary" onClick={() => navigate('/found')}>
            + Found Community
          </button>
        </div>
      )}

      {mine.map((c) => (
        <div key={c.address} className="memb-card card pop-in">
          <div className="memb-head">
            <Planet seed={c.address} size={62} />
            <div>
              <div className="memb-name">{c.name.toUpperCase()}</div>
              <div className="memb-sub mono">
                {c.isFounder ? 'FOUNDER' : 'MEMBER'} · {c.memberCount} members · {c.aiAgentCount} AI agents
              </div>
            </div>
            <span style={{ flex: 1 }} />
            <button className="btn btn-ghost" onClick={() => navigate(`/community/${c.address}`)}>
              Open →
            </button>
          </div>

          <div className="memb-grid mono">
            <div className="memb-block">
              <div className="memb-block-title">Institutional Holdings</div>
              <div className="memb-block-empty">No institutional shares yet</div>
            </div>
            <div className="memb-block">
              <div className="memb-block-title">Board Positions Held</div>
              <div className="memb-block-empty">No positions held</div>
            </div>
            <div className="memb-block">
              <div className="memb-block-title">Role(s)</div>
              <div className="memb-block-empty">
                {c.isFounder ? 'Founding Member' : 'Citizen'}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
