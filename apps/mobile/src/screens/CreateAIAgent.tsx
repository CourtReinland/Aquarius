import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAgentCreator } from '../hooks/useAgentCreator';
import { showAlert } from '../utils/alert';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateAIAgent'>;

const CAPABILITY_CHOICES = [
  { id: 'vote', label: 'Vote' },
  { id: 'chat', label: 'Chat' },
  { id: 'monitor-proposals', label: 'Monitor Proposals' },
  { id: 'manage-treasury', label: 'Manage Treasury' },
  { id: 'manage-institution', label: 'Manage Institution' },
  { id: 'trade-crypto', label: 'Trade Crypto' },
];

export function CreateAIAgent({ route }: Props) {
  const { communityAddress, communityName, creatorAddress } = route.params;
  const { createAgent, isCreating, error, agent } = useAgentCreator();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [capabilities, setCapabilities] = useState<string[]>(['vote', 'chat']);
  const [initialFundingEth, setInitialFundingEth] = useState('0');
  const [promptTemplate, setPromptTemplate] = useState(
    'You are an Aquarius community agent. Read community rules first, explain your reasoning briefly, and only take actions that fit your assigned role and the community bylaws.'
  );

  const canSubmit = useMemo(() => {
    return name.trim().length > 0 && promptTemplate.trim().length > 0 && capabilities.length > 0 && !isCreating;
  }, [capabilities.length, isCreating, name, promptTemplate]);

  const toggleCapability = (id: string) => {
    setCapabilities((current) =>
      current.includes(id)
        ? current.filter((capability) => capability !== id)
        : [...current, id]
    );
  };

  const handleCreate = async () => {
    if (!canSubmit) return;

    const created = await createAgent({
      communityAddress,
      communityName,
      creatorAddress,
      name: name.trim(),
      role: role.trim(),
      description: description.trim(),
      capabilities,
      promptTemplate: promptTemplate.trim(),
      initialFundingEth: initialFundingEth.trim() || '0',
    });

    if (created) {
      showAlert('Agent created', `${created.agentCard.name} now has a wallet and agent card.`);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>COMMUNITY</Text>
          <Text style={styles.communityName}>{communityName}</Text>
          <Text style={styles.addressText}>
            {communityAddress.slice(0, 10)}...{communityAddress.slice(-8)}
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>Agent Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Cupcake DAO Treasurer"
            placeholderTextColor="#484F58"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Role</Text>
          <TextInput
            style={styles.input}
            placeholder="Treasury assistant"
            placeholderTextColor="#484F58"
            value={role}
            onChangeText={setRole}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="What this agent is trusted to do"
            placeholderTextColor="#484F58"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>Capabilities</Text>
          <View style={styles.capabilityGrid}>
            {CAPABILITY_CHOICES.map((capability) => {
              const selected = capabilities.includes(capability.id);
              return (
                <TouchableOpacity
                  key={capability.id}
                  style={[styles.capabilityButton, selected && styles.capabilityButtonSelected]}
                  onPress={() => toggleCapability(capability.id)}
                >
                  <Text style={[styles.capabilityText, selected && styles.capabilityTextSelected]}>
                    {capability.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Initial Funding (ETH)</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor="#484F58"
            keyboardType="decimal-pad"
            value={initialFundingEth}
            onChangeText={setInitialFundingEth}
          />

          <Text style={styles.label}>Prompt Template</Text>
          <TextInput
            style={[styles.input, styles.promptInput]}
            value={promptTemplate}
            onChangeText={setPromptTemplate}
            multiline
            textAlignVertical="top"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.createButton, !canSubmit && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!canSubmit}
        >
          {isCreating ? (
            <ActivityIndicator color="#0D1117" />
          ) : (
            <>
              <Text style={styles.createIcon}>+</Text>
              <Text style={styles.createButtonText}>Create AI Agent</Text>
            </>
          )}
        </TouchableOpacity>

        {agent ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Agent Ready</Text>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Wallet</Text>
              <Text style={styles.resultValue}>
                {agent.walletAddress.slice(0, 10)}...{agent.walletAddress.slice(-8)}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Registry</Text>
              <Text style={styles.resultValue}>
                {agent.registration.mode}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Key Storage</Text>
              <Text style={styles.resultValue}>{agent.keyStorage}</Text>
            </View>
            {agent.registration.reason ? (
              <Text style={styles.resultNote}>{agent.registration.reason}</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  scroll: { padding: 16, gap: 14 },
  headerCard: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363D',
    padding: 16,
    gap: 4,
  },
  eyebrow: { color: '#484F58', fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  communityName: { color: '#E6EDF3', fontSize: 20, fontWeight: '700' },
  addressText: { color: '#8B949E', fontFamily: 'monospace', fontSize: 11 },
  formSection: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363D',
    padding: 16,
    gap: 10,
  },
  label: { color: '#8B949E', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  input: {
    backgroundColor: '#0D1117',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363D',
    color: '#E6EDF3',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multiline: { minHeight: 76 },
  promptInput: { minHeight: 150, lineHeight: 20 },
  capabilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  capabilityButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363D',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#0D1117',
  },
  capabilityButtonSelected: { borderColor: '#4ECDC4', backgroundColor: '#0D2D2A' },
  capabilityText: { color: '#8B949E', fontSize: 12, fontWeight: '600' },
  capabilityTextSelected: { color: '#4ECDC4' },
  createButton: {
    minHeight: 52,
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  createButtonDisabled: { opacity: 0.35 },
  createIcon: { color: '#0D1117', fontSize: 22, fontWeight: '700' },
  createButtonText: { color: '#0D1117', fontSize: 16, fontWeight: '700' },
  errorText: { color: '#FF6B6B', fontSize: 13 },
  resultCard: {
    backgroundColor: '#10201F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4ECDC4',
    padding: 16,
    gap: 8,
  },
  resultTitle: { color: '#4ECDC4', fontSize: 16, fontWeight: '700' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  resultLabel: { color: '#8B949E', fontSize: 12 },
  resultValue: { color: '#E6EDF3', fontSize: 12, fontFamily: 'monospace', flexShrink: 1, textAlign: 'right' },
  resultNote: { color: '#8B949E', fontSize: 12, lineHeight: 18 },
});
