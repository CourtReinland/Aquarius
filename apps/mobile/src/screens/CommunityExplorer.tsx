import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  ExplorerScene,
  type CommunityNode,
} from '../components/explorer3d/ExplorerScene';

/**
 * Community Explorer - the main discovery screen.
 *
 * Two modes:
 * 1. 3D View: Floating islands in a cosmic space (default on capable devices)
 * 2. Grid View: 2D card grid fallback (list mode or low-end devices)
 *
 * Matches mockup 00comexplorer.svg:
 * - "Community Explorer" header with search
 * - MY MEMBERSHIPS section
 * - TRENDING COMMUNITIES section
 * - CURRENTLY OPEN COMMUNITIES section
 * - CREATE + button
 * - Bottom nav bar (handled by tab navigator)
 */

// Sample data - will be replaced with blockchain reads
const SAMPLE_COMMUNITIES: CommunityNode[] = [
  { id: '1', name: 'Alpha Centauri', memberCount: 67, address: '0x1', category: 'membership' },
  { id: '2', name: 'Trantor', memberCount: 142, address: '0x2', category: 'membership' },
  { id: '3', name: 'Equanimity', memberCount: 31, address: '0x3', category: 'membership' },
  { id: '4', name: 'Skateville', memberCount: 60, address: '0x4', category: 'trending' },
  { id: '5', name: 'Brightplace', memberCount: 89, address: '0x5', category: 'trending' },
  { id: '6', name: 'New Eden', memberCount: 24, address: '0x6', category: 'trending' },
  { id: '7', name: 'Solarpunk Co', memberCount: 112, address: '0x7', category: 'open' },
  { id: '8', name: 'The Commons', memberCount: 45, address: '0x8', category: 'open' },
  { id: '9', name: 'Arcadia', memberCount: 78, address: '0x9', category: 'open' },
];

type ViewMode = '3d' | 'grid';

export function CommunityExplorer() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCommunities = SAMPLE_COMMUNITIES.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectCommunity = useCallback(
    (community: CommunityNode) => {
      navigation.navigate('CommunityDashboard', { address: community.address });
    },
    [navigation]
  );

  // ─── 3D View ────────────────────────────────────────────────────

  if (viewMode === '3d') {
    return (
      <View style={styles.container3d}>
        {/* 3D Scene fills background */}
        <ExplorerScene
          communities={filteredCommunities}
          onSelectCommunity={handleSelectCommunity}
        />

        {/* Overlay UI */}
        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          {/* Header */}
          <View style={styles.overlayHeader} pointerEvents="auto">
            <Text style={styles.headerTitle}>Community Explorer</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.viewToggle}
                onPress={() => setViewMode('grid')}
              >
                <Text style={styles.viewToggleText}>Grid</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.searchButton}>
                <Text style={styles.searchIcon}>Q</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search bar (expandable) */}
          <View style={styles.overlaySearch} pointerEvents="auto">
            <TextInput
              style={styles.searchInput}
              placeholder="Search communities..."
              placeholderTextColor="#484F58"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Bottom: stats + create button */}
          <View style={styles.overlayBottom} pointerEvents="auto">
            <View style={styles.statsRow}>
              <View style={styles.statBadge}>
                <Text style={styles.statNumber}>{filteredCommunities.length}</Text>
                <Text style={styles.statLabel}>Communities</Text>
              </View>
              <View style={styles.statBadge}>
                <Text style={styles.statNumber}>
                  {filteredCommunities.reduce((sum, c) => sum + c.memberCount, 0)}
                </Text>
                <Text style={styles.statLabel}>Total Members</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('FoundCommunity')}
            >
              <Text style={styles.createButtonText}>CREATE</Text>
              <Text style={styles.createPlus}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Legend */}
          <View style={styles.legend} pointerEvents="auto">
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#4ECDC4' }]} />
              <Text style={styles.legendText}>My Communities</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#7B68EE' }]} />
              <Text style={styles.legendText}>Trending</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F0C040' }]} />
              <Text style={styles.legendText}>Open</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── Grid View (2D fallback) ────────────────────────────────────

  const myComms = filteredCommunities.filter((c) => c.category === 'membership');
  const trending = filteredCommunities.filter((c) => c.category === 'trending');
  const open = filteredCommunities.filter((c) => c.category === 'open');

  const renderCard = ({ item }: { item: CommunityNode }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleSelectCommunity(item)}
    >
      <View
        style={[
          styles.cardImage,
          {
            backgroundColor:
              item.category === 'membership'
                ? '#1A3A3A'
                : item.category === 'trending'
                ? '#2A1A3A'
                : '#3A3A1A',
          },
        ]}
      >
        <Text style={styles.cardInitial}>{item.name[0]}</Text>
      </View>
      <Text style={styles.cardName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.cardMembers}>{item.memberCount} members</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.containerGrid} edges={['bottom']}>
      {/* Header */}
      <View style={styles.gridHeader}>
        <Text style={styles.headerTitle}>Community Explorer</Text>
        <TouchableOpacity
          style={styles.viewToggle}
          onPress={() => setViewMode('3d')}
        >
          <Text style={styles.viewToggleText}>3D</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.gridSearch}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search communities..."
          placeholderTextColor="#484F58"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Sections */}
      <View style={{ flex: 1 }}>
        {myComms.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>MY MEMBERSHIPS</Text>
            <FlatList
              horizontal
              data={myComms}
              renderItem={renderCard}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </>
        )}

        {trending.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>TRENDING COMMUNITIES</Text>
            <FlatList
              horizontal
              data={trending}
              renderItem={renderCard}
              keyExtractor={(item) => `t-${item.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </>
        )}

        {open.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>CURRENTLY OPEN COMMUNITIES</Text>
            <FlatList
              horizontal
              data={open}
              renderItem={renderCard}
              keyExtractor={(item) => `o-${item.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </>
        )}
      </View>

      {/* Create button */}
      <View style={styles.gridFooter}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('FoundCommunity')}
        >
          <Text style={styles.createButtonText}>CREATE</Text>
          <Text style={styles.createPlus}>+</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ─── 3D View ──────────────────────────────────────
  container3d: { flex: 1, backgroundColor: '#0A0E14' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 16,
  },
  overlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4ECDC4',
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  viewToggle: {
    backgroundColor: '#161B2288',
    borderWidth: 1,
    borderColor: '#4ECDC4',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewToggleText: { color: '#4ECDC4', fontSize: 12, fontWeight: '600' },
  searchButton: {
    backgroundColor: '#4ECDC4',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: { color: '#0D1117', fontWeight: '700', fontSize: 14 },
  overlaySearch: { marginTop: 8 },
  searchInput: {
    backgroundColor: '#161B22CC',
    borderRadius: 10,
    padding: 12,
    color: '#E6EDF3',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  overlayBottom: {
    gap: 12,
  },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBadge: {
    backgroundColor: '#161B22CC',
    borderRadius: 8,
    padding: 10,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  statNumber: { color: '#4ECDC4', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#484F58', fontSize: 10, marginTop: 2 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161B22CC',
    borderWidth: 1,
    borderColor: '#4ECDC4',
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  createButtonText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
  },
  createPlus: {
    color: '#4ECDC4',
    fontSize: 20,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#4ECDC4',
    borderRadius: 4,
    width: 24,
    height: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#484F58', fontSize: 10 },

  // ─── Grid View ────────────────────────────────────
  containerGrid: { flex: 1, backgroundColor: '#0D1117', padding: 16 },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridSearch: { marginBottom: 16 },
  sectionTitle: {
    color: '#8B949E',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 8,
  },
  horizontalList: { paddingBottom: 12, gap: 12 },
  card: {
    width: 140,
    backgroundColor: '#161B22',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  cardImage: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInitial: { fontSize: 36, color: '#4ECDC4', fontWeight: '700' },
  cardName: {
    color: '#E6EDF3',
    fontSize: 13,
    fontWeight: '600',
    padding: 8,
    paddingBottom: 2,
  },
  cardMembers: {
    color: '#484F58',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  gridFooter: { paddingTop: 12 },
});
