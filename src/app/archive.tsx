import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDatabase } from '@/data/DatabaseProvider';
import { archiveProgramme, listProgrammes, unarchiveProgramme } from '@/data/repositories/programmeRepository';
import { archiveTemplate, listTemplates, unarchiveTemplate } from '@/data/repositories/templateRepository';
import type { programme, template } from '@/data/schema';
import { strings } from '@/strings';
import { theme } from '@/theme';

type Programme = typeof programme.$inferSelect;
type Template = typeof template.$inferSelect;

type ArchiveView = 'active' | 'archived';

export default function ArchiveScreen() {
  const { db, userId } = useDatabase();

  const [view, setView] = useState<ArchiveView>('active');
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedProgrammeIds, setSelectedProgrammeIds] = useState<Set<string>>(new Set());
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userId]);

  async function reload() {
    const [p, t] = await Promise.all([listProgrammes(db, userId), listTemplates(db, userId)]);
    setProgrammes(p);
    setTemplates(t);
  }

  function switchView(next: ArchiveView) {
    setView(next);
    setSelectedProgrammeIds(new Set());
    setSelectedTemplateIds(new Set());
  }

  const programmeById = new Map(programmes.map((p) => [p.id, p]));
  const visibleProgrammes = programmes.filter((p) => (view === 'active' ? !p.isArchived : p.isArchived));
  const visibleTemplates = templates.filter((t) => (view === 'active' ? !t.isArchived : t.isArchived));

  const selectedCount = selectedProgrammeIds.size + selectedTemplateIds.size;
  const everythingVisibleSelected =
    visibleProgrammes.length + visibleTemplates.length > 0 &&
    visibleProgrammes.every((p) => selectedProgrammeIds.has(p.id)) &&
    visibleTemplates.every((t) => selectedTemplateIds.has(t.id));

  function toggleProgramme(id: string) {
    setSelectedProgrammeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTemplate(id: string) {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (everythingVisibleSelected) {
      setSelectedProgrammeIds(new Set());
      setSelectedTemplateIds(new Set());
    } else {
      setSelectedProgrammeIds(new Set(visibleProgrammes.map((p) => p.id)));
      setSelectedTemplateIds(new Set(visibleTemplates.map((t) => t.id)));
    }
  }

  async function handleBulkAction() {
    if (view === 'active') {
      await Promise.all([
        ...Array.from(selectedProgrammeIds).map((id) => archiveProgramme(db, userId, id)),
        ...Array.from(selectedTemplateIds).map((id) => archiveTemplate(db, userId, id)),
      ]);
    } else {
      await Promise.all([
        ...Array.from(selectedProgrammeIds).map((id) => unarchiveProgramme(db, userId, id)),
        ...Array.from(selectedTemplateIds).map((id) => unarchiveTemplate(db, userId, id)),
      ]);
    }
    setSelectedProgrammeIds(new Set());
    setSelectedTemplateIds(new Set());
    await reload();
  }

  const empty = visibleProgrammes.length === 0 && visibleTemplates.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{strings.archiveTitle}</Text>

        <View style={styles.tabRow}>
          <Pressable style={[styles.tab, view === 'active' && styles.tabActive]} onPress={() => switchView('active')}>
            <Text style={[styles.tabLabel, view === 'active' && styles.tabLabelActive]}>{strings.archiveActiveTab}</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, view === 'archived' && styles.tabActive]}
            onPress={() => switchView('archived')}>
            <Text style={[styles.tabLabel, view === 'archived' && styles.tabLabelActive]}>
              {strings.archiveArchivedTab}
            </Text>
          </Pressable>
        </View>

        {empty ? (
          <Text style={styles.mutedText}>{view === 'active' ? strings.archiveEmptyActive : strings.archiveEmptyArchived}</Text>
        ) : (
          <>
            <Pressable style={styles.selectAllRow} onPress={toggleSelectAll}>
              <Checkbox checked={everythingVisibleSelected} />
              <Text style={styles.selectAllLabel}>{strings.archiveSelectAll}</Text>
            </Pressable>

            {visibleProgrammes.length > 0 ? (
              <>
                <Text style={styles.sectionHeading}>{strings.archiveProgrammesHeading}</Text>
                {visibleProgrammes.map((p) => (
                  <Pressable key={p.id} style={styles.row} onPress={() => toggleProgramme(p.id)}>
                    <Checkbox checked={selectedProgrammeIds.has(p.id)} />
                    <Text style={styles.rowLabel}>{p.name}</Text>
                  </Pressable>
                ))}
              </>
            ) : null}

            {visibleTemplates.length > 0 ? (
              <>
                <Text style={styles.sectionHeading}>{strings.archiveTemplatesHeading}</Text>
                {visibleTemplates.map((t) => (
                  <Pressable key={t.id} style={styles.row} onPress={() => toggleTemplate(t.id)}>
                    <Checkbox checked={selectedTemplateIds.has(t.id)} />
                    <View>
                      <Text style={styles.rowLabel}>{t.name}</Text>
                      {t.programmeId && programmeById.get(t.programmeId) ? (
                        <Text style={styles.rowSubLabel}>{programmeById.get(t.programmeId)?.name}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </>
            ) : null}

            <Pressable
              style={[styles.bulkButton, selectedCount === 0 && styles.bulkButtonDisabled]}
              disabled={selectedCount === 0}
              onPress={handleBulkAction}>
              <Text style={styles.bulkButtonLabel}>
                {view === 'active'
                  ? strings.archiveBulkArchiveButton(selectedCount)
                  : strings.archiveBulkRestoreButton(selectedCount)}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View style={[checkboxStyles.box, checked && checkboxStyles.boxChecked]}>
      {checked ? <Text style={checkboxStyles.mark}>✓</Text> : null}
    </View>
  );
}

const checkboxStyles = StyleSheet.create({
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: theme.color.accentPrimary,
    borderColor: theme.color.accentPrimary,
  },
  mark: {
    color: theme.color.bg,
    fontSize: 14,
    fontWeight: '800',
  },
});

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
    fontSize: 26,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: theme.color.accentPrimary,
    borderColor: theme.color.accentPrimary,
  },
  tabLabel: {
    color: theme.color.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tabLabelActive: {
    color: theme.color.bg,
  },
  mutedText: {
    color: theme.color.textMuted,
    fontSize: 14,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
  },
  selectAllLabel: {
    color: theme.color.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sectionHeading: {
    color: theme.color.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: theme.minTouchTarget,
    backgroundColor: theme.color.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  rowLabel: {
    color: theme.color.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  rowSubLabel: {
    color: theme.color.textMuted,
    fontSize: 12,
  },
  bulkButton: {
    minHeight: theme.minTouchTarget,
    borderRadius: 12,
    backgroundColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  bulkButtonDisabled: {
    opacity: 0.4,
  },
  bulkButtonLabel: {
    color: theme.color.bg,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
