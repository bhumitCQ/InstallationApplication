import { spawn, SpawnOptionsWithoutStdio } from "child_process";
import { EventEmitter } from "events";

/** ---- Event Types ---- */
export interface DismProgressEvent {
	percent: number;
}
export interface DismErrorEvent {
	code?: string;
	message: string;
}
export interface DismCloseEvent {
	code: number;
}
export interface DismExecutorEvents {
	progress: (e: DismProgressEvent) => void;
	error: (e: DismErrorEvent) => void;
	log: (line: string) => void;
	done: () => void;
	close: (e: DismCloseEvent) => void;
}

/** ---- DISM Executor (NOT general) ---- */
export class DismExecutor extends EventEmitter {
	private lastPercent: number = -1;
	private sawError: DismErrorEvent | null = null;
	private tail: string = "";

	constructor(
		private args: string[],
		private opts?: SpawnOptionsWithoutStdio
	) {
		super();
	}

	/** Start dism.exe with provided args */
	run(): this {
		const child = spawn("dism.exe", this.args, {
			windowsHide: true,
			...this.opts,
		});

		child.stdout?.on("data", (buf: Buffer) => this.feed(buf));
		child.stderr?.on("data", (buf: Buffer) => this.feed(buf));

		child.on("error", (e) => {
			this.emit("error", { message: e.message });
		});

		child.on("close", (code: number) => {
			if (this.sawError) {
				return;
			}
			this.emit("done");
			this.emit("close", { code });
		});

		return this;
	}

	/** Feed a raw data chunk from DISM (stdout/stderr) */
	private feed(chunkBuf: Buffer): void {
		const s = this.tail + chunkBuf.toString("utf8");
		this.emit("log", s);

		// progress (cheap, lastIndexOf and backward scan)
		const newest = this.extractNewestPercent(s);
		if (newest !== null && newest !== this.lastPercent) {
			this.lastPercent = newest;
			this.emit("progress", { percent: newest });
		}

		// error (simple scan)
		const errIdx = s.indexOf("Error:");
		if (errIdx !== -1 && !this.sawError) {
			const after = s.slice(errIdx + 6).trim();
			const code = (after.split(/\s+/)[0] || "").replace(/[,.;:]/g, "");
			this.sawError = { code, message: s.trim() };
			this.emit("error", this.sawError);
		}

		// success hint
		if (/The operation completed successfully\./i.test(s)) {
			this.emit("done");
		}

		// keep small tail for split tokens like "99" + "%\r"
		this.tail = s.slice(-16);
	}

	private clamp(val: number): number | null {
		if (!Number.isFinite(val)) return null;
		if (val < 0) return 0;
		if (val > 100) return 100;
		return val;
	}

	private extractNewestPercent(s: string): number | null {
		const p = s.lastIndexOf("%");
		if (p === -1) return null;

		let j = p - 1;
		while (j >= 0 && s.charCodeAt(j) === 32) j--; // skip spaces

		let i = j;
		let sawDigit = false;
		while (i >= 0) {
			const c = s.charCodeAt(i);
			const isDigit = c >= 48 && c <= 57;
			const isDot = c === 46;
			if (isDigit) {
				sawDigit = true;
				i--;
				continue;
			}
			if (isDot) {
				const prev = s.charCodeAt(i - 1);
				if (prev >= 48 && prev <= 57) {
					i--;
					continue;
				}
			}
			break;
		}
		if (!sawDigit) return null;

		const numStr = s.slice(i + 1, j + 1);
		const val = this.clamp(Number(numStr));
		return val ?? null;
	}

	/** Typed .on/.emit */
	override on<K extends keyof DismExecutorEvents>(
		event: K,
		listener: DismExecutorEvents[K]
	): this {
		return super.on(event, listener);
	}
	override once<K extends keyof DismExecutorEvents>(
		event: K,
		listener: DismExecutorEvents[K]
	): this {
		return super.once(event, listener);
	}
	override emit<K extends keyof DismExecutorEvents>(
		event: K,
		...args: Parameters<DismExecutorEvents[K]>
	): boolean {
		return super.emit(event, ...args);
	}

	/** ---- Helpers for common DISM operations ---- */

	/** Factory: enable a Windows Optional Feature (keeps /all and /norestart) */
	static enableFeature(featureName: string, extraArgs: string[] = [], opts?: SpawnOptionsWithoutStdio): DismExecutor {
		const base = [
			"/online",
			"/enable-feature",
			`/featurename:${featureName}`,
			"/all",
			"/norestart",
		];
		return new DismExecutor(base.concat(extraArgs), opts);
	}

	static enableWSL(opts?: SpawnOptionsWithoutStdio): DismExecutor {
		return DismExecutor.enableFeature("Microsoft-Windows-Subsystem-Linux", [], opts);
	}

	static enableVirtualMachinePlatform(opts?: SpawnOptionsWithoutStdio): DismExecutor {
		return DismExecutor.enableFeature("VirtualMachinePlatform", [], opts);
	}
}

/** ---- Example ----
const exe = DismExecutor.enableWSL();
exe.on("progress", ({ percent }) => console.log(`[progress] ${percent}%`));
exe.on("error", (e) => console.error("[error]", e));
exe.on("log", (s) => process.stdout.write(s));
exe.on("done", () => console.log("WSL enablement completed."));
exe.on("close", ({ code }) => console.log(`Exited ${code}`));
exe.run();
*/
