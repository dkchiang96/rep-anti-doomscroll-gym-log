import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ListRow } from '@/components/ui';
import { EQUIPMENT_TYPES } from '@/components/exercise/ExercisePicker';
import { useDatabase } from '@/data/DatabaseProvider';
import { listExercises } from '@/data/repositories/exerciseRepository';
import { importProgramme, type CreateChoice, type ProgrammeImportSummary } from '@/data/repositories/programmeImportRepository';
import { matchExercises } from '@/domain/fuzzyMatch';
import type { EquipmentType } from '@/domain/loadConvention';
import { autoMatchedFraction, buildProgrammeMatchRows, type MatchDecision, type ProgrammeMatchRow } from '@/domain/programmeMatching';
import { parseProgrammeJson, type ProgrammeImportData } from '@/domain/programmeSchema';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// DESIGN-SPEC.md §6 screen 5 (programme JSON import) — paste box + file
// picker, field-level validation, then the mandatory name-mapping review
// (FR-6.4): nothing imports without a visible, overridable decision per
// exercise. src/domain/programmeSchema.ts and programmeMatching.ts are
// unchanged, per the R5 brief.

type Library = { id: string; name: string; aliases: string[] };

type Stage =
  | { kind: 'paste' }
  | { kind: 'errors'; errors: { path: string; message: string }[] }
  | { kind: 'review'; data: ProgrammeImportData }
  | { kind: 'importing' }
  | { kind: 'done'; summary: ProgrammeImportSummary };

export default function ImportProgramme() {
  const { db, userId } = useDatabase();
  const router = useRouter();

  const [text, setText] = useState('');
  const [stage, setStage] = useState<Stage>({ kind: 'paste' });
  const [library, setLibrary] = useState<Library[]>([]);
  const [rows, setRows] = useState<ProgrammeMatchRow<Library>[]>([]);
  const [createChoices, setCreateChoices] = useState<Record<string, EquipmentType>>({});
  const [remapOpenForName, setRemapOpenForName] = useState<string | null>(null);
  const [remapQuery, setRemapQuery] = useState('');
  const [activateProgramme, setActivateProgramme] = useState(false);

  useEffect(() => {
    void listExercises(db, userId).then((all) => setLibrary(all.map((e) => ({ id: e.id, name: e.name, aliases: e.aliases }))));
  }, [db, userId]);

  async function handlePickFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled || result.assets.length === 0) return;
    const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
    setText(content);
  }

  function defaultEquipmentFor(loadConvention: ProgrammeImportData['templates'][number]['exercises'][number]['loadConvention']): EquipmentType {
    if (loadConvention === 'bodyweight') return 'bodyweight';
    if (loadConvention === 'per_side') return 'dumbbell';
    return 'barbell';
  }

  function handleValidate() {
    const result = parseProgrammeJson(text);
    if (!result.ok) {
      setStage({ kind: 'errors', errors: result.errors });
      return;
    }
    const matchRows = buildProgrammeMatchRows(result.data, library);
    setRows(matchRows);
    const choices: Record<string, EquipmentType> = {};
    for (const row of matchRows) {
      choices[row.name.trim().toLowerCase()] = defaultEquipmentFor(row.sample.loadConvention);
    }
    setCreateChoices(choices);
    setStage({ kind: 'review', data: result.data });
  }

  function setDecision(name: string, decision: MatchDecision) {
    const key = name.trim().toLowerCase();
    setRows((prev) => prev.map((r) => (r.name.trim().toLowerCase() === key ? { ...r, decision } : r)));
  }

  const allDecided = rows.every((r) => r.decision.type !== 'create' || createChoices[r.name.trim().toLowerCase()] != null);
  const matchedFraction = Math.round(autoMatchedFraction(rows) * 100);

  async function handleConfirmImport() {
    if (stage.kind !== 'review' || !allDecided) return;
    setStage({ kind: 'importing' });
    const choiceMap = new Map<string, CreateChoice>(
      Object.entries(createChoices).map(([key, equipmentType]) => [key, { equipmentType }]),
    );
    const summary = await importProgramme(db, userId, stage.data, rows, choiceMap, activateProgramme);
    setStage({ kind: 'done', summary });
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: strings.programmeImportTitle }} />

      {stage.kind === 'paste' ? (
        <View style={styles.section}>
          <Text style={[type.body, styles.instructions]}>{strings.programmeImportPasteInstructions}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={strings.programmeImportPastePlaceholder}
            placeholderTextColor={color.textMuted}
            multiline
            style={styles.pasteBox}
          />
          <Pressable onPress={() => void handlePickFile()} style={styles.secondaryTouch}>
            <Text style={[type.label, styles.secondaryLabel]}>{strings.programmeImportPickFileButton}</Text>
          </Pressable>
          <Pressable onPress={handleValidate} disabled={text.trim().length === 0} style={[styles.primaryTouch, text.trim().length === 0 ? styles.disabled : null]}>
            <Text style={[type.label, styles.primaryLabel]}>{strings.programmeImportValidateButton}</Text>
          </Pressable>
        </View>
      ) : null}

      {stage.kind === 'errors' ? (
        <View style={styles.section}>
          <Text style={[type.heading, styles.errorHeading]}>{strings.programmeImportErrorsHeading(stage.errors.length)}</Text>
          {stage.errors.map((e, i) => (
            <View key={i} style={styles.errorRow}>
              <Text style={[type.caption, styles.errorPath]}>{e.path}</Text>
              <Text style={[type.body, styles.errorMessage]}>{e.message}</Text>
            </View>
          ))}
          <Pressable onPress={() => setStage({ kind: 'paste' })} style={styles.secondaryTouch}>
            <Text style={[type.label, styles.secondaryLabel]}>{strings.programmeImportBackButton}</Text>
          </Pressable>
        </View>
      ) : null}

      {stage.kind === 'review' ? (
        <View style={styles.section}>
          <Text style={[type.heading, styles.reviewHeading]}>{strings.programmeImportReviewHeading}</Text>
          <Text style={[type.body, styles.instructions]}>{strings.programmeImportReviewIntro}</Text>
          <Text style={[type.caption, styles.matchedFraction]}>{strings.programmeImportConfidenceLabel(matchedFraction)}</Text>

          {rows.map((row) => {
            const key = row.name.trim().toLowerCase();
            return (
              <View key={row.name} style={styles.reviewRow}>
                <Text style={[type.label, styles.reviewName]}>{row.name.toUpperCase()}</Text>
                <Text style={[type.caption, styles.confidence]}>
                  {row.bestMatch ? strings.programmeImportConfidenceLabel(Math.round(row.bestMatch.score * 100)) : strings.programmeImportNoMatch}
                </Text>

                <View style={styles.decisionRow}>
                  {row.bestMatch ? (
                    <Pressable
                      onPress={() => setDecision(row.name, { type: 'accept', exerciseId: row.bestMatch!.exercise.id })}
                      style={[styles.decisionTouch, row.decision.type === 'accept' ? styles.decisionActive : null]}
                    >
                      <Text style={[type.caption, row.decision.type === 'accept' ? styles.decisionLabelActive : styles.decisionLabel]}>
                        {strings.programmeImportDecisionAccept}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => {
                      setRemapOpenForName(remapOpenForName === row.name ? null : row.name);
                      setRemapQuery('');
                    }}
                    style={[styles.decisionTouch, row.decision.type === 'remap' ? styles.decisionActive : null]}
                  >
                    <Text style={[type.caption, row.decision.type === 'remap' ? styles.decisionLabelActive : styles.decisionLabel]}>
                      {strings.programmeImportDecisionRemap}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDecision(row.name, { type: 'create' })}
                    style={[styles.decisionTouch, row.decision.type === 'create' ? styles.decisionActive : null]}
                  >
                    <Text style={[type.caption, row.decision.type === 'create' ? styles.decisionLabelActive : styles.decisionLabel]}>
                      {strings.programmeImportDecisionCreate}
                    </Text>
                  </Pressable>
                </View>

                {remapOpenForName === row.name ? (
                  <View style={styles.remapPanel}>
                    <TextInput
                      value={remapQuery}
                      onChangeText={setRemapQuery}
                      placeholder={strings.programmeImportRemapSearchPlaceholder}
                      placeholderTextColor={color.textMuted}
                      autoFocus
                      style={styles.remapInput}
                    />
                    {matchExercises(remapQuery, library).map((m) => (
                      <Pressable
                        key={m.exercise.id}
                        onPress={() => {
                          setDecision(row.name, { type: 'remap', exerciseId: m.exercise.id });
                          setRemapOpenForName(null);
                        }}
                        style={styles.remapResultRow}
                      >
                        <Text style={[type.body, styles.remapResultLabel]}>{m.exercise.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {row.decision.type === 'create' ? (
                  <View style={styles.equipmentRow}>
                    <Text style={[type.caption, styles.fieldLabel]}>{strings.programmeImportEquipmentLabel}</Text>
                    <View style={styles.chipRow}>
                      {EQUIPMENT_TYPES.map((eq) => (
                        <Pressable
                          key={eq}
                          onPress={() => setCreateChoices((prev) => ({ ...prev, [key]: eq }))}
                          style={[styles.chipTouch, createChoices[key] === eq ? styles.chipActive : null]}
                        >
                          <Text style={[type.caption, createChoices[key] === eq ? styles.chipLabelActive : styles.chipLabelInactive]}>
                            {eq.toUpperCase()}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}

          <ListRow
            variant="toggle"
            label={strings.programmeImportActivateToggle}
            value={activateProgramme}
            onValueChange={setActivateProgramme}
          />

          <Pressable
            onPress={() => void handleConfirmImport()}
            disabled={!allDecided}
            style={[styles.primaryTouch, !allDecided ? styles.disabled : null]}
          >
            <Text style={[type.label, styles.primaryLabel]}>{strings.programmeImportConfirmButton}</Text>
          </Pressable>
        </View>
      ) : null}

      {stage.kind === 'importing' ? (
        <Text style={[type.body, styles.instructions]}>{strings.programmeImportingLabel}</Text>
      ) : null}

      {stage.kind === 'done' ? (
        <View style={styles.section}>
          <Text style={[type.heading, styles.reviewHeading]}>{strings.programmeImportDoneHeading}</Text>
          <Text style={[type.body, styles.instructions]}>
            {strings.programmeImportSummary(stage.summary.templatesImported, stage.summary.exercisesImported, stage.summary.exercisesCreated)}
          </Text>
          <Pressable onPress={() => router.replace('/programmes')} style={styles.primaryTouch}>
            <Text style={[type.label, styles.primaryLabel]}>{strings.programmeImportDoneButton}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
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
  pasteBox: {
    ...type.body,
    color: color.textPrimary,
    borderWidth: 2,
    borderColor: color.divider,
    minHeight: 160,
    padding: 12,
    textAlignVertical: 'top',
  },
  secondaryTouch: {
    minHeight: size.minTouchTarget,
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: color.slabSecondary,
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
  errorHeading: {
    color: color.danger,
  },
  errorRow: {
    marginTop: 4,
  },
  errorPath: {
    color: color.textMuted,
  },
  errorMessage: {
    color: color.textPrimary,
  },
  reviewHeading: {
    color: color.textPrimary,
  },
  matchedFraction: {
    color: color.slabSecondary,
  },
  reviewRow: {
    paddingVertical: 12,
    borderBottomWidth: size.divider,
    borderBottomColor: color.divider,
    gap: 4,
  },
  reviewName: {
    color: color.textPrimary,
  },
  confidence: {
    color: color.textMuted,
  },
  decisionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  decisionTouch: {
    minHeight: size.minTouchTarget,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: color.divider,
  },
  decisionActive: {
    backgroundColor: color.slabSecondary,
    borderColor: color.slabSecondary,
  },
  decisionLabel: {
    color: color.textPrimary,
  },
  decisionLabelActive: {
    color: color.onSlab,
  },
  remapPanel: {
    marginTop: 8,
    gap: 4,
  },
  remapInput: {
    ...type.body,
    color: color.textPrimary,
    borderWidth: 2,
    borderColor: color.divider,
    minHeight: size.minTouchTarget,
    paddingHorizontal: 12,
  },
  remapResultRow: {
    minHeight: size.minTouchTarget,
    justifyContent: 'center',
  },
  remapResultLabel: {
    color: color.textPrimary,
  },
  equipmentRow: {
    marginTop: 4,
  },
  fieldLabel: {
    color: color.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chipTouch: {
    minHeight: size.minTouchTarget,
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
