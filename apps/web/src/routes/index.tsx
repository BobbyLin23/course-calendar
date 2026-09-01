import { Button } from "@course-calendar/ui/components/button";
import { Checkbox } from "@course-calendar/ui/components/checkbox";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@course-calendar/ui/components/empty";
import { Skeleton } from "@course-calendar/ui/components/skeleton";
import { cn } from "@course-calendar/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	BookOpenCheck,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	MapPin,
} from "lucide-react";
import {
	type CSSProperties,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { SessionSheet } from "@/components/session-sheet";
import {
	addDays,
	type Course,
	formatUnits,
	getWeekStart,
	localDateKey,
	parseDateKey,
	type Session,
	useCalendar,
} from "@/lib/calendar-store";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/")({ component: HomeComponent });

const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const HOUR_HEIGHT = 72;
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 22;
const weekLabelFormatter = new Intl.DateTimeFormat("zh-CN", {
	year: "numeric",
	month: "long",
});
const shortDateFormatter = new Intl.DateTimeFormat("zh-CN", {
	month: "numeric",
	day: "numeric",
});

function HomeComponent() {
	const { courses } = useCalendar();
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
		null,
	);
	const [hiddenCourseIds, setHiddenCourseIds] = useState<Set<string>>(
		() => new Set(),
	);
	const [weekStartKey, setWeekStartKey] = useState(() =>
		localDateKey(getWeekStart(new Date())),
	);

	const weekStart = useMemo(() => parseDateKey(weekStartKey), [weekStartKey]);
	const dates = useMemo(
		() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
		[weekStart],
	);
	const activeCourses = useMemo(
		() => courses.filter((course) => course.status === "active"),
		[courses],
	);
	const weekQuery = useQuery(
		trpc.calendar.week.queryOptions({
			weekStart: weekStartKey,
			timezone: "Asia/Shanghai",
			days: 7,
		}),
	);
	const sessions = (weekQuery.data?.sessions ?? []) as Session[];
	const visibleSessions = useMemo(
		() => sessions.filter((session) => !hiddenCourseIds.has(session.courseId)),
		[hiddenCourseIds, sessions],
	);
	const selectedSession =
		sessions.find((session) => session.id === selectedSessionId) ?? null;
	const selectedCourse = selectedSession
		? activeCourses.find((course) => course.id === selectedSession.courseId)
		: undefined;

	const moveWeek = useCallback((amount: number) => {
		setWeekStartKey((current) =>
			localDateKey(addDays(parseDateKey(current), amount)),
		);
	}, []);
	const goToToday = useCallback(() => {
		setWeekStartKey(localDateKey(getWeekStart(new Date())));
	}, []);

	useEffect(() => {
		const handleShortcut = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (
				target?.matches("input, textarea, select, [contenteditable='true']") ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey
			)
				return;
			if (event.key === "[") moveWeek(-7);
			if (event.key === "]") moveWeek(7);
			if (event.key.toLowerCase() === "t") goToToday();
		};
		window.addEventListener("keydown", handleShortcut);
		return () => window.removeEventListener("keydown", handleShortcut);
	}, [goToToday, moveWeek]);

	const toggleCourse = (courseId: string, visible: boolean) => {
		setHiddenCourseIds((current) => {
			const next = new Set(current);
			if (visible) next.delete(courseId);
			else next.add(courseId);
			return next;
		});
	};

	return (
		<main className="calendar-workspace">
			<CalendarSidebar
				weekStart={weekStart}
				courses={activeCourses}
				hiddenCourseIds={hiddenCourseIds}
				onSelectDate={(date) =>
					setWeekStartKey(localDateKey(getWeekStart(date)))
				}
				onToggleCourse={toggleCourse}
			/>

			<section className="calendar-main-panel">
				<header className="calendar-toolbar">
					<div className="calendar-toolbar-title">
						<h1>{weekLabelFormatter.format(addDays(weekStart, 3))}</h1>
						<span>
							{shortDateFormatter.format(dates[0] ?? weekStart)} —{" "}
							{shortDateFormatter.format(dates[6] ?? weekStart)}
						</span>
					</div>
					<div className="calendar-toolbar-actions">
						<Button
							variant="outline"
							size="sm"
							onClick={goToToday}
							title="回到今天（T）"
						>
							今天
						</Button>
						<div className="calendar-stepper">
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => moveWeek(-7)}
								aria-label="上一周"
								title="上一周（[）"
							>
								<ChevronLeft />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => moveWeek(7)}
								aria-label="下一周"
								title="下一周（]）"
							>
								<ChevronRight />
							</Button>
						</div>
					</div>
				</header>

				{weekQuery.isLoading ? (
					<div className="calendar-loading" aria-label="正在加载本周课程">
						<Skeleton className="h-full w-full rounded-none" />
					</div>
				) : (
					<WeekCalendar
						dates={dates}
						sessions={visibleSessions}
						courses={activeCourses}
						onSelectSession={setSelectedSessionId}
					/>
				)}
			</section>

			<SessionSheet
				session={selectedSession}
				course={selectedCourse}
				open={Boolean(selectedSession)}
				onOpenChange={(open) => {
					if (!open) setSelectedSessionId(null);
				}}
			/>
		</main>
	);
}

function CalendarSidebar({
	weekStart,
	courses,
	hiddenCourseIds,
	onSelectDate,
	onToggleCourse,
}: {
	weekStart: Date;
	courses: Course[];
	hiddenCourseIds: Set<string>;
	onSelectDate: (date: Date) => void;
	onToggleCourse: (courseId: string, visible: boolean) => void;
}) {
	const monthDate = addDays(weekStart, 3);
	const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
	const gridStart = getWeekStart(monthStart);
	const monthDates = Array.from({ length: 42 }, (_, index) =>
		addDays(gridStart, index),
	);
	const todayKey = localDateKey(new Date());
	const selectedWeekKey = localDateKey(weekStart);

	return (
		<aside className="calendar-sidebar" aria-label="日历筛选">
			<section className="mini-calendar" aria-label="迷你月历">
				<h2>{weekLabelFormatter.format(monthDate)}</h2>
				<div className="mini-calendar-weekdays" aria-hidden="true">
					{DAY_LABELS.map((day) => (
						<span key={day}>{day}</span>
					))}
				</div>
				<div className="mini-calendar-grid">
					{monthDates.map((date) => {
						const dateKey = localDateKey(date);
						const dateWeekKey = localDateKey(getWeekStart(date));
						return (
							<button
								type="button"
								key={dateKey}
								className={cn(
									"mini-calendar-day",
									date.getMonth() !== monthDate.getMonth() && "is-outside",
									dateWeekKey === selectedWeekKey && "is-selected-week",
									dateKey === todayKey && "is-today",
								)}
								onClick={() => onSelectDate(date)}
								aria-current={dateKey === todayKey ? "date" : undefined}
							>
								{date.getDate()}
							</button>
						);
					})}
				</div>
			</section>

			<section className="calendar-list-section">
				<div className="calendar-list-heading">
					<h2>我的课程</h2>
					<span>{courses.length}</span>
				</div>
				<div className="calendar-course-list">
					{courses.map((course) => {
						const visible = !hiddenCourseIds.has(course.id);
						return (
							<label className="calendar-course-filter" key={course.id}>
								<Checkbox
									checked={visible}
									onCheckedChange={(checked) =>
										onToggleCourse(course.id, checked === true)
									}
									aria-label={`${visible ? "隐藏" : "显示"}${course.name}`}
								/>
								<span
									className={cn("course-dot", `course-dot-${course.color}`)}
								/>
								<span className="calendar-course-copy">
									<strong>{course.name}</strong>
									<small>{course.childName || course.location || "课程"}</small>
								</span>
								<span className="calendar-course-balance">
									{formatUnits(course.balanceUnits)}
								</span>
							</label>
						);
					})}
					{courses.length === 0 ? (
						<p className="calendar-sidebar-empty">已有课程会显示在这里。</p>
					) : null}
				</div>
			</section>

			<div className="calendar-sidebar-hint">
				<span>快捷键</span>
				<kbd>[</kbd>
				<kbd>T</kbd>
				<kbd>]</kbd>
			</div>
		</aside>
	);
}

function WeekCalendar({
	dates,
	sessions,
	courses,
	onSelectSession,
}: {
	dates: Date[];
	sessions: Session[];
	courses: Course[];
	onSelectSession: (sessionId: string) => void;
}) {
	const now = useNow();
	const todayKey = localDateKey(now);
	const currentMinutes = now.getHours() * 60 + now.getMinutes();
	const startHour = Math.max(
		0,
		Math.min(
			DEFAULT_START_HOUR,
			...sessions.map((session) => Math.floor(session.startMinutes / 60)),
		),
	);
	const endHour = Math.min(
		24,
		Math.max(
			DEFAULT_END_HOUR,
			...sessions.map((session) => Math.ceil(session.endMinutes / 60)),
		),
	);
	const hours = Array.from(
		{ length: endHour - startHour + 1 },
		(_, index) => startHour + index,
	);
	const gridHeight = (endHour - startHour) * HOUR_HEIGHT;
	const courseMap = useMemo(
		() => new Map(courses.map((course) => [course.id, course])),
		[courses],
	);
	const calendarRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const calendar = calendarRef.current;
		if (!calendar) return;
		const firstCourseMinutes = sessions.reduce(
			(earliest, session) => Math.min(earliest, session.startMinutes),
			Number.POSITIVE_INFINITY,
		);
		const referenceMinutes =
			firstCourseMinutes === Number.POSITIVE_INFINITY
				? currentMinutes
				: firstCourseMinutes;
		const targetTop = Math.max(
			0,
			((referenceMinutes - startHour * 60) / 60) * HOUR_HEIGHT - HOUR_HEIGHT,
		);
		const targetDate = dates.some((date) => localDateKey(date) === todayKey)
			? todayKey
			: localDateKey(dates[0] ?? new Date());
		const targetColumn = calendar.querySelector<HTMLElement>(
			`[data-date="${targetDate}"]`,
		);
		const targetLeft = targetColumn
			? Math.max(0, targetColumn.offsetLeft - 60)
			: 0;
		calendar.scrollTo({ left: targetLeft, top: targetTop, behavior: "auto" });
	}, [currentMinutes, dates, sessions, startHour, todayKey]);

	return (
		<div
			ref={calendarRef}
			className="notion-calendar-scroll"
			aria-label="本周课程日历，可横向和纵向滚动"
		>
			<div className="notion-calendar-grid">
				<div className="calendar-corner-cell">
					<span>GMT+8</span>
				</div>
				{dates.map((date, index) => {
					const dateKey = localDateKey(date);
					const isToday = dateKey === todayKey;
					return (
						<div
							key={dateKey}
							data-date={dateKey}
							className={cn("calendar-day-heading", isToday && "is-today")}
						>
							<span>周{DAY_LABELS[index]}</span>
							<strong>{date.getDate()}</strong>
							<small>
								{sessions.filter((session) => session.date === dateKey)
									.length || ""}
							</small>
						</div>
					);
				})}

				<div className="calendar-time-axis" style={{ height: gridHeight }}>
					{hours.map((hour) => (
						<span
							key={hour}
							style={{ top: `${(hour - startHour) * HOUR_HEIGHT - 7}px` }}
						>
							{String(hour).padStart(2, "0")}:00
						</span>
					))}
				</div>

				{dates.map((date) => {
					const dateKey = localDateKey(date);
					const daySessions = sessions.filter(
						(session) => session.date === dateKey,
					);
					const positionedSessions = layoutSessions(daySessions);
					const showNow =
						dateKey === todayKey &&
						currentMinutes >= startHour * 60 &&
						currentMinutes <= endHour * 60;
					return (
						<div
							key={dateKey}
							className={cn(
								"calendar-day-column",
								dateKey === todayKey && "is-today",
							)}
							style={{ height: gridHeight }}
						>
							{hours.slice(0, -1).map((hour) => (
								<div
									key={hour}
									className="calendar-hour-row"
									style={{ top: `${(hour - startHour) * HOUR_HEIGHT}px` }}
								/>
							))}
							{showNow ? (
								<div
									className="calendar-now-line"
									style={{
										top: `${((currentMinutes - startHour * 60) / 60) * HOUR_HEIGHT}px`,
									}}
								>
									<i />
								</div>
							) : null}
							{positionedSessions.map(({ session, column, columnCount }) => {
								const course = courseMap.get(session.courseId);
								return course ? (
									<SessionCard
										key={session.id}
										session={session}
										course={course}
										startHour={startHour}
										column={column}
										columnCount={columnCount}
										onClick={() => onSelectSession(session.id)}
									/>
								) : null;
							})}
						</div>
					);
				})}
			</div>

			{sessions.length === 0 ? (
				<Empty className="calendar-empty-state">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<CalendarDays />
						</EmptyMedia>
						<EmptyTitle>本周还没有课程</EmptyTitle>
						<EmptyDescription>请前往“课程”页面管理课程安排。</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
		</div>
	);
}

function SessionCard({
	session,
	course,
	startHour,
	column,
	columnCount,
	onClick,
}: {
	session: Session;
	course: Course;
	startHour: number;
	column: number;
	columnCount: number;
	onClick: () => void;
}) {
	const top = ((session.startMinutes - startHour * 60) / 60) * HOUR_HEIGHT;
	const height = Math.max(
		((session.endMinutes - session.startMinutes) / 60) * HOUR_HEIGHT - 2,
		30,
	);
	const widthPercent = 100 / columnCount;
	const style: CSSProperties = {
		top: `${top}px`,
		height: `${height}px`,
		left: `calc(${column * widthPercent}% + 3px)`,
		width: `calc(${widthPercent}% - 5px)`,
	};
	const isMuted = session.status === "leave" || session.status === "cancelled";

	return (
		<button
			type="button"
			className={cn(
				"notion-session-card",
				`course-${course.color}`,
				isMuted && "session-muted",
				height < 52 && "is-compact",
			)}
			style={style}
			onClick={onClick}
			aria-label={`${course.name}，${session.startTime} 至 ${session.endTime}，${statusLabel(session.status)}`}
		>
			<span className="session-title-row">
				<BookOpenCheck />
				<strong>{course.name}</strong>
			</span>
			<span className="session-meta">
				{session.startTime}–{session.endTime}
			</span>
			<span className="session-place">
				<MapPin />
				{isMuted
					? statusLabel(session.status)
					: course.location || course.childName}
			</span>
		</button>
	);
}

function layoutSessions(sessions: Session[]) {
	const sorted = [...sessions].sort(
		(a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
	);
	const groups: Session[][] = [];
	let currentGroup: Session[] = [];
	let groupEnd = -1;
	for (const session of sorted) {
		if (currentGroup.length > 0 && session.startMinutes >= groupEnd) {
			groups.push(currentGroup);
			currentGroup = [];
			groupEnd = -1;
		}
		currentGroup.push(session);
		groupEnd = Math.max(groupEnd, session.endMinutes);
	}
	if (currentGroup.length > 0) groups.push(currentGroup);

	return groups.flatMap((group) => {
		const columnEnds: number[] = [];
		const placed = group.map((session) => {
			let column = columnEnds.findIndex((end) => end <= session.startMinutes);
			if (column === -1) {
				column = columnEnds.length;
				columnEnds.push(session.endMinutes);
			} else {
				columnEnds[column] = session.endMinutes;
			}
			return { session, column };
		});
		return placed.map((item) => ({ ...item, columnCount: columnEnds.length }));
	});
}

function useNow() {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const timer = window.setInterval(() => setNow(new Date()), 60_000);
		return () => window.clearInterval(timer);
	}, []);
	return now;
}

function statusLabel(status: Session["status"]) {
	return {
		scheduled: "待上课",
		completed: "已完成",
		leave: "已请假",
		absent: "缺席",
		cancelled: "已取消",
	}[status];
}
