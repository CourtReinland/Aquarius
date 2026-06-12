import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Starfield } from './components/Starfield';
import { Shell } from './components/Shell';
import { BlueCompanion } from './blue/BlueCompanion';
import { Landing } from './pages/Landing';
import { Explorer } from './pages/Explorer';
import { Found } from './pages/Found';
import { Success } from './pages/Success';
import { Community } from './pages/Community';
import { Proposals } from './pages/Proposals';
import { Memberships } from './pages/Memberships';
import { Banking } from './pages/Banking';
import { useWalletStore } from './state/walletStore';
import { useBlueStore } from './state/blueStore';
import { useCommunityWatcher } from './hooks/useCommunityWatcher';
import { eventScript } from './blue/script';

function BlueWithActions() {
  const navigate = useNavigate();
  const { adoptIdentity } = useWalletStore();
  const blue = useBlueStore();
  useCommunityWatcher(); // every device senses new worlds landing on-chain

  return (
    <BlueCompanion
      onAction={(action) => {
        if (action.startsWith('visit:')) {
          navigate(`/community/${action.slice(6)}`);
          return;
        }
        switch (action) {
          case 'generate-wallet': {
            const addr = adoptIdentity(); // random free identity
            blue.say(eventScript.walletCreated(addr));
            navigate('/explorer');
            break;
          }
          case 'go-explorer':
            navigate('/explorer');
            break;
          case 'go-found':
          case 'wizard-demo':
            navigate('/found');
            break;
        }
      }}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Starfield />
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Landing />} />
          <Route path="/explorer" element={<Explorer />} />
          <Route path="/found" element={<Found />} />
          <Route path="/success" element={<Success />} />
          <Route path="/community/:address" element={<Community />} />
          <Route path="/proposals" element={<Proposals />} />
          <Route path="/memberships" element={<Memberships />} />
          <Route path="/banking" element={<Banking />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <BlueWithActions />
    </BrowserRouter>
  );
}
