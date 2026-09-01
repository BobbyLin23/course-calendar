import { Badge } from "@course-calendar/ui/components/badge";
import { Button } from "@course-calendar/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@course-calendar/ui/components/card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@course-calendar/ui/components/dialog";
import { Input } from "@course-calendar/ui/components/input";
import { Label } from "@course-calendar/ui/components/label";
import { Separator } from "@course-calendar/ui/components/separator";
import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowUpRight,
	BookOpen,
	ChevronRight,
	Minus,
	Plus,
	WalletCards,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";

import { CourseSheet } from "@/components/course-sheet";
import { type Course, formatUnits, useCalendar } from "@/lib/calendar-store";

export const Route = createFileRoute("/courses")({
	component: CoursesComponent,
});

function CoursesComponent() {
	const { courses, ledger, archiveCourse } = useCalendar();
	const activeCourses = courses.filter((course) => course.status === "active");
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editingCourse, setEditingCourse] = useState<Course | null>(null);
	const [adjustingCourse, setAdjustingCourse] = useState<Course | null>(null);

	function openNew() {
		setEditingCourse(null);
		setSheetOpen(true);
	}
	function openEdit(course: Course) {
		setEditingCourse(course);
		setSheetOpen(true);
	}

	return (
		<main className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 pt-6 pb-28 sm:px-6 lg:gap-9 lg:px-10 lg:pt-10 lg:pb-10">
			<section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
				<div>
					<p className="eyebrow">YOUR COURSES · 05 ACTIVE</p>
					<h1 className="mt-2 font-semibold text-3xl tracking-tight sm:text-4xl">
						课程管理
					</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						管理课程安排，也管理每一份时间储蓄。
					</p>
				</div>
				<Button onClick={openNew}>
					<Plus data-icon="inline-start" />
					添加课程
				</Button>
			</section>
			<section className="grid gap-3 sm:grid-cols-3">
				<MiniStat
					icon={<BookOpen />}
					label="有效课程"
					value={`${activeCourses.length} 门`}
				/>
				<MiniStat
					icon={<WalletCards />}
					label="总剩余课时"
					value={`${formatUnits(activeCourses.reduce((sum, course) => sum + course.balanceUnits, 0))}`}
				/>
				<MiniStat icon={<ArrowUpRight />} label="本月变动" value="− 3 课时" />
			</section>
			<section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
				<Card className="border-0 shadow-sm">
					<CardHeader className="border-b px-5 py-4">
						<CardTitle className="flex items-center justify-between">
							<span>全部课程</span>
							<span className="font-normal text-muted-foreground text-xs">
								按余额排序
							</span>
						</CardTitle>
					</CardHeader>
					<CardContent className="p-0">
						{activeCourses.map((course, index) => (
							<CourseRow
								key={course.id}
								course={course}
								onEdit={() => openEdit(course)}
								onAdjust={() => setAdjustingCourse(course)}
								last={index === activeCourses.length - 1}
							/>
						))}
					</CardContent>
				</Card>
				<LedgerCard courses={courses} ledger={ledger} />
			</section>
			<CourseSheet
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				course={editingCourse}
				onArchived={() => archiveCourse(editingCourse?.id ?? "")}
			/>
			<AdjustLessonsDialog
				course={adjustingCourse}
				open={Boolean(adjustingCourse)}
				onOpenChange={(open) => {
					if (!open) setAdjustingCourse(null);
				}}
			/>
		</main>
	);
}

function MiniStat({
	icon,
	label,
	value,
}: {
	icon: ReactNode;
	label: string;
	value: string;
}) {
	return (
		<Card className="border-0 shadow-sm">
			<CardContent className="flex items-center gap-3 p-4">
				<span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
					{icon}
				</span>
				<div>
					<p className="text-[11px] text-muted-foreground">{label}</p>
					<p className="mt-1 font-semibold text-lg">{value}</p>
				</div>
			</CardContent>
		</Card>
	);
}

function CourseRow({
	course,
	onEdit,
	onAdjust,
	last,
}: {
	course: Course;
	onEdit: () => void;
	onAdjust: () => void;
	last: boolean;
}) {
	const isLow = course.balanceUnits <= course.lowBalanceUnits;
	const scheduleLabel =
		course.scheduleType === "once"
			? `${course.singleDate ?? "单次"} ${course.startTime}`
			: course.scheduleSlots
					.map(
						(slot) =>
							`周${"一二三四五六日"[slot.weekday - 1]} ${slot.startTime}`,
					)
					.join("、");
	return (
		<div
			className={`group flex w-full items-center gap-3 p-2 text-left transition-colors hover:bg-muted/50 sm:gap-4 sm:p-3 ${last ? "" : "border-b"}`}
		>
			<button
				type="button"
				onClick={onEdit}
				className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left sm:gap-4 sm:p-2"
			>
				<span className={`course-avatar course-avatar-${course.color}`}>
					{course.name.slice(0, 1)}
				</span>
				<span className="min-w-0 flex-1">
					<span className="flex items-center gap-2">
						<strong className="truncate text-sm">{course.name}</strong>
						{isLow ? <Badge variant="destructive">课时偏低</Badge> : null}
					</span>
					<span className="mt-1 block truncate text-muted-foreground text-xs">
						{course.location} · {scheduleLabel}
					</span>
				</span>
				<span className="hidden text-right sm:block">
					<span className="block text-[11px] text-muted-foreground">
						剩余课时
					</span>
					<strong
						className={`mt-1 block text-lg ${isLow ? "text-destructive" : ""}`}
					>
						{formatUnits(course.balanceUnits)}
					</strong>
				</span>
			</button>
			<span className="flex items-center gap-1">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={(event) => {
						event.stopPropagation();
						onAdjust();
					}}
				>
					调整
				</Button>
				<ChevronRight className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
			</span>
		</div>
	);
}

function LedgerCard({
	courses,
	ledger,
}: {
	courses: Course[];
	ledger: ReturnType<typeof useCalendar>["ledger"];
}) {
	const courseMap = useMemo(
		() => new Map(courses.map((course) => [course.id, course])),
		[courses],
	);
	return (
		<Card className="border-0 shadow-sm">
			<CardHeader className="border-b px-5 py-4">
				<CardTitle>最近流水</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4 p-5">
				{ledger.slice(0, 5).map((entry, index) => {
					const course = courseMap.get(entry.courseId);
					return (
						<div key={entry.id} className="flex items-center gap-3">
							<span
								className={`ledger-icon ${entry.deltaUnits < 0 ? "ledger-minus" : "ledger-plus"}`}
							>
								{entry.deltaUnits < 0 ? <Minus /> : <Plus />}
							</span>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm">{entry.reason}</p>
								<p className="mt-0.5 text-[11px] text-muted-foreground">
									{course?.name ?? "课程"} · {formatLedgerDate(entry.createdAt)}
								</p>
							</div>
							<strong
								className={
									entry.deltaUnits < 0
										? "text-foreground"
										: "text-emerald-700 dark:text-emerald-400"
								}
							>
								{entry.deltaUnits > 0 ? "+" : ""}
								{formatUnits(entry.deltaUnits)}
							</strong>
							{index < Math.min(ledger.length, 5) - 1 ? null : null}
						</div>
					);
				})}
				<Separator />
				<p className="text-muted-foreground text-xs leading-5">
					每一次初始入账、课程结算和手动调整都会保留在流水中，余额变化可随时追溯。
				</p>
			</CardContent>
		</Card>
	);
}

function AdjustLessonsDialog({
	course,
	open,
	onOpenChange,
}: {
	course: Course | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { adjustLessons } = useCalendar();
	const [amount, setAmount] = useState("1");
	const [reason, setReason] = useState("");
	const [direction, setDirection] = useState<1 | -1>(1);
	if (!course) return null;
	const activeCourse = course;
	function save() {
		const units = Math.round(Number(amount) * 100) * direction;
		if (!Number.isFinite(units) || units === 0 || !reason.trim()) {
			toast.error("请填写有效课时和调整原因");
			return;
		}
		adjustLessons(activeCourse.id, units, reason.trim());
		toast.success(
			`已${direction > 0 ? "增加" : "减少"} ${formatUnits(Math.abs(units))} 课时`,
		);
		onOpenChange(false);
		setReason("");
	}
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>调整 {activeCourse.name} 课时</DialogTitle>
					<DialogDescription>
						当前余额 {formatUnits(activeCourse.balanceUnits)}{" "}
						课时。请填写原因，调整会留下流水记录。
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<div className="grid grid-cols-2 gap-2">
						<Button
							variant={direction === 1 ? "default" : "outline"}
							onClick={() => setDirection(1)}
						>
							<Plus data-icon="inline-start" />
							增加
						</Button>
						<Button
							variant={direction === -1 ? "default" : "outline"}
							onClick={() => setDirection(-1)}
						>
							<Minus data-icon="inline-start" />
							减少
						</Button>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="adjust-amount">课时数量</Label>
						<Input
							id="adjust-amount"
							type="number"
							min="0.25"
							step="0.25"
							value={amount}
							onChange={(event) => setAmount(event.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="adjust-reason">调整原因</Label>
						<Input
							id="adjust-reason"
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="例如：补录购课"
						/>
					</div>
				</div>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>取消</DialogClose>
					<Button onClick={save}>保存调整</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function formatLedgerDate(value: string | Date) {
	return new Intl.DateTimeFormat("zh-CN", {
		month: "short",
		day: "numeric",
	}).format(value instanceof Date ? value : new Date(value));
}
