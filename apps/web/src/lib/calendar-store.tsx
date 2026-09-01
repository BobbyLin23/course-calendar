import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useMemo } from "react";

import { trpc } from "@/utils/trpc";

export type CourseColor = "coral" | "indigo" | "sage" | "amber" | "plum";
export type SessionStatus =
	| "scheduled"
	| "completed"
	| "leave"
	| "absent"
	| "cancelled";
export type ScheduleType = "weekly" | "once";

export type ScheduleSlot = {
	weekday: number;
	startTime: string;
	durationMinutes: number;
};

export type Course = {
	id: string;
	name: string;
	childName: string;
	color: CourseColor;
	location: string;
	startTime: string;
	durationMinutes: number;
	startDate: string;
	weekdays: number[];
	scheduleSlots: ScheduleSlot[];
	scheduleType: ScheduleType;
	singleDate?: string;
	costUnits: number;
	balanceUnits: number;
	lowBalanceUnits: number;
	notes: string;
	status: "active" | "archived";
};

export type LedgerEntry = {
	id: string;
	courseId: string;
	sessionId?: string | null;
	deltaUnits: number;
	kind: "initial" | "consumption" | "reversal" | "adjustment";
	reason: string;
	createdAt: string | Date;
};

export type NewCourse = Omit<Course, "id" | "balanceUnits" | "status"> & {
	initialBalanceUnits: number;
};

type CalendarContextValue = {
	courses: Course[];
	ledger: LedgerEntry[];
	isLoading: boolean;
	addCourse: (course: NewCourse) => void;
	updateCourse: (courseId: string, changes: Partial<Course>) => void;
	archiveCourse: (courseId: string) => void;
	deleteCourse: (courseId: string) => void;
	adjustLessons: (courseId: string, deltaUnits: number, reason: string) => void;
	changeSessionStatus: (
		sessionId: string,
		courseId: string,
		status: SessionStatus,
	) => void;
};

export function localDateKey(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string) {
	const [year, month, day] = key.split("-").map(Number);
	return new Date(year, month - 1, day);
}

export function getWeekStart(date: Date) {
	const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const day = result.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	result.setDate(result.getDate() + diff);
	return result;
}

export function addDays(date: Date, amount: number) {
	const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	result.setDate(result.getDate() + amount);
	return result;
}

export function formatUnits(units: number) {
	return (units / 100)
		.toFixed(2)
		.replace(/\.00$/, "")
		.replace(/(\.\d)0$/, "$1");
}

export function dateForWeekday(weekStart: Date, weekday: number) {
	return addDays(weekStart, weekday - 1);
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const coursesQuery = useQuery(trpc.course.list.queryOptions());
	const ledgerQuery = useQuery(trpc.course.ledger.queryOptions());
	const createMutation = useMutation(
		trpc.course.create.mutationOptions({
			onSuccess: () => void queryClient.invalidateQueries(),
		}),
	);
	const updateMutation = useMutation(
		trpc.course.update.mutationOptions({
			onSuccess: () => void queryClient.invalidateQueries(),
		}),
	);
	const archiveMutation = useMutation(
		trpc.course.archive.mutationOptions({
			onSuccess: () => void queryClient.invalidateQueries(),
		}),
	);
	const deleteMutation = useMutation(
		trpc.course.delete.mutationOptions({
			onSuccess: () => void queryClient.invalidateQueries(),
		}),
	);
	const adjustMutation = useMutation(
		trpc.course.adjustLessons.mutationOptions({
			onSuccess: () => void queryClient.invalidateQueries(),
		}),
	);
	const sessionMutation = useMutation(
		trpc.calendar.changeSessionStatus.mutationOptions({
			onSuccess: () => void queryClient.invalidateQueries(),
		}),
	);
	const courses = (coursesQuery.data ?? []) as Course[];

	const value = useMemo<CalendarContextValue>(
		() => ({
			courses,
			ledger: (ledgerQuery.data ?? []) as LedgerEntry[],
			isLoading: coursesQuery.isLoading,
			addCourse: (input) => createMutation.mutate(input),
			updateCourse: (courseId, changes) => {
				const current = courses.find((course) => course.id === courseId);
				if (!current) return;
				updateMutation.mutate({
					id: courseId,
					name: changes.name ?? current.name,
					childName: changes.childName ?? current.childName,
					color: changes.color ?? current.color,
					location: changes.location ?? current.location,
					startTime: changes.startTime ?? current.startTime,
					durationMinutes: changes.durationMinutes ?? current.durationMinutes,
					startDate: changes.startDate ?? current.startDate,
					weekdays: changes.weekdays ?? current.weekdays,
					scheduleSlots: changes.scheduleSlots ?? current.scheduleSlots,
					scheduleType: changes.scheduleType ?? current.scheduleType,
					singleDate: changes.singleDate ?? current.singleDate,
					costUnits: changes.costUnits ?? current.costUnits,
					lowBalanceUnits: changes.lowBalanceUnits ?? current.lowBalanceUnits,
					notes: changes.notes ?? current.notes,
					initialBalanceUnits: current.balanceUnits,
				});
			},
			archiveCourse: (courseId) => archiveMutation.mutate({ id: courseId }),
			deleteCourse: (courseId) => deleteMutation.mutate({ id: courseId }),
			adjustLessons: (courseId, deltaUnits, reason) =>
				adjustMutation.mutate({
					id: courseId,
					deltaUnits,
					reason,
					idempotencyKey: crypto.randomUUID(),
				}),
			changeSessionStatus: (sessionId, _courseId, status) =>
				sessionMutation.mutate({
					sessionId,
					status,
					idempotencyKey: crypto.randomUUID(),
				}),
		}),
		[
			archiveMutation,
			courses,
			coursesQuery.isLoading,
			createMutation,
			deleteMutation,
			adjustMutation,
			ledgerQuery.data,
			sessionMutation,
			updateMutation,
		],
	);

	return (
		<CalendarContext.Provider value={value}>
			{children}
		</CalendarContext.Provider>
	);
}

export function useCalendar() {
	const context = useContext(CalendarContext);
	if (!context)
		throw new Error("useCalendar must be used inside CalendarProvider");
	return context;
}

export type Session = {
	id: string;
	courseId: string;
	date: string;
	startTime: string;
	endTime: string;
	startMinutes: number;
	endMinutes: number;
	status: SessionStatus;
};
