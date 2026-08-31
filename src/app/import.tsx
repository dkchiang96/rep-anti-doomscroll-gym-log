import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  buildConventionQuestions,
  conventionQuestionsToDecisions,
  type ConventionQuestion,
  type LoadConvention,
} from '@/domain/conventionReconciliation';
import { parseExerciseLine, parseKeepExport, type ParsedSession, type ReviewItem } from '@/domain/keepParser';
import { suggestReviewResolution } from '@/domain/reviewSuggestions';
import { useDatabase } from '@/data/DatabaseProvider';
import { importKeepSessions, type ImportSummary } from '@/data/repositories/importRepository';
import { strings } from '@/strings';
import { theme } from '@/theme';

type Stage = 'paste' | 'review' | 'importing' | 'done';

interface ReviewRow extends ReviewItem {
  id: number;
}

function mergeQuestions(previous: ConventionQuestion[], next: ConventionQuestion[]): ConventionQuestion[] {
  const byName = new Map(previous.map((q) => [q.exerciseName, q]));
  return next.map((q) => byName.get(q.exerciseName) ?? q);
}

function dateHeaderLabel(d: { year: number; month: number; day: number }): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.day} ${monthNames[d.month]} ${d.year}`;
}

function ConventionToggle({
  value,
  onChange,
}: {
  value: LoadConvention;
  onChange: (v: LoadConvention) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Pressable
        style={[styles.toggleOption, value === 'per_side' && styles.toggleOptionActive]}
        onPress={() => onChange('per_side')}>
        <Text style={[styles.toggleLabel, value === 'per_side' && styles.toggleLabelActive]}>
          {strings.importConventionPerSide}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.toggleOption, value === 'total' && styles.toggleOptionActive]}
        onPress={() => onChange('total')}>
        <Text style={[styles.toggleLabel, value === 'total' && styles.toggleLabelActive]}>
          {strings.importConventionTotal}
        </Text>
      </Pressable>
    </View>
  );
}

function ReviewItemCard({
  item,
  onApply,
  onDiscard,
}: {
  item: ReviewRow;
  onApply: (id: number, editedText: string) => boolean;
  onDiscard: (id: number) => void;
}) {
  const suggestion = useMemo(() => suggestReviewResolution(item), [item]);
  const [editedText, setEditedText] = useState(item.rawFragment);
  const [showError, setShowError] = useState(false);

  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewContext}>{item.context}</Text>
      <Text style={styles.mutedText}>{item.reason}</Text>
      <Text style={styles.suggestionText}>{suggestion.message}</Text>

      {suggestion.editable && item.sessionIndex !== undefined ? (
        <>
          <Text style={styles.label}>{strings.importReviewEditLabel}</Text>
          <TextInput
            style={styles.reviewInput}
            value={editedText}
            onChangeText={(t) => {
              setEditedText(t);
              setShowError(false);
            }}
          />
          {showError ? <Text style={styles.errorText}>{strings.importReviewStillUnparsed}</Text> : null}
          <View style={styles.toggleRow}>
            <Pressable
              style={styles.secondaryButtonSmall}
              onPress={() => onDiscard(item.id)}>
              <Text style={styles.secondaryButtonLabel}>{strings.importReviewDiscardButton}</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButtonSmall}
              onPress={() => {
                const applied = onApply(item.id, editedText);
                if (!applied) setShowError(true);
              }}>
              <Text style={styles.primaryButtonLabel}>{strings.importReviewApplyButton}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={styles.reviewFragment}>{item.rawFragment}</Text>
      )}
    </View>
  );
}

export default function ImportScreen() {
  const { db, userId } = useDatabase();

  const [stage, setStage] = useState<Stage>('paste');
  const [rawText, setRawText] = useState('');
  const [yearText, setYearText] = useState(String(new Date().getFullYear()));
  const [yearError, setYearError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ParsedSession[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewRow[]>([]);
  const [nextReviewId, setNextReviewId] = useState(0);
  const [questions, setQuestions] = useState<ConventionQuestion[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const sessionCount = sessions.length;
  const exerciseEntryCount = useMemo(() => sessions.reduce((n, s) => n + s.exercises.length, 0), [sessions]);
  const setCount = useMemo(
    () => sessions.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0), 0),
    [sessions],
  );

  function handleParse() {
    const year = parseInt(yearText, 10);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      setYearError(strings.importYearError);
      return;
    }
    setYearError(null);
    const result = parseKeepExport(rawText, { year });
    setSessions(result.sessions);
    setReviewItems(result.needsReview.map((r, id) => ({ ...r, id })));
    setNextReviewId(result.needsReview.length);
    setQuestions(buildConventionQuestions(result.sessions));
    setStage('review');
  }

  function updateQuestion(exerciseName: string, patch: Partial<ConventionQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.exerciseName === exerciseName ? { ...q, ...patch } : q)));
  }

  function discardReviewItem(id: number) {
    setReviewItems((prev) => prev.filter((r) => r.id !== id));
  }

  // Re-parses the user's corrected line and, if it now yields real sets,
  // splices the recovered exercise entry back into its original session.
  // Any leftover garbage inside the corrected line is re-surfaced as new
  // review rows rather than silently accepted — nothing skips the list.
  function applyReviewFix(id: number, editedText: string): boolean {
    const item = reviewItems.find((r) => r.id === id);
    if (!item || item.sessionIndex === undefined) return false;

    const parsed = parseExerciseLine(editedText, item.context);
    if (parsed.sets.length === 0) return false;

    const sessionIndex = item.sessionIndex;
    const updatedSessions = sessions.map((s, idx) =>
      idx === sessionIndex
        ? {
            ...s,
            exercises: [...s.exercises, { name: parsed.name, note: parsed.note, sets: parsed.sets, rawLine: editedText }],
          }
        : s,
    );
    setSessions(updatedSessions);

    setReviewItems((prev) => {
      const withoutResolved = prev.filter((r) => r.id !== id);
      const leftoverRows: ReviewRow[] = parsed.reviewItems.map((r, offset) => ({
        ...r,
        sessionIndex,
        id: nextReviewId + offset,
      }));
      return [...withoutResolved, ...leftoverRows];
    });
    setNextReviewId((n) => n + parsed.reviewItems.length);
    setQuestions((prevQuestions) => mergeQuestions(prevQuestions, buildConventionQuestions(updatedSessions)));

    return true;
  }

  async function handleConfirm() {
    setStage('importing');
    const decisions = conventionQuestionsToDecisions(questions);
    const result = await importKeepSessions(db, userId, sessions, decisions);
    setSummary(result);
    setStage('done');
  }

  function reset() {
    setStage('paste');
    setRawText('');
    setSessions([]);
    setReviewItems([]);
    setQuestions([]);
    setSummary(null);
  }

  if (stage === 'paste') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>{strings.importTitle}</Text>
          <Text style={styles.subtitle}>{strings.importPasteInstructions}</Text>

          <Text style={styles.label}>{strings.importYearLabel}</Text>
          <TextInput
            style={styles.yearInput}
            value={yearText}
            onChangeText={setYearText}
            placeholder={strings.importYearPlaceholder}
            placeholderTextColor={theme.color.textMuted}
            keyboardType="number-pad"
          />
          {yearError ? <Text style={styles.errorText}>{yearError}</Text> : null}

          <TextInput
            style={styles.pasteArea}
            value={rawText}
            onChangeText={setRawText}
            placeholder={strings.importPastePlaceholder}
            placeholderTextColor={theme.color.textMuted}
            multiline
            textAlignVertical="top"
          />

          <Pressable style={styles.primaryButton} onPress={handleParse}>
            <Text style={styles.primaryButtonLabel}>{strings.importParseButton}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (stage === 'review') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>{strings.importTitle}</Text>
          <Text style={styles.subtitle}>{strings.importParsedSummary(sessionCount, exerciseEntryCount, setCount)}</Text>

          {questions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>{strings.importConventionHeading}</Text>
              <Text style={styles.subtitle}>{strings.importConventionIntro}</Text>
              {questions.map((q) => (
                <View key={q.exerciseName} style={styles.conventionCard}>
                  <Text style={styles.conventionName}>{q.exerciseName}</Text>
                  {q.candidate ? (
                    <>
                      <Text style={styles.mutedText}>
                        {strings.importConventionBreakpoint(dateHeaderLabel(q.candidate.breakpointDate))}
                      </Text>
                      <Text style={styles.mutedText}>
                        {q.candidate.before.averageWeightKg}kg avg → {q.candidate.after.averageWeightKg}kg avg
                      </Text>
                      <Text style={styles.label}>{strings.importConventionBeforeLabel}</Text>
                      <ConventionToggle
                        value={q.beforeConvention}
                        onChange={(v) => updateQuestion(q.exerciseName, { beforeConvention: v })}
                      />
                      <Text style={styles.label}>{strings.importConventionAfterLabel}</Text>
                      <ConventionToggle
                        value={q.afterConvention}
                        onChange={(v) => updateQuestion(q.exerciseName, { afterConvention: v })}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={styles.label}>{strings.importConventionSingleLabel}</Text>
                      <ConventionToggle
                        value={q.beforeConvention}
                        onChange={(v) => updateQuestion(q.exerciseName, { beforeConvention: v, afterConvention: v })}
                      />
                    </>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>{strings.importNeedsReviewHeading(reviewItems.length)}</Text>
            {reviewItems.length === 0 ? (
              <Text style={styles.mutedText}>{strings.importNeedsReviewEmpty}</Text>
            ) : (
              reviewItems.map((item) => (
                <ReviewItemCard key={item.id} item={item} onApply={applyReviewFix} onDiscard={discardReviewItem} />
              ))
            )}
          </View>

          <Pressable style={styles.secondaryButton} onPress={reset}>
            <Text style={styles.secondaryButtonLabel}>{strings.importBackButton}</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={handleConfirm}>
            <Text style={styles.primaryButtonLabel}>{strings.importConfirmButton}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (stage === 'importing') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>{strings.importingLabel}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>{strings.importDoneHeading}</Text>
        {summary && (
          <Text style={styles.subtitle}>
            {strings.importSummary(summary.sessionsImported, summary.exercisesImported, summary.setsImported)}
          </Text>
        )}
        <Pressable style={styles.primaryButton} onPress={reset}>
          <Text style={styles.primaryButtonLabel}>{strings.importDoneButton}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  container: {
    padding: 20,
    gap: 12,
  },
  title: {
    color: theme.color.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  subtitle: {
    color: theme.color.textMuted,
    fontSize: 14,
  },
  label: {
    color: theme.color.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  errorText: {
    color: theme.color.accentPrimary,
    fontSize: 13,
  },
  yearInput: {
    minHeight: theme.minTouchTarget,
    borderRadius: 8,
    backgroundColor: theme.color.surface,
    color: theme.color.textPrimary,
    paddingHorizontal: 12,
    fontSize: 18,
  },
  pasteArea: {
    minHeight: 220,
    borderRadius: 8,
    backgroundColor: theme.color.surface,
    color: theme.color.textPrimary,
    padding: 12,
    fontSize: 14,
  },
  primaryButton: {
    minHeight: theme.minTouchTarget,
    borderRadius: 8,
    backgroundColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonLabel: {
    color: theme.color.bg,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  secondaryButton: {
    minHeight: theme.minTouchTarget,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  secondaryButtonLabel: {
    color: theme.color.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  primaryButtonSmall: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonSmall: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    color: theme.color.accentSecondary,
    fontSize: 13,
  },
  reviewInput: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: theme.color.bg,
    color: theme.color.textPrimary,
    paddingHorizontal: 10,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  section: {
    marginTop: 16,
    gap: 8,
  },
  sectionHeading: {
    color: theme.color.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  conventionCard: {
    backgroundColor: theme.color.surface,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  conventionName: {
    color: theme.color.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  mutedText: {
    color: theme.color.textMuted,
    fontSize: 13,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOptionActive: {
    backgroundColor: theme.color.accentSecondary,
    borderColor: theme.color.accentSecondary,
  },
  toggleLabel: {
    color: theme.color.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleLabelActive: {
    color: theme.color.bg,
  },
  reviewRow: {
    backgroundColor: theme.color.surface,
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  reviewContext: {
    color: theme.color.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  reviewFragment: {
    color: theme.color.accentPrimary,
    fontSize: 13,
    fontFamily: 'monospace',
  },
});
