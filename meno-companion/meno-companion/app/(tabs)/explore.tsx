import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

const ENTRY_SPACING = 18;

const beforePairing = [
  'Confirm the host has created or joined a Meno classroom session.',
  'Ensure the Yjs websocket bridge (`/yws/:sessionId`) is reachable.',
  'Verify the DynamoDB session registry is populated for this cohort.',
  'Prefer the same Wi‑Fi network as the classroom display to reduce latency.',
];

const joinSteps = [
  'Ask the host for the session code shown in the classroom top bar.',
  'Enter the code on the Session tab here, then press “Join Session”.',
  'Wait for the “Connecting to session…” spinner to dismiss before drawing.',
];

const syncedItems = [
  'Pen strokes, eraser sweeps, undo/redo history',
  'Awareness cursors with role + identity color',
  'Shared step subdocs, session metadata, and event log',
];

const troubleshooting = [
  'If nothing loads, double-check the session code and network connectivity.',
  'Restart the companion app if awareness cursors freeze or drift.',
  'Inspect the Expo console for Yjs websocket disconnects or auth errors.',
  'Rejoin the session to refresh local persistence (`y-indexeddb`).',
];

const Section = ({
  title,
  items,
  accentColor,
  cardColor,
  borderColor,
}: {
  title: string;
  items: string[];
  accentColor: string;
  cardColor: string;
  borderColor: string;
}) => (
  <View style={[styles.section, { backgroundColor: cardColor, borderColor }]}>
    <ThemedText type="subtitle" style={[styles.sectionTitle, { color: accentColor }]}>
      {title}
    </ThemedText>
    {items.map((item) => (
      <ThemedText key={item} style={styles.sectionItem}>
        • {item}
      </ThemedText>
    ))}
  </View>
);

export default function CompanionGuideScreen() {
  const background = useThemeColor({}, 'background');
  const accent = useThemeColor({}, 'accent');
  const muted = useThemeColor({}, 'muted');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <ThemedText type="title" style={styles.heading}>
          Companion Guide
        </ThemedText>
        <ThemedText style={[styles.lead, { color: muted }]}>
          Follow these checkpoints to keep the companion tablet perfectly matched with the Meno
          classroom canvas.
        </ThemedText>

        <Section
          title="Before pairing"
          items={beforePairing}
          accentColor={accent}
          cardColor={card}
          borderColor={border}
        />

        <Section
          title="Join from tablet"
          items={joinSteps}
          accentColor={accent}
          cardColor={card}
          borderColor={border}
        />

        <Section
          title="What stays in sync"
          items={syncedItems}
          accentColor={accent}
          cardColor={card}
          borderColor={border}
        />

        <Section
          title="Troubleshooting"
          items={troubleshooting}
          accentColor={accent}
          cardColor={card}
          borderColor={border}
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 28,
    paddingBottom: 48,
    paddingTop: 52,
    gap: ENTRY_SPACING,
  },
  heading: {
    textAlign: 'center',
  },
  lead: {
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 520,
    alignSelf: 'center',
  },
  section: {
    gap: 10,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: 'rgba(0,0,0,0.12)',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
  },
  sectionTitle: {
    letterSpacing: 0.25,
  },
  sectionItem: {
    fontSize: 16,
    lineHeight: 24,
  },
});
