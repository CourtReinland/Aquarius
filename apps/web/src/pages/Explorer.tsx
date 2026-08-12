import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChainData } from '../hooks/useChainData';
import { Planet } from '../components/Planet';
import { shortAddr } from '../lib/clients';
import type { CommunitySummary } from '../lib/types';
import type { CommunityAnnouncement } from '../lib/registry';
import './explorer.css';

/** Community Explorer — mockup 00, communities as worlds. */
export function Explorer() {
  const { communities, mine, loading, error, refresh, registry } = useChainData();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const annFor = (c: CommunitySummary) => registry[c.address.toLowerCase()];

  const filtered = communities.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );
  // quiet (unlisted) worlds stay out of the public feed unless they're yours
  const listed = filtered.filter(
    (c) => c.isMember || c.isFounder || annFor(c)?.visibility !== 'unlisted'
  );
  const seeking = listed.filter(
    (c) => annFor(c)?.seekingMembers && !c.isMember && !c.isFounder
  );
  const trending = [...listed].sort((a, b) => b.memberCount - a.memberCount);

  return (
    <div className="page">
      <div className="page-header data">
        <h1>Community Explorer</h1>
        <div className="sub">Every world below is alive on the blockchain.</div>
      </div>

      <div className="explorer-toolbar">
        <input
          className="input explorer-search"
          placeholder="🔍  Search communities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-ghost" onClick={refresh} disabled={loading}>
          {loading ? 'Scanning…' : '↻ Rescan'}
        </button>
        <button className="btn btn-primary" onClick={() => navigate('/found')}>
          + Found Community
        </button>
      </div>

      {error && (
        <div className="card explorer-error mono">
          ⚠ Chain unreachable: {error}. Is Anvil running on 127.0.0.1:8545?
        </div>
      )}

      {seeking.length > 0 && (
        <>
          <h2 className="explorer-section mono seeking">📡 SEEKING MEMBERS ▸</h2>
          <div className="explorer-grid">
            {seeking.map((c) => (
              <WorldCard
                key={c.address}
                c={c}
                ann={annFor(c)}
                onClick={() => navigate(`/community/${c.address}`)}
              />
            ))}
          </div>
        </>
      )}

      {mine.length > 0 && (
        <>
          <h2 className="explorer-section mono">MY MEMBERSHIPS ▸</h2>
          <div className="explorer-grid">
            {mine.map((c) => (
              <WorldCard key={c.address} c={c} onClick={() => navigate(`/community/${c.address}`)} />
            ))}
          </div>
        </>
      )}

      <h2 className="explorer-section mono">
        {query ? 'SEARCH RESULTS ▸' : 'TRENDING COMMUNITIES ▸'}
      </h2>

      {loading && communities.length === 0 ? (
        <div className="explorer-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 210, borderRadius: 14 }} />
          ))}
        </div>
      ) : trending.length === 0 ? (
        <div className="card explorer-empty">
          <div className="explorer-empty-art">🌌</div>
          <h3>No worlds yet</h3>
          <p>The cosmos is empty — be the first to found a community.</p>
          <button className="btn btn-primary" onClick={() => navigate('/found')}>
            + Found Community
          </button>
        </div>
      ) : (
        <div className="explorer-grid">
          {trending.map((c) => (
            <WorldCard
              key={c.address}
              c={c}
              ann={annFor(c)}
              onClick={() => navigate(`/community/${c.address}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorldCard({
  c,
  ann,
  onClick,
}: {
  c: CommunitySummary;
  ann?: CommunityAnnouncement;
  onClick: () => void;
}) {
  const recruiting = ann?.seekingMembers && !c.isMember && !c.isFounder;
  return (
    <button className={`world-card card ${recruiting ? 'recruiting' : ''}`} onClick={onClick}>
      <Planet seed={c.address} size={76} />
      <div className="world-name pill aqua">{c.name.toUpperCase()}</div>
      <div className="world-meta mono">
        <span>👥 {c.memberCount}</span>
        <span>⚑ {c.founderCount}</span>
        {c.aiAgentCount > 0 && <span>🤖 {c.aiAgentCount}</span>}
      </div>
      {recruiting && ann?.pitch && <div className="world-pitch">“{ann.pitch}”</div>}
      <div className="world-addr mono">{shortAddr(c.address)}</div>
      {(c.isFounder || c.isMember) ? (
        <span className={`world-badge mono ${c.isFounder ? 'founder' : ''}`}>
          {c.isFounder ? 'FOUNDER' : 'MEMBER'}
        </span>
      ) : recruiting ? (
        <span className="world-badge mono seeking">SEEKING</span>
      ) : null}
    </button>
  );
}
