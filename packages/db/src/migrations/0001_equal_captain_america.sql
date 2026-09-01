DROP INDEX "sessions_course_occurrence_idx";--> statement-breakpoint
DROP INDEX "sessions_course_starts_at_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_course_starts_at_idx" ON "sessions" USING btree ("course_id","starts_at");