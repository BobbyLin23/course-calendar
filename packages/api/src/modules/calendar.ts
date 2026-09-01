import { db } from "@course-calendar/db";
import {
	courses,
	lessonLedger,
	scheduleRules,
	sessions,
} from "@course-calendar/db/schema/index";
import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";

export const weekInput = z.object({
	weekStart: z.string().date(),
	timezone: z.string().default("Asia/Shanghai"),
	days: z.number().int().min(1).max(31).default(7),
});
export const changeSessionInput = z.object({
	sessionId: z.string().uuid(),
	status: z.enum(["scheduled", "completed", "leave", "absent", "cancelled"]),
	reason: z.string().trim().max(500).optional(),
	idempotencyKey: z.string().min(8).max(120),
});

function parseDateKey(key: string) {
	const [year = 1970, month = 1, day = 1] = key.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, day));
}

function formatDateKey(date: Date) {
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(key: string, amount: number) {
	const date = parseDateKey(key);
	date.setUTCDate(date.getUTCDate() + amount);
	return formatDateKey(date);
}

function weekdayFromDate(key: string) {
	const day = parseDateKey(key).getUTCDay();
	return day === 0 ? 7 : day;
}

function toShanghaiDate(date: string, time: string) {
	return new Date(`${date}T${time.slice(0, 5)}:00+08:00`);
}

type CourseScheduleSource = Pick<
	typeof courses.$inferSelect,
	| "scheduleType"
	| "singleDate"
	| "startDate"
	| "weekdays"
	| "localStartTime"
	| "durationMinutes"
>;

type RuleScheduleSource = Pick<
	typeof scheduleRules.$inferSelect,
	| "id"
	| "startDate"
	| "endDate"
	| "weekdays"
	| "localStartTime"
	| "durationMinutes"
>;

export type OccurrenceSpec = {
	date: string;
	startsAt: Date;
	endsAt: Date;
	scheduleRuleId?: string;
};

export function buildOccurrenceSpecs(
	weekStart: string,
	days: number,
	course: CourseScheduleSource,
	rule?: RuleScheduleSource | null,
): OccurrenceSpec[] {
	const weekEnd = addDays(weekStart, days - 1);
	const schedule =
		course.scheduleType === "weekly" && rule
			? {
					startDate: rule.startDate,
					endDate: rule.endDate,
					weekdays: rule.weekdays,
					localStartTime: rule.localStartTime,
					durationMinutes: rule.durationMinutes,
				}
			: {
					startDate: course.startDate,
					endDate: null,
					weekdays: course.weekdays,
					localStartTime: course.localStartTime,
					durationMinutes: course.durationMinutes,
				};
	const dates =
		course.scheduleType === "once" && course.singleDate
			? [course.singleDate]
			: Array.from({ length: days }, (_, index) =>
					addDays(weekStart, index),
				).filter((date) =>
					schedule.weekdays.map(Number).includes(weekdayFromDate(date)),
				);
	return dates.flatMap((occurrenceDate) => {
		if (
			occurrenceDate < weekStart ||
			occurrenceDate > weekEnd ||
			occurrenceDate < schedule.startDate ||
			(schedule.endDate !== null && occurrenceDate > schedule.endDate)
		)
			return [];
		const startsAt = toShanghaiDate(occurrenceDate, schedule.localStartTime);
		return [
			{
				date: occurrenceDate,
				startsAt,
				endsAt: new Date(
					startsAt.getTime() + schedule.durationMinutes * 60_000,
				),
				scheduleRuleId: rule?.id,
			},
		];
	});
}

function formatShanghaiTime(date: Date) {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Shanghai",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).format(date);
}

function minutesFromTime(time: string) {
	const [hours = 0, minutes = 0] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

async function ensureWeekSessions(weekStart: string, days: number) {
	const weekEnd = addDays(weekStart, days - 1);
	const activeCourses = await db
		.select({ course: courses, rule: scheduleRules })
		.from(courses)
		.leftJoin(
			scheduleRules,
			and(
				eq(scheduleRules.courseId, courses.id),
				eq(scheduleRules.isActive, true),
			),
		)
		.where(eq(courses.status, "active"));
	for (const { course, rule } of activeCourses) {
		for (const occurrence of buildOccurrenceSpecs(
			weekStart,
			days,
			course,
			rule,
		)) {
			await db
				.insert(sessions)
				.values({
					courseId: course.id,
					scheduleRuleId: occurrence.scheduleRuleId,
					occurrenceDate: occurrence.date,
					startsAt: occurrence.startsAt,
					endsAt: occurrence.endsAt,
					courseNameSnapshot: course.name,
					locationSnapshot: course.defaultLocation,
					costUnits: course.defaultCostUnits,
				})
				.onConflictDoNothing();
		}
	}
	return weekEnd;
}

export async function getWeek(weekStart: string, days = 7) {
	const weekEnd = await ensureWeekSessions(weekStart, days);
	const rows = await db
		.select({ session: sessions, course: courses })
		.from(sessions)
		.innerJoin(courses, eq(sessions.courseId, courses.id))
		.where(
			and(
				gte(sessions.occurrenceDate, weekStart),
				lte(sessions.occurrenceDate, weekEnd),
			),
		);
	return {
		weekStart,
		weekEnd,
		sessions: rows.map(({ session }) => {
			const startTime = formatShanghaiTime(session.startsAt);
			const endTime = formatShanghaiTime(session.endsAt);
			return {
				id: session.id,
				courseId: session.courseId,
				date: session.occurrenceDate,
				startTime,
				endTime,
				startMinutes: minutesFromTime(startTime),
				endMinutes: minutesFromTime(endTime),
				status: session.status,
			};
		}),
	};
}

export async function changeSessionStatus(
	input: z.infer<typeof changeSessionInput>,
) {
	return db.transaction(async (tx) => {
		const found = await tx
			.select()
			.from(sessions)
			.where(eq(sessions.id, input.sessionId))
			.limit(1);
		const session = found[0];
		if (!session) throw new Error("课程实例不存在");
		if (session.status === input.status) return session;
		const wasSettled =
			session.status === "completed" || session.status === "absent";
		const willSettle =
			input.status === "completed" || input.status === "absent";
		const deltaUnits =
			wasSettled === willSettle
				? 0
				: willSettle
					? -session.costUnits
					: session.costUnits;
		await tx
			.update(sessions)
			.set({
				status: input.status,
				statusReason: input.reason,
				settledAt: willSettle ? new Date() : null,
				updatedAt: new Date(),
			})
			.where(eq(sessions.id, input.sessionId));
		if (deltaUnits !== 0) {
			await tx.insert(lessonLedger).values({
				courseId: session.courseId,
				sessionId: session.id,
				kind: deltaUnits < 0 ? "consumption" : "reversal",
				deltaUnits,
				reason: input.reason ?? (deltaUnits < 0 ? "课程结算" : "撤销课程结算"),
				idempotencyKey: input.idempotencyKey,
			});
		}
		return { ...session, status: input.status };
	});
}
