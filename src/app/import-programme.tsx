import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDatabase } from '@/data/DatabaseProvider';
import { listExercises } from '@/data/repositories/exerciseRepository';
import { importProgramme, type CreateChoice, type ProgrammeImportSummary } from '@/data/repositories/programmeImportRepository';
import type { exercise } from '@/data/schema';
import { matchExercises } from '@/domain/fuzzyMatch';
import type { EquipmentType } from '@/domain/loadConvention';
import { buildProgrammeMatchRows, type MatchDecision, type ProgrammeMatchRow } from '@/domain/programmeMatching';
import { parseProgrammeJson, type FieldError, type ProgrammeImportData } from '@/domain/programmeSchema';
import { strings } from '@/strings';
import { theme } from '@/theme';

type Exercise = typeof exercise.$inferSelect;
type Stage = 'paste' | 'review' | 'importing' | 'done';

const EQUIPMENT_TYPES: EquipmentType[] = [
  'barbell',
  'dumbbell',
  'selectorised',
  'plate_loaded',
  'cable',
  'bodyweight',
  'other',
];

function defaultEquipmentFor(loadConvention: 'per_side' | 'total' | 'bodyweight'): EquipmentType {
  if (loadConvention === 'bodyweight') return 'bodyweight';
  if (loadConvention === 'per_side') return 'dumbbell';
  return 'barbell';
}

function RemapPicker({
  library,
  onPick,
  onCancel,
}: {
  library: Exercise[];
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    if (query.trim().length === 0) return library;
    return matchExercises(query, library).map((m) => m.exercise);
  }, [library, query]);

  return (
    <View style={styles.remapBox}>
      <TextInput
        style={styles.remapSearchInput}
        value={query}
        onChangeText={setQuery}
        placeholder={strings.programmeImportRemapSearchPlaceholder}
        placeholderTextColor={theme.color.textMuted}
        autoFocus
      />
      {results.map((ex) => (
        <Pressable key={ex.id} style={styles.remapRow} onPress={() => onPick(ex.id)}>
          <Text style={styles.remapRowLabel}>{ex.name}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.secondaryButtonSmall} onPress={onCancel}>
        <Text style={styles.secondaryButtonSmallLabel}>{strings.keypadCancel}</Text>
      </Pressable>
    </View>
  );
}

function MatchRowCard({
  row,
  library,
  createChoice,
  onDecisionChange,
  onCreateChoiceChange,
}: {
  row: ProgrammeMatchRow<Exercise>;
  library: Exercise[];
  createChoice: EquipmentType;
  onDecisionChange: (decision: MatchDecision) => void;
  onCreateChoiceChange: (equipmentType: EquipmentType) => void;
}) {
  const [remapping, setRemapping] = useState(false);
  const confidencePct = row.bestMatch ? Math.round(row.bestMatch.score * 100) : null;
  const remappedExerciseId = row.decision.type === 'remap' ? row.decision.exerciseId : null;

  return (
    <View style={styles.matchCard}>
      <Text style={styles.matchName}>{row.name}</Text>
      <Text style={styles.mutedText}>
        {row.bestMatch
          ? `${strings.programmeImportConfidenceLabel(confidencePct!)} — ${row.bestMatch.exercise.name}`
          : strings.programmeImportNoMatch}
      </Text>

      <View style={styles.toggleRow}>
        {row.bestMatch ? (
          <Pressable
            style={[styles.toggleOption, row.decision.type === 'accept' && styles.toggleOptionActive]}
            onPress={() => {
              setRemapping(false);
              onDecisionChange({ type: 'accept', exerciseId: row.bestMatch!.exercise.id });
            }}>
            <Text style={[styles.toggleLabel, row.decision.type === 'accept' && styles.toggleLabelActive]}>
              {strings.programmeImportDecisionAccept}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.toggleOption, row.decision.type === 'remap' && styles.toggleOptionActive]}
          onPress={() => setRemapping(true)}>
          <Text style={[styles.toggleLabel, row.decision.type === 'remap' && styles.toggleLabelActive]}>
            {strings.programmeImportDecisionRemap}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleOption, row.decision.type === 'create' && styles.toggleOptionActive]}
          onPress={() => {
            setRemapping(false);
            onDecisionChange({ type: 'create' });
          }}>
          <Text style={[styles.toggleLabel, row.decision.type === 'create' && styles.toggleLabelActive]}>
            {strings.programmeImportDecisionCreate}
          </Text>
        </Pressable>
      </View>

      {remapping ? (
        <RemapPicker
          library={library}
          onCancel={() => setRemapping(false)}
          onPick={(id) => {
            setRemapping(false);
            onDecisionChange({ type: 'remap', exerciseId: id });
          }}
        />
      ) : null}

      {remappedExerciseId ? (
        <Text style={styles.mutedText}>{library.find((e) => e.id === remappedExerciseId)?.name}</Text>
      ) : null}

      {row.decision.type === 'create' ? (
        <>
          <Text style={styles.label}>{strings.programmeImportEquipmentLabel}</Text>
          <View style={styles.chipRow}>
            {EQUIPMENT_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[styles.chip, createChoice === type && styles.chipActive]}
                onPress={() => onCreateChoiceChange(type)}>
                <Text style={[styles.chipLabel, createChoice === type && styles.chipLabelActive]}>
                  {type.replace('_', ' ').toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

export default function ImportProgrammeScreen() {
  const { db, userId } = useDatabase();

  const [stage, setStage] = useState<Stage>('paste');
  const [rawText, setRawText] = useState('');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [data, setData] = useState<ProgrammeImportData | null>(null);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [matchRows, setMatchRows] = useState<ProgrammeMatchRow<Exercise>[]>([]);
  const [createChoices, setCreateChoices] = useState<Map<string, EquipmentType>>(new Map());
  const [activate, setActivate] = useState(false);
  const [summary, setSummary] = useState<ProgrammeImportSummary | null>(null);

  async function handlePickFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (result.canceled || result.assets.length === 0) return;
    const text = await readAsStringAsync(result.assets[0].uri);
    setRawText(text);
  }

  async function handleValidate() {
    const result = parseProgrammeJson(rawText);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setData(result.data);

    const existing = await listExercises(db, userId);
    setLibrary(existing);
    const rows = buildProgrammeMatchRows(result.data, existing);
    setMatchRows(rows);
    setCreateChoices(
      new Map(
        rows
          .filter((r) => r.decision.type === 'create')
          .map((r) => [r.name.trim().toLowerCase(), defaultEquipmentFor(r.sample.loadConvention)]),
      ),
    );
    setStage('review');
  }

  function updateDecision(name: string, decision: MatchDecision) {
    setMatchRows((prev) => prev.map((r) => (r.name === name ? { ...r, decision } : r)));
    if (decision.type === 'create') {
      setCreateChoices((prev) => {
        const key = name.trim().toLowerCase();
        if (prev.has(key)) return prev;
        const row = matchRows.find((r) => r.name === name);
        const next = new Map(prev);
        next.set(key, defaultEquipmentFor(row?.sample.loadConvention ?? 'total'));
        return next;
      });
    }
  }

  function updateCreateChoice(name: string, equipmentType: EquipmentType) {
    setCreateChoices((prev) => new Map(prev).set(name.trim().toLowerCase(), equipmentType));
  }

  async function handleConfirm() {
    if (!data) return;
    setStage('importing');
    const choices = new Map<string, CreateChoice>(
      Array.from(createChoices.entries()).map(([key, equipmentType]) => [key, { equipmentType }]),
    );
    const result = await importProgramme(db, userId, data, matchRows, choices, activate);
    setSummary(result);
    setStage('done');
  }

  function reset() {
    setStage('paste');
    setRawText('');
    setErrors([]);
    setData(null);
    setMatchRows([]);
    setCreateChoices(new Map());
    setActivate(false);
    setSummary(null);
  }

  if (stage === 'paste') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>{strings.programmeImportTitle}</Text>
          <Text style={styles.subtitle}>{strings.programmeImportPasteInstructions}</Text>

          <Pressable style={styles.secondaryButton} onPress={handlePickFile}>
            <Text style={styles.secondaryButtonLabel}>{strings.programmeImportPickFileButton}</Text>
          </Pressable>

          <TextInput
            style={styles.pasteArea}
            value={rawText}
            onChangeText={setRawText}
            placeholder={strings.programmeImportPastePlaceholder}
            placeholderTextColor={theme.color.textMuted}
            multiline
            textAlignVertical="top"
          />

          {errors.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>{strings.programmeImportErrorsHeading(errors.length)}</Text>
              {errors.map((e, i) => (
                <Text key={i} style={styles.errorText}>
                  {e.path}: {e.message}
                </Text>
              ))}
            </View>
          ) : null}

          <Pressable style={styles.primaryButton} onPress={handleValidate}>
            <Text style={styles.primaryButtonLabel}>{strings.programmeImportValidateButton}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (stage === 'review' && data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>{data.name}</Text>
          <Text style={styles.sectionHeading}>{strings.programmeImportReviewHeading}</Text>
          <Text style={styles.subtitle}>{strings.programmeImportReviewIntro}</Text>

          {matchRows.map((row) => (
            <MatchRowCard
              key={row.name}
              row={row}
              library={library}
              createChoice={createChoices.get(row.name.trim().toLowerCase()) ?? 'other'}
              onDecisionChange={(decision) => updateDecision(row.name, decision)}
              onCreateChoiceChange={(equipmentType) => updateCreateChoice(row.name, equipmentType)}
            />
          ))}

          <View style={styles.toggleRow}>
            <Text style={styles.label}>{strings.programmeImportActivateToggle}</Text>
            <Switch value={activate} onValueChange={setActivate} />
          </View>

          <Pressable style={styles.secondaryButton} onPress={reset}>
            <Text style={styles.secondaryButtonLabel}>{strings.programmeImportBackButton}</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={handleConfirm}>
            <Text style={styles.primaryButtonLabel}>{strings.programmeImportConfirmButton}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (stage === 'importing') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>{strings.programmeImportingLabel}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>{strings.programmeImportDoneHeading}</Text>
        {summary ? (
          <Text style={styles.subtitle}>
            {strings.programmeImportSummary(summary.templatesImported, summary.exercisesImported, summary.exercisesCreated)}
          </Text>
        ) : null}
        <Pressable style={styles.primaryButton} onPress={reset}>
          <Text style={styles.primaryButtonLabel}>{strings.programmeImportDoneButton}</Text>
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
    fontSize: 24,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  subtitle: {
    color: theme.color.textMuted,
    fontSize: 14,
  },
  label: {
    color: theme.color.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  mutedText: {
    color: theme.color.textMuted,
    fontSize: 13,
  },
  errorText: {
    color: theme.color.accentPrimary,
    fontSize: 13,
  },
  pasteArea: {
    minHeight: 200,
    borderRadius: 8,
    backgroundColor: theme.color.surface,
    color: theme.color.textPrimary,
    padding: 12,
    fontSize: 14,
  },
  section: {
    gap: 4,
  },
  sectionHeading: {
    color: theme.color.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  primaryButton: {
    minHeight: theme.minTouchTarget,
    borderRadius: 8,
    backgroundColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  secondaryButtonLabel: {
    color: theme.color.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  secondaryButtonSmall: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonSmallLabel: {
    color: theme.color.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  matchCard: {
    backgroundColor: theme.color.surface,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  matchName: {
    color: theme.color.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  toggleOption: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  toggleOptionActive: {
    backgroundColor: theme.color.accentSecondary,
    borderColor: theme.color.accentSecondary,
  },
  toggleLabel: {
    color: theme.color.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  toggleLabelActive: {
    color: theme.color.bg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: theme.color.accentPrimary,
    borderColor: theme.color.accentPrimary,
  },
  chipLabel: {
    color: theme.color.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  chipLabelActive: {
    color: theme.color.bg,
  },
  remapBox: {
    gap: 6,
  },
  remapSearchInput: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: theme.color.bg,
    color: theme.color.textPrimary,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  remapRow: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  remapRowLabel: {
    color: theme.color.textPrimary,
    fontSize: 14,
  },
});
