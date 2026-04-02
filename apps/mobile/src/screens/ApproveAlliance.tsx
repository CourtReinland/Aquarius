import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Approve Alliance screen - matching mockup 11approve-alliance.svg
 *
 * Shown when another community proposes an alliance.
 * Lists what members will inherit, and Accept/Decline buttons.
 */

export function ApproveAlliance() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Fireworks */}
        <View style={styles.fireworksArea}>
          <Text style={styles.sparkle}>*  .  *  .  *</Text>
        </View>

        <Text style={styles.title}>Approve Alliance?</Text>

        {/* From / To communities */}
        <View style={styles.commRow}>
          <Text style={styles.commLabel}>Dear</Text>
          <View style={styles.commTag}>
            <Text style={styles.commTagText}>CINCINNATI SKATELAND</Text>
          </View>
        </View>

        <View style={styles.commRow}>
          <Text style={styles.commLabel}>The community of</Text>
          <View style={[styles.commTag, { borderColor: '#4ECDC4' }]}>
            <Text style={[styles.commTagText, { color: '#4ECDC4' }]}>ALPHA CENTAURI</Text>
          </View>
          <Text style={styles.commLabel}>invite you to join them in an alliance</Text>
        </View>

        {/* Inheritance details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>You will inherit:</Text>

          <View style={styles.detailItem}>
            <Text style={styles.detailBullet}>500 Alpha Centauri tokens per member</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailBullet}>
              Be able to travel freely in their community's lands and zones.
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailBullet}>Voting rights on certain proposals</Text>
          </View>

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  scroll: { padding: 24, justifyContent: 'center', flexGrow: 1 },
  fireworksArea: { alignItems: 'center', marginBottom: 12 },
  sparkle: { color: '#F0C040', fontSize: 16, letterSpacing: 6 },
  title: { fontSize: 26, fontWeight: '700', color: '#4ECDC4', textAlign: 'center', marginBottom: 24 },
  commRow: { alignItems: 'center', gap: 8, marginBottom: 8 },
  commLabel: { color: '#C9D1D9', fontSize: 14, textAlign: 'center' },
  commTag: {
    borderWidth: 1, borderColor: '#7B68EE', borderRadius: 4,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  commTagText: { color: '#7B68EE', fontWeight: '700', fontFamily: 'monospace', fontSize: 13 },
  detailsCard: {
    backgroundColor: '#161B22', borderRadius: 12, padding: 20, marginTop: 20,
    borderWidth: 1, borderColor: '#7B68EE',
  },
  detailsTitle: { color: '#E6EDF3', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  detailItem: {
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#21262D',
  },
  detailBullet: { color: '#C9D1D9', fontSize: 13, lineHeight: 20 },
  expandBtn: { alignItems: 'flex-end', marginTop: 8 },
  expandText: { color: '#7B68EE', fontSize: 10, letterSpacing: 1 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
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
