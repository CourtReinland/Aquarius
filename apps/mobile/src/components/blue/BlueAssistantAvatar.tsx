import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  createBlueAvatarCue,
  getBlueMouthFrame,
  type BlueAvatarState,
  type BlueMouthFrame,
} from '@aquarius/shared';

const BLUE_AVATAR = require('../../../assets/blueAvatar.png');
const BLUE_HERO_AVATAR = require('../../../assets/blueAvatarHero.png');

interface BlueAssistantAvatarProps {
  state?: BlueAvatarState;
  speechText?: string;
  audioLevel?: number;
  size?: number;
  caption?: string;
  showFrameworkBadge?: boolean;
  variant?: 'portrait' | 'hero';
}

export function BlueAssistantAvatar({
  state = 'idle',
  speechText,
  audioLevel,
  size = 220,
  caption,
  showFrameworkBadge = false,
  variant = 'portrait',
}: BlueAssistantAvatarProps) {
  const float = useSharedValue(0);
  const blink = useSharedValue(0);
  const talkPulse = useSharedValue(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const cue = useMemo(
    () => createBlueAvatarCue(state, { text: speechText, audioLevel }),
    [audioLevel, speechText, state]
  );
  const mouthFrame = useMemo(
    () => getBlueMouthFrame({ state, elapsedMs, text: speechText, audioLevel }),
    [audioLevel, elapsedMs, speechText, state]
  );

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [float]);

  useEffect(() => {
    const interval = setInterval(() => {
      blink.value = withSequence(
        withTiming(1, { duration: 90 }),
        withTiming(0, { duration: 140 })
      );
    }, cue.blinkIntervalMs);

    return () => clearInterval(interval);
  }, [blink, cue.blinkIntervalMs]);

  useEffect(() => {
    if (!cue.lipSyncEnabled) {
      talkPulse.value = withTiming(0, { duration: 180 });
      return;
    }

    talkPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 180, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 210, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [cue.lipSyncEnabled, talkPulse]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMs((current) => current + 80);
    }, 80);

    return () => clearInterval(interval);
  }, []);

  const avatarStyle = useAnimatedStyle(() => {
    const lift = interpolate(float.value, [0, 1], [0, -8 * cue.floatIntensity]);
    const rotate = interpolate(float.value, [0, 1], [-0.8, 0.8]);
    const speakingScale = interpolate(talkPulse.value, [0, 1], [1, cue.lipSyncEnabled ? 1.012 : 1]);

    return {
      transform: [
        { translateY: lift },
        { rotate: `${rotate}deg` },
        { scale: speakingScale },
      ],
    };
  });

  const eyelidStyle = useAnimatedStyle(() => ({
    opacity: interpolate(blink.value, [0, 1], [0, 0.55]),
    transform: [{ scaleY: interpolate(blink.value, [0, 1], [0.2, 1]) }],
  }));

  const mouthStyle = buildMouthStyle(mouthFrame, size, variant);
  const imageSource = variant === 'hero' ? BLUE_HERO_AVATAR : BLUE_AVATAR;
  const heroWidth = size * 0.78;
  const heroHeight = size * 1.4;

  return (
    <View style={[styles.shell, variant === 'hero' ? { width: heroWidth, height: heroHeight } : { width: size + 36 }]}>
      <Animated.View style={[variant === 'hero' ? styles.heroFloat : styles.avatarFloat, avatarStyle]}>
        {variant === 'portrait' ? (
          <View style={[styles.glow, { width: size, height: size, borderRadius: size / 2 }]} />
        ) : (
          <View style={[styles.heroGlow, { width: heroWidth * 0.76, height: heroHeight * 0.62 }]} />
        )}
        <Image
          source={imageSource}
          resizeMode={variant === 'hero' ? 'cover' : 'cover'}
          accessibilityLabel="Blue, the Aquarius setup assistant"
          style={variant === 'hero'
            ? [styles.heroImage, { width: heroWidth, height: heroHeight }]
            : [styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]
          }
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.eyelid,
            variant === 'hero'
              ? {
                  width: size * 0.16,
                  height: size * 0.04,
                  top: size * 0.33,
                  left: size * 0.19,
                  borderRadius: size * 0.02,
                }
              : {
                  width: size * 0.38,
                  height: size * 0.11,
                  top: size * 0.345,
                  left: size * 0.31,
                  borderRadius: size * 0.055,
                },
            eyelidStyle,
          ]}
        />
        <View pointerEvents="none" style={[styles.mouth, mouthStyle]} />
      </Animated.View>

      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      {showFrameworkBadge ? (
        <Text style={styles.frameworkBadge}>Reanimated now · VRM-ready later</Text>
      ) : null}
    </View>
  );
}

function buildMouthStyle(frame: BlueMouthFrame, size: number, variant: 'portrait' | 'hero') {
  const width = variant === 'hero'
    ? size * (0.024 + frame.width * 0.022)
    : size * (0.05 + frame.width * 0.055);
  const height = variant === 'hero'
    ? size * (0.006 + frame.openness * 0.026)
    : size * (0.012 + frame.openness * 0.065);

  return {
    width,
    height,
    left: variant === 'hero' ? size * 0.246 : (size - width) / 2,
    top: variant === 'hero' ? size * 0.418 : size * 0.545,
    borderRadius: Math.max(width, height) / 2,
    opacity: frame.shape === 'closed' ? 0.12 : 0.72,
    transform: [{ translateX: frame.smile * size * 0.01 }],
  };
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
  },
  avatarFloat: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFloat: {
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  glow: {
    position: 'absolute',
    backgroundColor: '#5DADEC',
    opacity: 0.2,
    shadowColor: '#7DD3FC',
    shadowOpacity: 0.8,
    shadowRadius: 28,
  },
  avatarImage: {
    borderWidth: 1,
    borderColor: '#8EC5FF',
    backgroundColor: '#07111F',
  },
  heroImage: {
    backgroundColor: 'transparent',
  },
  heroGlow: {
    position: 'absolute',
    left: -18,
    bottom: 48,
    backgroundColor: '#7DD3FC',
    opacity: 0.14,
    borderRadius: 180,
    shadowColor: '#A5F3FC',
    shadowOpacity: 0.48,
    shadowRadius: 36,
  },
  eyelid: {
    position: 'absolute',
    backgroundColor: '#101827',
  },
  mouth: {
    position: 'absolute',
    backgroundColor: '#251221',
    borderColor: 'rgba(255, 210, 230, 0.55)',
    borderWidth: 1,
  },
  caption: {
    color: '#DCEBFF',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 16,
  },
  frameworkBadge: {
    color: '#8B949E',
    fontSize: 11,
    marginTop: 8,
    letterSpacing: 0.4,
  },
});
