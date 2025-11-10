import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
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

  const { activeLine, isMutating, isHydrating, takeControl, releaseControl } = useChatControl({
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

  const [leaseCountdown, setLeaseCountdown] = useState<number>(0);

  const isLeaseHolder = !!localParticipantId && activeLine?.leaseTo === localParticipantId;
  const activeStepIndex = activeLine?.stepIndex ?? 0;

  useEffect(() => {
    if (!activeLine?.leaseExpiresAt) {
      setLeaseCountdown(0);
      return;
    }
    const update = () => {
      setLeaseCountdown(Math.max(0, Math.floor((activeLine.leaseExpiresAt - Date.now()) / 1000)));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [activeLine?.leaseId, activeLine?.leaseExpiresAt]);

  const canDraw =
    !!localParticipantId && !isMutating && (!activeLine?.leaseTo || activeLine.leaseTo === localParticipantId);

  const disabledReason = useMemo(() => {
    if (isMutating) {
      return 'Hang on… syncing control.';
    }
    if (!localParticipantId) {
      return 'Waiting for identity…';
    }
    if (!activeLine?.leaseTo) {
      return undefined;
    }
    if (activeLine.leaseTo === localParticipantId) {
      return undefined;
    }
    if (activeLine.leaseExpiresAt) {
      return `Host guiding… (${leaseCountdown}s)`;
    }
    return 'Host guiding…';
  }, [activeLine?.leaseExpiresAt, activeLine?.leaseTo, isMutating, leaseCountdown, localParticipantId]);

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

  const handleTakeControl = useCallback(async () => {
    if (!localParticipantId) return;
    await takeControl(activeStepIndex);
  }, [activeStepIndex, localParticipantId, takeControl]);

  const handleReleaseControl = useCallback(async () => {
    await releaseControl();
  }, [releaseControl]);

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
      <View style={styles.controlContainer}>
        <View style={styles.controlPill}>
          <View style={[styles.statusDot, isLeaseHolder ? styles.statusDotActive : styles.statusDotIdle]} />
          <ThemedText style={styles.controlText}>
            {isLeaseHolder
              ? 'You have control'
              : activeLine?.leaseTo
              ? `Waiting for host${leaseCountdown > 0 ? ` · ${leaseCountdown}s` : ''}`
              : isHydrating
              ? 'Synchronizing…'
              : 'Line available'}
          </ThemedText>
          <TouchableOpacity
            style={[styles.controlButton, isLeaseHolder ? styles.controlButtonGhost : styles.controlButtonPrimary]}
            onPress={isLeaseHolder ? handleReleaseControl : handleTakeControl}
            disabled={isMutating || !localParticipantId}
          >
            <ThemedText style={isLeaseHolder ? styles.controlButtonGhostText : styles.controlButtonPrimaryText}>
              {isMutating ? 'Syncing…' : isLeaseHolder ? 'Release' : 'Take Control'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
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
  controlContainer: {
    position: 'absolute',
    top: 24,
    right: 24,
    left: 24,
    zIndex: 10,
  },
  controlPill: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotIdle: {
    backgroundColor: '#CBD5F5',
  },
  controlText: {
    fontSize: 13,
    color: '#475569',
  },
  controlButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  controlButtonPrimary: {
    backgroundColor: '#2563EB',
  },
  controlButtonPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  controlButtonGhost: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#94A3B8',
    backgroundColor: 'transparent',
  },
  controlButtonGhostText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
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


