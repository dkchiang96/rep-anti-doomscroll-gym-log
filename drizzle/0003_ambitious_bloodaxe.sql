ALTER TABLE `exercise` ADD `target_rest_seconds` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `rest_flash_interval_seconds` integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `rest_sound_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `rest_vibration_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `rest_camera_flash_enabled` integer DEFAULT false NOT NULL;