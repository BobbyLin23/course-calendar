import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@course-calendar/ui/components/button";
import { Download, WifiOff, X } from "lucide-react";
import { useEffect, useState } from "react";

export function PwaStatus() {
	const [isOnline, setIsOnline] = useState(() => navigator.onLine);
	const { needRefresh, updateServiceWorker } = useRegisterSW();

	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	return !isOnline || needRefresh[0] ? (
		<aside
			className="fixed inset-x-3 top-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-card p-3 text-sm shadow-xl"
			role="status"
		>
			<span
				className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${isOnline ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}
			>
				{isOnline ? <Download /> : <WifiOff />}
			</span>
			<span className="min-w-0 flex-1">
				<strong className="block text-xs">
					{isOnline ? "发现新版本" : "当前处于离线状态"}
				</strong>
				<span className="mt-0.5 block text-[11px] text-muted-foreground">
					{isOnline
						? "更新后即可使用最新的课程日历。"
						: "正在展示最近保存的数据，写入操作需要联网。"}
				</span>
			</span>
			{isOnline ? (
				<Button size="sm" onClick={() => updateServiceWorker(true)}>
					更新
				</Button>
			) : null}
			{isOnline ? (
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => needRefresh[1](false)}
					aria-label="关闭更新提示"
				>
					<X />
				</Button>
			) : null}
		</aside>
	) : null;
}
