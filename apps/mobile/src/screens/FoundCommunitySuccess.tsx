import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { defaultChain } from '../config/chains';
import { useBlockchain } from '../context/BlockchainContext';

/**
 * Success screen shown after community is founded on-chain.
 * Matches pitch deck slide 39: fireworks + community name + blockchain confirmation.
 *
 * "View Dashboard" goes to MainTabs (memberships/profile tab).
 */

type Props = NativeStackScreenProps<RootStackParamList, 'FoundCommunitySuccess'>;

export function FoundCommunitySuccess({ route, navigation }: Props) {
  const { name, address, txHash } = route.params;
  const { refresh } = useBlockchain();

  // Refresh blockchain data immediately so new community shows in memberships
  useEffect(() => {
    refresh();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Fireworks */}
      <View style={styles.fireworks}>
        <Text style={styles.sparkle}>*  .  *</Text>
        <Text style={styles.sparkle}>.  *  .</Text>
        <Text style={styles.sparkle}>*  .  *</Text>
      </View>

      <Text style={styles.successTitle}>Success!</Text>

      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>AQUARIUS</Text>
      </View>

      <Text style={styles.message}>
        You just founded{'\n'}
        <Text style={styles.communityName}>{name.toUpperCase()}</Text>
        {'\n'}on the Ethereum blockchain.
      </Text>

      {/* Contract details */}
      <View style={styles.detailsCard}>
        <Text style={styles.detailLabel}>Contract Address</Text>
        <Text style={styles.detailValue}>
          {address.slice(0, 10)}...{address.slice(-8)}
        </Text>

        <Text style={styles.detailLabel}>Transaction</Text>
        <Text style={styles.detailValue}>
          {txHash.slice(0, 10)}...{txHash.slice(-8)}
        </Text>

        <Text style={styles.detailLabel}>Network</Text>
        <Text style={styles.detailValue}>{defaultChain.name}</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            // Navigate to the main tabs, landing on the Profile/Memberships tab
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainTabs' }],
            });
          }}
        >
          <Text style={styles.primaryButtonText}>View My Memberships</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          }}
        >
          <Text style={styles.secondaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0D1117',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  fireworks: { alignItems: 'center', marginBottom: 16 },
  sparkle: { color: '#F0C040', fontSize: 20, letterSpacing: 8 },
  successTitle: { fontSize: 36, fontWeight: '700', color: '#4ECDC4', marginBottom: 20 },
  logoContainer: { marginBottom: 24 },
  logoText: { fontSize: 28, fontWeight: '200', color: '#4ECDC4', letterSpacing: 8 },
  message: { color: '#C9D1D9', fontSize: 16, textAlign: 'center', lineHeight: 26, marginBottom: 24 },
  communityName: { color: '#4ECDC4', fontWeight: '700', fontSize: 20 },
  detailsCard: {
    backgroundColor: '#161B22', borderRadius: 12, padding: 16, width: '100%',
    borderWidth: 1, borderColor: '#30363D', marginBottom: 32, gap: 4,
  },
  detailLabel: { color: '#484F58', fontSize: 11, marginTop: 8 },
  detailValue: { color: '#E6EDF3', fontSize: 13, fontFamily: 'monospace' },
  buttonContainer: { width: '100%', gap: 12 },
  primaryButton: {
    backgroundColor: '#4ECDC4', paddingVertical: 16, borderRadius: 12, alignItems: 'center',
  },
  primaryButtonText: { color: '#0D1117', fontSize: 18, fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1, borderColor: '#30363D', paddingVertical: 14, borderRadius: 12, alignItems: 'center',
  },
  secondaryButtonText: { color: '#8B949E', fontSize: 16 },
});
