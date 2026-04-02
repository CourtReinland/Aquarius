import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Proposals Tracker - matching mockup 09proposals.svg
 *
 * Shows upcoming votes across all communities the user belongs to.
 * Each proposal card shows:
 * - Community name tag (colored)
 * - Proposal description
 * - Requirements (quorum type, funding, share allocation)
 * - Vote Now button with countdown timer
 * - Expandable detail
 */

interface ProposalCardData {
  id: string;
  communityName: string;
  communityColor: string;
  title: string;
  description: string;
  requirements: string[];
  timeRemaining: string;
  yesVotes: number;
  noVotes: number;
  fundingCostEth: string;
  status: 'active' | 'passed' | 'failed';
}

const MOCK_PROPOSALS: ProposalCardData[] = [
  {
    id: '1',
    communityName: 'TRANTOR',
    communityColor: '#7B68EE',
    title: 'Proposal to create a kindergarten institution',
    description:
      "appoint 'Emma Stone' as headmaster,\nHeadmaster compensation 400 TOKENS /day\nAttendance will cost 20 TOKENS per pupil/day\nAnticipated maintenance cost per/anum 300 ETH",
    requirements: [
      '51% majority required to PASS',
      'A YES vote requires immediate payment of .05 ETH',
      'Each YES vote receives institutional shares as percentage of total YES votes',
    ],
    timeRemaining: '23hrs 10mins 11secs',
    yesVotes: 12,
    noVotes: 3,
    fundingCostEth: '0.05',
    status: 'active',
  },
  {
    id: '2',
    communityName: 'ALPHA CENTAURI',
    communityColor: '#4ECDC4',
    title: 'Proposal to create a coffee shop institution',
    description:
      "staffed by a Baxter robot, managed by 'Dominique Ansel'. Manager compensation will be 25% of REVENUE\nBagels cost 1 TOKEN/ea, Pastries cost 2 TOKENs/ea.\nCoffees cost 1.5 TOKEN ea.",
    requirements: [
      'SIMPLE majority of votes cast required to PASS',
      'A minimum quorum of 63 votes required for funding.',
      'Each YES vote receives institutional shares as percentage of total YES votes.',
    ],
    timeRemaining: '8hrs 15mins 09secs',
    yesVotes: 41,
    noVotes: 8,
    fundingCostEth: '0.03',
    status: 'active',
  },
];

export function ProposalsTracker() {
  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<ProposalCardData | null>(null);

  const handleVote = (proposal: ProposalCardData) => {
    setSelectedProposal(proposal);
    setVoteModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>UPCOMING VOTES</Text>

        {MOCK_PROPOSALS.map((proposal) => (
          <View key={proposal.id} style={styles.proposalCard}>
            {/* Community tag */}
            <View style={styles.communityTagRow}>
              <Text style={styles.communityTagLabel}>IN COMMUNITY:</Text>
              <View
                style={[
                  styles.communityTag,
                  { borderColor: proposal.communityColor },
                ]}
              >
                <Text
                  style={[styles.communityTagText, { color: proposal.communityColor }]}
                >
                  {proposal.communityName}
                </Text>
              </View>
            </View>

            {/* Description */}
            <Text style={styles.proposalTitle}>{proposal.title}</Text>
            <Text style={styles.proposalDesc}>{proposal.description}</Text>

            {/* Requirements */}
            <View style={styles.requirementsBox}>
              <Text style={styles.requirementsLabel}>REQUIREMENTS</Text>
              {proposal.requirements.map((req, i) => (
                <Text key={i} style={styles.requirementText}>
                  {req}
                </Text>
              ))}
            </View>

            {/* Vote tally bar */}
            <View style={styles.tallyRow}>
              <Text style={styles.tallyYes}>
                YES {proposal.yesVotes}
              </Text>
              <View style={styles.tallyBar}>
                <View
                  style={[
                    styles.tallyYesBar,
                    {
                      flex: proposal.yesVotes,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.tallyNoBar,
                    {
                      flex: proposal.noVotes || 0.1,
                    },
                  ]}
                />
              </View>
              <Text style={styles.tallyNo}>
                NO {proposal.noVotes}
              </Text>
            </View>

            {/* Vote button + timer */}
            <View style={styles.voteRow}>
              <TouchableOpacity
                style={styles.voteButton}
                onPress={() => handleVote(proposal)}
              >
                <Text style={styles.voteButtonText}>Vote Now</Text>
              </TouchableOpacity>
              <View style={styles.timerBadge}>
                <Text style={styles.timerText}>{proposal.timeRemaining}</Text>
                <Text style={styles.timerLabel}>till voting closes</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.expandRow}>
              <Text style={styles.expandText}>EXPAND</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Vote Modal */}
      <Modal
        visible={voteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setVoteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cast Your Vote</Text>
            <Text style={styles.modalProposal}>
              {selectedProposal?.title}
            </Text>

            {selectedProposal?.fundingCostEth !== '0' && (
              <Text style={styles.modalCost}>
                A YES vote costs {selectedProposal?.fundingCostEth} ETH
              </Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.yesButton}
                onPress={() => {
                  // TODO: Call governance.castVote(proposalId, true)
                  setVoteModalVisible(false);
                }}
              >
                <Text style={styles.yesButtonText}>YES</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.noButton}
                onPress={() => {
                  // TODO: Call governance.castVote(proposalId, false)
                  setVoteModalVisible(false);
                }}
              >
                <Text style={styles.noButtonText}>NO</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setVoteModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  scroll: { padding: 16, gap: 16 },
  sectionTitle: {
    color: '#8B949E',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  proposalCard: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363D',
    gap: 10,
  },
  communityTagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  communityTagLabel: { color: '#484F58', fontSize: 10, letterSpacing: 1 },
  communityTag: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  communityTagText: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  proposalTitle: { color: '#E6EDF3', fontSize: 14, fontWeight: '600' },
  proposalDesc: {
    color: '#8B949E',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  requirementsBox: {
    backgroundColor: '#0D2D2A',
    borderRadius: 6,
    padding: 10,
    gap: 4,
  },
  requirementsLabel: {
    color: '#4ECDC4',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  requirementText: { color: '#C9D1D9', fontSize: 11, lineHeight: 16 },
  tallyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  tallyYes: { color: '#4ECDC4', fontSize: 12, fontWeight: '700', width: 45 },
  tallyNo: { color: '#F85149', fontSize: 12, fontWeight: '700', width: 35, textAlign: 'right' },
  tallyBar: { flex: 1, flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  tallyYesBar: { backgroundColor: '#4ECDC4' },
  tallyNoBar: { backgroundColor: '#F85149' },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  voteButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  voteButtonText: { color: '#0D1117', fontWeight: '700', fontSize: 14 },
  timerBadge: {
    backgroundColor: '#1A3A3A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flex: 1,
  },
  timerText: { color: '#4ECDC4', fontSize: 12, fontFamily: 'monospace', fontWeight: '600' },
  timerLabel: { color: '#484F58', fontSize: 9 },
  expandRow: { alignItems: 'flex-end' },
  expandText: { color: '#4ECDC4', fontSize: 10, letterSpacing: 1 },

  // Vote Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#4ECDC4',
    gap: 16,
  },
  modalTitle: { color: '#E6EDF3', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  modalProposal: { color: '#8B949E', fontSize: 14, textAlign: 'center' },
  modalCost: {
    color: '#F0C040',
    fontSize: 13,
    textAlign: 'center',
    backgroundColor: '#2D2200',
    padding: 8,
    borderRadius: 6,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  yesButton: {
    flex: 1,
    backgroundColor: '#4ECDC4',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  yesButtonText: { color: '#0D1117', fontSize: 18, fontWeight: '700' },
  noButton: {
    flex: 1,
    backgroundColor: '#21262D',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F85149',
  },
  noButtonText: { color: '#F85149', fontSize: 18, fontWeight: '700' },
  cancelButton: { alignItems: 'center', padding: 8 },
  cancelButtonText: { color: '#484F58', fontSize: 14 },
});
