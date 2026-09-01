import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { publicProcedure, router } from "../index";
import {
	changeSessionInput,
	changeSessionStatus,
	getWeek,
	weekInput,
} from "../modules/calendar";
import {
	adjustLessons,
	archiveCourse,
	courseInput,
	createCourse,
	deleteCourse,
	listCourses,
	listLedger,
	updateCourse,
} from "../modules/course";

const courseIdInput = z.object({ id: z.string().uuid() });
const adjustLessonsInput = z.object({
	id: z.string().uuid(),
	deltaUnits: z
		.number()
		.int()
		.refine((value) => value !== 0, "课时变更不能为 0"),
	reason: z.string().trim().min(1).max(500),
	idempotencyKey: z.string().min(8).max(120),
});
export const appRouter = router({
	healthCheck: publicProcedure.query(() => "OK"),
	calendar: router({
		week: publicProcedure
			.input(weekInput)
			.query(({ input }) => getWeek(input.weekStart, input.days)),
		changeSessionStatus: publicProcedure
			.input(changeSessionInput)
			.mutation(({ input }) => changeSessionStatus(input)),
	}),
	course: router({
		list: publicProcedure.query(() => listCourses(true)),
		ledger: publicProcedure.query(() => listLedger()),
		byId: publicProcedure.input(courseIdInput).query(async ({ input }) => {
			const course = (await listCourses(true)).find(
				(item) => item.id === input.id,
			);
			if (!course)
				throw new TRPCError({ code: "NOT_FOUND", message: "课程不存在" });
			return course;
		}),
		create: publicProcedure
			.input(courseInput)
			.mutation(({ input }) => createCourse(input)),
		update: publicProcedure
			.input(courseInput.and(z.object({ id: z.string().uuid() })))
			.mutation(({ input }) => {
				const { id, ...course } = input;
				return updateCourse(id, course);
			}),
		archive: publicProcedure
			.input(courseIdInput)
			.mutation(({ input }) => archiveCourse(input.id)),
		delete: publicProcedure.input(courseIdInput).mutation(async ({ input }) => {
			const deleted = await deleteCourse(input.id);
			if (!deleted)
				throw new TRPCError({ code: "NOT_FOUND", message: "课程不存在" });
			return { id: input.id };
		}),
		adjustLessons: publicProcedure
			.input(adjustLessonsInput)
			.mutation(({ input }) =>
				adjustLessons(
					input.id,
					input.deltaUnits,
					input.reason,
					input.idempotencyKey,
				),
			),
	}),
});

export type AppRouter = typeof appRouter;
