CREATE TABLE "access_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"name" text,
	"first_used_at" timestamp,
	"expires_at" timestamp,
	"is_revoked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "access_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_id" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"snippet" text,
	"course_name" text,
	"received_at" timestamp DEFAULT now(),
	"sort_order" integer DEFAULT 0,
	"visible_to" text[] DEFAULT '{"5747","4201","1010"}'
);
--> statement-breakpoint
CREATE TABLE "app_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "course_week_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_code" text NOT NULL,
	"semester_settings_id" integer NOT NULL,
	"week_number" integer NOT NULL,
	"confirmed" boolean DEFAULT false,
	"course_week_label" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "custom_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_folder_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "degree_tracking_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "degree_tracking_data_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "deleted_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"folder_id" text NOT NULL,
	"deleted_at" timestamp DEFAULT now(),
	CONSTRAINT "deleted_folders_folder_id_unique" UNIQUE("folder_id")
);
--> statement-breakpoint
CREATE TABLE "entity_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feedback_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"note" text NOT NULL,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_name" text NOT NULL,
	"display_name" text NOT NULL,
	"object_path" text NOT NULL,
	"content_type" text,
	"size" integer,
	"folder" text,
	"listened" boolean DEFAULT false,
	"last_chunk_index" integer DEFAULT 0,
	"total_chunks" integer DEFAULT 0,
	"checked_chunks" text,
	"tts_audio_url" text,
	"tts_generated_at" timestamp,
	"extracted_text" text,
	"prepared_audio_paths" text,
	"prepared_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "files_object_path_unique" UNIQUE("object_path")
);
--> statement-breakpoint
CREATE TABLE "ha_automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"triggers" text DEFAULT '[]' NOT NULL,
	"conditions" text DEFAULT '[]' NOT NULL,
	"actions" text DEFAULT '[]' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_triggered" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "key_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"organization" text,
	"department" text,
	"email" text,
	"phone" text,
	"office" text,
	"category" text DEFAULT 'other',
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "pending_review_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_email" text,
	"external_id" text,
	"title" text NOT NULL,
	"description" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"event_start_time" text,
	"event_end_time" text,
	"location" text,
	"raw_data" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"course_name" text,
	"task_type" text DEFAULT 'meeting',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#6366F1',
	"status" text DEFAULT 'planning',
	"course_name" text,
	"start_date" timestamp,
	"target_date" timestamp,
	"completed_at" timestamp,
	"priority" text DEFAULT 'medium',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saved_email_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"account" text DEFAULT 'all' NOT NULL,
	"search_term" text,
	"date_filter" text DEFAULT 'all',
	"date_from" text,
	"date_to" text,
	"category" text DEFAULT 'skip',
	"action" text DEFAULT 'delete',
	"folder_id" text,
	"folder_account" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scheduled_alexa_announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"repeat_type" text DEFAULT 'none',
	"repeat_interval" integer,
	"repeat_interval_unit" text,
	"repeat_end_date" timestamp,
	"shift_adjust" boolean DEFAULT false,
	"is_enabled" boolean DEFAULT true,
	"is_sent" boolean DEFAULT false,
	"last_sent_at" timestamp,
	"speakers" text DEFAULT 'all',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scholarships" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization" text NOT NULL,
	"amount" text,
	"applications_open" text,
	"deadline" text,
	"winners_announced" text,
	"application_url" text,
	"contact_info" text,
	"additional_info" text,
	"status" text DEFAULT 'not_started'
);
--> statement-breakpoint
CREATE TABLE "second_google_account" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "semester_checklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"semester_settings_id" integer NOT NULL,
	"course_code" text NOT NULL,
	"item_type" text NOT NULL,
	"is_checked" boolean DEFAULT false,
	"checked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "semester_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"semester_name" text DEFAULT 'Winter 2026 Semester' NOT NULL,
	"semester_start_date" timestamp NOT NULL,
	"semester_end_date" timestamp,
	"semester_type" text DEFAULT 'winter',
	"course1_code" text NOT NULL,
	"course1_name" text NOT NULL,
	"course1_professor" text,
	"course1_professor_email" text,
	"course1_semester_type" text,
	"course1_delivery_mode" text,
	"course1_class_day" text,
	"course1_class_day2" text,
	"course1_class_time" text,
	"course1_class_end_time" text,
	"course1_class_time2" text,
	"course1_class_end_time2" text,
	"course1_start_date" timestamp,
	"course1_end_date" timestamp,
	"course1_spring_summer_term" text,
	"course1_course_type" text,
	"course1_zoom_link" text,
	"course1_color" text,
	"course1_color_end" text,
	"course1_color_stops" text,
	"course1_border_color" text,
	"course1_course_row_color" text,
	"course1_task_bg_color" text,
	"course1_final_grade" integer,
	"course1_completed" boolean DEFAULT false,
	"course2_code" text NOT NULL,
	"course2_name" text NOT NULL,
	"course2_professor" text,
	"course2_professor_email" text,
	"course2_semester_type" text,
	"course2_delivery_mode" text,
	"course2_class_day" text,
	"course2_class_day2" text,
	"course2_class_time" text,
	"course2_class_end_time" text,
	"course2_class_time2" text,
	"course2_class_end_time2" text,
	"course2_start_date" timestamp,
	"course2_end_date" timestamp,
	"course2_spring_summer_term" text,
	"course2_course_type" text,
	"course2_zoom_link" text,
	"course2_color" text,
	"course2_color_end" text,
	"course2_color_stops" text,
	"course2_border_color" text,
	"course2_course_row_color" text,
	"course2_task_bg_color" text,
	"course2_final_grade" integer,
	"course2_completed" boolean DEFAULT false,
	"course3_code" text NOT NULL,
	"course3_name" text NOT NULL,
	"course3_professor" text,
	"course3_professor_email" text,
	"course3_semester_type" text,
	"course3_delivery_mode" text,
	"course3_class_day" text,
	"course3_class_day2" text,
	"course3_class_time" text,
	"course3_class_end_time" text,
	"course3_class_time2" text,
	"course3_class_end_time2" text,
	"course3_start_date" timestamp,
	"course3_end_date" timestamp,
	"course3_spring_summer_term" text,
	"course3_course_type" text,
	"course3_zoom_link" text,
	"course3_color" text,
	"course3_color_end" text,
	"course3_color_stops" text,
	"course3_border_color" text,
	"course3_course_row_color" text,
	"course3_task_bg_color" text,
	"course3_final_grade" integer,
	"course3_completed" boolean DEFAULT false,
	"secondary_calendar_id" text,
	"reading_week_start" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shared_notebook_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"notebook_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shift_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"shift_type" text DEFAULT 'off' NOT NULL,
	CONSTRAINT "shift_schedule_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "sticky_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text DEFAULT 'Note' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"color" text DEFAULT 'yellow' NOT NULL,
	"custom_color" text,
	"position_x" integer DEFAULT 100 NOT NULL,
	"position_y" integer DEFAULT 100 NOT NULL,
	"width" integer DEFAULT 200 NOT NULL,
	"height" integer DEFAULT 150 NOT NULL,
	"z_index" integer DEFAULT 100 NOT NULL,
	"is_minimized" boolean DEFAULT false NOT NULL,
	"task_id" integer,
	"project_id" integer,
	"reminder_time" timestamp,
	"reminder_alarm" boolean DEFAULT false NOT NULL,
	"reminder_email" boolean DEFAULT false NOT NULL,
	"reminder_push" boolean DEFAULT false NOT NULL,
	"home_position_x" integer,
	"home_position_y" integer,
	"last_moved_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subtasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_task_id" integer NOT NULL,
	"parent_subtask_id" integer,
	"title" text NOT NULL,
	"description" text,
	"start_date" timestamp,
	"due_date" timestamp,
	"event_start_time" text,
	"event_end_time" text,
	"week_number" integer,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"priority" text DEFAULT 'medium',
	"notes" text,
	"reference_link" text,
	"attachments" text[],
	"position" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_type" text NOT NULL,
	"source_id" integer NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"link_type" text DEFAULT 'relates_to' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"course_name" text,
	"project_id" integer,
	"start_date" timestamp,
	"due_date" timestamp NOT NULL,
	"event_start_time" text,
	"event_end_time" text,
	"reminder_1" integer DEFAULT 30,
	"reminder_2" integer DEFAULT 120,
	"reminder_3" integer,
	"reminder_4" integer,
	"week_number" integer NOT NULL,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"is_missed" boolean DEFAULT false,
	"priority" text DEFAULT 'medium',
	"notes" text,
	"reference_link" text,
	"attachments" text[],
	"calendar_event_id" text,
	"calendar_provider" text,
	"prep_calendar_event_id" text,
	"secondary_calendar_event_id" text,
	"second_account_calendar_event_id" text,
	"second_account_prep_event_id" text,
	"repeat_type" text DEFAULT 'none',
	"repeat_interval" integer,
	"repeat_interval_unit" text,
	"repeat_end_date" timestamp,
	"parent_task_id" integer,
	"grade_weight" double precision,
	"grade_value" double precision,
	"grade_total" double precision,
	"assignment_group" text,
	"sort_order" integer DEFAULT 0,
	"is_acknowledged" boolean DEFAULT true,
	"exclude_from_gpa" boolean DEFAULT true,
	"invite_emails" text[],
	"hide_from_summary" boolean DEFAULT false,
	"hide_from_timeline" boolean DEFAULT false,
	"hide_from_countdown" boolean DEFAULT false,
	"flagged" boolean DEFAULT false,
	"reminder_email" boolean DEFAULT false,
	"reminder_alexa" boolean DEFAULT false,
	"reminder_sms" boolean DEFAULT false,
	"reminder_1_methods" text,
	"reminder_2_methods" text,
	"reminder_3_methods" text,
	"reminder_4_methods" text,
	"reminder_4_date_time" text,
	"show_countdown_bar" boolean DEFAULT true,
	"show_countdown_bar_main" boolean DEFAULT true,
	"show_countdown_bar_summary" boolean DEFAULT true,
	"countdown_bar_days" integer DEFAULT 0,
	"countdown_bar_color" text,
	"repeat_span_days" integer DEFAULT 1,
	"shift_adjust" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "third_google_account" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;