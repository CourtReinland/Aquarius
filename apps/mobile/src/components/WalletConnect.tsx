import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { createWalletClient, http, parseEther } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { useWalletStore } from '../hooks/useWalletStore';
import { defaultChain } from '../config/chains';
import { showAlert } from '../utils/alert';

// Anvil's first pre-funded account — used to send ETH to newly generated wallets on local chain
const ANVIL_FUNDER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

/**
 * Wallet connection component for MVP.
 * Stores dev key in a way that works on both web and native.
 */

// Use a module-level variable that works across web and native
let _devPrivateKey: `0x${string}` | undefined;

export function getDevKey(): `0x${string}` | undefined {
  return _devPrivateKey;
}

export function WalletConnect() {
  const { address, isConnected, connect, disconnect } = useWalletStore();
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleGenerateWallet = async () => {
    try {
      // On local Anvil, use a pre-funded account directly so gas works immediately
      const isLocal = defaultChain.id === 31337;
      const pk = isLocal ? ANVIL_FUNDER_KEY : generatePrivateKey();
      const account = privateKeyToAccount(pk);

      _devPrivateKey = pk;
      if (typeof globalThis !== 'undefined') {
        (globalThis as any).__aquariusDevKey = pk;
      }

      console.log('[Wallet] Connected:', account.address, isLocal ? '(Anvil pre-funded)' : '(new)');
      connect(account.address, defaultChain.id);
    } catch (error: any) {
      console.error('[Wallet] Generate failed:', error);
      showAlert('Wallet Error', error?.message || 'Failed to generate wallet');
    }
  };

  const handleImportWallet = () => {
    try {
      const pk = privateKeyInput.startsWith('0x')
        ? (privateKeyInput as `0x${string}`)
        : (`0x${privateKeyInput}` as `0x${string}`);
      const account = privateKeyToAccount(pk);

      _devPrivateKey = pk;
      if (typeof globalThis !== 'undefined') {
        (globalThis as any).__aquariusDevKey = pk;
      }

      console.log('[Wallet] Imported:', account.address);
      connect(account.address, defaultChain.id);
      setShowInput(false);
    } catch {
      showAlert('Invalid Key', 'Please enter a valid private key.');
    }
  };

  const handleDisconnect = () => {
    _devPrivateKey = undefined;
    if (typeof globalThis !== 'undefined') {
      (globalThis as any).__aquariusDevKey = undefined;
    }
    disconnect();
  };

  if (isConnected && address) {
    return (
      <View style={styles.connectedContainer}>
        <View style={styles.addressRow}>
          <View style={styles.dot} />
          <Text style={styles.addressText}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </Text>
          <Text style={styles.networkBadge}>{defaultChain.name}</Text>
        </View>
        <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.primaryButton} onPress={handleGenerateWallet}>
        <Text style={styles.primaryButtonText}>Generate Dev Wallet</Text>
      </TouchableOpacity>

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
          />
          <TouchableOpacity style={styles.importButton} onPress={handleImportWallet}>
            <Text style={styles.importButtonText}>Connect</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.hint}>
        {defaultChain.name} testnet. No real funds needed.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16 },
  connectedContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
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
  disconnectBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: '#484F58',
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
});
