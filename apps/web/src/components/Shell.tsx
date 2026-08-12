import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useWalletStore } from '../state/walletStore';
import { shortAddr } from '../lib/clients';
import './shell.css';

const NAV = [
  { to: '/explorer', label: 'Explorer', icon: '🪐' },
  { to: '/found', label: 'Found', icon: '⚒' },
  { to: '/memberships', label: 'Memberships', icon: '👤' },
  { to: '/proposals', label: 'Proposals', icon: '📋' },
  { to: '/banking', label: 'Banking', icon: '🏛' },
];

export function Shell() {
  const { address, disconnect } = useWalletStore();
  const navigate = useNavigate();

  return (
    <>
      <header className="shell-top glass">
        <button className="shell-brand" onClick={() => navigate(address ? '/explorer' : '/')}>
          <span className="shell-logo">▲</span>
          <span className="shell-word">AQUARIUS</span>
        </button>

        <nav className="shell-nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `shell-link ${isActive ? 'active' : ''}`}
            >
              <span className="shell-link-icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="shell-wallet">
          {address ? (
            <>
              <span className="mono shell-addr" title={address}>
                {shortAddr(address)}
              </span>
              <button
                className="shell-disconnect"
                onClick={() => {
                  disconnect();
                  navigate('/');
                }}
                title="Disconnect"
              >
                ⏻
              </button>
            </>
          ) : (
            <button className="btn btn-primary shell-connect" onClick={() => navigate('/')}>
              Connect
            </button>
          )}
        </div>
      </header>
      <Outlet />
    </>
  );
}
