import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBlockchain } from '../context/BlockchainContext';

/**
 * Profile / My Memberships screen.
 * Shows REAL data: ETH balance, communities, token holdings, positions.
 * No placeholder data.
 */
export function CommunityDashboard() {
  const { profile, myCommunities, proposals, loading, refresh, walletAddress, isConnected } = useBlockchain();

  if (!isConnected || !walletAddress) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Not Connected</Text>
          <Text style={styles.emptySubtitle}>Connect a wallet on the home screen to view your profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeProposals = proposals.filter(p => p.status === 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#4ECDC4" />}
      >
        {/* Wallet header */}
        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>WALLET</Text>
          <Text style={styles.walletAddress}>
            {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
          </Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceAmount}>
              {profile ? parseFloat(profile.ethBalance).toFixed(4) : '...'} ETH
            </Text>
            <Text style={styles.networkLabel}>{'\u2022'} Anvil Local</Text>
          </View>
        </View>

        {/* Stats summary */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{myCommunities.length}</Text>
            <Text style={styles.statLabel}>Communities</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{myCommunities.filter(c => c.isFounder).length}</Text>
            <Text style={styles.statLabel}>Founded</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{activeProposals.length}</Text>
            <Text style={styles.statLabel}>Active Votes</Text>
          </View>
        </View>

        {/* My Communities */}
        <Text style={styles.sectionTitle}>MY MEMBERSHIPS</Text>

        {myCommunities.length === 0 && !loading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No memberships yet. Found or join a community!</Text>
          </View>
        )}

        {myCommunities.map(c => (
          <View key={c.address} style={styles.communityCard}>
            <View style={styles.communityHeader}>
              <Text style={styles.communityName}>{c.name}</Text>
              {c.isFounder && (
                <View style={styles.founderTag}>
                  <Text style={styles.founderTagText}>FOUNDER</Text>
                </View>
              )}
            </View>

            <View style={styles.detailGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Members</Text>
                <Text style={styles.detailValue}>{c.memberCount}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Founders</Text>
                <Text style={styles.detailValue}>{c.founderCount}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Founded</Text>
                <Text style={styles.detailValue}>
                  {new Date(c.createdAt * 1000).toLocaleDateString()}
                </Text>
              </View>
            </View>

            {c.legalFramework ? (
              <Text style={styles.legalInfo}>Legal: {c.legalFramework} | {c.jurisdiction}</Text>
            ) : null}

            <Text style={styles.contractAddr}>
              {c.address.slice(0, 10)}...{c.address.slice(-8)}
            </Text>
          </View>
        ))}

        {/* Upcoming votes */}
        {activeProposals.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>UPCOMING VOTES</Text>
            {activeProposals.map(p => (
              <View key={p.id} style={styles.voteItem}>
                <Text style={styles.voteTitle}>{p.title}</Text>
                <View style={styles.voteMetaRow}>
                  <Text style={styles.voteCommunity}>{p.communityName}</Text>
                  <Text style={styles.voteStatus}>{p.hasVoted ? 'Voted' : 'Pending'}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  scroll: { padding: 16, gap: 12 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { color: '#E6EDF3', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#484F58', fontSize: 14, textAlign: 'center' },

  walletCard: { backgroundColor: '#161B22', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#30363D' },
  walletLabel: { color: '#484F58', fontSize: 10, letterSpacing: 2, marginBottom: 4 },
  walletAddress: { color: '#E6EDF3', fontSize: 14, fontFamily: 'monospace', marginBottom: 8 },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  balanceAmount: { color: '#4ECDC4', fontSize: 28, fontWeight: '700', fontFamily: 'monospace' },
  networkLabel: { color: '#484F58', fontSize: 12 },

  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: '#161B22', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#30363D' },
  statNumber: { color: '#4ECDC4', fontSize: 24, fontWeight: '700' },
  statLabel: { color: '#484F58', fontSize: 10, marginTop: 2 },

  sectionTitle: { color: '#8B949E', fontSize: 12, fontWeight: '700', letterSpacing: 2, marginTop: 8 },

  emptyCard: { backgroundColor: '#161B22', borderRadius: 10, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#30363D' },
  emptyCardText: { color: '#484F58', fontSize: 13, textAlign: 'center' },

  communityCard: { backgroundColor: '#161B22', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#30363D', gap: 8 },
  communityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  communityName: { color: '#E6EDF3', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  founderTag: { backgroundColor: '#4ECDC422', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#4ECDC4' },
  founderTagText: { color: '#4ECDC4', fontSize: 10, fontWeight: '700' },

  detailGrid: { flexDirection: 'row', gap: 12 },
  detailItem: { flex: 1, backgroundColor: '#0D1117', borderRadius: 6, padding: 8, alignItems: 'center' },
  detailLabel: { color: '#484F58', fontSize: 10 },
  detailValue: { color: '#E6EDF3', fontSize: 16, fontWeight: '600' },

  legalInfo: { color: '#8B949E', fontSize: 11, fontStyle: 'italic' },
  contractAddr: { color: '#30363D', fontSize: 10, fontFamily: 'monospace' },

  voteItem: { backgroundColor: '#161B22', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#30363D' },
  voteTitle: { color: '#E6EDF3', fontSize: 13 },
  voteMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  voteCommunity: { color: '#484F58', fontSize: 11 },
  voteStatus: { color: '#4ECDC4', fontSize: 11, fontWeight: '600' },
});
