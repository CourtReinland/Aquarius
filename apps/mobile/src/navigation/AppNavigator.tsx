import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';

// Screens
import { HomeScreen } from '../screens/HomeScreen';
import { CommunityExplorer } from '../screens/CommunityExplorer';
import { FoundCommunityWizard } from '../screens/FoundCommunityWizard';
import { FoundCommunitySuccess } from '../screens/FoundCommunitySuccess';
import { CommunityDashboard } from '../screens/CommunityDashboard';
import { ProposalsTracker } from '../screens/ProposalsTracker';
import { BankingSetup } from '../screens/BankingSetup';
import { BilawsExplorer } from '../screens/BilawsExplorer';
import { HistoriesExplorer } from '../screens/HistoriesExplorer';
import { CongratsRole } from '../screens/CongratsRole';
import { ApproveAlliance } from '../screens/ApproveAlliance';

// ─── Types ────────────────────────────────────────────────────────

export type RootStackParamList = {
  Home: undefined;
  MainTabs: undefined;
  FoundCommunity: undefined;
  FoundCommunitySuccess: { name: string; address: string; txHash: string };
  CommunityDashboard: { address: string };
  BankingSetup: { communityAddress?: string };
  CongratsRole: undefined;
  ApproveAlliance: undefined;
};

export type TabParamList = {
  Explorer: undefined;
  Proposals: undefined;
  Profile: undefined;
  Bilaws: undefined;
  Histories: undefined;
};

// ─── Tab Icon ─────────────────────────────────────────────────────

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Explorer: '\u{1F3DB}',   // classical building
    Proposals: '\u{1F4CB}',  // clipboard
    Profile: '\u{1F464}',    // bust
    Bilaws: '\u{1F4DC}',     // scroll
    Histories: '\u{1F570}',  // mantelpiece clock
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20 }}>{icons[label] || '?'}</Text>
      <Text
        style={{
          fontSize: 9,
          color: focused ? '#4ECDC4' : '#484F58',
          marginTop: 2,
          fontWeight: focused ? '700' : '400',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Bottom Tabs ──────────────────────────────────────────────────

const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#0D1117',
          borderTopColor: '#30363D',
          height: 65,
          paddingBottom: 8,
        },
        tabBarShowLabel: false,
        headerStyle: { backgroundColor: '#0D1117' },
        headerTintColor: '#4ECDC4',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tab.Screen
        name="Explorer"
        component={CommunityExplorer}
        options={{
          title: 'Community Explorer',
          tabBarIcon: ({ focused }) => <TabIcon label="Explorer" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Proposals"
        component={ProposalsTracker}
        options={{
          title: 'Proposals Tracker',
          tabBarIcon: ({ focused }) => <TabIcon label="Proposals" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={CommunityDashboard}
        options={{
          title: 'My Memberships',
          tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Bilaws"
        component={BilawsExplorer}
        options={{
          title: 'Bi-laws Explorer',
          tabBarIcon: ({ focused }) => <TabIcon label="Bilaws" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Histories"
        component={HistoriesExplorer}
        options={{
          title: 'Histories Explorer',
          tabBarIcon: ({ focused }) => <TabIcon label="Histories" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Root Stack ───────────────────────────────────────────────────

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#0D1117' },
          headerTintColor: '#4ECDC4',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#0D1117' },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FoundCommunity"
          component={FoundCommunityWizard}
          options={{ title: 'Found Community' }}
        />
        <Stack.Screen
          name="FoundCommunitySuccess"
          component={FoundCommunitySuccess}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CommunityDashboard"
          component={CommunityDashboard}
          options={{ title: 'Dashboard' }}
        />
        <Stack.Screen
          name="BankingSetup"
          component={BankingSetup}
          options={{ title: 'Banking Setup' }}
        />
        <Stack.Screen
          name="CongratsRole"
          component={CongratsRole}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ApproveAlliance"
          component={ApproveAlliance}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
