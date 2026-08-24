import React, { useState, useCallback, lazy, Suspense } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useBlockchain } from '../context/BlockchainContext';
import type { CommunityNode } from '../components/explorer3d/ExplorerScene';

const ExplorerScene = lazy(() =>
  import('../components/explorer3d/ExplorerScene').then((m) => ({ default: m.ExplorerScene }))
);

type ViewMode = '3d' | 'grid';
const INITIAL_MODE: ViewMode = Platform.OS === 'web' ? 'grid' : '3d';

export function CommunityExplorer() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { myCommunities, allCommunities, loading, refresh } = useBlockchain();
  const [viewMode, setViewMode] = useState<ViewMode>(INITIAL_MODE);
  const [searchQuery, setSearchQuery] = useState('');

  // Split communities into mine vs discoverable
  const myComms = myCommunities.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const openComms = allCommunities.filter(c =>
    !c.isMember && c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Build 3D nodes from real data
  const communityNodes: CommunityNode[] = [
    ...myComms.map(c => ({
      id: c.address, name: c.name, memberCount: c.memberCount,
      address: c.address, category: 'membership' as const,
    })),
    ...openComms.map(c => ({
      id: c.address, name: c.name, memberCount: c.memberCount,
      address: c.address, category: 'open' as const,
    })),
  ];

  const handleSelectCommunity = useCallback((_community: { address: string }) => {
    // Navigate to Profile tab (which shows memberships) — stays within tabs
    navigation.getParent()?.navigate('Profile');
  }, [navigation]);

  // ─── Empty state ────────────────────────────────────────────────
  const isEmpty = allCommunities.length === 0 && !loading;

  // ─── 3D View ────────────────────────────────────────────────────
  if (viewMode === '3d' && communityNodes.length > 0) {
    return (
      <View style={styles.container3d}>
        <Suspense fallback={
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0E14' }}>
            <ActivityIndicator size="large" color="#4ECDC4" />
            <Text style={{ color: '#4ECDC4', marginTop: 12 }}>Loading 3D Explorer...</Text>
          </View>
        }>
          <ExplorerScene communities={communityNodes} onSelectCommunity={handleSelectCommunity} />
        </Suspense>
        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          <View style={styles.overlayHeader} pointerEvents="auto">
            <Text style={styles.headerTitle}>Community Explorer</Text>
            <TouchableOpacity style={styles.viewToggle} onPress={() => setViewMode('grid')}>
              <Text style={styles.viewToggleText}>Grid</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.overlayBottom} pointerEvents="auto">
            <TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate('FoundCommunity')}>
              <Text style={styles.createButtonText}>CREATE</Text>
              <Text style={styles.createPlus}>+</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── Grid View ──────────────────────────────────────────────────
  const renderMyCard = ({ item }: { item: typeof myComms[0] }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleSelectCommunity(item)}>
      <View style={[styles.cardImage, { backgroundColor: '#1A3A3A' }]}>
        <Text style={styles.cardInitial}>{item.name[0]}</Text>
        {item.isFounder && <Text style={styles.founderBadge}>FOUNDER</Text>}
      </View>
      <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.cardMembers}>{item.memberCount} members</Text>
    </TouchableOpacity>
  );

  const renderOpenCard = ({ item }: { item: typeof openComms[0] }) => (
    <View style={styles.card}>
      <View style={[styles.cardImage, { backgroundColor: '#3A3A1A' }]}>
        <Text style={styles.cardInitial}>{item.name[0]}</Text>
      </View>
      <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.cardMembers}>{item.memberCount} members</Text>
      <TouchableOpacity style={styles.applyButton}>
        <Text style={styles.applyButtonText}>Apply to Join</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.containerGrid} edges={['bottom']}>
      <View style={styles.gridHeader}>
        <Text style={styles.headerTitle}>Community Explorer</Text>
        {communityNodes.length > 0 && (
          <TouchableOpacity style={styles.viewToggle} onPress={() => setViewMode('3d')}>
            <Text style={styles.viewToggleText}>3D</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search communities..."
        placeholderTextColor="#484F58"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#4ECDC4" size="small" />
          <Text style={styles.loadingText}>Fetching communities...</Text>
        </View>
      )}

      {isEmpty && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Communities Yet</Text>
          <Text style={styles.emptySubtitle}>Be the first to found one!</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('FoundCommunity')}>
            <Text style={styles.emptyButtonText}>+ Found Community</Text>
          </TouchableOpacity>
        </View>
      )}

      {myComms.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>MY MEMBERSHIPS ({myComms.length})</Text>
          <FlatList horizontal data={myComms} renderItem={renderMyCard}
            keyExtractor={i => i.address} showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList} />
        </>
      )}

      {openComms.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>OPEN TO JOIN ({openComms.length})</Text>
          <FlatList horizontal data={openComms} renderItem={renderOpenCard}
            keyExtractor={i => `o-${i.address}`} showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList} />
        </>
      )}

      <View style={styles.gridFooter}>
        <TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate('FoundCommunity')}>
          <Text style={styles.createButtonText}>CREATE</Text>
          <Text style={styles.createPlus}>+</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container3d: { flex: 1, backgroundColor: '#0A0E14' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 16 },
  overlayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overlayBottom: { gap: 12 },
  containerGrid: { flex: 1, backgroundColor: '#0D1117', padding: 16 },
  gridHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#4ECDC4' },
  viewToggle: { backgroundColor: '#161B2288', borderWidth: 1, borderColor: '#4ECDC4', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  viewToggleText: { color: '#4ECDC4', fontSize: 12, fontWeight: '600' },
  searchInput: { backgroundColor: '#161B22', borderRadius: 10, padding: 12, color: '#E6EDF3', fontSize: 14, borderWidth: 1, borderColor: '#30363D', marginBottom: 12 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  loadingText: { color: '#484F58', fontSize: 13 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#E6EDF3', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#484F58', fontSize: 14, marginBottom: 24 },
  emptyButton: { backgroundColor: '#4ECDC4', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10 },
  emptyButtonText: { color: '#0D1117', fontSize: 16, fontWeight: '600' },
  sectionTitle: { color: '#8B949E', fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 10, marginTop: 8 },
  horizontalList: { paddingBottom: 12, gap: 12 },
  card: { width: 150, backgroundColor: '#161B22', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#30363D' },
  cardImage: { height: 80, justifyContent: 'center', alignItems: 'center' },
  cardInitial: { fontSize: 32, color: '#4ECDC4', fontWeight: '700' },
  founderBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: '#4ECDC4', color: '#0D1117', fontSize: 8, fontWeight: '700', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, overflow: 'hidden' },
  cardName: { color: '#E6EDF3', fontSize: 13, fontWeight: '600', padding: 8, paddingBottom: 2 },
  cardMembers: { color: '#484F58', fontSize: 11, paddingHorizontal: 8, paddingBottom: 4 },
  applyButton: { backgroundColor: '#0D2D2A', margin: 6, marginTop: 0, padding: 6, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#4ECDC4' },
  applyButtonText: { color: '#4ECDC4', fontSize: 11, fontWeight: '600' },
  gridFooter: { paddingTop: 12 },
  createButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#161B22CC', borderWidth: 1, borderColor: '#4ECDC4', borderRadius: 10, padding: 14, gap: 8 },
  createButtonText: { color: '#4ECDC4', fontSize: 14, fontWeight: '600', letterSpacing: 2 },
  createPlus: { color: '#4ECDC4', fontSize: 20, fontWeight: '700' },
});
