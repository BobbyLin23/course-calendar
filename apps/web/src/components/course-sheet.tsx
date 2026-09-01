import { Button } from "@course-calendar/ui/components/button";
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
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@course-calendar/ui/components/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@course-calendar/ui/components/sheet";
import { Textarea } from "@course-calendar/ui/components/textarea";
import { cn } from "@course-calendar/ui/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

import type {
	Course,
	CourseColor,
	NewCourse,
	ScheduleSlot,
	ScheduleType,
} from "@/lib/calendar-store";
import { useCalendar } from "@/lib/calendar-store";

const weekdays = [
	[1, "一"],
	[2, "二"],
	[3, "三"],
	[4, "四"],
	[5, "五"],
	[6, "六"],
	[7, "日"],
] as const;

const colorOptions: { value: CourseColor; label: string }[] = [
	{ value: "coral", label: "珊瑚红" },
	{ value: "indigo", label: "靛蓝" },
	{ value: "sage", label: "鼠尾草绿" },
	{ value: "amber", label: "琥珀黄" },
	{ value: "plum", label: "梅子紫" },
];

type CourseSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	course?: Course | null;
	onSaved?: (courseId: string) => void;
	onArchived?: (courseId: string) => void;
};

function getTodayKey() {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function CourseSheet({
	open,
	onOpenChange,
	course,
	onSaved,
	onArchived,
}: CourseSheetProps) {
	const { addCourse, updateCourse, archiveCourse, deleteCourse } =
		useCalendar();
	const [form, setForm] = useState(() => defaultForm(course));
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

	useEffect(() => {
		if (open) setForm(defaultForm(course));
	}, [course, open]);

	const isEditing = Boolean(course);
	const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
		setForm((current) => ({ ...current, [key]: value }));
	const updateScheduleSlot = (
		index: number,
		changes: Partial<FormScheduleSlot>,
	) =>
		setForm((current) => ({
			...current,
			scheduleSlots: current.scheduleSlots.map((slot, slotIndex) =>
				slotIndex === index ? { ...slot, ...changes } : slot,
			),
		}));
	const addScheduleSlot = () =>
		setForm((current) => {
			const previous = current.scheduleSlots.at(-1);
			return {
				...current,
				scheduleSlots: [
					...current.scheduleSlots,
					{
						id: crypto.randomUUID(),
						weekday: previous ? (previous.weekday % 7) + 1 : 2,
						startTime: previous?.startTime ?? "17:00",
						durationMinutes: previous?.durationMinutes ?? "60",
					},
				],
			};
		});
	const removeScheduleSlot = (index: number) =>
		setForm((current) => ({
			...current,
			scheduleSlots: current.scheduleSlots.filter(
				(_slot, slotIndex) => slotIndex !== index,
			),
		}));

	function save() {
		if (!form.name.trim() || !form.location.trim()) {
			toast.error("请填写课程名称和上课地点");
			return;
		}
		if (
			form.scheduleType === "weekly" &&
			(form.scheduleSlots.length === 0 ||
				form.scheduleSlots.some(
					(slot) =>
						!slot.startTime ||
						Number(slot.durationMinutes) < 15 ||
						!Number.isFinite(Number(slot.durationMinutes)),
				))
		) {
			toast.error("请至少添加一个有效的每周上课时间");
			return;
		}
		if (
			form.scheduleType === "once" &&
			(!form.singleDate || !form.startTime || Number(form.durationMinutes) < 15)
		) {
			toast.error("请填写单次课程的日期、时间和时长");
			return;
		}
		const scheduleSlots: ScheduleSlot[] =
			form.scheduleType === "weekly"
				? form.scheduleSlots.map((slot) => ({
						weekday: slot.weekday,
						startTime: slot.startTime,
						durationMinutes: Number(slot.durationMinutes),
					}))
				: [];
		const primarySlot = scheduleSlots[0];
		const payload: NewCourse = {
			name: form.name.trim(),
			childName: "安安",
			color: form.color,
			location: form.location.trim(),
			startTime: primarySlot?.startTime ?? form.startTime,
			durationMinutes:
				primarySlot?.durationMinutes ?? Number(form.durationMinutes),
			startDate: form.startDate,
			weekdays: [...new Set(scheduleSlots.map((slot) => slot.weekday))].sort(),
			scheduleSlots,
			scheduleType: form.scheduleType,
			singleDate: form.singleDate || undefined,
			costUnits: Math.round(Number(form.costLessons) * 100),
			lowBalanceUnits: 200,
			notes: form.notes.trim(),
			initialBalanceUnits: Math.round(Number(form.initialLessons) * 100),
		};
		if (isEditing && course) {
			const { initialBalanceUnits: _initialBalanceUnits, ...courseChanges } =
				payload;
			updateCourse(course.id, courseChanges);
			onSaved?.(course.id);
			toast.success("课程资料已更新");
		} else {
			addCourse(payload);
			toast.success("课程已添加");
		}
		onOpenChange(false);
	}

	function archive() {
		if (!course) return;
		archiveCourse(course.id);
		onArchived?.(course.id);
		onOpenChange(false);
		toast.success("课程已停用，历史记录仍会保留");
	}

	function remove() {
		if (!course) return;
		deleteCourse(course.id);
		setDeleteConfirmOpen(false);
		onOpenChange(false);
		toast.success("课程及其历史记录已删除");
	}

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent
					side="bottom"
					className="mx-auto max-h-[94dvh] max-w-3xl overflow-y-auto rounded-t-3xl"
				>
					<SheetHeader className="px-5 sm:px-8">
						<SheetTitle>{isEditing ? "编辑课程" : "添加课程"}</SheetTitle>
						<SheetDescription>
							{isEditing
								? "资料更新会影响未来安排，历史记录保持不变。"
								: "记录一门新课程，保存后会出现在对应的周视图中。"}
						</SheetDescription>
					</SheetHeader>
					<div className="grid gap-6 px-5 pb-5 sm:grid-cols-2 sm:px-8">
						<section className="flex w-full min-w-0 flex-col gap-4">
							<div className="section-kicker">课程资料</div>
							<FormField label="课程名称" htmlFor="course-name">
								<Input
									id="course-name"
									value={form.name}
									onChange={(event) => update("name", event.target.value)}
									placeholder="例如：街舞基础"
								/>
							</FormField>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<FormField label="课程颜色" htmlFor="course-color">
									<Select
										value={form.color}
										onValueChange={(value) =>
											update("color", value as CourseColor)
										}
									>
										<SelectTrigger id="course-color" className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												{colorOptions.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
								</FormField>
								<FormField label="单次消耗（课时）" htmlFor="course-cost">
									<Input
										id="course-cost"
										type="number"
										min="0.25"
										step="0.25"
										value={form.costLessons}
										onChange={(event) =>
											update("costLessons", event.target.value)
										}
									/>
								</FormField>
							</div>
							<FormField label="上课地点" htmlFor="course-location">
								<Input
									id="course-location"
									value={form.location}
									onChange={(event) => update("location", event.target.value)}
									placeholder="例如：星河游泳馆"
								/>
							</FormField>
							<FormField label="备注" htmlFor="course-notes">
								<Textarea
									id="course-notes"
									rows={3}
									value={form.notes}
									onChange={(event) => update("notes", event.target.value)}
									placeholder="可选，记录老师、材料或提醒"
								/>
							</FormField>
						</section>
						<section className="flex w-full min-w-0 flex-col gap-4">
							<div className="section-kicker">时间与课时</div>
							<div className="flex flex-col gap-2">
								<span className="font-medium text-xs">重复规则</span>
								<div className="grid grid-cols-2 gap-2">
									{(["weekly", "once"] as ScheduleType[]).map((type) => (
										<button
											key={type}
											type="button"
											onClick={() => update("scheduleType", type)}
											className={cn(
												"min-h-11 border px-3 text-left text-xs transition-colors",
												form.scheduleType === type
													? "border-primary bg-primary/10 text-primary"
													: "border-border text-muted-foreground hover:bg-muted",
											)}
										>
											<span className="block font-medium">
												{type === "weekly" ? "每周重复" : "仅一次"}
											</span>
											<span className="mt-1 block text-[11px] text-muted-foreground">
												{type === "weekly"
													? "按星期自动安排"
													: "只安排一个日期"}
											</span>
										</button>
									))}
								</div>
							</div>
							{form.scheduleType === "weekly" ? (
								<ScheduleSlotEditor
									slots={form.scheduleSlots}
									onAdd={addScheduleSlot}
									onChange={updateScheduleSlot}
									onRemove={removeScheduleSlot}
								/>
							) : (
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<FormField label="上课日期" htmlFor="course-date">
										<Input
											id="course-date"
											type="date"
											value={form.singleDate}
											onChange={(event) =>
												update("singleDate", event.target.value)
											}
										/>
									</FormField>
									<FormField label="开始时间" htmlFor="course-time">
										<Input
											id="course-time"
											type="time"
											value={form.startTime}
											onChange={(event) =>
												update("startTime", event.target.value)
											}
										/>
									</FormField>
									<FormField label="时长（分钟）" htmlFor="course-duration">
										<Input
											id="course-duration"
											type="number"
											min="15"
											step="15"
											value={form.durationMinutes}
											onChange={(event) =>
												update("durationMinutes", event.target.value)
											}
										/>
									</FormField>
								</div>
							)}
							<FormField
								label={isEditing ? "当前剩余课时" : "初始剩余课时"}
								htmlFor="course-balance"
							>
								<Input
									id="course-balance"
									type="number"
									min="0"
									step="0.25"
									value={form.initialLessons}
									onChange={(event) =>
										update("initialLessons", event.target.value)
									}
									disabled={isEditing}
								/>
							</FormField>
							<div className="rounded-xl bg-muted/60 p-3 text-muted-foreground text-xs">
								保存摘要：
								{form.scheduleType === "weekly"
									? form.scheduleSlots
											.map(
												(slot) =>
													`周${weekdays.find(([value]) => value === slot.weekday)?.[1]} ${slot.startTime || "--:--"}`,
											)
											.join("、") || "尚未添加时间"
									: `${form.singleDate || "选择日期"} ${form.startTime || "--:--"}`}
								，剩余 {form.initialLessons || "0"} 课时
							</div>
						</section>
					</div>
					<SheetFooter className="flex-row justify-between px-5 sm:px-8">
						{isEditing ? (
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									className="text-destructive hover:text-destructive"
									onClick={archive}
								>
									停用课程
								</Button>
								<Button
									variant="ghost"
									className="text-destructive hover:text-destructive"
									onClick={() => setDeleteConfirmOpen(true)}
								>
									删除课程
								</Button>
							</div>
						) : (
							<span />
						)}
						<div className="flex items-center gap-2">
							<Button variant="outline" onClick={() => onOpenChange(false)}>
								取消
							</Button>
							<Button onClick={save}>
								{isEditing ? "保存修改" : "添加课程"}
							</Button>
						</div>
					</SheetFooter>
				</SheetContent>
			</Sheet>
			<Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>确认删除课程？</DialogTitle>
						<DialogDescription>
							将永久删除“{course?.name}
							”的课程安排、历史课程和课时流水，此操作无法撤销。
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose render={<Button variant="outline" />}>
							取消
						</DialogClose>
						<Button variant="destructive" onClick={remove}>
							确认删除
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

type FormScheduleSlot = {
	id: string;
	weekday: number;
	startTime: string;
	durationMinutes: string;
};

function ScheduleSlotEditor({
	slots,
	onAdd,
	onChange,
	onRemove,
}: {
	slots: FormScheduleSlot[];
	onAdd: () => void;
	onChange: (index: number, changes: Partial<FormScheduleSlot>) => void;
	onRemove: (index: number) => void;
}) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				<span>
					<span className="block font-medium text-xs">每周上课时间</span>
					<span className="mt-0.5 block text-[11px] text-muted-foreground">
						每次课可以设置不同的星期、时间和时长
					</span>
				</span>
				<Button type="button" variant="outline" size="xs" onClick={onAdd}>
					<Plus data-icon="inline-start" />
					添加安排
				</Button>
			</div>
			<div className="flex flex-col gap-2">
				{slots.map((slot, index) => (
					<div
						key={slot.id}
						className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5.25rem_2rem] items-end gap-2 rounded-lg border bg-muted/25 p-2"
					>
						<div className="flex min-w-0 flex-col gap-1">
							<Label className="text-[10px] text-muted-foreground">星期</Label>
							<Select
								value={String(slot.weekday)}
								onValueChange={(value) =>
									onChange(index, { weekday: Number(value) })
								}
							>
								<SelectTrigger
									className="w-full"
									aria-label={`第 ${index + 1} 次课的星期`}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{weekdays.map(([value, label]) => (
											<SelectItem key={value} value={String(value)}>
												周{label}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
						<div className="flex min-w-0 flex-col gap-1">
							<Label
								htmlFor={`course-slot-time-${index}`}
								className="text-[10px] text-muted-foreground"
							>
								开始时间
							</Label>
							<Input
								id={`course-slot-time-${index}`}
								type="time"
								value={slot.startTime}
								onChange={(event) =>
									onChange(index, { startTime: event.target.value })
								}
							/>
						</div>
						<div className="flex min-w-0 flex-col gap-1">
							<Label
								htmlFor={`course-slot-duration-${index}`}
								className="text-[10px] text-muted-foreground"
							>
								分钟
							</Label>
							<Input
								id={`course-slot-duration-${index}`}
								type="number"
								min="15"
								step="15"
								value={slot.durationMinutes}
								onChange={(event) =>
									onChange(index, { durationMinutes: event.target.value })
								}
							/>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={() => onRemove(index)}
							disabled={slots.length === 1}
							aria-label={`删除第 ${index + 1} 个上课时间`}
						>
							<Trash2 />
						</Button>
					</div>
				))}
			</div>
		</div>
	);
}

type FormState = {
	name: string;
	color: CourseColor;
	location: string;
	startTime: string;
	durationMinutes: string;
	startDate: string;
	scheduleSlots: FormScheduleSlot[];
	scheduleType: ScheduleType;
	singleDate: string;
	costLessons: string;
	initialLessons: string;
	notes: string;
};

function defaultForm(course?: Course | null): FormState {
	return {
		name: course?.name ?? "",
		color: course?.color ?? "indigo",
		location: course?.location ?? "",
		startTime: course?.startTime ?? "17:00",
		durationMinutes: String(course?.durationMinutes ?? 60),
		startDate: course?.startDate ?? getTodayKey(),
		scheduleSlots:
			course?.scheduleSlots && course.scheduleSlots.length > 0
				? course.scheduleSlots.map((slot) => ({
						id: crypto.randomUUID(),
						weekday: slot.weekday,
						startTime: slot.startTime,
						durationMinutes: String(slot.durationMinutes),
					}))
				: (course?.weekdays.length ? course.weekdays : [2]).map((weekday) => ({
						id: crypto.randomUUID(),
						weekday,
						startTime: course?.startTime ?? "17:00",
						durationMinutes: String(course?.durationMinutes ?? 60),
					})),
		scheduleType: course?.scheduleType ?? "weekly",
		singleDate: course?.singleDate ?? getTodayKey(),
		costLessons: String((course?.costUnits ?? 100) / 100),
		initialLessons: String((course?.balanceUnits ?? 10 * 100) / 100),
		notes: course?.notes ?? "",
	};
}

function FormField({
	label,
	htmlFor,
	children,
}: {
	label: string;
	htmlFor: string;
	children: ReactNode;
}) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
		</div>
	);
}
