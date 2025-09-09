import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Progress } from "../ui/progress";
import { Spinner } from "../ui/shadcn-io/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Phase =
	| "idle"
	| "checking"
	| "outdated"
	| "ready"
	| "downloading"
	| "installing"
	| "complete"
	| "error";

interface InstallState {
	phase: Phase;
	downloaded: number;
	total: number;
	error?: string;
	needsRestart?: boolean;
	versionOutput?: string;
}

function fmtBytes(n: number): string {
	if (!Number.isFinite(n) || n <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	let i = 0;
	let v = n;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export const InstallWSL: React.FC = () => {
	const [state, setState] = useState<InstallState>({
		phase: "checking",
		downloaded: 0,
		total: 0
	});

	// Handle download progress
	const handleDownloadEvent = useCallback(
		(_: Electron.IpcRendererEvent, error: unknown, status: unknown) => {
			if (typeof error === "string" && error.length) {
				setState(prev => ({ ...prev, phase: "error", error }));
				return;
			}
			if (
				status &&
				typeof status === "object" &&
				"total" in status &&
				"downloaded" in status
			) {
				const total = Math.max(0, (status as any).total);
				const downloaded = Math.max(
					0,
					Math.min(total || Number.MAX_SAFE_INTEGER, (status as any).downloaded)
				);
				setState(prev => ({
					...prev,
					phase: "downloading",
					total,
					downloaded
				}));
			}
		},
		[]
	);

	const handleStarted = useCallback(() => {
		setState(prev => ({ ...prev, phase: "installing" }));
	}, []);

	const handleComplete = useCallback(
		(_: Electron.IpcRendererEvent, payload: any) => {
			setState(prev => ({
				...prev,
				phase: "complete",
				needsRestart: payload?.needsRestart
			}));
		},
		[]
	);

	useEffect(() => {
		if (!window.ipcRenderer) return;
		window.ipcRenderer.on("wsl-install-event", handleDownloadEvent);
		window.ipcRenderer.on("wsl-install-started", handleStarted);
		window.ipcRenderer.on("wsl-install-complete", handleComplete);
		window.ipcRenderer.invoke("execute-step", 2);
		return () => {
			window.ipcRenderer?.off("wsl-install-event", handleDownloadEvent);
			window.ipcRenderer?.off("wsl-install-started", handleStarted);
			window.ipcRenderer?.off("wsl-install-complete", handleComplete);
		};
	}, [handleDownloadEvent, handleStarted, handleComplete]);

	const percent = useMemo(() => {
		if (!state.total || state.total <= 0) return 0;
		return Math.max(0, Math.min(100, (state.downloaded / state.total) * 100));
	}, [state.total, state.downloaded]);

	// ===== UI Rendering =====

	if (state.phase === "checking") {
		return (
			<div className="h-full w-full flex items-center justify-center">
				<div className="flex flex-col items-center justify-center gap-3">
					<div className="h-12 w-12 flex items-center justify-center">
						<Spinner size="lg" />
					</div>
					<p className="text-sm text-gray-600">Checking WSL version…</p>
				</div>
			</div>
		);
	}

	if (state.phase === "outdated") {
		return (
			<Alert variant="destructive">
				<AlertTitle>WSL is outdated</AlertTitle>
				<AlertDescription>
					Windows Subsystem for Linux must be updated to the latest version.
					<br />
					Run <code>wsl.exe --update</code> in PowerShell or CMD.
					<br />
					More info:{" "}
					<a
						href="https://aka.ms/wslinstall"
						target="_blank"
						rel="noreferrer"
						className="underline text-blue-600"
					>
						aka.ms/wslinstall
					</a>
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-4 rounded-xl border bg-white p-4">
			<header className="flex items-center justify-between">
				<div>
					<h2 className="text-sm font-semibold text-gray-900">
						Windows Subsystem for Linux
					</h2>
					<p className="text-xs text-gray-600">
						Downloading & installing WSL components
					</p>
				</div>
				<div className="text-xs text-gray-600">
					{state.phase === "error"
						? "Error"
						: state.phase === "complete"
							? "Done"
							: state.phase === "installing"
								? "Installing"
								: state.phase === "downloading"
									? "Downloading"
									: "Ready"}
				</div>
			</header>

			{/* Download Progress */}
			{state.phase === "downloading" && (
				<>
					<div className="flex items-center justify-between text-xs text-gray-700">
						<span>Download Progress</span>
						<span>
							{fmtBytes(state.downloaded)} / {fmtBytes(state.total)} (
							{Math.round(percent)}%)
						</span>
					</div>
					<Progress value={percent} className="h-2" />
				</>
			)}

			{/* Installing Phase */}
			{state.phase === "installing" && (
				<>
					<div className="flex items-center justify-between text-xs text-gray-700">
						<span>Installing</span>
						<span>Please wait…</span>
					</div>
					<div className="h-2 w-full bg-gray-200 rounded relative overflow-hidden">
						<div className="absolute h-full w-1/3 bg-blue-600 animate-[progress-slide_2s_linear_infinite]" />
					</div>
					<Alert>
						<AlertTitle>Installing…</AlertTitle>
						<AlertDescription>
							Please wait while WSL is being installed.
						</AlertDescription>
					</Alert>
				</>
			)}

			{/* Complete */}
			{state.phase === "complete" && (
				<Alert variant="default">
					<AlertTitle>Installation complete</AlertTitle>
					<AlertDescription>
						Moving to the next step{" "}
						{state.needsRestart ? "(restart required)" : ""}
					</AlertDescription>
				</Alert>
			)}

			{/* Error */}
			{state.phase === "error" && (
				<Alert variant="destructive">
					<AlertTitle>WSL install failed</AlertTitle>
					<AlertDescription className="break-all">
						{state.error}
					</AlertDescription>
				</Alert>
			)}
		</div>
	);
};
