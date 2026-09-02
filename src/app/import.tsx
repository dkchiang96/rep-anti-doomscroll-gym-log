import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useDatabase } from '@/data/DatabaseProvider';
import { importKeepSessions, type ImportSummary } from '@/data/repositories/importRepository';
import {
  buildConventionQuestions,
  conventionQuestionsToDecisions,
  type ConventionQuestion,
  type LoadConvention,
} from '@/domain/conventionReconciliation';
import { parseExerciseLine, parseKeepExport, type ParsedSession, type ReviewItem } from '@/domain/keepParser';
import { suggestReviewResolution } from '@/domain/reviewSuggestions';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// DESIGN-SPEC.md §6 screen 5 (Keep import) — paste + year, parse, an
// editable needs-review list, dumbbell convention questions, confirm.
// src/domain/keepParser.ts, conventionReconciliation.ts and
// reviewSuggestions.ts are unchanged, per the R5 brief.

type Stage =
  | { kind: 'paste' }
  | { kind: 'review'; sessions: ParsedSession[]; reviewItems: ReviewItem[] }
  | { kind: 'importing' }
  | { kind: 'done'; summary: ImportSummary };

function countExercisesAndSets(sessions: ParsedSession[]): { exercises: number; sets: number } {
  let exercises = 0;
  let sets = 0;
  for (const s of sessions) {
    exercises += s.exercises.length;
    for (const e of s.exercises) sets += e.sets.length;
  }
  return { exercises, sets };
}

export default function Import() {
  const { db, userId } = useDatabase();
  const router = useRouter();

  const [text, setText] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [yearError, setYearError] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: 'paste' });
  const [editedText, setEditedText] = useState<Record<number, string>>({});
  const [conventionAnswers, setConventionAnswers] = useState<ConventionQuestion[]>([]);

  function handleParse() {
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2100) {
      setYearError(true);
      return;
    }
    setYearError(false);
    const result = parseKeepExport(text, { year: parsedYear });
    setConventionAnswers(buildConventionQuestions(result.sessions));
    setEditedText({});
    setStage({ kind: 'review', sessions: result.sessions, reviewItems: result.needsReview });
  }

  function handleIgnore(item: ReviewItem, index: number) {
    if (stage.kind !== 'review') return;
    setStage({ ...stage, reviewItems: stage.reviewItems.filter((_, i) => i !== index) });
  }

  function handleApplyEdit(item: ReviewItem, index: number) {
    if (stage.kind !== 'review' || item.sessionIndex == null) return;
    const edited = editedText[index] ?? item.rawFragment;
    const parsed = parseExerciseLine(edited, item.context);
    if (parsed.sets.length === 0) {
      // Still couldn't recover a weight/rep pattern — leave the item in
      // place so the "still unparsed" hint renders instead of silently
      // discarding the edit.
      return;
    }
    const nextSessions = stage.sessions.map((s, i) =>
      i === item.sessionIndex
        ? { ...s, exercises: [...s.exercises, { name: parsed.name, note: parsed.note, sets: parsed.sets, rawLine: edited }] }
        : s,
    );
    const nextReviewItems = stage.reviewItems.filter((_, i) => i !== index).concat(parsed.reviewItems);
    setConventionAnswers(buildConventionQuestions(nextSessions));
    setStage({ kind: 'review', sessions: nextSessions, reviewItems: nextReviewItems });
  }

  function setConventionSide(name: string, side: 'before' | 'after', convention: LoadConvention) {
    setConventionAnswers((prev) =>
      prev.map((q) => (q.exerciseName === name ? { ...q, [side === 'before' ? 'beforeConvention' : 'afterConvention']: convention } : q)),
    );
  }

  async function handleConfirmImport() {
    if (stage.kind !== 'review') return;
    setStage({ kind: 'importing' });
    const decisions = conventionQuestionsToDecisions(conventionAnswers);
    const summary = await importKeepSessions(db, userId, stage.sessions, decisions);
    setStage({ kind: 'done', summary });
  }

  const counts = stage.kind === 'review' ? countExercisesAndSets(stage.sessions) : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: strings.importTitle }} />

      {stage.kind === 'paste' ? (
        <View style={styles.section}>
          <Text style={[type.body, styles.instructions]}>{strings.importPasteInstructions}</Text>
          <Text style={[type.caption, styles.fieldLabel]}>{strings.importYearLabel}</Text>
          <TextInput
            value={year}
            onChangeText={setYear}
            placeholder={strings.importYearPlaceholder}
            placeholderTextColor={color.textMuted}
            keyboardType="number-pad"
            style={styles.yearInput}
          />
          {yearError ? <Text style={[type.caption, styles.errorText]}>{strings.importYearError}</Text> : null}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={strings.importPastePlaceholder}
            placeholderTextColor={color.textMuted}
            multiline
            style={styles.pasteBox}
          />
          <Pressable onPress={handleParse} disabled={text.trim().length === 0} style={[styles.primaryTouch, text.trim().length === 0 ? styles.disabled : null]}>
            <Text style={[type.label, styles.primaryLabel]}>{strings.importParseButton}</Text>
          </Pressable>
        </View>
      ) : null}

      {stage.kind === 'review' && counts ? (
        <View style={styles.section}>
          <Text style={[type.body, styles.instructions]}>
            {strings.importParsedSummary(stage.sessions.length, counts.exercises, counts.sets)}
          </Text>

          <Text style={[type.heading, styles.reviewHeading]}>{strings.importNeedsReviewHeading(stage.reviewItems.length)}</Text>
          {stage.reviewItems.length === 0 ? <Text style={[type.body, styles.instructions]}>{strings.importNeedsReviewEmpty}</Text> : null}
          {stage.reviewItems.map((item, index) => {
            const suggestion = suggestReviewResolution(item);
            return (
              <View key={index} style={styles.reviewRow}>
                <Text style={[type.caption, styles.reviewContext]}>{item.context}</Text>
                <Text style={[type.body, styles.reviewMessage]}>{suggestion.message}</Text>
                {suggestion.editable ? (
                  <>
                    <TextInput
                      value={editedText[index] ?? item.rawFragment}
                      onChangeText={(v) => setEditedText((prev) => ({ ...prev, [index]: v }))}
                      style={styles.editInput}
                    />
                    <View style={styles.reviewActions}>
                      <Pressable onPress={() => handleIgnore(item, index)} style={styles.smallTouch}>
                        <Text style={[type.caption, styles.smallTouchLabel]}>{strings.importReviewDiscardButton}</Text>
                      </Pressable>
                      <Pressable onPress={() => handleApplyEdit(item, index)} style={styles.smallTouch}>
                        <Text style={[type.caption, styles.smallTouchLabelActive]}>{strings.importReviewApplyButton}</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </View>
            );
          })}

          {conventionAnswers.length > 0 ? (
            <>
              <Text style={[type.heading, styles.reviewHeading]}>{strings.importConventionHeading}</Text>
              <Text style={[type.body, styles.instructions]}>{strings.importConventionIntro}</Text>
              {conventionAnswers.map((q) => (
                <View key={q.exerciseName} style={styles.conventionRow}>
                  <Text style={[type.label, styles.conventionName]}>{q.exerciseName.toUpperCase()}</Text>
                  {q.candidate ? (
                    <Text style={[type.caption, styles.instructions]}>
                      {strings.importConventionBreakpoint(
                        `${q.candidate.breakpointDate.day}/${q.candidate.breakpointDate.month + 1}/${q.candidate.breakpointDate.year}`,
                      )}
                    </Text>
                  ) : null}
                  {q.candidate ? (
                    <>
                      <ConventionToggle
                        label={strings.importConventionBeforeLabel}
                        value={q.beforeConvention}
                        onChange={(c) => setConventionSide(q.exerciseName, 'before', c)}
                      />
                      <ConventionToggle
                        label={strings.importConventionAfterLabel}
                        value={q.afterConvention}
                        onChange={(c) => setConventionSide(q.exerciseName, 'after', c)}
                      />
                    </>
                  ) : (
                    <ConventionToggle
                      label={strings.importConventionSingleLabel}
                      value={q.afterConvention}
                      onChange={(c) => {
                        setConventionSide(q.exerciseName, 'before', c);
                        setConventionSide(q.exerciseName, 'after', c);
                      }}
                    />
                  )}
                </View>
              ))}
            </>
          ) : null}

          <Pressable onPress={() => void handleConfirmImport()} style={styles.primaryTouch}>
            <Text style={[type.label, styles.primaryLabel]}>{strings.importConfirmButton}</Text>
          </Pressable>
        </View>
      ) : null}

      {stage.kind === 'importing' ? <Text style={[type.body, styles.instructions]}>{strings.importingLabel}</Text> : null}

      {stage.kind === 'done' ? (
        <View style={styles.section}>
          <Text style={[type.heading, styles.reviewHeading]}>{strings.importDoneHeading}</Text>
          <Text style={[type.body, styles.instructions]}>
            {strings.importSummary(stage.summary.sessionsImported, stage.summary.exercisesImported, stage.summary.setsImported)}
          </Text>
          <Pressable onPress={() => router.replace('/')} style={styles.primaryTouch}>
            <Text style={[type.label, styles.primaryLabel]}>{strings.importDoneButton}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function ConventionToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: LoadConvention;
  onChange: (convention: LoadConvention) => void;
}) {
  return (
    <View style={styles.conventionToggleRow}>
      <Text style={[type.caption, styles.fieldLabel]}>{label}</Text>
      <View style={styles.chipRow}>
        {(['per_side', 'total'] as LoadConvention[]).map((c) => (
          <Pressable key={c} onPress={() => onChange(c)} style={[styles.chipTouch, value === c ? styles.chipActive : null]}>
            <Text style={[type.caption, value === c ? styles.chipLabelActive : styles.chipLabelInactive]}>
              {c === 'per_side' ? strings.importConventionPerSide.toUpperCase() : strings.importConventionTotal.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  section: {
    paddingHorizontal: size.listRowPadding,
    paddingTop: 16,
    gap: 12,
  },
  instructions: {
    color: color.textMuted,
  },
  fieldLabel: {
    color: color.textMuted,
  },
  yearInput: {
    ...type.body,
    color: color.textPrimary,
    borderWidth: 2,
    borderColor: color.divider,
    minHeight: size.minTouchTarget,
    paddingHorizontal: 12,
    width: 140,
  },
  errorText: {
    color: color.danger,
  },
  pasteBox: {
    ...type.body,
    color: color.textPrimary,
    borderWidth: 2,
    borderColor: color.divider,
    minHeight: 200,
    padding: 12,
    textAlignVertical: 'top',
  },
  primaryTouch: {
    minHeight: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.slabPrimary,
  },
  disabled: {
    opacity: 0.4,
  },
  primaryLabel: {
    color: color.onSlab,
  },
  reviewHeading: {
    color: color.textPrimary,
    marginTop: 8,
  },
  reviewRow: {
    paddingVertical: 8,
    borderBottomWidth: size.divider,
    borderBottomColor: color.divider,
    gap: 6,
  },
  reviewContext: {
    color: color.textMuted,
  },
  reviewMessage: {
    color: color.textPrimary,
  },
  editInput: {
    ...type.body,
    color: color.textPrimary,
    borderWidth: 2,
    borderColor: color.divider,
    minHeight: size.minTouchTarget,
    paddingHorizontal: 12,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 16,
  },
  smallTouch: {
    minHeight: 44,
    justifyContent: 'center',
  },
  smallTouchLabel: {
    color: color.textMuted,
  },
  smallTouchLabelActive: {
    color: color.slabSecondary,
  },
  conventionRow: {
    paddingVertical: 8,
    borderBottomWidth: size.divider,
    borderBottomColor: color.divider,
    gap: 6,
  },
  conventionName: {
    color: color.textPrimary,
  },
  conventionToggleRow: {
    gap: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chipTouch: {
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: color.divider,
  },
  chipActive: {
    backgroundColor: color.slabSecondary,
    borderColor: color.slabSecondary,
  },
  chipLabelActive: {
    color: color.onSlab,
  },
  chipLabelInactive: {
    color: color.textPrimary,
  },
});
