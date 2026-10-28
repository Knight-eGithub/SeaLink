import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerTintColor: '#167D6A',
          headerTitleStyle: {
            fontWeight: '800',
            fontSize: 17,
            color: '#17252D',
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: '#F7F9FA',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false, // The home screen implements its custom branded header
          }}
        />
        <Stack.Screen
          name="connect"
          options={{
            title: 'ESP32 LoRa Gateway',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="boats"
          options={{
            title: 'Fleet Directory',
            headerBackTitle: 'Chats',
          }}
        />
        <Stack.Screen
          name="chat/[boatId]"
          options={{
            title: 'Boat Chat',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Vessel Identity',
            headerBackTitle: 'Back',
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
