import { Link } from "@tanstack/react-router";

export default function Header() {
	const links = [
		{ to: "/", label: "日历" },
		{ to: "/courses", label: "课程" },
	] as const;

	return (
		<header className="border-b bg-background/90 backdrop-blur">
			<div className="mx-auto flex h-16 w-full max-w-360 items-center justify-between px-4 sm:px-6 lg:px-10">
				<Link
					to="/"
					className="flex items-center gap-3"
					aria-label="返回课程日历首页"
				>
					<img
						src="/logo.png"
						alt=""
						width={36}
						height={36}
						className="size-9 rounded-xl object-cover shadow-sm"
					/>
					<span>
						<span className="block font-semibold text-sm tracking-tight">
							西米课表
						</span>
						<span className="hidden text-[10px] text-muted-foreground sm:block">
							a little more organized
						</span>
					</span>
				</Link>
				<nav className="hidden items-center gap-1 rounded-full bg-muted/70 p-1 sm:flex">
					{links.map(({ to, label }) => {
						return (
							<Link
								key={to}
								to={to}
								activeProps={{
									className: "bg-background text-foreground shadow-sm",
								}}
								className="rounded-full px-4 py-2 font-medium text-muted-foreground text-xs transition-colors hover:text-foreground"
							>
								{label}
							</Link>
						);
					})}
				</nav>
			</div>
		</header>
	);
}
