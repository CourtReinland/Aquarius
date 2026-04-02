import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Congratulations / Role Election screen - matching mockup 10congrats.svg
 *
 * Shown when community members elect you to a role.
 * Displays role details and Accept/Decline buttons.
 */

export function CongratsRole() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Fireworks header */}
      <View style={styles.fireworksArea}>
        <Text style={styles.sparkle}>*  .  *  .  *</Text>
        <Text style={styles.congratsTitle}>Congratulations!</Text>
        <Text style={styles.sparkle}>*  .  *  .  *</Text>
      </View>

      {/* Election info */}
      <View style={styles.electionCard}>
        <Text style={styles.electionText}>Your fellow community members in</Text>
        <View style={styles.communityTag}>
          <Text style={styles.communityTagText}>ALPHA CENTAURI</Text>
        </View>
        <Text style={styles.electionText}>have elected you to the role of:</Text>
      </View>

      {/* Role details */}
      <View style={styles.roleCard}>
        <Text style={styles.roleTitle}>Kindergarten Headmaster</Text>
        <Text style={styles.roleDetail}>
          The role pays 400 TOKENS/day.{'\n'}
          With an expected 5.5hr workday, M-F.
        </Text>
        <View style={styles.roleDivider} />
        <Text style={styles.roleDetail}>
          This role also comes with a 10 share stake in the Kindergarten Institution.
        </Text>
        <TouchableOpacity style={styles.expandBtn}>
          <Text style={styles.expandText}>EXPAND</Text>
        </TouchableOpacity>
      </View>

      {/* Accept / Decline */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.acceptButton}>
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.declineButton}>
          <Text style={styles.declineText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117', padding: 24, justifyContent: 'center' },
  fireworksArea: { alignItems: 'center', marginBottom: 24 },
  sparkle: { color: '#F0C040', fontSize: 16, letterSpacing: 6 },
  congratsTitle: { fontSize: 28, fontWeight: '700', color: '#4ECDC4', marginVertical: 8 },
  electionCard: { alignItems: 'center', gap: 8, marginBottom: 20 },
  electionText: { color: '#C9D1D9', fontSize: 14, textAlign: 'center' },
  communityTag: {
    backgroundColor: '#4ECDC422', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: '#4ECDC4',
  },
  communityTagText: { color: '#4ECDC4', fontWeight: '700', fontFamily: 'monospace', fontSize: 13 },
  roleCard: {
    backgroundColor: '#161B22', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#7B68EE', marginBottom: 24,
  },
  roleTitle: { color: '#E6EDF3', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  roleDetail: { color: '#C9D1D9', fontSize: 13, lineHeight: 20 },
  roleDivider: { height: 1, backgroundColor: '#30363D', marginVertical: 12 },
  expandBtn: { alignItems: 'flex-end', marginTop: 8 },
  expandText: { color: '#7B68EE', fontSize: 10, letterSpacing: 1 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  acceptButton: {
    flex: 1, backgroundColor: '#4ECDC4', padding: 16, borderRadius: 10, alignItems: 'center',
  },
  acceptText: { color: '#0D1117', fontSize: 16, fontWeight: '700' },
  declineButton: {
    flex: 1, backgroundColor: '#21262D', padding: 16, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#8B949E',
  },
  declineText: { color: '#8B949E', fontSize: 16, fontWeight: '600' },
});
