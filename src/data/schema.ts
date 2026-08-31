import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// The single local user. Does not carry user_id/deleted_at/sync_state —
// those columns describe a row's relationship to a user, which is meaningless
// for the user row itself.
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const exercise = sqliteTable('exercise', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  name: text('name').notNull(),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>().notNull(),
  muscleGroup: text('muscle_group').notNull(),
  equipmentType: text('equipment_type', {
    enum: ['barbell', 'dumbbell', 'selectorised', 'plate_loaded', 'cable', 'bodyweight', 'other'],
  }).notNull(),
  loadConvention: text('load_convention', {
    enum: ['per_side', 'total', 'bodyweight'],
  }).notNull(),
  // Required at the repository layer, not the DB layer, when equipmentType === 'barbell'.
  barWeightKg: real('bar_weight_kg'),
  defaultWeightStep: real('default_weight_step'),
  source: text('source', { enum: ['user', 'system', 'imported'] }).notNull(),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
  useCount: integer('use_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  syncState: text('sync_state').notNull().default('synced'),
});

export const plateInventory = sqliteTable('plate_inventory', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  gymLabel: text('gym_label').notNull(),
  denominationKg: real('denomination_kg').notNull(),
  colourHex: text('colour_hex').notNull(),
  quantityPerSide: integer('quantity_per_side').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  syncState: text('sync_state').notNull().default('synced'),
});

export const programme = sqliteTable('programme', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  name: text('name').notNull(),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  version: integer('version').notNull().default(1),
  source: text('source', {
    enum: ['manual', 'json_import', 'text_import', 'vision_import'],
  }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  syncState: text('sync_state').notNull().default('synced'),
});

export const template = sqliteTable('template', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  programmeId: text('programme_id').references(() => programme.id),
  name: text('name').notNull(),
  dayHint: text('day_hint'),
  orderIndex: integer('order_index').notNull().default(0),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  syncState: text('sync_state').notNull().default('synced'),
});

export const templateExercise = sqliteTable('template_exercise', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  templateId: text('template_id')
    .notNull()
    .references(() => template.id),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercise.id),
  orderIndex: integer('order_index').notNull().default(0),
  targetSets: integer('target_sets').notNull(),
  targetRepsMin: integer('target_reps_min').notNull(),
  targetRepsMax: integer('target_reps_max').notNull(),
  supersetGroupId: text('superset_group_id'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  syncState: text('sync_state').notNull().default('synced'),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  templateId: text('template_id').references(() => template.id),
  programmeId: text('programme_id').references(() => programme.id),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
  note: text('note'),
  // Verbatim source text for an imported session (e.g. the Google Keep note it came from). Null for manual sessions.
  rawImportText: text('raw_import_text'),
  source: text('source', { enum: ['manual', 'import'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  syncState: text('sync_state').notNull().default('synced'),
});

export const sessionExercise = sqliteTable('session_exercise', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  sessionId: text('session_id')
    .notNull()
    .references(() => session.id),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercise.id),
  orderIndex: integer('order_index').notNull().default(0),
  supersetGroupId: text('superset_group_id'),
  note: text('note'),
  // Temporarily hidden from the active logging flow (machine occupied, etc.) — not a deletion. FR-3.11.
  skippedAt: integer('skipped_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  syncState: text('sync_state').notNull().default('synced'),
});

export const setEntry = sqliteTable('set', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  sessionExerciseId: text('session_exercise_id')
    .notNull()
    .references(() => sessionExercise.id),
  index: integer('index').notNull(),
  weightKg: real('weight_kg').notNull(),
  reps: integer('reps').notNull(),
  setType: text('set_type', {
    enum: ['working', 'warmup', 'dropset', 'failure'],
  }).notNull(),
  // Not a DB-level FK: points at another row in this same table (the set a drop set follows).
  parentSetId: text('parent_set_id'),
  restAfterSeconds: integer('rest_after_seconds'),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  syncState: text('sync_state').notNull().default('synced'),
});
