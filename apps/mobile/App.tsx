import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppNavigator } from './src/navigation/AppNavigator';
import { BlockchainProvider } from './src/context/BlockchainContext';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <BlockchainProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </BlockchainProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
