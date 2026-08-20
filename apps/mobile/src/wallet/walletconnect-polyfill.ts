/**
 * WalletConnect v2 React Native polyfills.
 *
 * `@walletconnect/react-native-compat` must load before the Ethereum provider.
 * Web preview skips these — WC pairing is Android-first (see README).
 */
import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  require('react-native-get-random-values');
  require('@walletconnect/react-native-compat');
}
