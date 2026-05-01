import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  MemberAdmission,
  ProposalPermission,
  type CommunityWizardState,
} from '../types/community';
import { createCommunityOnChain } from '../hooks/useCommunityFactory';
import { useWalletStore } from '../hooks/useWalletStore';
import { CONTRACT_ADDRESSES, defaultChain } from '../config/chains';
import { showAlert } from '../utils/alert';
import { getDevKey } from '../utils/devWallet';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'FoundCommunity'>;
};

export function FoundCommunityWizard({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const { address: walletAddress } = useWalletStore();
  const [wizard, setWizard] = useState<CommunityWizardState>({
    name: '',
    founderCount: 'single',
    founderAddresses: [],
    charterTemplate: 'draft-original',
    charterText: '',
    admissionRule: MemberAdmission.FoundersAndMembers,
    exileRule: MemberAdmission.FoundersOnly,
    votePercentage: 51,
    whoMayPropose: ProposalPermission.FoundersOrMembers,
    legalFramework: '',
    jurisdiction: '',
    allowCorporateMembers: false,
  });

  const update = (fields: Partial<CommunityWizardState>) =>
    setWizard((prev) => ({ ...prev, ...fields }));

  const handleFinish = async () => {
    console.log('[Aquarius] handleFinish called');

    const factoryAddress = CONTRACT_ADDRESSES[defaultChain.id]?.communityFactory;
    const devKey = getDevKey() || (globalThis as any).__aquariusDevKey;

    console.log('[Aquarius] Factory:', factoryAddress);
    console.log('[Aquarius] DevKey exists:', !!devKey);
    console.log('[Aquarius] Chain ID:', defaultChain.id);

    if (!factoryAddress) {
      showAlert(
        'Not Deployed',
        'CommunityFactory not deployed. Start Anvil and run the deploy script first.'
      );
      return;
    }

    if (!devKey) {
      showAlert('No Wallet', 'Please connect a wallet on the home screen first.');
      return;
    }

    if (!wizard.name.trim()) {
      showAlert('Missing Name', 'Please enter a community name.');
      return;
    }

    setIsDeploying(true);
    setDeployError(null);

    try {
      // Use connected wallet as founder if none specified
      const wizardCopy = { ...wizard };
      if (wizardCopy.founderAddresses.length === 0 && walletAddress) {
        wizardCopy.founderAddresses = [walletAddress];
      }

      console.log('[Aquarius] Deploying community:', wizardCopy.name);
      console.log('[Aquarius] Founders:', wizardCopy.founderAddresses);

      const result = await createCommunityOnChain(
        devKey,
        factoryAddress,
        wizardCopy
      );

      console.log('[Aquarius] Deploy success!', result);

      // Navigate to success screen
      navigation.replace('FoundCommunitySuccess', {
        name: wizardCopy.name,
        address: result.communityAddress,
        txHash: result.txHash,
      });
    } catch (error: any) {
      const msg = error?.shortMessage || error?.message || 'Unknown error';
      console.error('[Aquarius] Deploy failed:', msg);
      setDeployError(msg.slice(0, 300));
      showAlert('Transaction Failed', msg.slice(0, 200));
    } finally {
      setIsDeploying(false);
    }
  };

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
          <Text style={styles.headerTitle}>Found Community</Text>
          <Text style={styles.stepIndicator}>{step} / 3</Text>
        </View>

        {/* Error display */}
        {deployError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{deployError}</Text>
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>Community name</Text>
            <TextInput
              style={styles.input}
              value={wizard.name}
              onChangeText={(text) => update({ name: text })}
              placeholder="e.g. Cincinnati Skateville"
              placeholderTextColor="#484F58"
            />

            <Text style={styles.label}>Who founds this community?</Text>
            <View style={styles.optionGroup}>
              <TouchableOpacity
                style={[styles.option, wizard.founderCount === 'single' && styles.optionSelected]}
                onPress={() => update({ founderCount: 'single' })}
              >
                <Text style={styles.optionText}>A Founder</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.option, wizard.founderCount === 'multiple' && styles.optionSelected]}
                onPress={() => update({ founderCount: 'multiple' })}
              >
                <Text style={styles.optionText}>Several Founders</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Charter style?</Text>
            {[
              { key: 'draft-original', label: 'Draft Original' },
              { key: 'us-constitution', label: 'Based on U.S. Constitution' },
              { key: 'magna-carta', label: 'Based on Magna Carta' },
              { key: 'blackfeet-tribal', label: 'Based on Blackfeet Tribal Constitution' },
            ].map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.option, wizard.charterTemplate === t.key && styles.optionSelected]}
                onPress={() => update({ charterTemplate: t.key as any })}
              >
                <Text style={styles.optionText}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>By what rule may a member be admitted or exiled?</Text>
            <TouchableOpacity
              style={[styles.option, wizard.admissionRule === MemberAdmission.FoundersOnly && styles.optionSelected]}
              onPress={() => update({ admissionRule: MemberAdmission.FoundersOnly })}
            >
              <Text style={styles.optionText}>By a vote of the founders only</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.option, wizard.admissionRule === MemberAdmission.FoundersAndMembers && styles.optionSelected]}
              onPress={() => update({ admissionRule: MemberAdmission.FoundersAndMembers })}
            >
              <Text style={styles.optionText}>By a vote of the founders + members</Text>
            </TouchableOpacity>

            <Text style={styles.label}>By what vote percentage?</Text>
            <View style={styles.percentageRow}>
              {[51, 66, 80].map((pct) => (
                <TouchableOpacity
                  key={pct}
                  style={[styles.percentageButton, wizard.votePercentage === pct && styles.percentageSelected]}
                  onPress={() => update({ votePercentage: pct })}
                >
                  <Text style={[styles.percentageText, wizard.votePercentage === pct && styles.percentageTextSelected]}>
                    {pct}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Who may propose a vote?</Text>
            <TouchableOpacity
              style={[styles.option, wizard.whoMayPropose === ProposalPermission.FoundersOnly && styles.optionSelected]}
              onPress={() => update({ whoMayPropose: ProposalPermission.FoundersOnly })}
            >
              <Text style={styles.optionText}>Only a founder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.option, wizard.whoMayPropose === ProposalPermission.FoundersOrMembers && styles.optionSelected]}
              onPress={() => update({ whoMayPropose: ProposalPermission.FoundersOrMembers })}
            >
              <Text style={styles.optionText}>Any member</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>Nest this community in the following legal structure?</Text>
            {['U.S. Code', 'International Commerce Law', 'None'].map((fw) => (
              <TouchableOpacity
                key={fw}
                style={[styles.option, wizard.legalFramework === fw && styles.optionSelected]}
                onPress={() => update({ legalFramework: fw })}
              >
                <Text style={styles.optionText}>{fw}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.label}>Define the jurisdiction as?</Text>
            <TextInput
              style={styles.input}
              value={wizard.jurisdiction}
              onChangeText={(text) => update({ jurisdiction: text })}
              placeholder="e.g. State of California"
              placeholderTextColor="#484F58"
            />

            <Text style={styles.label}>Allow members to join as?</Text>
            <TouchableOpacity
              style={[styles.option, !wizard.allowCorporateMembers && styles.optionSelected]}
              onPress={() => update({ allowCorporateMembers: false })}
            >
              <Text style={styles.optionText}>Natural persons</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.option, wizard.allowCorporateMembers && styles.optionSelected]}
              onPress={() => update({ allowCorporateMembers: true })}
            >
              <Text style={styles.optionText}>Persons or corporations</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View
        style={[
          styles.navRow,
          { paddingBottom: 20 + insets.bottom },
        ]}
      >
        {step > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={() => setStep(step - 1)}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, isDeploying && styles.nextButtonDeploying]}
          disabled={isDeploying}
          onPress={() => {
            if (step < 3) {
              setStep(step + 1);
            } else {
              handleFinish();
            }
          }}
        >
          {isDeploying ? (
            <View style={styles.deployingRow}>
              <ActivityIndicator color="#0D1117" size="small" />
              <Text style={styles.nextButtonText}>Deploying...</Text>
            </View>
          ) : (
            <Text style={styles.nextButtonText}>
              {step === 3 ? 'Found on Blockchain' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  scroll: { padding: 20, paddingBottom: 100 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#30363D',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#4ECDC4' },
  stepIndicator: { fontSize: 16, color: '#4ECDC4', fontWeight: '600' },
  stepContainer: { gap: 8 },
  errorBanner: {
    backgroundColor: '#3D1117', borderRadius: 8, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#F85149',
  },
  errorText: { color: '#F85149', fontSize: 12, fontFamily: 'monospace' },
  label: { color: '#E6EDF3', fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: {
    backgroundColor: '#161B22', borderWidth: 1, borderColor: '#4ECDC4',
    borderRadius: 8, padding: 14, color: '#E6EDF3', fontSize: 16,
  },
  optionGroup: { gap: 8 },
  option: {
    backgroundColor: '#161B22', borderWidth: 1, borderColor: '#30363D',
    borderRadius: 8, padding: 14, marginBottom: 4,
  },
  optionSelected: { borderColor: '#4ECDC4', backgroundColor: '#0D2D2A' },
  optionText: { color: '#E6EDF3', fontSize: 15 },
  percentageRow: { flexDirection: 'row', gap: 12 },
  percentageButton: {
    flex: 1, backgroundColor: '#161B22', borderWidth: 1, borderColor: '#30363D',
    borderRadius: 8, padding: 14, alignItems: 'center',
  },
  percentageSelected: { borderColor: '#4ECDC4', backgroundColor: '#0D2D2A' },
  percentageText: { color: '#8B949E', fontSize: 16, fontWeight: '700' },
  percentageTextSelected: { color: '#4ECDC4' },
  navRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 12,
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0D1117', borderTopWidth: 1, borderTopColor: '#30363D',
  },
  backButton: {
    flex: 1, borderWidth: 1, borderColor: '#30363D', borderRadius: 10,
    padding: 16, alignItems: 'center',
  },
  backButtonText: { color: '#8B949E', fontSize: 16, fontWeight: '600' },
  nextButton: {
    flex: 2, backgroundColor: '#4ECDC4', borderRadius: 10,
    padding: 16, alignItems: 'center',
  },
  nextButtonText: { color: '#0D1117', fontSize: 16, fontWeight: '700' },
  nextButtonDeploying: { backgroundColor: '#3BA89F' },
  deployingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
