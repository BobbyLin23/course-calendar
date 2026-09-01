import { db } from "@course-calendar/db";
import {
	children,
	courses,
	lessonAccounts,
	lessonLedger,
	scheduleRules,
	sessions,
} from "@course-calendar/db/schema/index";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";

export const scheduleSlotSchema = z.object({
	weekday: z.number().int().min(1).max(7),
	startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
	durationMinutes: z.number().int().min(15).max(720),
});

export const courseInput = z
	.object({
		name: z.string().trim().min(1).max(120),
		childName: z.string().trim().min(1).max(80).default("安安"),
		color: z.enum(["coral", "indigo", "sage", "amber", "plum"]),
		location: z.string().trim().max(160).default(""),
		startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
		durationMinutes: z.number().int().min(15).max(720),
		startDate: z.string().date(),
		weekdays: z.array(z.number().int().min(1).max(7)).max(7),
		scheduleType: z.enum(["weekly", "once"]),
		singleDate: z.string().date().optional(),
		costUnits: z.number().int().positive().max(100000),
		lowBalanceUnits: z.number().int().nonnegative().max(100000),
		notes: z.string().trim().max(2000).default(""),
		initialBalanceUnits: z.number().int().nonnegative().max(1000000),
		scheduleSlots: z.array(scheduleSlotSchema).max(28).optional(),
	})
	.superRefine((input, context) => {
		if (
			input.scheduleType === "weekly" &&
			(input.scheduleSlots?.length ?? 0) === 0 &&
			input.weekdays.length === 0
		) {
			context.addIssue({
				code: "custom",
				path: ["scheduleSlots"],
				message: "每周重复课程至少需要一个上课时间",
			});
		}
		if (input.scheduleType === "once" && !input.singleDate) {
			context.addIssue({
				code: "custom",
				path: ["singleDate"],
				message: "单次课程需要上课日期",
			});
		}
		const seen = new Set<string>();
		for (const slot of input.scheduleSlots ?? []) {
			const key = `${slot.weekday}:${slot.startTime}`;
			if (seen.has(key)) {
				context.addIssue({
					code: "custom",
					path: ["scheduleSlots"],
					message: "同一星期和开始时间不能重复",
				});
				break;
			}
			seen.add(key);
		}
	});

export type CourseInput = z.infer<typeof courseInput>;
export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;

export type CourseSummary = Omit<CourseInput, "scheduleSlots"> & {
	scheduleSlots: ScheduleSlot[];
	id: string;
	balanceUnits: number;
	status: "active" | "archived";
};

export function normalizeScheduleSlots(input: CourseInput): ScheduleSlot[] {
	if (input.scheduleType !== "weekly") return [];
	const slots =
		input.scheduleSlots && input.scheduleSlots.length > 0
			? input.scheduleSlots
			: input.weekdays.map((weekday) => ({
					weekday,
					startTime: input.startTime,
					durationMinutes: input.durationMinutes,
				}));
	return [...slots].sort(
		(a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
	);
}

function localTodayKey() {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(new Date());
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((item) => item.type === type)?.value ?? "";
	return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function ensureDefaultChild(name = "安安") {
	const existing = await db
		.select()
		.from(children)
		.orderBy(asc(children.createdAt))
		.limit(1);
	if (existing[0]) return existing[0];
	const inserted = await db.insert(children).values({ name }).returning();
	if (!inserted[0]) throw new Error("默认孩子档案创建失败");
	return inserted[0];
}

async function getBalances(courseIds: string[]) {
	if (courseIds.length === 0) return new Map<string, number>();
	const rows = await db
		.select({
			courseId: lessonLedger.courseId,
			balanceUnits: sql<number>`coalesce(sum(${lessonLedger.deltaUnits}), 0)`,
		})
		.from(lessonLedger)
		.where(inArray(lessonLedger.courseId, courseIds))
		.groupBy(lessonLedger.courseId);
	return new Map(rows.map((row) => [row.courseId, Number(row.balanceUnits)]));
}

export async function listCourses(
	includeArchived = false,
): Promise<CourseSummary[]> {
	const rows = await db
		.select({ course: courses, child: children, account: lessonAccounts })
		.from(courses)
		.innerJoin(children, eq(courses.childId, children.id))
		.leftJoin(lessonAccounts, eq(courses.id, lessonAccounts.courseId))
		.where(includeArchived ? undefined : eq(courses.status, "active"));
	const courseIds = rows.map((row) => row.course.id);
	const [balances, activeRules] = await Promise.all([
		getBalances(courseIds),
		courseIds.length === 0
			? Promise.resolve([])
			: db
					.select()
					.from(scheduleRules)
					.where(
						and(
							inArray(scheduleRules.courseId, courseIds),
							eq(scheduleRules.isActive, true),
						),
					),
	]);
	return rows.map(({ course, child, account }) => ({
		...(() => {
			const ruleSlots = activeRules
				.filter((rule) => rule.courseId === course.id)
				.flatMap((rule) =>
					rule.weekdays.map((weekday) => ({
						weekday: Number(weekday),
						startTime: rule.localStartTime.slice(0, 5),
						durationMinutes: rule.durationMinutes,
					})),
				);
			return {
				scheduleSlots:
					ruleSlots.length > 0
						? ruleSlots.sort(
								(a, b) =>
									a.weekday - b.weekday ||
									a.startTime.localeCompare(b.startTime),
							)
						: course.weekdays.map((weekday) => ({
								weekday: Number(weekday),
								startTime: course.localStartTime.slice(0, 5),
								durationMinutes: course.durationMinutes,
							})),
			};
		})(),
		id: course.id,
		name: course.name,
		childName: child.name,
		color: course.color as CourseSummary["color"],
		location: course.defaultLocation ?? "",
		startTime: course.localStartTime.slice(0, 5),
		durationMinutes: course.durationMinutes,
		startDate: course.startDate,
		weekdays: course.weekdays.map(Number),
		scheduleType: course.scheduleType as CourseSummary["scheduleType"],
		singleDate: course.singleDate ?? undefined,
		costUnits: course.defaultCostUnits,
		lowBalanceUnits: account?.lowBalanceUnits ?? 300,
		notes: course.notes ?? "",
		initialBalanceUnits: balances.get(course.id) ?? 0,
		balanceUnits: balances.get(course.id) ?? 0,
		status: course.status,
	}));
}

export async function createCourse(input: CourseInput) {
	const child = await ensureDefaultChild(input.childName);
	const scheduleSlots = normalizeScheduleSlots(input);
	const primarySlot = scheduleSlots[0];
	const inserted = await db
		.insert(courses)
		.values({
			childId: child.id,
			name: input.name,
			color: input.color,
			defaultLocation: input.location,
			defaultCostUnits: input.costUnits,
			notes: input.notes,
			startDate: input.startDate,
			weekdays: [...new Set(scheduleSlots.map((slot) => slot.weekday))],
			localStartTime: primarySlot?.startTime ?? input.startTime,
			durationMinutes: primarySlot?.durationMinutes ?? input.durationMinutes,
			scheduleType: input.scheduleType,
			singleDate: input.singleDate,
		})
		.returning();
	const course = inserted[0];
	if (!course) throw new Error("课程创建失败");
	await db
		.insert(lessonAccounts)
		.values({ courseId: course.id, lowBalanceUnits: input.lowBalanceUnits });
	await db.insert(lessonLedger).values({
		courseId: course.id,
		kind: "initial",
		deltaUnits: input.initialBalanceUnits,
		reason: "初始课时",
		idempotencyKey: `initial:${course.id}`,
	});
	if (input.scheduleType === "weekly") {
		await db.insert(scheduleRules).values(
			scheduleSlots.map((slot) => ({
				courseId: course.id,
				startDate: input.startDate,
				weekdays: [slot.weekday],
				localStartTime: slot.startTime,
				durationMinutes: slot.durationMinutes,
			})),
		);
	}
	return (await listCourses(true)).find((item) => item.id === course.id);
}

export async function updateCourse(courseId: string, input: CourseInput) {
	const scheduleSlots = normalizeScheduleSlots(input);
	const primarySlot = scheduleSlots[0];
	const updated = await db
		.update(courses)
		.set({
			name: input.name,
			color: input.color,
			defaultLocation: input.location,
			defaultCostUnits: input.costUnits,
			notes: input.notes,
			startDate: input.startDate,
			weekdays: [...new Set(scheduleSlots.map((slot) => slot.weekday))],
			localStartTime: primarySlot?.startTime ?? input.startTime,
			durationMinutes: primarySlot?.durationMinutes ?? input.durationMinutes,
			scheduleType: input.scheduleType,
			singleDate: input.singleDate,
			updatedAt: new Date(),
		})
		.where(eq(courses.id, courseId))
		.returning();
	if (!updated[0]) return undefined;
	await db
		.update(lessonAccounts)
		.set({ lowBalanceUnits: input.lowBalanceUnits, updatedAt: new Date() })
		.where(eq(lessonAccounts.courseId, courseId));
	await db
		.update(scheduleRules)
		.set({ isActive: false, updatedAt: new Date() })
		.where(
			and(
				eq(scheduleRules.courseId, courseId),
				eq(scheduleRules.isActive, true),
			),
		);
	await db
		.delete(sessions)
		.where(
			and(
				eq(sessions.courseId, courseId),
				gte(sessions.occurrenceDate, localTodayKey()),
				eq(sessions.status, "scheduled"),
			),
		);
	if (input.scheduleType === "weekly") {
		await db.insert(scheduleRules).values(
			scheduleSlots.map((slot) => ({
				courseId,
				startDate: input.startDate,
				weekdays: [slot.weekday],
				localStartTime: slot.startTime,
				durationMinutes: slot.durationMinutes,
			})),
		);
	}
	return (await listCourses(true)).find((item) => item.id === courseId);
}

export async function archiveCourse(courseId: string) {
	await db
		.update(courses)
		.set({ status: "archived", updatedAt: new Date() })
		.where(eq(courses.id, courseId));
	await db
		.update(scheduleRules)
		.set({ isActive: false, updatedAt: new Date() })
		.where(eq(scheduleRules.courseId, courseId));
}

export async function deleteCourse(courseId: string) {
	return db.transaction(async (tx) => {
		const existing = await tx
			.select({ id: courses.id })
			.from(courses)
			.where(eq(courses.id, courseId))
			.limit(1);
		if (!existing[0]) return false;

		await tx.delete(lessonLedger).where(eq(lessonLedger.courseId, courseId));
		await tx.delete(sessions).where(eq(sessions.courseId, courseId));
		await tx.delete(scheduleRules).where(eq(scheduleRules.courseId, courseId));
		await tx
			.delete(lessonAccounts)
			.where(eq(lessonAccounts.courseId, courseId));
		await tx.delete(courses).where(eq(courses.id, courseId));
		return true;
	});
}

export async function adjustLessons(
	courseId: string,
	deltaUnits: number,
	reason: string,
	idempotencyKey: string,
) {
	await db
		.insert(lessonLedger)
		.values({
			courseId,
			kind: "adjustment",
			deltaUnits,
			reason,
			idempotencyKey,
		})
		.onConflictDoNothing({ target: lessonLedger.idempotencyKey });
	const balances = await getBalances([courseId]);
	return { courseId, balanceUnits: balances.get(courseId) ?? 0 };
}

export async function listLedger() {
	return db
		.select()
		.from(lessonLedger)
		.orderBy(desc(lessonLedger.createdAt))
		.limit(100);
}
