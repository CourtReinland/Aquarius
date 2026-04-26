import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert that works on web and native.
 * On web, Alert.alert is a no-op, so we use window.alert.
 */
export function showAlert(title: string, message?: string, onOk?: () => void) {
  if (Platform.OS === 'web') {
    window.alert(`${title}${message ? '\n\n' + message : ''}`);
    onOk?.();
  } else {
    Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
  }
}
