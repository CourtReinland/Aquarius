import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
/**
 * Community Dashboard - "Power windows" view.
 * Matches pitch deck slides 20-22: My Memberships, Bi-laws Explorer, Histories.
 * Will be populated with real blockchain data in Phase 2-3.
 */
export function CommunityDashboard({ route }: { route?: { params?: { address?: string } } }) {
  const address = route?.params?.address || '0x...';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Community Header */}
        <View style={styles.communityHeader}>
          <Text style={styles.communityName}>ALPHA CENTAURI</Text>
          <Text style={styles.contractAddress}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </Text>
        </View>

        {/* Institutional Holdings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Institutional Holdings</Text>
          <Text style={styles.cardItem}>Pizza Foundry: 23 shares</Text>
          <Text style={styles.cardItem}>Golf course: 10 shares</Text>
          <Text style={styles.cardItem}>Schoolhouse: 25 shares</Text>
        </View>

        {/* Board Positions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Board Positions Held</Text>
          <Text style={styles.cardItem}>
            Food Planning, School Planning, Membership Committee
          </Text>
        </View>

        {/* Roles */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Role(s)</Text>
          <Text style={styles.roleTitle}>Baker</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>RESPONSIBILITIES: Bake 60 Cupcakes/day</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>TAKE RATE: 200 tokens/day</Text>
          </View>
        </View>

        {/* Token Balance */}
        <View style={styles.tokenCard}>
          <Text style={styles.tokenLabel}>TOKENS HELD</Text>
          <Text style={styles.tokenAmount}>3201</Text>
          <Text style={styles.tokenAction}>SWAP ON INTERNAL MARKET</Text>
          <Text style={styles.tokenAction}>SWAP ON EXTERNAL MARKET (ETH)</Text>
        </View>

        {/* Upcoming Votes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>UPCOMING VOTES</Text>
          <View style={styles.voteItem}>
            <Text style={styles.cardItem}>Proposal to Create Teaching Position</Text>
            <Text style={styles.voteDate}>11/11/25 16:03</Text>
          </View>
          <View style={styles.voteItem}>
            <Text style={styles.cardItem}>Proposal to purchase Mini Golf Course</Text>
            <Text style={styles.voteDate}>11/12/25 16:03</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  scroll: {
    padding: 16,
    gap: 16,
  },
  communityHeader: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  communityName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E6EDF3',
    letterSpacing: 2,
  },
  contractAddress: {
    fontSize: 12,
    color: '#484F58',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  card: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  cardTitle: {
    color: '#4ECDC4',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  cardItem: {
    color: '#C9D1D9',
    fontSize: 14,
    lineHeight: 22,
  },
  roleTitle: {
    color: '#E6EDF3',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#0D2D2A',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  badgeText: {
    color: '#4ECDC4',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  tokenCard: {
    backgroundColor: '#1A3A3A',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4ECDC4',
  },
  tokenLabel: {
    color: '#8B949E',
    fontSize: 12,
    letterSpacing: 3,
    marginBottom: 4,
  },
  tokenAmount: {
    color: '#E6EDF3',
    fontSize: 42,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  tokenAction: {
    color: '#4ECDC4',
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 4,
  },
  voteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  voteDate: {
    color: '#4ECDC4',
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: '#0D2D2A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
