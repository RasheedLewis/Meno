import 'react-native-get-random-values';
import crypto from '@/polyfills/isomorphic-webcrypto-react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { Buffer } from 'buffer';

import { useColorScheme } from '@/hooks/use-color-scheme';

if (typeof global.crypto === 'undefined') {
  global.crypto = crypto as unknown as Crypto;
}

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
