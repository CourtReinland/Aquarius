import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { WalletConnect } from '../components/WalletConnect';
import { BlueAssistantAvatar } from '../components/blue';
import { useWalletStore } from '../hooks/useWalletStore';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export function HomeScreen({ navigation }: Props) {
  const { isConnected } = useWalletStore();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.blueStage}>
        <BlueAssistantAvatar
          state="speaking"
          speechText="Hi, I'm Blue. I'm here to help you get set up. Would you like to found a community or join an existing one?"
          size={236}
          caption="Hi, I'm Blue. I'm here to help you get set up."
        />
      </View>

      <View style={styles.choiceCard}>
        <Text style={styles.choicePrompt}>Would you like to found a community or join an existing one?</Text>
        <View style={styles.primaryChoices}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('FoundCommunity')}
          >
            <Text style={styles.primaryButtonText}>Found Community</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('MainTabs')}
          >
            <Text style={styles.secondaryButtonText}>Join Community</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.walletSection}>
        <WalletConnect />
      </View>

      <TouchableOpacity
        style={styles.foundryButton}
        onPress={() => navigation.navigate('CreateAIAgent', {
          communityAddress: '0x0000000000000000000000000000000000000001',
          communityName: 'Agent Foundry Preview',
        })}
      >
        <Text style={styles.foundryEyebrow}>ADVANCED</Text>
        <Text style={styles.foundryButtonText}>Open Agent Foundry</Text>
        <Text style={styles.foundrySubtext}>Customize Blue's agents under the hood</Text>
      </TouchableOpacity>

      {!isConnected && (
        <Text style={styles.connectPrompt}>
          You can look around now. Connect a wallet before creating on-chain records.
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B1A',
    justifyContent: 'center',
    padding: 24,
  },
  blueStage: {
    alignItems: 'center',
    marginBottom: 22,
  },
  choiceCard: {
    backgroundColor: 'rgba(13, 17, 23, 0.92)',
    borderWidth: 1,
    borderColor: '#263B5E',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  choicePrompt: {
    color: '#DCEBFF',
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryChoices: {
    gap: 12,
  },
  walletSection: {
    marginBottom: 16,
  },
  foundryButton: {
    backgroundColor: '#10201F',
    borderWidth: 1,
    borderColor: '#4ECDC4',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#4ECDC4',
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  foundryEyebrow: {
    color: '#F0B429',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  foundryButtonText: {
    color: '#4ECDC4',
    fontSize: 20,
    fontWeight: '800',
  },
  foundrySubtext: {
    color: '#8B949E',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0D1117',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#4ECDC4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4ECDC4',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  textDisabled: {
    opacity: 0.5,
  },
  connectPrompt: {
    color: '#484F58',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
});
