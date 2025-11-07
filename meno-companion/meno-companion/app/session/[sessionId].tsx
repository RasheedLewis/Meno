import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useSessionYjs } from '@/hooks/use-session-yjs';

export default function SessionScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : null;

  const connection = useSessionYjs(sessionId, 'companion');
  const connected = Boolean(connection);

  return (
    <View style={styles.container}>
      <ThemedText type="title">Companion Session</ThemedText>
      <ThemedText>Session ID: {sessionId ?? '—'}</ThemedText>
      <ThemedText>Status: {connected ? 'Connected' : 'Connecting…'}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
});


