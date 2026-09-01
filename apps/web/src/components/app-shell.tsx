import { Button } from "@course-calendar/ui/components/button";
import { Link, Outlet } from "@tanstack/react-router";
import { CalendarDays, ListTodo, Settings2 } from "lucide-react";
import type { ReactNode } from "react";

import Header from "@/components/header";
import { PwaStatus } from "@/components/pwa-status";
import { CalendarProvider } from "@/lib/calendar-store";

export function AppShell() {
	return (
		<CalendarProvider>
			<div className="min-h-svh bg-background">
				<Header />
				<PwaStatus />
				<Outlet />
				<BottomNav />
			</div>
		</CalendarProvider>
	);
}

function BottomNav() {
	return (
		<nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
			<div className="mx-auto grid max-w-lg grid-cols-2 gap-2 py-2">
				<NavItem to="/" icon={<CalendarDays />} label="日历" />
				<NavItem to="/courses" icon={<ListTodo />} label="课程" />
			</div>
		</nav>
	);
}

function NavItem({
	to,
	icon,
	label,
}: {
	to: "/" | "/courses";
	icon: ReactNode;
	label: string;
}) {
	return (
		<Link
			to={to}
			activeProps={{ className: "text-primary" }}
			className="flex min-h-11 flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
		>
			{icon}
			<span className="font-medium text-[11px]">{label}</span>
		</Link>
	);
}

export function DesktopSettingsButton() {
	return (
		<Button variant="outline" size="sm" className="hidden md:inline-flex">
			<Settings2 data-icon="inline-start" />
			偏好设置
		</Button>
	);
}
