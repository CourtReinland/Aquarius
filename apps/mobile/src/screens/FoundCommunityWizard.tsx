import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  MemberAdmission,
  ProposalPermission,
  type CommunityWizardState,
} from '../types/community';
import { createCommunityOnChain } from '../hooks/useCommunityFactory';
import { useWalletStore } from '../hooks/useWalletStore';
import { CONTRACT_ADDRESSES } from '../config/chains';
import { baseSepolia } from 'viem/chains';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'FoundCommunity'>;
};

/**
 * 3-step community creation wizard matching pitch deck slides 16-18:
 * Step 1: Name, founders, charter template
 * Step 2: Bylaws (admission, exile, voting rules)
 * Step 3: Legal nesting (legal framework, jurisdiction, member types)
 */
export function FoundCommunityWizard({ navigation }: Props) {
  const [step, setStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);
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
    const factoryAddress = CONTRACT_ADDRESSES[baseSepolia.id]?.communityFactory;
    const devKey = global.__aquariusDevKey;

    if (!factoryAddress) {
      Alert.alert(
        'Not Deployed',
        'CommunityFactory contract not yet deployed to Base Sepolia. Run the deploy script first.'
      );
      return;
    }

    if (!devKey) {
      Alert.alert('No Wallet', 'Please connect a wallet first.');
      return;
    }

    if (!wizard.name.trim()) {
      Alert.alert('Missing Name', 'Please enter a community name.');
      return;
    }

    setIsDeploying(true);
    try {
      // If no founder addresses specified, use the connected wallet
      if (wizard.founderAddresses.length === 0 && walletAddress) {
        wizard.founderAddresses = [walletAddress];
      }

      const result = await createCommunityOnChain(
        devKey,
        factoryAddress,
        wizard
      );

      // Navigate to success screen
      navigation.replace('FoundCommunitySuccess', {
        name: wizard.name,
        address: result.communityAddress,
        txHash: result.txHash,
      });
    } catch (error: any) {
      Alert.alert(
        'Transaction Failed',
        error?.message?.slice(0, 200) || 'Unknown error. Check console.'
      );
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header with teal gradient accent */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Found Community</Text>
          <Text style={styles.stepIndicator}>{step} / 3</Text>
        </View>

        {step === 1 && (
          <View style={styles.stepContainer}>
            {/* Community Name */}
            <Text style={styles.label}>Community name</Text>
            <TextInput
              style={styles.input}
              value={wizard.name}
              onChangeText={(text) => update({ name: text })}
              placeholder="e.g. Libertyville"
              placeholderTextColor="#484F58"
            />

            {/* Founder selection */}
            <Text style={styles.label}>Who founds this community?</Text>
            <View style={styles.optionGroup}>
              <TouchableOpacity
                style={[
                  styles.option,
                  wizard.founderCount === 'single' && styles.optionSelected,
                ]}
                onPress={() => update({ founderCount: 'single' })}
              >
                <Text style={styles.optionText}>A Founder</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.option,
                  wizard.founderCount === 'multiple' && styles.optionSelected,
                ]}
                onPress={() => update({ founderCount: 'multiple' })}
              >
                <Text style={styles.optionText}>Several Founders</Text>
              </TouchableOpacity>
            </View>

            {/* Charter template */}
            <Text style={styles.label}>Charter style?</Text>
            {[
              { key: 'draft-original', label: 'Draft Original' },
              { key: 'us-constitution', label: 'Based on U.S. Constitution' },
              { key: 'magna-carta', label: 'Based on Magna Carta' },
              { key: 'blackfeet-tribal', label: 'Based on Blackfeet Tribal Constitution' },
            ].map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.option,
                  wizard.charterTemplate === t.key && styles.optionSelected,
                ]}
                onPress={() => update({ charterTemplate: t.key as any })}
              >
                <Text style={styles.optionText}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            {/* Admission rule */}
            <Text style={styles.label}>By what rule may a member be admitted or exiled?</Text>
            <TouchableOpacity
              style={[
                styles.option,
                wizard.admissionRule === MemberAdmission.FoundersOnly && styles.optionSelected,
              ]}
              onPress={() => update({ admissionRule: MemberAdmission.FoundersOnly })}
            >
              <Text style={styles.optionText}>By a vote of the founders only</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.option,
                wizard.admissionRule === MemberAdmission.FoundersAndMembers && styles.optionSelected,
              ]}
              onPress={() => update({ admissionRule: MemberAdmission.FoundersAndMembers })}
            >
              <Text style={styles.optionText}>By a vote of the founders + members</Text>
            </TouchableOpacity>

            {/* Vote percentage */}
            <Text style={styles.label}>By what vote percentage?</Text>
            <View style={styles.percentageRow}>
              {[51, 66, 80].map((pct) => (
                <TouchableOpacity
                  key={pct}
                  style={[
                    styles.percentageButton,
                    wizard.votePercentage === pct && styles.percentageSelected,
                  ]}
                  onPress={() => update({ votePercentage: pct })}
                >
                  <Text
                    style={[
                      styles.percentageText,
                      wizard.votePercentage === pct && styles.percentageTextSelected,
                    ]}
                  >
                    {pct}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Who may propose */}
            <Text style={styles.label}>Who may propose a vote?</Text>
            <TouchableOpacity
              style={[
                styles.option,
                wizard.whoMayPropose === ProposalPermission.FoundersOnly && styles.optionSelected,
              ]}
              onPress={() => update({ whoMayPropose: ProposalPermission.FoundersOnly })}
            >
              <Text style={styles.optionText}>Only a founder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.option,
                wizard.whoMayPropose === ProposalPermission.FoundersOrMembers && styles.optionSelected,
              ]}
              onPress={() => update({ whoMayPropose: ProposalPermission.FoundersOrMembers })}
            >
              <Text style={styles.optionText}>Any member</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            {/* Legal framework */}
            <Text style={styles.label}>Nest this community in the following legal structure?</Text>
            {['U.S. Code', 'International Commerce Law', 'None'].map((fw) => (
              <TouchableOpacity
                key={fw}
                style={[
                  styles.option,
                  wizard.legalFramework === fw && styles.optionSelected,
                ]}
                onPress={() => update({ legalFramework: fw })}
              >
                <Text style={styles.optionText}>{fw}</Text>
              </TouchableOpacity>
            ))}

            {/* Jurisdiction */}
            <Text style={styles.label}>Define the jurisdiction as?</Text>
            <TextInput
              style={styles.input}
              value={wizard.jurisdiction}
              onChangeText={(text) => update({ jurisdiction: text })}
              placeholder="e.g. State of California"
              placeholderTextColor="#484F58"
            />

            {/* Member types */}
            <Text style={styles.label}>Allow members to join as?</Text>
            <TouchableOpacity
              style={[
                styles.option,
                !wizard.allowCorporateMembers && styles.optionSelected,
              ]}
              onPress={() => update({ allowCorporateMembers: false })}
            >
              <Text style={styles.optionText}>Natural persons</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.option,
                wizard.allowCorporateMembers && styles.optionSelected,
              ]}
              onPress={() => update({ allowCorporateMembers: true })}
            >
              <Text style={styles.optionText}>Persons or corporations</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={styles.navRow}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(step - 1)}
          >
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
              <Text style={styles.nextButtonText}>Deploying to Base...</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  scroll: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4ECDC4',
  },
  stepIndicator: {
    fontSize: 16,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  stepContainer: {
    gap: 8,
  },
  label: {
    color: '#E6EDF3',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#4ECDC4',
    borderRadius: 8,
    padding: 14,
    color: '#E6EDF3',
    fontSize: 16,
  },
  optionGroup: {
    gap: 8,
  },
  option: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    padding: 14,
    marginBottom: 4,
  },
  optionSelected: {
    borderColor: '#4ECDC4',
    backgroundColor: '#0D2D2A',
  },
  optionText: {
    color: '#E6EDF3',
    fontSize: 15,
  },
  percentageRow: {
    flexDirection: 'row',
    gap: 12,
  },
  percentageButton: {
    flex: 1,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  percentageSelected: {
    borderColor: '#4ECDC4',
    backgroundColor: '#0D2D2A',
  },
  percentageText: {
    color: '#8B949E',
    fontSize: 16,
    fontWeight: '700',
  },
  percentageTextSelected: {
    color: '#4ECDC4',
  },
  navRow: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0D1117',
    borderTopWidth: 1,
    borderTopColor: '#30363D',
  },
  backButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#8B949E',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#4ECDC4',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#0D1117',
    fontSize: 16,
    fontWeight: '700',
  },
  nextButtonDeploying: {
    backgroundColor: '#3BA89F',
  },
  deployingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
