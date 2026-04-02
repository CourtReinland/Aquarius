import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Histories Explorer - matching mockup 13histories.svg
 *
 * Shows the community's blockchain event history chronologically.
 * Each block group shows: event description + timestamp
 * With expandable block detail.
 */

interface HistoryEvent {
  description: string;
  timestamp: string;
}

interface HistoryBlock {
  events: HistoryEvent[];
}

const MOCK_HISTORY: HistoryBlock[] = [
  {
    events: [
      { description: 'Community was created by founder(s)', timestamp: '05/14/24 1:03' },
      { description: 'Community charter was approved', timestamp: '05/14/24 2:15' },
      { description: 'Community was nested within the laws of the State of New York', timestamp: '05/14/24 2:20' },
    ],
  },
  {
    events: [
      { description: "New member 'Sophia Coppola' was admitted by a vote of the members", timestamp: '05/15/24 16:03' },
      { description: "New member 'Ingmar Bergman' was admitted by a vote of the members", timestamp: '05/15/24 18:45' },
      { description: 'Proposal to create a pizza institution and purchase a pizza making machine PASSED', timestamp: '05/15/24 19:39' },
    ],
  },
  {
    events: [
      { description: "Motion to appoint 'Gordon Ramsey' as pizza chef has FAILED", timestamp: '05/16/24 12:09' },
      { description: 'Motion to purchase large display fountain and sculpture has FAILED', timestamp: '05/16/24 14:45' },
      { description: "Motion to appoint 'Wolfgang Puck' as pizza chef has PASSED", timestamp: '05/16/24 16:35' },
    ],
  },
];

export function HistoriesExplorer() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Histories Explorer</Text>
        </View>

        {/* Community tag */}
        <View style={styles.communityRow}>
          <Text style={styles.communityLabel}>COMMUNITY BLOCK RECORD FOR:</Text>
          <View style={styles.communityTag}>
            <Text style={styles.communityTagText}>TRANTOR</Text>
          </View>
        </View>

        {/* History blocks */}
        {MOCK_HISTORY.map((block, blockIdx) => (
          <View key={blockIdx} style={styles.blockCard}>
            {block.events.map((event, eventIdx) => (
              <View key={eventIdx} style={styles.eventRow}>
                <Text style={styles.eventDesc}>{event.description}</Text>
                <View style={styles.timestampBadge}>
                  <Text style={styles.timestampText}>{event.timestamp}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.expandRow}>
              <Text style={styles.expandText}>EXPAND BLOCK DETAIL</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  scroll: { padding: 16, gap: 12 },
  header: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#30363D' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#4ECDC4' },
  communityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    backgroundColor: '#7B68EE22', padding: 8, borderRadius: 6,
  },
  communityLabel: { color: '#8B949E', fontSize: 10, letterSpacing: 1 },
  communityTag: { backgroundColor: '#7B68EE33', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  communityTagText: { color: '#7B68EE', fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  blockCard: {
    backgroundColor: '#161B22', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#30363D', gap: 8,
  },
  eventRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 4, gap: 8,
  },
  eventDesc: { color: '#C9D1D9', fontSize: 12, flex: 1, lineHeight: 18 },
  timestampBadge: {
    backgroundColor: '#21262D', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4,
  },
  timestampText: { color: '#E6EDF3', fontSize: 10, fontFamily: 'monospace' },
  expandRow: { alignItems: 'flex-end', marginTop: 4 },
  expandText: { color: '#4ECDC4', fontSize: 10, letterSpacing: 1, fontWeight: '600' },
});
