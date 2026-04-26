import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// Slider replaced with custom button-based selector (no external dep needed)

/**
 * Banking Setup screen - matching mockup 12banking.svg
 *
 * Fields:
 * - Starting Token Amount (text input)
 * - Banking Style dropdown: Austrian (Strict) | Keynesian (Fractional Reserve)
 * - Allow Arbitrary Token Creation (toggle Y/N)
 * - Allow Fractional Lending (toggle Y/N)
 * - Allowed Banking Leverage Ratio (slider 1/1 → 9/1)
 */

export function BankingSetup() {
  const insets = useSafeAreaInsets();
  const [tokenAmount, setTokenAmount] = useState('33000000');
  const [bankingStyle, setBankingStyle] = useState<'austrian' | 'keynesian'>('austrian');
  const [allowArbitrary, setAllowArbitrary] = useState(false);
  const [allowFractional, setAllowFractional] = useState(false);
  const [leverageRatio, setLeverageRatio] = useState(1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 100 + insets.bottom },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Banking Setup</Text>
        </View>

        {/* Starting Token Amount */}
        <Text style={styles.label}>Starting Token Amount</Text>
        <TextInput
          style={styles.input}
          value={tokenAmount}
          onChangeText={setTokenAmount}
          keyboardType="numeric"
          placeholder="33,000,000"
          placeholderTextColor="#484F58"
        />

        {/* Banking Style */}
        <Text style={styles.label}>Banking Style</Text>
        <View style={styles.optionGroup}>
          <TouchableOpacity
            style={[styles.option, bankingStyle === 'austrian' && styles.optionSelected]}
            onPress={() => setBankingStyle('austrian')}
          >
            <Text style={styles.optionText}>Austrian (Strict)</Text>
            <Text style={styles.optionDesc}>No money creation beyond initial supply</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.option, bankingStyle === 'keynesian' && styles.optionSelected]}
            onPress={() => setBankingStyle('keynesian')}
          >
            <Text style={styles.optionText}>Keynesian (Fractional Reserve)</Text>
            <Text style={styles.optionDesc}>Bank can lend more than it holds in reserve</Text>
          </TouchableOpacity>
        </View>

        {/* Toggle: Arbitrary Token Creation */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabel}>
            <Text style={styles.toggleTitle}>Allow Arbitrary Token Creation</Text>
            <Text style={styles.toggleHint}>Y/N</Text>
          </View>
          <Switch
            value={allowArbitrary}
            onValueChange={setAllowArbitrary}
            trackColor={{ false: '#30363D', true: '#4ECDC4' }}
            thumbColor={allowArbitrary ? '#0D1117' : '#8B949E'}
          />
        </View>

        {/* Toggle: Fractional Lending */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabel}>
            <Text style={styles.toggleTitle}>Allow Fractional Lending</Text>
            <Text style={styles.toggleHint}>Y/N</Text>
          </View>
          <Switch
            value={allowFractional}
            onValueChange={setAllowFractional}
            trackColor={{ false: '#30363D', true: '#4ECDC4' }}
            thumbColor={allowFractional ? '#0D1117' : '#8B949E'}
          />
        </View>

        {/* Leverage Ratio Slider */}
        <Text style={styles.label}>Allowed Banking Leverage Ratio</Text>
        <View style={styles.sliderContainer}>
          <View style={styles.sliderLabels}>
            {['1/1', '2/1', '4/1', '6/1', '9/1'].map((l) => (
              <Text key={l} style={styles.sliderTick}>{l}</Text>
            ))}
          </View>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${((leverageRatio - 1) / 8) * 100}%` }]} />
            <View style={[styles.sliderThumb, { left: `${((leverageRatio - 1) / 8) * 100}%` }]} />
          </View>
          <TouchableOpacity style={styles.ratioRow} onPress={() => {}}>
            {[1, 2, 4, 6, 9].map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.ratioBtn, leverageRatio === r && styles.ratioBtnSelected]}
                onPress={() => setLeverageRatio(r)}
              >
                <Text style={[styles.ratioBtnText, leverageRatio === r && styles.ratioBtnTextSelected]}>
                  {r}/1
                </Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Configuration Summary</Text>
          <Text style={styles.summaryItem}>Tokens: {Number(tokenAmount).toLocaleString()}</Text>
          <Text style={styles.summaryItem}>Style: {bankingStyle === 'austrian' ? 'Austrian (Strict)' : 'Keynesian'}</Text>
          <Text style={styles.summaryItem}>Arbitrary creation: {allowArbitrary ? 'Yes' : 'No'}</Text>
          <Text style={styles.summaryItem}>Fractional lending: {allowFractional ? 'Yes' : 'No'}</Text>
          <Text style={styles.summaryItem}>Leverage: {leverageRatio}/1</Text>
        </View>
      </ScrollView>

      {/* Deploy button */}
      <View
        style={[
          styles.footer,
          { paddingBottom: 16 + insets.bottom },
        ]}
      >
        <TouchableOpacity style={styles.deployButton}>
          <Text style={styles.deployButtonText}>Deploy Community Bank</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  scroll: { padding: 16, paddingBottom: 100, gap: 4 },
  header: { paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#30363D', marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#4ECDC4' },
  label: { color: '#E6EDF3', fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: {
    backgroundColor: '#161B22', borderWidth: 1, borderColor: '#4ECDC4',
    borderRadius: 8, padding: 14, color: '#E6EDF3', fontSize: 18,
    fontFamily: 'monospace', fontWeight: '600',
  },
  optionGroup: { gap: 8 },
  option: {
    backgroundColor: '#161B22', borderWidth: 1, borderColor: '#30363D',
    borderRadius: 8, padding: 14,
  },
  optionSelected: { borderColor: '#4ECDC4', backgroundColor: '#0D2D2A' },
  optionText: { color: '#E6EDF3', fontSize: 15, fontWeight: '600' },
  optionDesc: { color: '#484F58', fontSize: 11, marginTop: 4 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#161B22', borderRadius: 8, padding: 14,
    borderWidth: 1, borderColor: '#30363D', marginTop: 12,
  },
  toggleLabel: { flex: 1 },
  toggleTitle: { color: '#E6EDF3', fontSize: 14, fontWeight: '600' },
  toggleHint: { color: '#484F58', fontSize: 11 },
  sliderContainer: { marginTop: 8 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sliderTick: { color: '#8B949E', fontSize: 12, fontFamily: 'monospace' },
  sliderTrack: {
    height: 6, backgroundColor: '#30363D', borderRadius: 3, marginBottom: 12,
  },
  sliderFill: { height: '100%', backgroundColor: '#7B68EE', borderRadius: 3 },
  sliderThumb: {
    position: 'absolute', top: -5, width: 16, height: 16,
    borderRadius: 8, backgroundColor: '#4ECDC4', marginLeft: -8,
  },
  ratioRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  ratioBtn: {
    flex: 1, backgroundColor: '#161B22', borderWidth: 1, borderColor: '#30363D',
    borderRadius: 6, padding: 8, alignItems: 'center',
  },
  ratioBtnSelected: { borderColor: '#4ECDC4', backgroundColor: '#0D2D2A' },
  ratioBtnText: { color: '#8B949E', fontSize: 13, fontFamily: 'monospace' },
  ratioBtnTextSelected: { color: '#4ECDC4', fontWeight: '700' },
  summaryCard: {
    backgroundColor: '#161B22', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#30363D', marginTop: 20, gap: 4,
  },
  summaryTitle: { color: '#4ECDC4', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  summaryItem: { color: '#C9D1D9', fontSize: 13, fontFamily: 'monospace' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#0D1117', borderTopWidth: 1, borderTopColor: '#30363D',
  },
  deployButton: { backgroundColor: '#4ECDC4', padding: 16, borderRadius: 10, alignItems: 'center' },
  deployButtonText: { color: '#0D1117', fontSize: 16, fontWeight: '700' },
});
