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
import { submitLine } from '@/lib/api/lease';

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

  const { activeLine, isMutating, isHydrating, takeControl, releaseControl, setActiveLineState } = useChatControl({
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const canSubmit = canDraw && isLeaseHolder && strokes.length > 0 && !isSubmitting;

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

  const handleSubmitLine = useCallback(async () => {
    if (!sessionId || !localParticipantId || !strokes.length) {
      return;
    }
    const stepIndex = typeof activeLine?.stepIndex === 'number' ? activeLine.stepIndex : 0;
    setIsSubmitting(true);
    try {
      const response = await submitLine(sessionId, stepIndex, {
        strokes,
        leaseTo: localParticipantId,
        submitter: {
          participantId: localParticipantId,
          name: displayName,
          role: 'student',
        },
      });
      if (!response.ok) {
        setFeedback({
          type: 'error',
          message: response.error ?? 'Submission failed. Please try again.',
        });
        return;
      }
      const { attempt, nextActiveLine, advanced, solverError } = response.data;
      setActiveLineState(nextActiveLine);

      const solver = attempt?.solver;
      if (advanced) {
        const successMessage = solver?.expression
          ? `Nice! “${solver.expression}” keeps things moving.`
          : 'Correct step! Move on to the next line.';
        setFeedback({ type: 'success', message: successMessage });
      } else {
        const failureMessage =
          solverError ??
          (solver?.expression
            ? `I read this as “${solver.expression}”. Try connecting it to the next step.`
            : 'This step needs a bit more detail. Give it another shot.');
        setFeedback({ type: 'error', message: failureMessage });
      }
    } catch (error) {
      console.warn('Submit line failed', error);
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Submission failed. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [activeLine?.stepIndex, displayName, localParticipantId, sessionId, setActiveLineState, strokes]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => {
      setFeedback(null);
    }, 2600);
    return () => clearTimeout(timer);
  }, [feedback]);

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
      <View style={styles.submitContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.submitButton, (!canSubmit || isMutating) && styles.submitButtonDisabled]}
          onPress={handleSubmitLine}
          activeOpacity={0.88}
          disabled={!canSubmit}
        >
          <ThemedText style={styles.submitButtonText}>{isSubmitting ? 'Submitting…' : 'Submit Step'}</ThemedText>
        </TouchableOpacity>
      </View>
      {feedback ? (
        <View style={styles.feedbackContainer} pointerEvents="none">
          <View
            style={[
              styles.feedbackPill,
              feedback.type === 'success' ? styles.feedbackPillSuccess : styles.feedbackPillError,
            ]}
          >
            <ThemedText style={styles.feedbackText}>{feedback.message}</ThemedText>
          </View>
        </View>
      ) : null}
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
  submitContainer: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
  submitButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    shadowColor: '#1e3a8a',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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
  feedbackContainer: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackPill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  feedbackPillSuccess: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(187, 247, 208, 0.92)',
  },
  feedbackPillError: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(254, 226, 226, 0.92)',
  },
  feedbackText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});


