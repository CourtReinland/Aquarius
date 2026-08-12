import { useEffect, useState } from 'react';
import { useChainData } from '../hooks/useChainData';
import { useWalletStore } from '../state/walletStore';
import { useBlueStore } from '../state/blueStore';
import { eventScript } from '../blue/script';
import { castVote, createProposal, finalizeProposal } from '../lib/actions';
import { formatEther } from 'viem';
import type { OnChainProposal } from '../lib/types';
import './proposals.css';

/** Proposals Tracker — mockup 09. */

const STATUS = ['ACTIVE', 'PASSED', 'FAILED', 'CANCELLED'] as const;

export function Proposals() {
  const { proposals, communities, mine, refresh, loading } = useChainData();
  const { privateKey } = useWalletStore();
  const blue = useBlueStore();
  const [voteFor, setVoteFor] = useState<OnChainProposal | null>(null);
  const [creating, setCreating] = useState(false);

  const active = proposals.filter((p) => p.status === 0);
  const past = proposals.filter((p) => p.status !== 0);

  return (
    <div className="page">
      <div className="page-header found">
        <h1>Proposals Tracker</h1>
        <div className="sub">Decisions are made by those who show up.</div>
      </div>

      <div className="props-toolbar">
        <h2 className="explorer-section mono" style={{ margin: 0 }}>UPCOMING VOTES ▸</h2>
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={refresh} disabled={loading}>
          ↻
        </button>
        <button
          className="btn btn-primary"
          onClick={() => setCreating(true)}
          disabled={mine.length === 0}
          title={mine.length === 0 ? 'Join or found a community first' : ''}
        >
          + New Proposal
        </button>
      </div>

      {active.length === 0 && (
        <div className="card explorer-empty">
          <div className="explorer-empty-art">🗳</div>
          <h3>No live votes</h3>
          <p>Nothing on the ballot — propose something worth deciding.</p>
        </div>
      )}

      {active.map((p) => (
        <ProposalCard key={p.id} p={p} onVote={() => setVoteFor(p)} onFinalize={async () => {
          if (!privateKey) return;
          blue.think(true);
          try {
            await finalizeProposal(privateKey, p.id);
            blue.say('Proposal finalized — the chain has spoken.');
            refresh();
          } catch (e: any) {
            blue.say(`Could not finalize: ${(e?.shortMessage || e?.message || '').slice(0, 100)}`);
          }
        }} />
      ))}

      {past.length > 0 && (
        <>
          <h2 className="explorer-section mono">DECIDED ▸</h2>
          {past.map((p) => (
            <ProposalCard key={p.id} p={p} />
          ))}
        </>
      )}

      {voteFor && (
        <VoteModal
          p={voteFor}
          onClose={() => setVoteFor(null)}
          onVoted={() => {
            setVoteFor(null);
            blue.say(eventScript.voteCast());
            refresh();
          }}
        />
      )}

      {creating && (
        <CreateModal
          communities={mine.map((c) => ({ address: c.address, name: c.name }))}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            blue.say(eventScript.proposalCreated());
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Proposal card ───────────────────────────────────────────────

function ProposalCard({
  p,
  onVote,
  onFinalize,
}: {
  p: OnChainProposal;
  onVote?: () => void;
  onFinalize?: () => void;
}) {
  const total = p.yesVotes + p.noVotes;
  const yesPct = total ? Math.round((p.yesVotes / total) * 100) : 0;
  const ended = p.endTime * 1000 < Date.now();

  return (
    <div className={`prop-card card pop-in ${p.status === 1 ? 'passed' : p.status >= 2 ? 'failed' : ''}`}>
      <div className="prop-head mono">
        <span className="prop-in">IN COMMUNITY:</span>
        <span className="prop-comm">{p.communityName.toUpperCase()}</span>
        <span style={{ flex: 1 }} />
        <span className={`prop-status s${p.status}`}>{STATUS[p.status] ?? '—'}</span>
      </div>

      <div className="prop-title">{p.title}</div>

      <div className="prop-req mono">
        <span className="pill">REQUIREMENTS</span>
        <div className="prop-req-body">
          51% majority required to PASS
          {p.fundingCostPerYes > 0n && (
            <> · A YES vote carries {formatEther(p.fundingCostPerYes)} ETH</>
          )}
          {p.totalFunded > 0n && <> · {formatEther(p.totalFunded)} ETH raised</>}
        </div>
      </div>

      <div className="prop-tally">
        <div className="prop-bar">
          <div className="prop-bar-yes" style={{ width: `${yesPct}%` }} />
        </div>
        <div className="prop-tally-row mono">
          <span className="yes">YES {p.yesVotes}</span>
          <span className="no">NO {p.noVotes}</span>
        </div>
      </div>

      <div className="prop-foot">
        {p.status === 0 && !ended && <Countdown endTime={p.endTime} />}
        {p.status === 0 && ended && (
          <span className="mono prop-ended">voting closed — awaiting finalize</span>
        )}
        <span style={{ flex: 1 }} />
        {p.status === 0 && !ended && onVote && (
          <button className="btn btn-primary prop-vote-btn" onClick={onVote} disabled={p.hasVoted}>
            {p.hasVoted ? '✓ Voted' : 'Vote Now'}
          </button>
        )}
        {p.status === 0 && ended && onFinalize && (
          <button className="btn btn-violet prop-vote-btn" onClick={onFinalize}>
            Finalize
          </button>
        )}
      </div>
    </div>
  );
}

function Countdown({ endTime }: { endTime: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  let s = Math.max(0, Math.floor(endTime - now / 1000));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return (
    <span className="prop-countdown mono">
      ⏱ {h}hrs {m}mins {s}secs
    </span>
  );
}

// ─── Vote modal ──────────────────────────────────────────────────

function VoteModal({
  p,
  onClose,
  onVoted,
}: {
  p: OnChainProposal;
  onClose: () => void;
  onVoted: () => void;
}) {
  const { privateKey } = useWalletStore();
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const funding = p.fundingCostPerYes > 0n ? formatEther(p.fundingCostPerYes) : '';

  const vote = async (support: boolean) => {
    if (!privateKey) return;
    setBusy(support ? 'yes' : 'no');
    setErr(null);
    try {
      await castVote(privateKey, p.id, support, support ? funding : '');
      onVoted();
    } catch (e: any) {
      setErr((e?.shortMessage || e?.message || 'vote failed').slice(0, 160));
      setBusy(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glass pop-in" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Cast your vote</h3>
        <div className="modal-prop mono">{p.title}</div>
        {p.fundingCostPerYes > 0n && (
          <div className="modal-note mono">
            A YES vote sends {funding} ETH with it — refunded if the proposal fails.
          </div>
        )}
        {err && <div className="found-error card mono">⚠ {err}</div>}
        <div className="modal-actions">
          <button className="btn btn-primary" disabled={!!busy} onClick={() => vote(true)}>
            {busy === 'yes' ? '⟳ Signing…' : '✓ YES'}
          </button>
          <button className="btn btn-ghost" disabled={!!busy} onClick={() => vote(false)}>
            {busy === 'no' ? '⟳ Signing…' : '✗ NO'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create modal ────────────────────────────────────────────────

function CreateModal({
  communities,
  onClose,
  onCreated,
}: {
  communities: Array<{ address: string; name: string }>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { privateKey } = useWalletStore();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [community, setCommunity] = useState(communities[0]?.address ?? '');
  const [duration, setDuration] = useState(300);
  const [fundPerYes, setFundPerYes] = useState('0');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!privateKey || !title.trim() || !community) return;
    setBusy(true);
    setErr(null);
    try {
      await createProposal(
        privateKey,
        community as `0x${string}`,
        title.trim(),
        desc.trim(),
        duration,
        fundPerYes
      );
      onCreated();
    } catch (e: any) {
      setErr((e?.shortMessage || e?.message || 'creation failed').slice(0, 160));
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glass pop-in" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">New proposal</h3>

        <label className="label">Community</label>
        <select className="select" value={community} onChange={(e) => setCommunity(e.target.value)}>
          {communities.map((c) => (
            <option key={c.address} value={c.address}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="label">Title</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Create a kindergarten institution"
          autoFocus
        />

        <label className="label">Description</label>
        <textarea
          className="input"
          rows={3}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="What exactly are we deciding?"
        />

        <div className="modal-grid">
          <div>
            <label className="label">Duration</label>
            <select
              className="select"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value={300}>5 minutes (test)</option>
              <option value={3600}>1 hour</option>
              <option value={86400}>24 hours</option>
              <option value={604800}>7 days</option>
            </select>
          </div>
          <div>
            <label className="label">ETH per YES vote</label>
            <input
              className="input mono"
              value={fundPerYes}
              onChange={(e) => setFundPerYes(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {err && <div className="found-error card mono">⚠ {err}</div>}

        <div className="modal-actions">
          <button className="btn btn-primary" disabled={busy || !title.trim()} onClick={submit}>
            {busy ? '⟳ Publishing…' : '⛓ Publish Proposal'}
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
