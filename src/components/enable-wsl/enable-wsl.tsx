import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export const EnableWsl: React.FC = () => {
	const [vmpPct, setVmpPct] = useState(0);
	const [vmpErr, setVmpErr] = useState<string>("");
	const [vmpCompleted, setVmpCompleted] = useState<boolean>(false);

	const [wslPct, setWslPct] = useState(0);
	const [wslErr, setWslErr] = useState<string>("");
	const [wslCompleted, setWslCompleted] = useState<boolean>(false);

	const handleVPDEvent = useCallback((_: Electron.IpcRendererEvent, ...args: unknown[]) => {
		const error = typeof args[0] === "string" ? args[0] : null;
		const percentage = typeof args[1] === "number" ? args[1] : null;
		if (error) setVmpErr(error);
		if (percentage !== null) {
			const p = Math.max(0, Math.min(100, percentage));
			setVmpPct(p);
			if (!error && p >= 100) setVmpCompleted(true);
		}
	}, []);

	const handleWSLEvent = useCallback((_: Electron.IpcRendererEvent, ...args: unknown[]) => {
		const error = typeof args[0] === "string" ? args[0] : null;
		const percentage = typeof args[1] === "number" ? args[1] : null;
		if (error) setWslErr(error);
		if (percentage !== null) {
			const p = Math.max(0, Math.min(100, percentage));
			setWslPct(p);
			if (!error && p >= 100) setWslCompleted(true);
		}
	}, []);

	// Start + IPC wiring
	useEffect(() => {
		if (!window.ipcRenderer) {
			setVmpErr("ipcRenderer not available. Run inside Electron with preload exposing IPC.");
			return;
		}
		void window.ipcRenderer.invoke("execute-step", 1);

		window.ipcRenderer.on("vmp-event", handleVPDEvent);
		window.ipcRenderer.on("wsl-event", handleWSLEvent);

		const onVmpDone = () => setVmpCompleted(true);
		const onWslDone = () => setWslCompleted(true);

		window.ipcRenderer.on("vmp-event-complete", onVmpDone);
		window.ipcRenderer.on("wsl-event-complete", onWslDone);

		return () => {
			window.ipcRenderer?.off("vmp-event", handleVPDEvent);
			window.ipcRenderer?.off("wsl-event", handleWSLEvent);
			window.ipcRenderer?.off("vmp-event-complete", onVmpDone);
			window.ipcRenderer?.off("wsl-event-complete", onWslDone);
		};
	}, [handleVPDEvent, handleWSLEvent]);

	// Restart countdown when BOTH succeed and there are NO errors
	const allGood = useMemo(
		() => vmpCompleted && wslCompleted && !vmpErr && !wslErr,
		[vmpCompleted, wslCompleted, vmpErr, wslErr]
	);

	const [secondsLeft, setSecondsLeft] = useState<number>(30);

	useEffect(() => {
		if (!allGood) return;
		setSecondsLeft(30);
		const iv = setInterval(() => {
			setSecondsLeft((s) => {
				if (s <= 1) {
					clearInterval(iv);
					void window.ipcRenderer?.invoke("system-restart-now");
					return 0;
				}
				return s - 1;
			});
		}, 1000);
		return () => clearInterval(iv);
	}, [allGood]);

	const vmpBarClass =
		vmpErr
			? "h-2 [&>div]:bg-red-600"
			: vmpCompleted
				? "h-2 [&>div]:bg-green-600"
				: "h-2";
	const wslBarClass =
		wslErr
			? "h-2 [&>div]:bg-red-600"
			: wslCompleted
				? "h-2 [&>div]:bg-green-600"
				: "h-2";

	return (
		<div className="space-y-6">
			<section className="rounded-xl border bg-white p-4">
				<header className="mb-3 flex items-center justify-between">
					<div>
						<h2 className="text-sm font-semibold text-gray-900">Installing Hypervisor</h2>
						<p className="text-xs text-gray-600">
							Turning on Virtual Machine Platform / Hyper-V
						</p>
					</div>
					<div className="text-xs text-gray-600">
						{vmpCompleted ? "Done" : vmpErr ? "Error" : "In progress"}
					</div>
				</header>

				<div className="mb-2 flex items-center justify-between text-xs text-gray-700">
					<span>Progress</span>
					<span>{vmpPct}%</span>
				</div>
				<Progress value={vmpPct} className={vmpBarClass} />

				{vmpErr && (
					<Alert variant="destructive" className="mt-3">
						<AlertTitle>Hypervisor install failed</AlertTitle>
						<AlertDescription className="break-all">{vmpErr}</AlertDescription>
					</Alert>
				)}
			</section>

			<section className="rounded-xl border bg-white p-4">
				<header className="mb-3 flex items-center justify-between">
					<div>
						<h2 className="text-sm font-semibold text-gray-900">Windows Subsystem for Linux</h2>
						<p className="text-xs text-gray-600">Enabling WSL & WSL2 components</p>
					</div>
					<div className="text-xs text-gray-600">
						{wslCompleted ? "Done" : wslErr ? "Error" : "In progress"}
					</div>
				</header>

				<div className="mb-2 flex items-center justify-between text-xs text-gray-700">
					<span>Progress</span>
					<span>{wslPct}%</span>
				</div>
				<Progress value={wslPct} className={wslBarClass} />

				{wslErr && (
					<Alert variant="destructive" className="mt-3">
						<AlertTitle>WSL setup failed</AlertTitle>
						<AlertDescription className="break-all">{wslErr}</AlertDescription>
					</Alert>
				)}
			</section>

			{allGood && (
				<Alert className="border-green-600">
					<AlertTitle>Setup complete</AlertTitle>
					<AlertDescription className="flex items-center justify-between gap-3">
						<span>Your system will restart automatically in {secondsLeft}s.</span>
						<Button
							variant="default"
							onClick={() => void window.ipcRenderer?.invoke("system-restart-now")}
						>
							Restart now
						</Button>
					</AlertDescription>
				</Alert>
			)}
		</div>
	);
};
