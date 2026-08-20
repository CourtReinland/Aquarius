import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Share,
  Platform,
} from 'react-native';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { useWalletStore } from '../hooks/useWalletStore';
import { useWalletAuth } from '../hooks/useWalletAuth';
import { useWalletConnect } from '../hooks/useWalletConnect';
import { isDevSignerEnabled } from '../config/env';
import { defaultChain } from '../config/chains';
import { showAlert } from '../utils/alert';
import {
  clearSigningKey,
  getSignerMode,
  isDevAnvilSignerActive,
  setSigningKey,
  useAnvilDevSigner,
} from '../wallet/signer';
import {
  connectWalletConnect,
  disconnectWalletConnect,
  isWalletConnectSessionActive,
  openWalletConnectUri,
} from '../wallet/walletconnect';

/**
 * Wallet connect UI.
 *
 * Local path: generate or import a personal key, persist via SecureStore,
 * and sign SIWE + txs with that same WalletClient.
 *
 * WalletConnect v2: when EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID is set, connect
 * an external wallet. getWalletClient() prefers the WC session.
 *
 * Dev path (opt-in): EXPO_PUBLIC_AQUARIUS_DEV_SIGNER=1 enables the Anvil
 * account #0 button for local gas. That mode is labeled in the UI.
 */

export function WalletConnect() {
  const { address, isConnected, session, linkedWallets, connect, disconnect } = useWalletStore();
  const { signInWithConnectedWallet, isSigningIn, error: authError } = useWalletAuth();
  const walletConnect = useWalletConnect();
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const devSignerEnabled = isDevSignerEnabled();
  const usingDevAnvil = isDevAnvilSignerActive();
  const usingWalletConnect = getSignerMode() === 'walletconnect';
  const wasWalletConnect = useRef(walletConnect.connected);

  const finishConnect = async (accountAddress: `0x${string}`) => {
    connect(accountAddress, defaultChain.id);
    const nextSession = await signInWithConnectedWallet(accountAddress, defaultChain.id);
    if (!nextSession) {
      showAlert(
        'Wallet Connected',
        'Aquarius could not create an off-chain signed session, but blockchain reads and transactions can still use this wallet.'
      );
    }
  };

  useEffect(() => {
    if (wasWalletConnect.current && !walletConnect.connected && !walletConnect.connecting) {
      disconnect();
    }
    wasWalletConnect.current = walletConnect.connected;
  }, [disconnect, walletConnect.connected, walletConnect.connecting]);

  const handleGenerateWallet = async () => {
    try {
      if (isWalletConnectSessionActive()) {
        await disconnectWalletConnect();
      }
      const pk = generatePrivateKey();
      const account = await setSigningKey(pk);
      // Never log the private key — address only.
      console.log('[Wallet] Connected personal wallet:', account.address);
      await finishConnect(account.address);
    } catch (error: any) {
      console.error('[Wallet] Generate failed:', error?.message || error);
      showAlert('Wallet Error', error?.message || 'Failed to generate wallet');
    }
  };

  const handleUseAnvilDevSigner = async () => {
    try {
      if (isWalletConnectSessionActive()) {
        await disconnectWalletConnect();
      }
      const account = await useAnvilDevSigner();
      console.log('[Wallet] Connected DEV Anvil signer:', account.address);
      await finishConnect(account.address);
    } catch (error: any) {
      console.error('[Wallet] Dev signer failed:', error?.message || error);
      showAlert('Dev Signer Error', error?.message || 'Failed to enable Anvil signer');
    }
  };

  const handleImportWallet = async () => {
    try {
      const pk = privateKeyInput.startsWith('0x')
        ? (privateKeyInput as `0x${string}`)
        : (`0x${privateKeyInput}` as `0x${string}`);
      // Validate before persisting.
      privateKeyToAccount(pk);
      if (isWalletConnectSessionActive()) {
        await disconnectWalletConnect();
      }
      const account = await setSigningKey(pk);
      setPrivateKeyInput('');
      setShowInput(false);
      console.log('[Wallet] Imported wallet:', account.address);
      await finishConnect(account.address);
    } catch (error: any) {
      showAlert('Invalid Key', error?.message || 'Please enter a valid private key.');
    }
  };

  const handleConnectWalletConnect = async () => {
    try {
      const accountAddress = await connectWalletConnect();
      console.log('[Wallet] Connected WalletConnect:', accountAddress);
      await finishConnect(accountAddress);
    } catch (error: any) {
      const message = error?.message || 'WalletConnect pairing failed';
      if (/reject|denied|cancel/i.test(message)) return;
      console.error('[Wallet] WalletConnect failed:', message);
      showAlert('WalletConnect', message);
    }
  };

  const handleSharePairingUri = async () => {
    if (!walletConnect.pairingUri) return;
    try {
      await Share.share({ message: walletConnect.pairingUri });
    } catch {
      // User dismissed the share sheet.
    }
  };

  const handleOpenPairingUri = async () => {
    if (!walletConnect.pairingUri) return;
    const opened = await openWalletConnectUri(walletConnect.pairingUri);
    if (!opened) {
      showAlert(
        'Open Wallet',
        'No installed wallet handled the WalletConnect link. Copy the pairing URI into MetaMask, Rainbow, or another WC-compatible wallet.'
      );
    }
  };

  const handleDisconnect = async () => {
    if (isWalletConnectSessionActive()) {
      await disconnectWalletConnect();
    } else {
      await clearSigningKey();
    }
    disconnect();
  };

  if (walletConnect.connecting || walletConnect.pairingUri) {
    return (
      <View style={styles.connectedContainer}>
        <Text style={styles.pairingTitle}>Approve in your wallet</Text>
        <Text style={styles.pairingHint}>
          Scan or paste this WalletConnect URI in MetaMask, Rainbow, or another WC v2 wallet.
        </Text>
        {walletConnect.pairingUri ? (
          <Text selectable style={styles.uriText}>
            {walletConnect.pairingUri}
          </Text>
        ) : (
          <Text style={styles.sessionText}>Waiting for pairing URI…</Text>
        )}
        <View style={styles.pairingActions}>
          {walletConnect.pairingUri ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleSharePairingUri}>
              <Text style={styles.secondaryButtonText}>Share pairing URI</Text>
            </TouchableOpacity>
          ) : null}
          {walletConnect.pairingUri && Platform.OS === 'android' ? (
            <TouchableOpacity style={styles.wcButton} onPress={handleOpenPairingUri}>
              <Text style={styles.wcButtonText}>Open installed wallet</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.disconnectBtn} onPress={() => void disconnectWalletConnect()}>
            <Text style={styles.disconnectText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isConnected && address) {
    return (
      <View style={styles.connectedContainer}>
        {usingDevAnvil ? (
          <View style={styles.devBanner}>
            <Text style={styles.devBannerText}>DEV SIGNER ACTIVE — Anvil shared key</Text>
          </View>
        ) : null}
        {usingWalletConnect ? (
          <View style={styles.wcBanner}>
            <Text style={styles.wcBannerText}>WalletConnect — external wallet</Text>
          </View>
        ) : null}
        <View style={styles.addressRow}>
          <View style={styles.dot} />
          <Text style={styles.addressText}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </Text>
          <Text style={styles.networkBadge}>{defaultChain.name}</Text>
        </View>
        <Text style={[styles.sessionText, session && styles.sessionTextVerified]}>
          {session ? 'Signed in' : 'Wallet only'}
          {linkedWallets.length > 0 ? ` · ${linkedWallets.length} linked` : ''}
          {' · '}
          {usingWalletConnect ? 'walletconnect' : usingDevAnvil ? 'dev-anvil' : 'local-key'}
        </Text>
        <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {devSignerEnabled ? (
        <View style={styles.devBanner}>
          <Text style={styles.devBannerText}>
            DEV SIGNER ENABLED — Anvil shared key available for local gas
          </Text>
        </View>
      ) : null}

      {walletConnect.available ? (
        <TouchableOpacity
          style={styles.wcButton}
          onPress={handleConnectWalletConnect}
          disabled={isSigningIn}
        >
          <Text style={styles.wcButtonText}>
            {isSigningIn ? 'Signing In...' : 'Connect WalletConnect'}
          </Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleGenerateWallet}
        disabled={isSigningIn}
      >
        <Text style={styles.primaryButtonText}>
          {isSigningIn ? 'Signing In...' : 'Create Wallet'}
        </Text>
      </TouchableOpacity>

      {devSignerEnabled ? (
        <TouchableOpacity
          style={styles.devButton}
          onPress={handleUseAnvilDevSigner}
          disabled={isSigningIn}
        >
          <Text style={styles.devButtonText}>Use Anvil Account #0 (funded)</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowInput(!showInput)}>
        <Text style={styles.secondaryButtonText}>Import Private Key</Text>
      </TouchableOpacity>

      {showInput && (
        <View style={styles.importContainer}>
          <TextInput
            style={styles.input}
            value={privateKeyInput}
            onChangeText={setPrivateKeyInput}
            placeholder="0x..."
            placeholderTextColor="#484F58"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.importButton}
            onPress={handleImportWallet}
            disabled={isSigningIn}
          >
            <Text style={styles.importButtonText}>Connect</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.hint}>
        {defaultChain.name}. Keys stay on device
        {walletConnect.available ? ', or sign with WalletConnect' : ''}
        {defaultChain.id === 31337 && !devSignerEnabled
          ? '. For pre-funded Anvil gas set EXPO_PUBLIC_AQUARIUS_DEV_SIGNER=1.'
          : '.'}
      </Text>
      {authError ? <Text style={styles.authError}>{authError}</Text> : null}
      {walletConnect.error ? <Text style={styles.authError}>{walletConnect.error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16 },
  connectedContainer: {
    gap: 8,
    padding: 12, backgroundColor: '#161B22', borderRadius: 10,
    borderWidth: 1, borderColor: '#30363D',
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ECDC4' },
  addressText: { color: '#E6EDF3', fontSize: 14, fontFamily: 'monospace' },
  networkBadge: {
    color: '#4ECDC4', fontSize: 10, backgroundColor: '#0D2D2A',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
  },
  sessionText: { color: '#8B949E', fontSize: 11 },
  sessionTextVerified: { color: '#4ECDC4' },
  disconnectBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: '#484F58', alignSelf: 'flex-start',
  },
  disconnectText: { color: '#8B949E', fontSize: 12 },
  primaryButton: {
    backgroundColor: '#4ECDC4', paddingVertical: 14, borderRadius: 10, alignItems: 'center',
  },
  primaryButtonText: { color: '#0D1117', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1, borderColor: '#30363D', paddingVertical: 14, borderRadius: 10, alignItems: 'center',
  },
  secondaryButtonText: { color: '#8B949E', fontSize: 16 },
  wcButton: {
    backgroundColor: '#1F3A5F', borderWidth: 1, borderColor: '#58A6FF',
    paddingVertical: 14, borderRadius: 10, alignItems: 'center',
  },
  wcButtonText: { color: '#58A6FF', fontSize: 16, fontWeight: '600' },
  wcBanner: {
    backgroundColor: '#12233A', borderWidth: 1, borderColor: '#58A6FF',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
  },
  wcBannerText: { color: '#58A6FF', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  pairingTitle: { color: '#E6EDF3', fontSize: 14, fontWeight: '600' },
  pairingHint: { color: '#8B949E', fontSize: 12 },
  pairingActions: { gap: 8 },
  uriText: {
    color: '#E6EDF3', fontSize: 11, fontFamily: 'monospace',
    backgroundColor: '#0D1117', padding: 8, borderRadius: 6,
  },
  devButton: {
    backgroundColor: '#3D2E00', borderWidth: 1, borderColor: '#F0B429',
    paddingVertical: 14, borderRadius: 10, alignItems: 'center',
  },
  devButtonText: { color: '#F0B429', fontSize: 14, fontWeight: '600' },
  devBanner: {
    backgroundColor: '#3D2E00', borderWidth: 1, borderColor: '#F0B429',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
  },
  devBannerText: { color: '#F0B429', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  importContainer: { gap: 8 },
  input: {
    backgroundColor: '#161B22', borderWidth: 1, borderColor: '#30363D',
    borderRadius: 8, padding: 12, color: '#E6EDF3', fontSize: 14, fontFamily: 'monospace',
  },
  importButton: {
    backgroundColor: '#238636', paddingVertical: 12, borderRadius: 8, alignItems: 'center',
  },
  importButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  hint: { color: '#484F58', fontSize: 12, textAlign: 'center', marginTop: 4 },
  authError: { color: '#F0B429', fontSize: 11, textAlign: 'center' },
});
