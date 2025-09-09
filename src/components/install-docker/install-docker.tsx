import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Progress } from "../ui/progress";
import { Spinner } from "../ui/shadcn-io/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DownloadStatus {
	total: number;
	downloaded: number;
	error?: string;
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

export const InstallDocker: React.FC = () => {
	const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({
		downloaded: 0,
		total: 0,
	});

	const handleDownloadEvent = useCallback((_: Electron.IpcRendererEvent, error: unknown, status: unknown) => {
		if (typeof error === "string" && error.length) {
			setDownloadStatus(prev => ({ ...prev, error }));
		}
		if (
			status &&
			typeof status === "object" &&
			"total" in status &&
			"downloaded" in status &&
			typeof (status as any).total === "number" &&
			typeof (status as any).downloaded === "number"
		) {
			const total = Math.max(0, (status as any).total as number);
			const downloaded = Math.max(0, Math.min(total || Number.MAX_SAFE_INTEGER, (status as any).downloaded as number));
			setDownloadStatus(prev => ({ ...prev, total, downloaded }));
		}
	}, []);

	useEffect(() => {
		if (!window.ipcRenderer) return;
		window.ipcRenderer.on("docker-install-event", handleDownloadEvent);
		window.ipcRenderer.invoke("execute-step", 3);
		return () => {
			window.ipcRenderer?.off("docker-install-event", handleDownloadEvent);
		};
	}, [handleDownloadEvent]);

	const percent = useMemo(() => {
		const { total, downloaded } = downloadStatus;
		if (!total || total <= 0) return 0;
		return Math.max(0, Math.min(100, (downloaded / total) * 100));
	}, [downloadStatus]);

	const isComplete = downloadStatus.total > 0 && downloadStatus.downloaded >= downloadStatus.total && !downloadStatus.error;
	const hasError = Boolean(downloadStatus.error);

	const progressClass =
		hasError
			? "h-2 [&>div]:bg-red-600"
			: isComplete
				? "h-2 [&>div]:bg-green-600"
				: "h-2";

	if (!downloadStatus.total && !hasError) {
		return (
			<div className="h-full w-full flex items-center justify-center">
				<div className="flex flex-col items-center justify-center gap-3">
					<div className="h-12 w-12 flex items-center justify-center">
						<Spinner size="lg" />
					</div>
					<p className="text-sm text-gray-600">Preparing Docker download…</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4 rounded-xl border bg-white p-4">
			<header className="flex items-center justify-between">
				<div>
					<h2 className="text-sm font-semibold text-gray-900">Docker Install</h2>
					<p className="text-xs text-gray-600">Downloading & installing Docker</p>
				</div>
				<div className="text-xs text-gray-600">
					{hasError ? "Error" : isComplete ? "Done" : "In progress"}
				</div>
			</header>

			<div className="flex items-center justify-between text-xs text-gray-700">
				<span>Progress</span>
				<span>
					{fmtBytes(downloadStatus.downloaded)} / {fmtBytes(downloadStatus.total)} ({Math.round(percent)}%)
				</span>
			</div>

			<Progress value={percent} className={progressClass} />

			{hasError && (
				<Alert variant="destructive">
					<AlertTitle>Docker install failed</AlertTitle>
					<AlertDescription className="break-all">{downloadStatus.error}</AlertDescription>
				</Alert>
			)}
		</div>
	);
};
