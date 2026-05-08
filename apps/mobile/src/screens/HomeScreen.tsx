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
import { BlueAssistantAvatar, BlueOnboardingBackground } from '../components/blue';
import { useWalletStore } from '../hooks/useWalletStore';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export function HomeScreen({ navigation }: Props) {
  const { isConnected } = useWalletStore();

  return (
    <SafeAreaView style={styles.container}>
      <BlueOnboardingBackground />

      <View style={styles.menuLayer}>
        <Text style={styles.blueLabel}>BLUE</Text>
        <Text style={styles.greeting}>Hi, I'm Blue. I'm here to help you get set up.</Text>

        <View style={styles.menuChoices}>
          <TouchableOpacity
            style={styles.menuChoice}
            onPress={() => navigation.navigate('FoundCommunity')}
          >
            <Text style={styles.menuChoiceText}>1. Found Community</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuChoice}
            onPress={() => navigation.navigate('MainTabs')}
          >
            <Text style={styles.menuChoiceText}>2. Join Community</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.avatarLayer} pointerEvents="none">
        <BlueAssistantAvatar
          state="speaking"
          speechText="Hi, I'm Blue. I'm here to help you get set up. Would you like to found a community or join an existing one?"
          size={430}
          variant="hero"
        />
      </View>

      <View style={styles.bottomControls}>
        <View style={styles.walletSection}>
          <WalletConnect />
        </View>

        <TouchableOpacity
          style={styles.advancedLink}
          onPress={() => navigation.navigate('CreateAIAgent', {
            communityAddress: '0x0000000000000000000000000000000000000001',
            communityName: 'Agent Foundry Preview',
          })}
        >
          <Text style={styles.advancedLinkText}>ADVANCED / AGENT FOUNDRY</Text>
        </TouchableOpacity>

        {!isConnected && (
          <Text style={styles.connectPrompt}>
            Wallet can wait. Connect before creating on-chain records.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B1A',
    overflow: 'hidden',
  },
  menuLayer: {
    position: 'absolute',
    top: 76,
    left: 34,
    right: 24,
    zIndex: 4,
  },
  blueLabel: {
    color: '#8EC5FF',
    fontFamily: 'Roboto Mono',
    fontSize: 13,
    letterSpacing: 8,
    marginBottom: 18,
    opacity: 0.74,
  },
  greeting: {
    color: '#DCEBFF',
    fontFamily: 'Roboto Mono',
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 310,
    opacity: 0.92,
    marginBottom: 34,
  },
  menuChoices: {
    gap: 18,
  },
  menuChoice: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingRight: 14,
  },
  menuChoiceText: {
    color: '#CFF8FF',
    fontFamily: 'Roboto Mono',
    fontSize: 25,
    lineHeight: 34,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(118, 220, 232, 0.55)',
    textShadowRadius: 12,
  },
  avatarLayer: {
    position: 'absolute',
    left: -86,
    bottom: -118,
    zIndex: 2,
  },
  bottomControls: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 28,
    zIndex: 5,
  },
  walletSection: {
    marginBottom: 12,
    opacity: 0.92,
  },
  advancedLink: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingRight: 10,
  },
  advancedLinkText: {
    color: '#8BDEF2',
    fontFamily: 'Roboto Mono',
    fontSize: 12,
    letterSpacing: 1.4,
    opacity: 0.86,
  },
  connectPrompt: {
    color: '#89A6C5',
    fontFamily: 'Roboto Mono',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    opacity: 0.78,
  },
});
