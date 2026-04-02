import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { useWalletStore } from '../hooks/useWalletStore';
import { baseSepolia } from '../config/chains';

/**
 * Wallet connection component for MVP.
 *
 * For development: generates or accepts a private key.
 * TODO: Replace with WalletConnect / Privy / Coinbase Smart Wallet
 *       for production release.
 */
export function WalletConnect() {
  const { address, isConnected, connect, disconnect } = useWalletStore();
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleGenerateWallet = () => {
    const pk = generatePrivateKey();
    const account = privateKeyToAccount(pk);
    // Store pk temporarily in state for contract interactions
    // In production, this would be handled by the wallet provider
    global.__aquariusDevKey = pk;
    connect(account.address, baseSepolia.id);
  };

  const handleImportWallet = () => {
    try {
      const pk = privateKeyInput.startsWith('0x')
        ? (privateKeyInput as `0x${string}`)
        : (`0x${privateKeyInput}` as `0x${string}`);
      const account = privateKeyToAccount(pk);
      global.__aquariusDevKey = pk;
      connect(account.address, baseSepolia.id);
      setShowInput(false);
    } catch {
      Alert.alert('Invalid Key', 'Please enter a valid private key.');
    }
  };

  if (isConnected && address) {
    return (
      <View style={styles.connectedContainer}>
        <View style={styles.addressRow}>
          <View style={styles.dot} />
          <Text style={styles.addressText}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </Text>
          <Text style={styles.networkBadge}>Base Sepolia</Text>
        </View>
        <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleGenerateWallet}
      >
        <Text style={styles.primaryButtonText}>Generate Dev Wallet</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => setShowInput(!showInput)}
      >
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
          <TouchableOpacity
            style={styles.importButton}
            onPress={handleImportWallet}
          >
            <Text style={styles.importButtonText}>Connect</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.hint}>
        Base Sepolia testnet. No real funds needed.
      </Text>
    </View>
  );
}

// Augment global for dev key storage
declare global {
  var __aquariusDevKey: `0x${string}` | undefined;
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    padding: 16,
  },
  connectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#161B22',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ECDC4',
  },
  addressText: {
    color: '#E6EDF3',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  networkBadge: {
    color: '#4ECDC4',
    fontSize: 10,
    backgroundColor: '#0D2D2A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  disconnectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#484F58',
  },
  disconnectText: {
    color: '#8B949E',
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0D1117',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#30363D',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#8B949E',
    fontSize: 16,
  },
  importContainer: {
    gap: 8,
  },
  input: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    padding: 12,
    color: '#E6EDF3',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  importButton: {
    backgroundColor: '#238636',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    color: '#484F58',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
