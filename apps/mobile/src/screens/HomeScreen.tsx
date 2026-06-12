import React from 'react';
import {
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export function HomeScreen({ navigation }: Props) {
  return (
    <ImageBackground
      source={require('../../assets/Blu_Avtr.png')}
      resizeMode="cover"
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.menuHitArea}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Found Community"
            hitSlop={12}
            onPress={() => navigation.navigate('FoundCommunity')}
            style={({ pressed }) => [styles.menuOption, pressed && styles.menuOptionPressed]}
          >
            <Text style={styles.menuText}>1. Found Community</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Join Community"
            hitSlop={12}
            onPress={() => navigation.navigate('MainTabs')}
            style={({ pressed }) => [styles.menuOption, pressed && styles.menuOptionPressed]}
          >
            <Text style={styles.menuText}>2. Join Community</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#071B31',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
  },
  menuHitArea: {
    position: 'absolute',
    top: Platform.select({ web: '24.7%', default: '25%' }),
    left: '29.5%',
    width: '58%',
  },
  menuOption: {
    alignSelf: 'flex-start',
    marginBottom: 22,
    paddingVertical: 7,
    paddingHorizontal: 4,
  },
  menuOptionPressed: {
    opacity: 0.68,
    transform: [{ translateX: 2 }],
  },
  menuText: {
    color: '#9EDFFF',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
    fontSize: 30,
    fontWeight: '400',
    letterSpacing: 0.2,
    lineHeight: 38,
    textShadowColor: 'rgba(6, 21, 38, 0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});
