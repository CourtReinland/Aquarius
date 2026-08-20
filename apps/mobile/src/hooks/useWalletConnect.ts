import { useEffect, useState } from 'react';
import {
  getWalletConnectSnapshot,
  subscribeWalletConnect,
  type WalletConnectSnapshot,
} from '../wallet/walletconnect';

export function useWalletConnect(): WalletConnectSnapshot {
  const [state, setState] = useState<WalletConnectSnapshot>(getWalletConnectSnapshot);

  useEffect(() => subscribeWalletConnect(setState), []);

  return state;
}
