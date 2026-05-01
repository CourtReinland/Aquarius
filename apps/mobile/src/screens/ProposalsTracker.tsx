import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEther } from 'viem';
import { useBlockchain } from '../context/BlockchainContext';
import { castVote, createProposal } from '../hooks/useGovernance';
import { getDevKey } from '../utils/devWallet';
import { CONTRACT_ADDRESSES, defaultChain } from '../config/chains';
import { showAlert } from '../utils/alert';
import type { OnChainProposal } from '../hooks/useBlockchainData';

const STATUS_LABELS: Record<number, string> = { 0: 'Active', 1: 'Passed', 2: 'Failed', 3: 'Executed', 4: 'Cancelled' };
const STATUS_COLORS: Record<number, string> = { 0: '#4ECDC4', 1: '#238636', 2: '#F85149', 3: '#8B949E', 4: '#484F58' };

export function ProposalsTracker() {
  const { proposals, myCommunities, loading, refresh, walletAddress } = useBlockchain();
  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<OnChainProposal | null>(null);
  const [voting, setVoting] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create proposal form
  const [newTitle, setNewTitle] = useState('');
  const [newCommunity, setNewCommunity] = useState('');
  const [newDuration, setNewDuration] = useState('86400'); // 1 day
  const [newQuorum, setNewQuorum] = useState('51');
  const [newFundingCost, setNewFundingCost] = useState('0');

  const govAddress = CONTRACT_ADDRESSES[defaultChain.id]?.governanceModule;

  const handleVote = async (support: boolean) => {
    if (!selectedProposal || !govAddress) return;
    const devKey = getDevKey() || (globalThis as any).__aquariusDevKey;
    if (!devKey) { showAlert('No Wallet', 'Connect wallet first'); return; }

    setVoting(true);
    try {
      const fundingEth = support && selectedProposal.fundingCostPerYes > 0n
        ? formatEther(selectedProposal.fundingCostPerYes)
        : undefined;

      await castVote(devKey, govAddress, BigInt(selectedProposal.id), support, fundingEth);
      showAlert('Vote Cast!', `You voted ${support ? 'YES' : 'NO'}`);
      setVoteModalVisible(false);
      refresh();
    } catch (e: any) {
      showAlert('Vote Failed', e?.shortMessage || e?.message || 'Unknown error');
    } finally {
      setVoting(false);
    }
  };

  const handleCreateProposal = async () => {
    if (!govAddress || !newCommunity || !newTitle.trim()) {
      showAlert('Missing Fields', 'Enter a title and select a community');
      return;
    }
    const devKey = getDevKey() || (globalThis as any).__aquariusDevKey;
    if (!devKey) { showAlert('No Wallet', 'Connect wallet first'); return; }

    setCreating(true);
    try {
      await createProposal(devKey, govAddress, {
        communityAddress: newCommunity as `0x${string}`,
        title: newTitle,
        descriptionIpfsHash: '',
        quorumType: 0,
        quorumPercentage: parseInt(newQuorum),
        minimumVoters: 0,
        durationSeconds: parseInt(newDuration),
        outcomeType: 0,
        fundingCostPerYesEth: newFundingCost,
        fundingThresholdEth: '0',
        institutionName: '',
      });
      showAlert('Proposal Created!', 'Members can now vote on it.');
      setCreateModalVisible(false);
      setNewTitle('');
      refresh();
    } catch (e: any) {
      showAlert('Create Failed', e?.shortMessage || e?.message || 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  const activeProposals = proposals.filter(p => p.status === 0);
  const pastProposals = proposals.filter(p => p.status !== 0);

  const renderProposal = (p: OnChainProposal) => {
    const totalVotes = p.yesVotes + p.noVotes;
    const yesPct = totalVotes > 0 ? (p.yesVotes / totalVotes) * 100 : 0;
    const isActive = p.status === 0;
    const timeLeft = Math.max(0, p.endTime - Math.floor(Date.now() / 1000));
    const hoursLeft = Math.floor(timeLeft / 3600);
    const minsLeft = Math.floor((timeLeft % 3600) / 60);

    return (
      <View key={p.id} style={styles.proposalCard}>
        <View style={styles.tagRow}>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[p.status] + '22', borderColor: STATUS_COLORS[p.status] }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[p.status] }]}>{STATUS_LABELS[p.status]}</Text>
          </View>
          {p.communityName ? (
            <Text style={styles.communityTag}>{p.communityName}</Text>
          ) : null}
        </View>

        <Text style={styles.proposalTitle}>{p.title || '(Untitled proposal)'}</Text>

        {p.fundingCostPerYes > 0n && (
          <Text style={styles.fundingInfo}>Funding: {formatEther(p.fundingCostPerYes)} ETH per YES vote</Text>
        )}

        {/* Vote tally */}
        <View style={styles.tallyRow}>
          <Text style={styles.tallyYes}>YES {p.yesVotes}</Text>
          <View style={styles.tallyBar}>
            <View style={[styles.tallyYesBar, { flex: p.yesVotes || 0.1 }]} />
            <View style={[styles.tallyNoBar, { flex: p.noVotes || 0.1 }]} />
          </View>
          <Text style={styles.tallyNo}>NO {p.noVotes}</Text>
        </View>

        {/* Timer + vote button */}
        {isActive && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.voteButton, p.hasVoted && styles.voteButtonDisabled]}
              disabled={p.hasVoted}
              onPress={() => { setSelectedProposal(p); setVoteModalVisible(true); }}
            >
              <Text style={styles.voteButtonText}>{p.hasVoted ? 'Voted' : 'Vote Now'}</Text>
            </TouchableOpacity>
            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>{hoursLeft}h {minsLeft}m</Text>
              <Text style={styles.timerLabel}>remaining</Text>
            </View>
          </View>
        )}

        {p.totalFunded > 0n && (
          <Text style={styles.fundedAmount}>Total funded: {formatEther(p.totalFunded)} ETH</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#4ECDC4" />}
      >
        {/* Header + Create button */}
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>PROPOSALS</Text>
          {myCommunities.length > 0 && (
            <TouchableOpacity style={styles.createBtn} onPress={() => setCreateModalVisible(true)}>
              <Text style={styles.createBtnText}>+ New Proposal</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading && proposals.length === 0 && (
          <View style={styles.loadingState}>
            <ActivityIndicator color="#4ECDC4" />
            <Text style={styles.loadingText}>Syncing from blockchain...</Text>
          </View>
        )}

        {!loading && proposals.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Proposals Yet</Text>
            <Text style={styles.emptySubtitle}>
              {myCommunities.length > 0
                ? 'Create the first proposal for your community!'
                : 'Join or found a community to participate in governance.'}
            </Text>
          </View>
        )}

        {activeProposals.length > 0 && (
          <>
            <Text style={styles.subSection}>ACTIVE ({activeProposals.length})</Text>
            {activeProposals.map(renderProposal)}
          </>
        )}

        {pastProposals.length > 0 && (
          <>
            <Text style={styles.subSection}>PAST ({pastProposals.length})</Text>
            {pastProposals.map(renderProposal)}
          </>
        )}
      </ScrollView>

      {/* ─── Vote Modal ──────────────────────────── */}
      <Modal visible={voteModalVisible} transparent animationType="slide" onRequestClose={() => setVoteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cast Your Vote</Text>
            <Text style={styles.modalProposal}>{selectedProposal?.title}</Text>

            {selectedProposal && selectedProposal.fundingCostPerYes > 0n && (
              <Text style={styles.modalCost}>YES costs {formatEther(selectedProposal.fundingCostPerYes)} ETH</Text>
            )}

            {voting ? (
              <ActivityIndicator color="#4ECDC4" size="large" style={{ padding: 20 }} />
            ) : (
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.yesButton} onPress={() => handleVote(true)}>
                  <Text style={styles.yesButtonText}>YES</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.noButton} onPress={() => handleVote(false)}>
                  <Text style={styles.noButtonText}>NO</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={() => setVoteModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Create Proposal Modal ───────────────── */}
      <Modal visible={createModalVisible} transparent animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Proposal</Text>

            <Text style={styles.fieldLabel}>Community</Text>
            {myCommunities.map(c => (
              <TouchableOpacity key={c.address}
                style={[styles.communityOption, newCommunity === c.address && styles.communityOptionSelected]}
                onPress={() => setNewCommunity(c.address)}>
                <Text style={styles.communityOptionText}>{c.name}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput style={styles.modalInput} value={newTitle} onChangeText={setNewTitle}
              placeholder="e.g. Buy a pizza making machine" placeholderTextColor="#484F58" />

            <Text style={styles.fieldLabel}>Quorum %</Text>
            <TextInput style={styles.modalInput} value={newQuorum} onChangeText={setNewQuorum}
              keyboardType="numeric" placeholder="51" placeholderTextColor="#484F58" />

            <Text style={styles.fieldLabel}>Voting Duration</Text>
            <View style={styles.durationRow}>
              {[
                { label: '5 Min', value: '300' },
                { label: '1 Hour', value: '3600' },
                { label: '1 Day', value: '86400' },
                { label: '3 Days', value: '259200' },
                { label: '1 Week', value: '604800' },
              ].map(d => (
                <TouchableOpacity key={d.value}
                  style={[styles.durationBtn, newDuration === d.value && styles.durationBtnSelected]}
                  onPress={() => setNewDuration(d.value)}>
                  <Text style={[styles.durationBtnText, newDuration === d.value && styles.durationBtnTextSelected]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Funding cost per YES vote (ETH, 0 = free)</Text>
            <TextInput style={styles.modalInput} value={newFundingCost} onChangeText={setNewFundingCost}
              keyboardType="numeric" placeholder="0" placeholderTextColor="#484F58" />

            {creating ? (
              <ActivityIndicator color="#4ECDC4" size="large" style={{ padding: 20 }} />
            ) : (
              <TouchableOpacity style={styles.submitButton} onPress={handleCreateProposal}>
                <Text style={styles.submitButtonText}>Create Proposal</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={() => setCreateModalVisible(false)}>
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
  scroll: { padding: 16, gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#8B949E', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  subSection: { color: '#484F58', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: 12 },
  createBtn: { backgroundColor: '#0D2D2A', borderWidth: 1, borderColor: '#4ECDC4', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  createBtnText: { color: '#4ECDC4', fontSize: 12, fontWeight: '600' },
  loadingState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { color: '#484F58', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#E6EDF3', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#484F58', fontSize: 13, textAlign: 'center' },

  proposalCard: { backgroundColor: '#161B22', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#30363D', gap: 8 },
  tagRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  statusBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '700' },
  communityTag: { color: '#484F58', fontSize: 10, fontFamily: 'monospace' },
  proposalTitle: { color: '#E6EDF3', fontSize: 14, fontWeight: '600' },
  fundingInfo: { color: '#F0C040', fontSize: 11 },
  tallyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tallyYes: { color: '#4ECDC4', fontSize: 12, fontWeight: '700', width: 50 },
  tallyNo: { color: '#F85149', fontSize: 12, fontWeight: '700', width: 40, textAlign: 'right' },
  tallyBar: { flex: 1, flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  tallyYesBar: { backgroundColor: '#4ECDC4' },
  tallyNoBar: { backgroundColor: '#F85149' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  voteButton: { backgroundColor: '#4ECDC4', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  voteButtonDisabled: { backgroundColor: '#21262D' },
  voteButtonText: { color: '#0D1117', fontWeight: '700', fontSize: 14 },
  timerBadge: { backgroundColor: '#1A3A3A', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, flex: 1 },
  timerText: { color: '#4ECDC4', fontSize: 12, fontFamily: 'monospace', fontWeight: '600' },
  timerLabel: { color: '#484F58', fontSize: 9 },
  fundedAmount: { color: '#8B949E', fontSize: 11, fontFamily: 'monospace' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#161B22', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#4ECDC4', gap: 12 },
  modalTitle: { color: '#E6EDF3', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  modalProposal: { color: '#8B949E', fontSize: 14, textAlign: 'center' },
  modalCost: { color: '#F0C040', fontSize: 13, textAlign: 'center', backgroundColor: '#2D2200', padding: 8, borderRadius: 6 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  yesButton: { flex: 1, backgroundColor: '#4ECDC4', padding: 16, borderRadius: 10, alignItems: 'center' },
  yesButtonText: { color: '#0D1117', fontSize: 18, fontWeight: '700' },
  noButton: { flex: 1, backgroundColor: '#21262D', padding: 16, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#F85149' },
  noButtonText: { color: '#F85149', fontSize: 18, fontWeight: '700' },
  cancelButton: { alignItems: 'center', padding: 8 },
  cancelButtonText: { color: '#484F58', fontSize: 14 },

  fieldLabel: { color: '#E6EDF3', fontSize: 12, fontWeight: '600', marginTop: 4 },
  modalInput: { backgroundColor: '#0D1117', borderWidth: 1, borderColor: '#30363D', borderRadius: 8, padding: 12, color: '#E6EDF3', fontSize: 14 },
  communityOption: { backgroundColor: '#0D1117', borderWidth: 1, borderColor: '#30363D', borderRadius: 8, padding: 10 },
  communityOptionSelected: { borderColor: '#4ECDC4', backgroundColor: '#0D2D2A' },
  communityOptionText: { color: '#E6EDF3', fontSize: 13 },
  durationRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  durationBtn: { backgroundColor: '#0D1117', borderWidth: 1, borderColor: '#30363D', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 },
  durationBtnSelected: { borderColor: '#4ECDC4', backgroundColor: '#0D2D2A' },
  durationBtnText: { color: '#8B949E', fontSize: 12 },
  durationBtnTextSelected: { color: '#4ECDC4', fontWeight: '700' },
  submitButton: { backgroundColor: '#4ECDC4', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  submitButtonText: { color: '#0D1117', fontSize: 16, fontWeight: '700' },
});
