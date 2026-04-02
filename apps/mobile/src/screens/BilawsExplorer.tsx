import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Bi-laws Explorer - matching mockup 08bilaws.svg
 *
 * Shows community stats, constitution/banking style,
 * institution tracker cards, and financial summary.
 */

export function BilawsExplorer() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Bi-laws Explorer</Text>
        </View>

        {/* Community name */}
        <Text style={styles.communityName}>TRANTOR</Text>

        {/* Charter button */}
        <TouchableOpacity style={styles.charterBtn}>
          <Text style={styles.charterBtnText}>View Charter</Text>
          <Text style={styles.expandHint}>EXPAND</Text>
        </TouchableOpacity>

        {/* Constitution & Banking Style */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Constitution Style</Text>
          <View style={styles.infoBadge}><Text style={styles.infoBadgeText}>American</Text></View>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Banking Style</Text>
          <View style={styles.infoBadge}><Text style={styles.infoBadgeText}>Austrian (Strict)</Text></View>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Stats</Text>
          <Text style={styles.statItem}>Founders 3</Text>
          <Text style={styles.statItem}>Total Members 67</Text>
          <Text style={styles.statItem}>Total Number of Institutions 11</Text>
        </View>

        {/* Institution Tracker */}
        <Text style={styles.sectionLabel}>INSTITUTION TRACKER</Text>
        <View style={styles.institutionRow}>
          <View style={styles.institutionCard}>
            <Text style={styles.instName}>Pizza Foundry</Text>
            <View style={styles.instStat}><Text style={styles.instLabel}>PAYS DIVIDENDS?</Text><Text style={styles.instValueY}>Y</Text></View>
            <View style={styles.instStat}><Text style={styles.instLabel}>PROFITABLE?</Text><Text style={styles.instValueY}>Y</Text></View>
            <View style={styles.instStat}><Text style={styles.instLabel}>YEARLY REVENUE</Text><Text style={styles.instValueNum}>150008</Text></View>
            <View style={styles.instStat}><Text style={styles.instLabel}># OF SHAREHOLDERS</Text><Text style={styles.instValueNum}>14</Text></View>
          </View>
          <View style={styles.institutionCard}>
            <Text style={styles.instName}>Kindergarten</Text>
            <View style={styles.instStat}><Text style={styles.instLabel}>PAYS DIVIDENDS?</Text><Text style={styles.instValueN}>N</Text></View>
            <View style={styles.instStat}><Text style={styles.instLabel}>PROFITABLE?</Text><Text style={styles.instValueY}>Y</Text></View>
            <View style={styles.instStat}><Text style={styles.instLabel}>YEARLY REVENUE</Text><Text style={styles.instValueNum}>30000</Text></View>
            <View style={styles.instStat}><Text style={styles.instLabel}># OF SHAREHOLDERS</Text><Text style={styles.instValueNum}>6</Text></View>
          </View>
        </View>

        {/* Financial Summary */}
        <View style={styles.finCard}>
          <View style={styles.finRow}>
            <Text style={styles.finLabel}>CURRENT BANK HELD TOKENS</Text>
            <View style={styles.finBadge}><Text style={styles.finValue}>230042</Text></View>
          </View>
          <View style={styles.finRow}>
            <Text style={styles.finLabel}>CURRENT BANK HELD ETH</Text>
            <View style={styles.finBadge}><Text style={styles.finValue}>3001</Text></View>
          </View>
          <Text style={styles.finMeta}>ALLOWS FRACTIONAL RESERVE BANKING?  <Text style={styles.finMetaVal}>NO</Text></Text>
          <Text style={styles.finMeta}>FISCAL SOLVENCY SCORE  <Text style={styles.finMetaGreen}>96</Text></Text>
          <Text style={styles.finMeta}>CREDIT RATING (EXTERNAL)  <Text style={styles.finMetaGold}>AAA+</Text></Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  scroll: { padding: 16, gap: 8 },
  header: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#30363D' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#4ECDC4' },
  communityName: { fontSize: 24, fontWeight: '700', color: '#E6EDF3', letterSpacing: 2, marginTop: 8 },
  charterBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#4ECDC4', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8,
  },
  charterBtnText: { color: '#0D1117', fontWeight: '700', fontSize: 14 },
  expandHint: { color: '#0D111788', fontSize: 10, letterSpacing: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  infoLabel: { color: '#8B949E', fontSize: 13 },
  infoBadge: { backgroundColor: '#21262D', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4 },
  infoBadgeText: { color: '#E6EDF3', fontSize: 13, fontFamily: 'monospace' },
  statsCard: {
    backgroundColor: '#4ECDC422', borderRadius: 8, padding: 12, marginTop: 12, gap: 2,
  },
  statsTitle: { color: '#4ECDC4', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  statItem: { color: '#C9D1D9', fontSize: 13 },
  sectionLabel: {
    color: '#4ECDC4', fontSize: 11, fontWeight: '700', letterSpacing: 1,
    marginTop: 16, backgroundColor: '#4ECDC422', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 4, alignSelf: 'flex-start',
  },
  institutionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  institutionCard: {
    flex: 1, backgroundColor: '#161B22', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#30363D', gap: 3,
  },
  instName: { color: '#E6EDF3', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  instStat: { flexDirection: 'row', justifyContent: 'space-between' },
  instLabel: { color: '#484F58', fontSize: 9, fontFamily: 'monospace' },
  instValueY: { color: '#4ECDC4', fontSize: 10, fontWeight: '700' },
  instValueN: { color: '#F85149', fontSize: 10, fontWeight: '700' },
  instValueNum: { color: '#4ECDC4', fontSize: 10, fontFamily: 'monospace' },
  finCard: {
    backgroundColor: '#161B22', borderRadius: 10, padding: 14, marginTop: 12,
    borderWidth: 1, borderColor: '#30363D', gap: 6,
  },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  finLabel: { color: '#8B949E', fontSize: 11, fontFamily: 'monospace' },
  finBadge: { backgroundColor: '#21262D', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4 },
  finValue: { color: '#E6EDF3', fontSize: 16, fontWeight: '700', fontFamily: 'monospace' },
  finMeta: { color: '#484F58', fontSize: 10, fontFamily: 'monospace' },
  finMetaVal: { color: '#F85149' },
  finMetaGreen: { color: '#4ECDC4' },
  finMetaGold: { color: '#F0C040' },
});
