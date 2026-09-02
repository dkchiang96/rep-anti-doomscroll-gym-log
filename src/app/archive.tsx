import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDatabase } from '@/data/DatabaseProvider';
import { archiveProgramme, listProgrammes, unarchiveProgramme } from '@/data/repositories/programmeRepository';
import { archiveTemplate, listTemplates, unarchiveTemplate } from '@/data/repositories/templateRepository';
import type { programme as programmeTable, template as templateTable } from '@/data/schema';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// DESIGN-SPEC.md §6 screen — multi-select archive/restore, fully reversible
// via the same mechanism (FR-5.8). Archiving a programme never cascades to
// its templates — same precedent as the pre-rebuild build.

type Programme = typeof programmeTable.$inferSelect;
type Template = typeof templateTable.$inferSelect;

type Tab = 'active' | 'archived';
type RowKey = `programme:${string}` | `template:${string}`;

export default function Archive() {
  const { db, userId } = useDatabase();
  const [tab, setTab] = useState<Tab>('active');
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Set<RowKey>>(new Set());

  async function fetchRows() {
    const [p, t] = await Promise.all([listProgrammes(db, userId), listTemplates(db, userId)]);
    return { programmes: p, templates: t };
  }

  async function reload() {
    const rows = await fetchRows();
    setProgrammes(rows.programmes);
    setTemplates(rows.templates);
    setSelected(new Set());
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await fetchRows();
      if (cancelled) return;
      setProgrammes(rows.programmes);
      setTemplates(rows.templates);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userId]);

  const visibleProgrammes = programmes.filter((p) => (tab === 'active' ? !p.isArchived : p.isArchived));
  const visibleTemplates = templates.filter((t) => (tab === 'active' ? !t.isArchived : t.isArchived));
  const allKeys: RowKey[] = [
    ...visibleProgrammes.map((p) => `programme:${p.id}` as RowKey),
    ...visibleTemplates.map((t) => `template:${t.id}` as RowKey),
  ];
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));

  function toggle(key: RowKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allKeys));
  }

  function switchTab(next: Tab) {
    setTab(next);
    setSelected(new Set());
  }

  async function handleBulkAction() {
    const programmeIds = [...selected].filter((k) => k.startsWith('programme:')).map((k) => k.slice('programme:'.length));
    const templateIds = [...selected].filter((k) => k.startsWith('template:')).map((k) => k.slice('template:'.length));
    if (tab === 'active') {
      await Promise.all([
        ...programmeIds.map((id) => archiveProgramme(db, userId, id)),
        ...templateIds.map((id) => archiveTemplate(db, userId, id)),
      ]);
    } else {
      await Promise.all([
        ...programmeIds.map((id) => unarchiveProgramme(db, userId, id)),
        ...templateIds.map((id) => unarchiveTemplate(db, userId, id)),
      ]);
    }
    await reload();
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: strings.archiveTitle }} />

      <View style={styles.tabRow}>
        <Pressable style={styles.tabTouch} onPress={() => switchTab('active')}>
          <Text style={[type.label, tab === 'active' ? styles.tabActive : styles.tabInactive]}>{strings.archiveActiveTab}</Text>
        </Pressable>
        <Pressable style={styles.tabTouch} onPress={() => switchTab('archived')}>
          <Text style={[type.label, tab === 'archived' ? styles.tabActive : styles.tabInactive]}>{strings.archiveArchivedTab}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {allKeys.length > 0 ? (
          <Pressable style={styles.selectAllRow} onPress={toggleAll}>
            <Checkbox checked={allSelected} />
            <Text style={[type.label, styles.selectAllLabel]}>{strings.archiveSelectAll}</Text>
          </Pressable>
        ) : null}

        {visibleProgrammes.length > 0 ? (
          <>
            <Text style={[type.caption, styles.sectionHeading]}>{strings.archiveProgrammesHeading}</Text>
            {visibleProgrammes.map((p) => (
              <SelectableRow key={p.id} label={p.name} checked={selected.has(`programme:${p.id}`)} onPress={() => toggle(`programme:${p.id}`)} />
            ))}
          </>
        ) : null}

        {visibleTemplates.length > 0 ? (
          <>
            <Text style={[type.caption, styles.sectionHeading]}>{strings.archiveTemplatesHeading}</Text>
            {visibleTemplates.map((t) => (
              <SelectableRow key={t.id} label={t.name} checked={selected.has(`template:${t.id}`)} onPress={() => toggle(`template:${t.id}`)} />
            ))}
          </>
        ) : null}

        {allKeys.length === 0 ? (
          <Text style={[type.body, styles.emptyText]}>{tab === 'active' ? strings.archiveEmptyActive : strings.archiveEmptyArchived}</Text>
        ) : null}
      </ScrollView>

      {selected.size > 0 ? (
        <Pressable onPress={() => void handleBulkAction()} style={styles.bulkTouch}>
          <Text style={[type.label, styles.bulkLabel]}>
            {tab === 'active' ? strings.archiveBulkArchiveButton(selected.size) : strings.archiveBulkRestoreButton(selected.size)}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SelectableRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Checkbox checked={checked} />
      <Text style={[type.label, styles.rowLabel]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  tabRow: {
    flexDirection: 'row',
    height: size.topBar,
  },
  tabTouch: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    color: color.slabSecondary,
  },
  tabInactive: {
    color: color.textMuted,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 96,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: size.listRow,
    paddingHorizontal: size.listRowPadding,
  },
  selectAllLabel: {
    color: color.textPrimary,
  },
  sectionHeading: {
    color: color.textMuted,
    paddingHorizontal: size.listRowPadding,
    marginTop: 8,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: size.listRow,
    paddingHorizontal: size.listRowPadding,
    borderBottomWidth: size.divider,
    borderBottomColor: color.divider,
  },
  rowLabel: {
    color: color.textPrimary,
    flexShrink: 1,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: color.divider,
  },
  checkboxChecked: {
    backgroundColor: color.slabSecondary,
    borderColor: color.slabSecondary,
  },
  emptyText: {
    color: color.textMuted,
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 16,
  },
  bulkTouch: {
    minHeight: size.bottomSlab,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.slabPrimary,
  },
  bulkLabel: {
    color: color.onSlab,
  },
});
