ALTER TABLE `session` ADD `clock_started_at` integer;--> statement-breakpoint
ALTER TABLE `session` ADD `clock_paused_at` integer;--> statement-breakpoint
ALTER TABLE `session` ADD `clock_accumulated_pause_ms` integer DEFAULT 0 NOT NULL;