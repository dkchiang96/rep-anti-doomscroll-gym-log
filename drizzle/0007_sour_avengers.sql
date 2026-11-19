ALTER TABLE `exercise` ADD `kind` text DEFAULT 'strength' NOT NULL;--> statement-breakpoint
ALTER TABLE `exercise` ADD `track` text;--> statement-breakpoint
ALTER TABLE `session_exercise` ADD `rpe` integer;--> statement-breakpoint
ALTER TABLE `session_exercise` ADD `lap_started_at` integer;--> statement-breakpoint
ALTER TABLE `set` ADD `distance_m` real;--> statement-breakpoint
ALTER TABLE `set` ADD `duration_seconds` integer;--> statement-breakpoint
ALTER TABLE `set` ADD `calories` integer;--> statement-breakpoint
ALTER TABLE `template` ADD `warm_up` text;--> statement-breakpoint
ALTER TABLE `template` ADD `warm_down` text;--> statement-breakpoint
ALTER TABLE `template_exercise` ADD `target_distance_m` real;--> statement-breakpoint
ALTER TABLE `template_exercise` ADD `target_time_seconds` integer;--> statement-breakpoint
ALTER TABLE `template_exercise` ADD `target_calories` integer;--> statement-breakpoint
ALTER TABLE `template_exercise` ADD `target_load_kg` real;