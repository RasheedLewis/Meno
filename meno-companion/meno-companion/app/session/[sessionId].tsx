import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import SharedSkiaCanvas from '@/components/SharedSkiaCanvas';
import { ThemedText } from '@/components/themed-text';
import { useSharedCanvas } from '@/hooks/use-shared-canvas';
import { useSessionYjs } from '@/hooks/use-session-yjs';
import { useChatControl } from '@/hooks/use-chat-control';
import { randomId } from '@/lib/randomId';

export default function SessionScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : null;

  const identityColor = '#F97316';
  const displayName = 'Tablet Companion';
  const [localParticipantId, setLocalParticipantId] = useState<string | null>(null);

  useEffect(() => {
    const loadParticipantId = async () => {
      try {
        const stored = await AsyncStorage.getItem('meno-companion-participant-id');
        if (stored) {
          setLocalParticipantId(stored);
        } else {
          const generated = randomId('companion');
          await AsyncStorage.setItem('meno-companion-participant-id', generated);
          setLocalParticipantId(generated);
        }
      } catch (error) {
        console.warn('Failed to load companion participant id', error);
        setLocalParticipantId(randomId('companion'));
      }
    };

    void loadParticipantId();
  }, []);

  const connection = useSessionYjs(sessionId, 'companion', {
    color: identityColor,
    participantId: localParticipantId ?? undefined,
  });

  const activeLine = useChatControl({
    sessionId,
    participantId: localParticipantId,
    name: displayName,
    role: 'companion',
  });

  const {
    strokes,
    beginStroke,
    appendToStroke,
    endStroke,
    cancelStroke,
    clear,
    eraseStroke,
    awareness,
  } = useSharedCanvas(connection);

  const handleBeginStroke = useCallback(
    (point: { x: number; y: number }, size: number) =>
      beginStroke({
        color: identityColor,
        size,
        author: localParticipantId ?? 'companion',
        start: point,
      }),
    [beginStroke, identityColor, localParticipantId],
  );

  const canDraw =
    !!localParticipantId &&
    (!activeLine?.leaseTo || activeLine.leaseTo === localParticipantId);

  const disabledReason =
    !canDraw && activeLine?.leaseExpiresAt
      ? `Waiting for host… (${Math.max(0, Math.floor((activeLine.leaseExpiresAt - Date.now()) / 1000))}s)`
      : undefined;

  const handleEraseLast = useCallback(() => {
    const last = strokes.at(-1);
    if (last) {
      eraseStroke(last.id);
    }
  }, [eraseStroke, strokes]);

  const [pointerState, setPointerState] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!connection?.awareness) return;
    const current = connection.awareness.getLocalState() ?? {};
    connection.awareness.setLocalState({
      ...current,
      role: 'companion',
      client: 'tablet',
      color: identityColor,
      participantId: localParticipantId ?? 'companion',
      displayName,
      pointer: pointerState,
      updatedAt: Date.now(),
    });
  }, [connection?.awareness, identityColor, pointerState, localParticipantId, displayName]);

  const handlePointerUpdate = useCallback(
    (point: { x: number; y: number } | null) => {
      setPointerState(point);
      if (!connection?.awareness) return;
      const current = connection.awareness.getLocalState() ?? {};
      connection.awareness.setLocalState({
        ...current,
        pointer: point,
        color: identityColor,
        participantId: localParticipantId ?? 'companion',
        displayName,
        updatedAt: Date.now(),
      });
    },
    [connection?.awareness, identityColor, localParticipantId, displayName],
  );

  if (!connection) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={identityColor} />
        <ThemedText style={styles.loadingText}>Connecting to session…</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SharedSkiaCanvas
        strokes={strokes}
        beginStroke={handleBeginStroke}
        appendToStroke={appendToStroke}
        endStroke={endStroke}
        cancelStroke={cancelStroke}
        onClear={clear}
        onEraseLast={handleEraseLast}
        pointerColor={identityColor}
        awareness={awareness}
        localParticipantId={localParticipantId ?? 'companion'}
        localDisplayName={displayName}
        onPointerUpdate={handlePointerUpdate}
        activeStepIndex={activeLine?.stepIndex ?? null}
        canDraw={canDraw}
        disabledReason={disabledReason}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#F1F5F9',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#F1F5F9',
  },
  loadingText: {
    color: '#64748B',
  },
});


