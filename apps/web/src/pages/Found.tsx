import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../state/walletStore';
import { useBlueStore } from '../state/blueStore';
import { eventScript } from '../blue/script';
import { createCommunityOnChain } from '../lib/actions';
import { announceCommunity } from '../lib/registry';
import { useChainBus } from '../state/chainBus';
import {
  emptyWizard,
  MemberAdmission,
  ProposalPermission,
  type CommunityWizardState,
} from '../lib/types';
import './found.css';

/** Found Community — the 3-step wizard from mockups 02/03/04. */

const CHARTERS = [
  { key: 'draft-original', label: 'Draft Original', hint: 'A charter written from scratch' },
  { key: 'us-constitution', label: 'U.S. Constitution', hint: 'Separation of powers, amendments' },
  { key: 'magna-carta', label: 'Magna Carta', hint: 'Limits on authority, due process' },
  { key: 'blackfeet-tribal', label: 'Blackfeet Tribal', hint: 'Communal councils, stewardship' },
] as const;

const STEP_TITLES = ['Identity', 'Governance', 'Legal Nesting'];

export function Found() {
  const navigate = useNavigate();
  const { address, privateKey } = useWalletStore();
  const blue = useBlueStore();
  const [step, setStep] = useState(1);
  const [wizard, setWizard] = useState<CommunityWizardState>({ ...emptyWizard });
  const [visibility, setVisibility] = useState<'public' | 'unlisted'>('public');
  const [pitch, setPitch] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bump = useChainBus((s) => s.bump);

  const up = (fields: Partial<CommunityWizardState>) =>
    setWizard((prev) => ({ ...prev, ...fields }));

  const goStep = (n: number) => {
    setStep(n);
    if (n === 2) blue.say(eventScript.wizardStep2());
    if (n === 3) blue.say(eventScript.wizardStep3());
  };

  const fillDemo = () => {
    up({
      name: wizard.name || 'Alpha Centauri',
      jurisdiction: 'State of New York',
      legalFramework: 'U.S. Code',
    });
    blue.say("Seeded it with a classic. Rename anything you like — it's your world, not mine. 😉");
  };

  const finish = async () => {
    if (!privateKey || !address) {
      blue.say('You need a wallet first — head back to the home screen and I will set you up.');
      return;
    }
    if (!wizard.name.trim()) {
      setError('Your community needs a name.');
      blue.say('One thing missing: the name. Every world deserves one.');
      setStep(1);
      return;
    }
    setDeploying(true);
    setError(null);
    blue.clear();
    blue.say(eventScript.deployStarted(), { mood: 'thinking' });
    try {
      const result = await createCommunityOnChain(privateKey, wizard);
      // publish the social announcement so the rest of the network hears about it
      await announceCommunity({
        address: result.communityAddress,
        name: wizard.name,
        visibility,
        seekingMembers: visibility === 'public',
        pitch,
        founder: address,
      });
      bump();
      blue.celebrate(eventScript.deploySuccess(wizard.name));
      navigate(
        `/success?name=${encodeURIComponent(wizard.name)}&address=${result.communityAddress}&tx=${result.txHash}`
      );
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || 'Unknown error';
      setError(msg.slice(0, 240));
      blue.say(eventScript.deployFailed(msg.slice(0, 120)));
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="page found-page">
      <div className="page-header found">
        <h1>Found Community</h1>
        <div className="sub">Design a world. Deploy it to the chain. Step {step} of 3.</div>
      </div>

      {/* constellation progress */}
      <div className="constellation mono">
        {STEP_TITLES.map((t, i) => (
          <div key={t} className="constellation-seg">
            <button
              className={`const-star ${step > i ? 'lit' : ''} ${step === i + 1 ? 'now' : ''}`}
              onClick={() => i + 1 < step && goStep(i + 1)}
            >
              ✦
            </button>
            <span className={`const-label ${step === i + 1 ? 'now' : ''}`}>{t}</span>
            {i < 2 && <span className={`const-line ${step > i + 1 ? 'lit' : ''}`} />}
          </div>
        ))}
      </div>

      {error && <div className="card found-error mono">⚠ {error}</div>}

      <div className="card found-body pop-in" key={step}>
        {step === 1 && (
          <>
            <label className="label">Community name</label>
            <input
              className="input"
              placeholder="e.g. Alpha Centauri"
              value={wizard.name}
              onChange={(e) => up({ name: e.target.value })}
              autoFocus
            />

            <label className="label">Who founds this community?</label>
            {(
              [
                ['single', 'A Founder', 'Just you — others join after genesis'],
                ['multiple', 'Several Founders', 'Co-found with friends (add their addresses)'],
              ] as const
            ).map(([key, title, hint]) => (
              <button
                key={key}
                className={`option ${wizard.founderCount === key ? 'selected' : ''}`}
                onClick={() => up({ founderCount: key })}
              >
                <span className="tick">✓</span>
                <span>
                  {title}
                  <span className="option-hint"> — {hint}</span>
                </span>
              </button>
            ))}

            {wizard.founderCount === 'multiple' && (
              <>
                <label className="label">Co-founder addresses (comma separated)</label>
                <input
                  className="input mono"
                  placeholder="0xabc…, 0xdef…"
                  value={wizard.founderAddresses.join(', ')}
                  onChange={(e) =>
                    up({
                      founderAddresses: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </>
            )}

            <label className="label">Charter style</label>
            <div className="found-charter-grid">
              {CHARTERS.map((c) => (
                <button
                  key={c.key}
                  className={`option ${wizard.charterTemplate === c.key ? 'selected' : ''}`}
                  onClick={() => up({ charterTemplate: c.key })}
                >
                  <span className="tick">✓</span>
                  <span>
                    {c.label}
                    <span className="option-hint"> — {c.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <label className="label">By what rule may a member be admitted or exiled?</label>
            {(
              [
                [MemberAdmission.FoundersOnly, 'By a vote of the founders only'],
                [MemberAdmission.FoundersAndMembers, 'By a vote of the founders + members'],
              ] as const
            ).map(([val, title]) => (
              <button
                key={val}
                className={`option ${wizard.admissionRule === val ? 'selected' : ''}`}
                onClick={() => up({ admissionRule: val })}
              >
                <span className="tick">✓</span>
                {title}
              </button>
            ))}

            <label className="label">By what vote percentage?</label>
            <div className="found-pct-row">
              {[51, 66, 80].map((pct) => (
                <button
                  key={pct}
                  className={`found-pct ${wizard.votePercentage === pct ? 'selected' : ''}`}
                  onClick={() => up({ votePercentage: pct })}
                >
                  <span className="found-pct-num mono">{pct}%</span>
                  <span className="found-pct-name">
                    {pct === 51 ? 'Majority' : pct === 66 ? 'Supermajority' : 'Consensus'}
                  </span>
                </button>
              ))}
            </div>

            <label className="label">Who may propose a vote?</label>
            {(
              [
                [ProposalPermission.FoundersOnly, 'Only a founder'],
                [ProposalPermission.FoundersOrMembers, 'Any member'],
              ] as const
            ).map(([val, title]) => (
              <button
                key={val}
                className={`option ${wizard.whoMayPropose === val ? 'selected' : ''}`}
                onClick={() => up({ whoMayPropose: val })}
              >
                <span className="tick">✓</span>
                {title}
              </button>
            ))}
          </>
        )}

        {step === 3 && (
          <>
            <label className="label">Nest this community in the following legal structure?</label>
            {['U.S. Code', 'International Commerce Law', 'None'].map((fw) => (
              <button
                key={fw}
                className={`option ${wizard.legalFramework === fw ? 'selected' : ''}`}
                onClick={() => up({ legalFramework: fw })}
              >
                <span className="tick">✓</span>
                {fw}
              </button>
            ))}

            <label className="label">Define the jurisdiction as?</label>
            <input
              className="input"
              placeholder="e.g. State of New York"
              value={wizard.jurisdiction}
              onChange={(e) => up({ jurisdiction: e.target.value })}
            />

            <label className="label">Allow members to join as?</label>
            {(
              [
                [false, 'Natural persons'],
                [true, 'Persons or corporations'],
              ] as const
            ).map(([val, title]) => (
              <button
                key={String(val)}
                className={`option ${wizard.allowCorporateMembers === val ? 'selected' : ''}`}
                onClick={() => up({ allowCorporateMembers: val })}
              >
                <span className="tick">✓</span>
                {title}
              </button>
            ))}

            <label className="label">Visibility on the network</label>
            {(
              [
                ['public', 'Public — seeking members', 'Announced to every connected device; listed as recruiting'],
                ['unlisted', 'Quiet — on-chain only', 'No announcement; discoverable only by address'],
              ] as const
            ).map(([val, title, hint]) => (
              <button
                key={val}
                className={`option ${visibility === val ? 'selected' : ''}`}
                onClick={() => setVisibility(val)}
              >
                <span className="tick">✓</span>
                <span>
                  {title}
                  <span className="option-hint"> — {hint}</span>
                </span>
              </button>
            ))}

            {visibility === 'public' && (
              <>
                <label className="label">Founding pitch (what should the network hear?)</label>
                <input
                  className="input"
                  placeholder="e.g. Skaters and builders wanted — first 10 members get founding shares"
                  maxLength={280}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                />
              </>
            )}

            <div className="found-summary mono">
              <div className="found-summary-title">GENESIS SUMMARY</div>
              <div>name: {wizard.name || '—'}</div>
              <div>founders: {wizard.founderCount === 'single' ? '1 (you)' : wizard.founderAddresses.length || 'you + listed'}</div>
              <div>charter: {wizard.charterTemplate}</div>
              <div>admission: {wizard.admissionRule === 0 ? 'founders only' : 'founders + members'} @ {wizard.votePercentage}%</div>
              <div>law: {wizard.legalFramework || 'none'} / {wizard.jurisdiction || 'unspecified'}</div>
              <div>visibility: {visibility === 'public' ? 'public · seeking members' : 'quiet · on-chain only'}</div>
            </div>
          </>
        )}
      </div>

      <div className="found-nav">
        {step > 1 ? (
          <button className="btn btn-ghost" onClick={() => goStep(step - 1)} disabled={deploying}>
            ← Back
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={fillDemo}>
            ✨ Blue, fill it for me
          </button>
        )}
        <button
          className="btn btn-primary found-next"
          disabled={deploying || (step === 1 && !wizard.name.trim())}
          onClick={() => (step < 3 ? goStep(step + 1) : finish())}
        >
          {deploying ? (
            <span className="found-deploying">⟳ Deploying to chain…</span>
          ) : step === 3 ? (
            '⛓ Found on Blockchain'
          ) : (
            'Next →'
          )}
        </button>
      </div>
    </div>
  );
}
