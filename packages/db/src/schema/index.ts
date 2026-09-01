import {
	boolean,
	date,
	index,
	integer,
	pgEnum,
	pgTable,
	smallint,
	text,
	time,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

export const courseStatus = pgEnum("course_status", ["active", "archived"]);
export const sessionStatus = pgEnum("session_status", [
	"scheduled",
	"completed",
	"leave",
	"absent",
	"cancelled",
]);
export const ledgerKind = pgEnum("ledger_kind", [
	"initial",
	"purchase",
	"consumption",
	"reversal",
	"adjustment",
]);

export const children = pgTable("children", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: text("name").notNull(),
	avatarUrl: text("avatar_url"),
	color: text("color"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const courses = pgTable(
	"courses",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		childId: uuid("child_id")
			.references(() => children.id)
			.notNull(),
		name: text("name").notNull(),
		color: text("color").notNull(),
		defaultLocation: text("default_location"),
		defaultCostUnits: integer("default_cost_units").notNull().default(100),
		timezone: text("timezone").notNull().default("Asia/Shanghai"),
		notes: text("notes"),
		startDate: date("start_date", { mode: "string" }).notNull(),
		weekdays: smallint("weekdays").array().notNull().default([]),
		localStartTime: time("local_start_time").notNull(),
		durationMinutes: integer("duration_minutes").notNull(),
		scheduleType: text("schedule_type").notNull().default("weekly"),
		singleDate: date("single_date", { mode: "string" }),
		status: courseStatus("status").notNull().default("active"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("courses_child_status_idx").on(table.childId, table.status),
		index("courses_start_date_idx").on(table.startDate),
	],
);

export const scheduleRules = pgTable(
	"schedule_rules",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		courseId: uuid("course_id")
			.references(() => courses.id)
			.notNull(),
		startDate: date("start_date", { mode: "string" }).notNull(),
		endDate: date("end_date", { mode: "string" }),
		weekdays: smallint("weekdays").array().notNull(),
		localStartTime: time("local_start_time").notNull(),
		durationMinutes: integer("duration_minutes").notNull(),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("schedule_rules_course_idx").on(table.courseId, table.isActive),
	],
);

export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		courseId: uuid("course_id")
			.references(() => courses.id)
			.notNull(),
		scheduleRuleId: uuid("schedule_rule_id").references(
			() => scheduleRules.id,
			{ onDelete: "set null" },
		),
		occurrenceDate: date("occurrence_date", { mode: "string" }).notNull(),
		startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
		endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
		courseNameSnapshot: text("course_name_snapshot").notNull(),
		locationSnapshot: text("location_snapshot"),
		costUnits: integer("cost_units").notNull(),
		status: sessionStatus("status").notNull().default("scheduled"),
		statusReason: text("status_reason"),
		settledAt: timestamp("settled_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("sessions_starts_at_idx").on(table.startsAt),
		uniqueIndex("sessions_course_starts_at_idx").on(
			table.courseId,
			table.startsAt,
		),
		index("sessions_status_starts_at_idx").on(table.status, table.startsAt),
	],
);

export const lessonAccounts = pgTable("lesson_accounts", {
	courseId: uuid("course_id")
		.references(() => courses.id)
		.primaryKey(),
	lowBalanceUnits: integer("low_balance_units").notNull().default(300),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const lessonLedger = pgTable(
	"lesson_ledger",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		courseId: uuid("course_id")
			.references(() => courses.id)
			.notNull(),
		sessionId: uuid("session_id").references(() => sessions.id),
		kind: ledgerKind("kind").notNull(),
		deltaUnits: integer("delta_units").notNull(),
		reason: text("reason"),
		idempotencyKey: text("idempotency_key").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("lesson_ledger_course_created_idx").on(
			table.courseId,
			table.createdAt,
		),
	],
);
