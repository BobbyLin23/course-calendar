import assert from "node:assert/strict";
import test from "node:test";

import { buildOccurrenceSpecs } from "@course-calendar/api/modules/calendar";
import { courseInput } from "@course-calendar/api/modules/course";

test("course input preserves multiple weekly slots with independent times", () => {
	const parsed = courseInput.parse({
		name: "游泳",
		childName: "安安",
		color: "indigo",
		location: "游泳馆",
		startTime: "16:00",
		durationMinutes: 60,
		startDate: "2026-09-01",
		weekdays: [2, 4],
		scheduleType: "weekly",
		costUnits: 100,
		lowBalanceUnits: 200,
		notes: "",
		initialBalanceUnits: 1000,
		scheduleSlots: [
			{ weekday: 2, startTime: "16:00", durationMinutes: 60 },
			{ weekday: 4, startTime: "18:30", durationMinutes: 90 },
		],
	});

	assert.deepEqual(parsed.scheduleSlots, [
		{ weekday: 2, startTime: "16:00", durationMinutes: 60 },
		{ weekday: 4, startTime: "18:30", durationMinutes: 90 },
	]);
});

test("one weekly course keeps a different time and duration for each schedule rule", () => {
	const course = {
		scheduleType: "weekly",
		singleDate: null,
		startDate: "2026-09-01",
		weekdays: [2, 4],
		localStartTime: "16:00:00",
		durationMinutes: 60,
	};
	const rules = [
		{
			id: "rule-tuesday",
			startDate: "2026-09-01",
			endDate: null,
			weekdays: [2],
			localStartTime: "16:00:00",
			durationMinutes: 60,
		},
		{
			id: "rule-thursday",
			startDate: "2026-09-01",
			endDate: null,
			weekdays: [4],
			localStartTime: "18:30:00",
			durationMinutes: 90,
		},
	];

	const occurrences = rules.flatMap((rule) =>
		buildOccurrenceSpecs("2026-08-31", 7, course, rule),
	);

	assert.deepEqual(
		occurrences.map((occurrence) => ({
			date: occurrence.date,
			start: occurrence.startsAt.toISOString(),
			end: occurrence.endsAt.toISOString(),
			ruleId: occurrence.scheduleRuleId,
		})),
		[
			{
				date: "2026-09-01",
				start: "2026-09-01T08:00:00.000Z",
				end: "2026-09-01T09:00:00.000Z",
				ruleId: "rule-tuesday",
			},
			{
				date: "2026-09-03",
				start: "2026-09-03T10:30:00.000Z",
				end: "2026-09-03T12:00:00.000Z",
				ruleId: "rule-thursday",
			},
		],
	);
});
