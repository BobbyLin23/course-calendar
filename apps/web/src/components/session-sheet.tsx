import { Badge } from "@course-calendar/ui/components/badge";
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
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@course-calendar/ui/components/sheet";
import {
	CalendarClock,
	Check,
	CircleAlert,
	MapPin,
	RotateCcw,
	X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import {
	type Course,
	formatUnits,
	type Session,
	type SessionStatus,
	useCalendar,
} from "@/lib/calendar-store";

export function SessionSheet({
	session,
	course,
	open,
	onOpenChange,
}: {
	session: Session | null;
	course?: Course;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { changeSessionStatus } = useCalendar();
	const [confirmOpen, setConfirmOpen] = useState(false);
	if (!session) return null;
	if (!course) return null;
	const activeSession = session;
	const activeCourse = course;

	const status = activeSession.status;
	const isLeave = status === "leave";
	const isClosed =
		status === "completed" || status === "absent" || status === "cancelled";
	const date = new Date(`${activeSession.date}T12:00:00`);
	const dateLabel = new Intl.DateTimeFormat("zh-CN", {
		month: "long",
		day: "numeric",
		weekday: "long",
	}).format(date);

	function changeStatus(nextStatus: SessionStatus) {
		changeSessionStatus(activeSession.id, activeCourse.id, nextStatus);
		setConfirmOpen(false);
		onOpenChange(false);
		toast.success(
			nextStatus === "leave"
				? "已请假，本次不扣课时"
				: nextStatus === "scheduled"
					? "已撤销请假"
					: "课程已标记为完成",
		);
	}

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent side="bottom" className="mx-auto max-w-2xl rounded-t-3xl">
					<SheetHeader className="px-5 sm:px-7">
						<div className="mb-2 flex items-center gap-2">
							<span className={`course-dot course-dot-${activeCourse.color}`} />
							<Badge
								variant={
									isLeave
										? "secondary"
										: status === "cancelled"
											? "outline"
											: "default"
								}
							>
								{statusLabel(status)}
							</Badge>
						</div>
						<SheetTitle>{activeCourse.name}</SheetTitle>
						<SheetDescription>本次课程安排与出勤状态</SheetDescription>
					</SheetHeader>
					<div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 sm:px-7">
						<InfoItem
							icon={<CalendarClock />}
							label="时间"
							value={`${dateLabel} · ${activeSession.startTime}–${activeSession.endTime}`}
						/>
						<InfoItem
							icon={<MapPin />}
							label="地点"
							value={activeCourse.location}
						/>
						<InfoItem
							icon={<CircleAlert />}
							label="本次消耗"
							value={
								isLeave || status === "cancelled"
									? "0 课时 · 不扣除"
									: `${formatUnits(activeCourse.costUnits)} 课时`
							}
						/>
						<InfoItem
							icon={<Check />}
							label="当前余额"
							value={`${formatUnits(activeCourse.balanceUnits)} 课时`}
						/>
					</div>
					<SheetFooter className="px-5 sm:px-7">
						{isLeave ? (
							<Button
								variant="outline"
								onClick={() => changeStatus("scheduled")}
							>
								<RotateCcw data-icon="inline-start" />
								撤销请假
							</Button>
						) : (
							<Button
								variant="outline"
								disabled={isClosed}
								onClick={() => setConfirmOpen(true)}
							>
								<X data-icon="inline-start" />
								请假
							</Button>
						)}
						{status === "scheduled" && (
							<Button onClick={() => changeStatus("completed")}>
								<Check data-icon="inline-start" />
								标记已完成
							</Button>
						)}
					</SheetFooter>
				</SheetContent>
			</Sheet>
			<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>确认请假？</DialogTitle>
						<DialogDescription>
							本次课程将保留在日历中，并且不扣除{" "}
							{formatUnits(activeCourse.costUnits)} 课时。之后仍然可以撤销请假。
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose render={<Button variant="outline" />}>
							再想想
						</DialogClose>
						<Button onClick={() => changeStatus("leave")}>确认请假</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function statusLabel(status: SessionStatus) {
	return {
		scheduled: "待上课",
		completed: "已完成",
		leave: "已请假",
		absent: "缺席",
		cancelled: "已取消",
	}[status];
}

function InfoItem({
	icon,
	label,
	value,
}: {
	icon: ReactNode;
	label: string;
	value: string;
}) {
	return (
		<div className="flex gap-3 rounded-xl bg-muted/50 p-3">
			<span className="mt-0.5 text-muted-foreground">{icon}</span>
			<div>
				<div className="text-[11px] text-muted-foreground">{label}</div>
				<div className="mt-0.5 font-medium text-sm">{value}</div>
			</div>
		</div>
	);
}
