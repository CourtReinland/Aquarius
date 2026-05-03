import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { WalletConnect } from '../components/WalletConnect';
import { useWalletStore } from '../hooks/useWalletStore';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export function HomeScreen({ navigation }: Props) {
  const { isConnected } = useWalletStore();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>AQUARIUS</Text>
        <Text style={styles.tagline}>
          Community Governance on the Blockchain
        </Text>
      </View>

      {/* Wallet connection */}
      <View style={styles.walletSection}>
        <WalletConnect />
      </View>

      {/* Action buttons - only enabled when wallet is connected */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.foundryButton}
          onPress={() => navigation.navigate('CreateAIAgent', {
            communityAddress: '0x0000000000000000000000000000000000000001',
            communityName: 'Agent Foundry Preview',
          })}
        >
          <Text style={styles.foundryEyebrow}>NEW</Text>
          <Text style={styles.foundryButtonText}>Open Agent Foundry</Text>
          <Text style={styles.foundrySubtext}>Create an embodied AI community member</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, !isConnected && styles.buttonDisabled]}
          onPress={() => navigation.navigate('MainTabs')}
          disabled={!isConnected}
        >
          <Text style={[styles.primaryButtonText, !isConnected && styles.textDisabled]}>
            Explore Communities
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, !isConnected && styles.buttonDisabled]}
          onPress={() => navigation.navigate('FoundCommunity')}
          disabled={!isConnected}
        >
          <Text style={[styles.secondaryButtonText, !isConnected && styles.textDisabled]}>
            + Found Community
          </Text>
        </TouchableOpacity>
      </View>

      {!isConnected && (
        <Text style={styles.connectPrompt}>
          Connect a wallet to get started
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '200',
    color: '#4ECDC4',
    letterSpacing: 12,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 14,
    color: '#8B949E',
    textAlign: 'center',
  },
  walletSection: {
    marginBottom: 32,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  foundryButton: {
    backgroundColor: '#10201F',
    borderWidth: 1,
    borderColor: '#4ECDC4',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#4ECDC4',
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  foundryEyebrow: {
    color: '#F0B429',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  foundryButtonText: {
    color: '#4ECDC4',
    fontSize: 20,
    fontWeight: '800',
  },
  foundrySubtext: {
    color: '#8B949E',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0D1117',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#4ECDC4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4ECDC4',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  textDisabled: {
    opacity: 0.5,
  },
  connectPrompt: {
    color: '#484F58',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
});
