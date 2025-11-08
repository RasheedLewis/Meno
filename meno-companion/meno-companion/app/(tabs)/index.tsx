import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { API_BASE_URL } from '@/constants/config';
import { randomId } from '@/lib/randomId';

export default function HomeScreen() {
  const router = useRouter();
  const [sessionInput, setSessionInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);

  const canSubmit = useMemo(() => sessionInput.trim().length > 0, [sessionInput]);

  useEffect(() => {
    const ensureParticipantId = async () => {
      const key = 'meno-companion-participant-id';
      try {
        const existing = await AsyncStorage.getItem(key);
        if (existing) {
          setParticipantId(existing);
          return;
        }
        const generated = randomId('companion');
        await AsyncStorage.setItem(key, generated);
        setParticipantId(generated);
      } catch (storageError) {
        console.warn('Failed to access participantId storage', storageError);
        setParticipantId(randomId('companion'));
      }
    };

    void ensureParticipantId();
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!participantId) return;

    const normalized = sessionInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/sessions/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: normalized,
          participant: {
            id: participantId,
            name: 'Tablet Companion',
            role: 'observer',
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Failed to join session');
      }

      const sessionId: string | undefined = payload.data?.sessionId;
      if (!sessionId) {
        throw new Error('Session ID missing in response');
      }

      router.push(`/session/${sessionId}`);
    } catch (joinError) {
      console.error('Companion join failed', joinError);
      setError(joinError instanceof Error ? joinError.message : 'Unable to join session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const backgroundColor = useThemeColor({}, 'background');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const accentColor = useThemeColor({}, 'tint');
  const accentContrast = useThemeColor({}, 'accentContrast');
  const mutedColor = useThemeColor({}, 'muted');
  const textColor = useThemeColor({}, 'text');
  const paperColor = useThemeColor({}, 'paper');

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={[styles.root, { backgroundColor }]}>
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <ThemedText type="title" style={styles.heading}>
          Companion Mode
        </ThemedText>
        <ThemedText type="subtitle" style={[styles.subtitle, { color: mutedColor }]}>
          Pair this tablet with an active Meno classroom so every stroke, eraser pass, and cue stays
          in sync.
        </ThemedText>

        <View
          style={[
            styles.card,
            {
              backgroundColor: cardColor,
              borderColor,
              shadowColor: borderColor,
            },
          ]}>
          <ThemedText type="defaultSemiBold" style={[styles.label, { color: mutedColor }]}>
            Enter session ID
          </ThemedText>
          <TextInput
            placeholder="e.g. C184 or etna-geometry"
            placeholderTextColor={`${mutedColor}99`}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                backgroundColor: paperColor,
                borderColor,
                color: textColor,
              },
            ]}
            value={sessionInput}
            onChangeText={setSessionInput}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Join session"
            style={[
              styles.button,
              {
                backgroundColor: accentColor,
                opacity: canSubmit && !isSubmitting ? 1 : 0.4,
              },
            ]}
            disabled={!canSubmit || isSubmitting || !participantId}
            onPress={handleSubmit}>
            <ThemedText
              type="defaultSemiBold"
              style={[styles.buttonText, { color: accentContrast }]}>
              {isSubmitting ? 'Joining…' : 'Join Session'}
            </ThemedText>
          </Pressable>
          {error ? (
            <ThemedText style={[styles.errorText, { color: accentColor }]}>{error}</ThemedText>
          ) : null}
        </View>

        <ThemedText style={[styles.helper, { color: mutedColor }]}>
          Ask the classroom host for the session code in the top bar. Companion mode mirrors the
          shared canvas while keeping your identity color and awareness cursor aligned with Meno.
        </ThemedText>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 64,
    gap: 28,
  },
  heading: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 480,
    alignSelf: 'center',
  },
  card: {
    gap: 12,
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
  },
  label: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: Platform.select({ ios: 16, default: 12 }),
    fontSize: 18,
    borderWidth: 1,
  },
  button: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 15,
  },
  helper: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 520,
    alignSelf: 'center',
  },
  errorText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13,
  },
});
