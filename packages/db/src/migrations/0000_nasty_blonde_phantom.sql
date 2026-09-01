CREATE TYPE "public"."course_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('initial', 'purchase', 'consumption', 'reversal', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'completed', 'leave', 'absent', 'cancelled');--> statement-breakpoint
CREATE TABLE "children" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"default_location" text,
	"default_cost_units" integer DEFAULT 100 NOT NULL,
	"timezone" text DEFAULT 'Asia/Shanghai' NOT NULL,
	"notes" text,
	"start_date" date NOT NULL,
	"weekdays" smallint[] DEFAULT '{}' NOT NULL,
	"local_start_time" time NOT NULL,
	"duration_minutes" integer NOT NULL,
	"schedule_type" text DEFAULT 'weekly' NOT NULL,
	"single_date" date,
	"status" "course_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_accounts" (
	"course_id" uuid PRIMARY KEY NOT NULL,
	"low_balance_units" integer DEFAULT 300 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"session_id" uuid,
	"kind" "ledger_kind" NOT NULL,
	"delta_units" integer NOT NULL,
	"reason" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_ledger_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "schedule_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"weekdays" smallint[] NOT NULL,
	"local_start_time" time NOT NULL,
	"duration_minutes" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"schedule_rule_id" uuid,
	"occurrence_date" date NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"course_name_snapshot" text NOT NULL,
	"location_snapshot" text,
	"cost_units" integer NOT NULL,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"status_reason" text,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_accounts" ADD CONSTRAINT "lesson_accounts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_ledger" ADD CONSTRAINT "lesson_ledger_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_ledger" ADD CONSTRAINT "lesson_ledger_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_schedule_rule_id_schedule_rules_id_fk" FOREIGN KEY ("schedule_rule_id") REFERENCES "public"."schedule_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courses_child_status_idx" ON "courses" USING btree ("child_id","status");--> statement-breakpoint
CREATE INDEX "courses_start_date_idx" ON "courses" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "lesson_ledger_course_created_idx" ON "lesson_ledger" USING btree ("course_id","created_at");--> statement-breakpoint
CREATE INDEX "schedule_rules_course_idx" ON "schedule_rules" USING btree ("course_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_course_occurrence_idx" ON "sessions" USING btree ("course_id","occurrence_date");--> statement-breakpoint
CREATE INDEX "sessions_starts_at_idx" ON "sessions" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "sessions_course_starts_at_idx" ON "sessions" USING btree ("course_id","starts_at");--> statement-breakpoint
CREATE INDEX "sessions_status_starts_at_idx" ON "sessions" USING btree ("status","starts_at");