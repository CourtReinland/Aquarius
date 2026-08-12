import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Address } from 'viem';
import { useChainData } from '../hooks/useChainData';
import { fetchCommunityHistory } from '../lib/actions';
import { Planet } from '../components/Planet';
import { shortAddr } from '../lib/clients';
import type { HistoryEvent } from '../lib/types';
import './community.css';

/**
 * Community detail — Stats Explorer (07), Bi-laws (08) and
 * Histories Explorer (13) as tabs of one world.
 */

type Tab = 'stats' | 'bylaws' | 'histories';

export function Community() {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const { communities, proposals } = useChainData();
  const [tab, setTab] = useState<Tab>('stats');
  const [history, setHistory] = useState<HistoryEvent[] | null>(null);

  const c = communities.find((x) => x.address.toLowerCase() === address?.toLowerCase());

  useEffect(() => {
    if (tab === 'histories' && address && history === null) {
      fetchCommunityHistory(address as Address)
        .then(setHistory)
        .catch(() => setHistory([]));
    }
  }, [tab, address, history]);

  const communityProposals = proposals.filter(
    (p) => c && p.communityName === c.name
  );

  if (!c) {
    return (
      <div className="page">
        <div className="page-header data">
          <h1>Community</h1>
          <div className="sub mono">{shortAddr(address)}</div>
        </div>
        <div className="card">
          <div className="skeleton" style={{ height: 120, borderRadius: 10 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header data">
        <h1>{tab === 'bylaws' ? 'Bi-laws Explorer' : tab === 'histories' ? 'Histories Explorer' : 'Community Stats Explorer'}</h1>
        <div className="sub">A world on the chain since {c.createdAt ? new Date(c.createdAt * 1000).toLocaleDateString() : '—'}</div>
      </div>

      <div className="comm-hero card">
        <Planet seed={c.address} size={92} />
        <div className="comm-hero-info">
          <div className="pill aqua comm-name">{c.name.toUpperCase()}</div>
          <div className="comm-addr mono">{c.address}</div>
          <div className="comm-stats-row mono">
            <span>👥 {c.memberCount} members</span>
            <span>⚑ {c.founderCount} founders</span>
            <span>🤖 {c.aiAgentCount} AI agents</span>
          </div>
        </div>
        {(c.isFounder || c.isMember) && (
          <span className={`world-badge mono ${c.isFounder ? 'founder' : ''}`}>
            {c.isFounder ? 'FOUNDER' : 'MEMBER'}
          </span>
        )}
      </div>

      <div className="comm-tabs">
        {(
          [
            ['stats', 'Stats'],
            ['bylaws', 'Bi-laws'],
            ['histories', 'Histories'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`comm-tab mono ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'stats' && (
        <div className="card pop-in">
          <span className="section-tag">Stats</span>
          <div className="comm-stat-list mono">
            <Stat k="Founders" v={String(c.founderCount)} />
            <Stat k="Total Members" v={String(c.memberCount)} />
            <Stat k="AI Agent Members" v={String(c.aiAgentCount)} />
            <Stat k="Open Proposals" v={String(communityProposals.filter((p) => p.status === 0).length)} />
            <Stat k="Total Proposals" v={String(communityProposals.length)} />
            <Stat k="Jurisdiction" v={c.jurisdiction || '—'} />
          </div>

          <span className="section-tag">Actions</span>
          <div className="comm-actions">
            <button className="btn btn-violet" onClick={() => navigate('/proposals')}>
              View Proposals
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/banking')}>
              Banking Setup
            </button>
          </div>
        </div>
      )}

      {tab === 'bylaws' && (
        <div className="card pop-in">
          <span className="section-tag">View Charter</span>
          <div className="comm-stat-list mono">
            <Stat k="Constitution Style" v="American" boxed />
            <Stat k="Banking Style" v="Austrian (Strict)" boxed />
            <Stat k="Legal Framework" v={c.legalFramework || 'None'} boxed />
            <Stat k="Jurisdiction" v={c.jurisdiction || 'Unspecified'} boxed />
          </div>
          <span className="section-tag">Bylaws</span>
          <div className="comm-stat-list mono">
            <Stat k="Member admission" v="By community vote" />
            <Stat k="Exile rule" v="By community vote" />
            <Stat k="Proposals" v="Open to eligible members" />
          </div>
        </div>
      )}

      {tab === 'histories' && (
        <div className="card pop-in">
          <div className="comm-record-head mono">
            <span className="pill violet">COMMUNITY BLOCK RECORD FOR:</span>
            <span className="comm-record-name mono">{c.name.toUpperCase()}</span>
          </div>
          {history === null ? (
            <div className="skeleton" style={{ height: 90, borderRadius: 8, marginTop: 14 }} />
          ) : history.length === 0 ? (
            <div className="comm-empty mono">No events decoded yet — the genesis block is the first story.</div>
          ) : (
            <div className="comm-record">
              {history.map((ev, i) => (
                <div key={i} className="term-row">
                  <span>{ev.text}</span>
                  <span className="stamp">{ev.stamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ k, v, boxed }: { k: string; v: string; boxed?: boolean }) {
  return (
    <div className="comm-stat">
      <span className="comm-stat-k">{k}</span>
      <span className={`comm-stat-v ${boxed ? 'boxed' : ''}`}>{v}</span>
    </div>
  );
}
