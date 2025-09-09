// import mitt, { Emitter } from "mitt";
// import { Installer } from "./abstract";
// import { Key } from "react";

// type ScenarioName =
//   | "happy"
//   | "slow"
//   | "needsRestart"
//   | "wslFail"
//   | "dockerFail"
//   | "flakyNet";

// export interface SimOptions {
//   scenario?: ScenarioName;

//   // Simulated bytes (for progress bars)
//   wslBytes?: number;           // default ~150 MB
//   dockerBytes?: number;        // default ~650 MB

//   // Speed baseline & tick frequency
//   baseThroughput?: number;     // bytes/sec; default ~12 MB/s
//   tickMs?: number;             // default 120 ms

//   // Deterministic tests
//   seed?: number;

//   // Version strings to return on success
//   dockerVersion?: string;      // default "4.30.0"
//   wslVersion?: string;         // default "2"

//   // Pretend kernel string
//   kernelVersion?: string;      // default "5.15.90-microsoft-standard-WSL2-sim"
// }

// // ----- Small deterministic PRNG for jitter -----
// function makePRNG(seed = 1) {
//   let s = seed >>> 0;
//   return () => {
//     s = (s * 1664525 + 1013904223) >>> 0;
//     return (s & 0xfffffff) / 0xfffffff; // 0..1
//   };
// }

// function clamp(n: number, min: number, max: number) {
//   return Math.max(min, Math.min(max, n));
// }

// // ----- Download simulator with stalls/jitter/failure injection -----
// class SimDownload {
//   private total: number;
//   private downloaded = 0;
//   private timer: any = null;
//   private cancelled = false;
//   private prng: () => number;
//   private baseThroughput: number;
//   private tickMs: number;
//   private scenario: ScenarioName;
//   private failedOnce = false;

//   constructor(params: {
//     total: number;
//     prng: () => number;
//     baseThroughput: number;
//     tickMs: number;
//     scenario: ScenarioName;
//   }) {
//     this.total = params.total;
//     this.prng = params.prng;
//     this.baseThroughput = params.baseThroughput;
//     this.tickMs = params.tickMs;
//     this.scenario = params.scenario;
//   }

//   start(
//     onTick: (downloaded: number, total: number) => void,
//     onDone: () => void,
//     onFail?: (err: string) => void
//   ) {
//     const tick = () => {
//       if (this.cancelled) return;

//       // base jitter 0.6x..1.4x
//       let jitter = 0.6 + this.prng() * 0.8;

//       // scenario modifiers
//       if (this.scenario === "slow") jitter *= 0.35;

//       if (this.scenario === "flakyNet") {
//         const r = this.prng();
//         if (r < 0.06) {
//           // short stall
//           this.timer = setTimeout(tick, this.tickMs * 3);
//           return;
//         }
//         if (r > 0.94) jitter *= 0.15; // brief slowdown
//       }

//       const bytesThisTick = clamp(
//         Math.floor((this.baseThroughput * jitter * this.tickMs) / 1000),
//         8 * 1024,
//         32 * 1024 * 1024
//       );

//       this.downloaded = Math.min(this.total, this.downloaded + bytesThisTick);
//       onTick(this.downloaded, this.total);

//       // Inject a single failure between 20–45%
//       if (!this.failedOnce && onFail && (this.scenario === "wslFail" || this.scenario === "dockerFail" || this.scenario === "flakyNet")) {
//         const frac = this.downloaded / this.total;
//         if (frac > 0.2 && frac < 0.45) {
//           this.failedOnce = true;
//           this.stop();
//           const msg =
//             this.scenario === "wslFail"
//               ? "Network error downloading WSL package."
//               : this.scenario === "dockerFail"
//                 ? "Network error downloading Docker installer."
//                 : "Temporary network issue.";
//           onFail(msg);
//           return;
//         }
//       }

//       if (this.downloaded >= this.total) {
//         this.stop();
//         onDone();
//       } else {
//         this.timer = setTimeout(tick, this.tickMs);
//       }
//     };

//     this.timer = setTimeout(tick, this.tickMs);
//   }

//   stop() {
//     if (this.timer) clearTimeout(this.timer);
//     this.timer = null;
//   }

//   cancel() {
//     this.cancelled = true;
//     this.stop();
//   }
// }

// // ----- Main simulator -----
// export class SimulatedWindowInstaller extends Installer {
//   private emitter: Emitter<{}>;
//   private prng: () => number;

//   private options: Required<SimOptions>;
//   private featuresEnabled = false;
//   private wslInstalled = false;
//   private dockerInstalled = false;
//   private restartNeeded = false;

//   private activeJobs: Array<{ cancel: () => void }> = [];

//   constructor(opts: SimOptions = {}) {
//     super();
//     this.emitter = mitt();
//     this.options = {
//       scenario: opts.scenario ?? "happy",
//       wslBytes: opts.wslBytes ?? 150 * 1024 * 1024,         // 150 MB
//       dockerBytes: opts.dockerBytes ?? 650 * 1024 * 1024,    // 650 MB
//       baseThroughput: opts.baseThroughput ?? 12 * 1024 * 1024, // 12 MB/s
//       tickMs: opts.tickMs ?? 120,
//       seed: opts.seed ?? 1337,
//       dockerVersion: opts.dockerVersion ?? "4.30.0",
//       wslVersion: opts.wslVersion ?? "2",
//       kernelVersion: opts.kernelVersion ?? "5.15.90-microsoft-standard-WSL2-sim",
//     };
//     this.prng = makePRNG(this.options.seed);
//   }

//   private addJob(j: { cancel: () => void }) {
//     this.activeJobs.push(j);
//     return j;
//   }
//   cancelAll() {
//     this.activeJobs.forEach(j => j.cancel());
//     this.activeJobs = [];
//   }

//   // ----- Simulated system checks (version strings) -----
//   async checkWSLAndVMP(): Promise<{ wsl: boolean; vmp: boolean }> {
//     return { wsl: this.featuresEnabled, vmp: this.featuresEnabled };
//   }

//   parseWslStdout(_: string) {
//     return {
//       wslVersion: this.wslInstalled ? this.options.wslVersion : "0",
//       kernalVersion: this.wslInstalled ? this.options.kernelVersion : undefined,
//     };
//   }

//   // NOTE: returns string version or false (per your latest requirement)
//   async checkWslVersion(): Promise<false | string> {
//     return this.wslInstalled ? this.options.wslVersion : false;
//   }

//   // NOTE: returns string version or false
//   async checkDockerVersion(): Promise<false | string> {
//     return this.dockerInstalled ? this.options.dockerVersion : false;
//   }

//   // Keep logic independent of numeric compare so it works with string versions
//   async checkCurrentStep(): Promise<number> {
//     // 1 -> features/WSL; 2 -> WSL installer; 3 -> Docker; done when >3
//     const wslVersion = await this.checkWslVersion();
//     if (wslVersion !== this.options.wslVersion) return 1;

//     const dockerVersion = await this.checkDockerVersion();
//     if (!dockerVersion) return 2;

//     return 3;
//   }

//   async moveToNextStep(): Promise<boolean> {
//     return true;
//   }

//   async restart(): Promise<void> {
//     // Simulate restart without changing state (like a real reboot)
//     if (this.restartNeeded) {
//       this.restartNeeded = false;
//     }
//   }

//   // ----- Actions that emit the same events as production -----
//   async turnWindowsFeatureOn() {
//     // Two phases: VMP then WSL features enabling
//     const cancelRef = { cancelled: false };
//     this.addJob({ cancel: () => (cancelRef.cancelled = true) });

//     const runPhase = async (
//       eventName: "vmp-event" | "wsl-event",
//       completeName: "vmp-event-complete" | "wsl-event-complete",
//       onDone: () => void
//     ) => {
//       let p = 0;
//       const advance = () => {
//         if (cancelRef.cancelled) return;
//         const inc = 3 + Math.floor(this.prng() * 12);
//         p = clamp(p + inc, 0, 100);
//         this.emitter.emit(eventName, [null, p]);
//         if (p >= 100) {
//           this.emitter.emit(completeName as any);
//           onDone();
//         } else {
//           setTimeout(advance, this.options.tickMs * (1 + this.prng()));
//         }
//       };
//       setTimeout(advance, this.options.tickMs);
//     };

//     await new Promise<void>((resolve) => {
//       runPhase("vmp-event", "vmp-event-complete", () => {
//         this.featuresEnabled = true;
//         runPhase("wsl-event", "wsl-event-complete", () => resolve());
//       });
//     });

//     return this.emitter;
//   }

//   async downloadWsl() {
//     // Emits progress and then complete; can require restart or fail based on scenario
//     this.emitter.emit("wsl-install-started", [null, { total: this.options.wslBytes, downloaded: 0 }]);
//     const downloader = new SimDownload({
//       total: this.options.wslBytes,
//       prng: this.prng,
//       baseThroughput: this.options.baseThroughput,
//       tickMs: this.options.tickMs,
//       scenario: this.options.scenario,
//     });
//     this.addJob({ cancel: () => downloader.cancel() });
//     const onTick = (downloaded: number, total: number) => {
//         this.emitter.emit("wsl-install-event", [null, { total, downloaded }]);
//     };

//     const onDone = () => {
//         const needsRestart = this.options.scenario === "needsRestart";
//         this.restartNeeded = needsRestart;
//         this.wslInstalled = true;
//         this.emitter.emit("wsl-install-complete", { needsRestart });
//     };
//     const onFail = (msg: string) => {
//         this.emitter.emit("wsl-install-event", [msg]);
//     };
//     const shouldFail = this.options.scenario === "wslFail" || this.options.scenario === "flakyNet";
//     downloader.start(onTick, onDone, shouldFail ? onFail : undefined);
//     console.log("ETMITTER RETURNED");
//     return this.emitter;
//   }

//   async downloadDocker() {
//     const downloader = new SimDownload({
//       total: this.options.dockerBytes,
//       prng: this.prng,
//       baseThroughput: this.options.baseThroughput,
//       tickMs: this.options.tickMs,
//       scenario: this.options.scenario,
//     });

//     this.addJob({ cancel: () => downloader.cancel() });

//     return await new Promise<Emitter<{}>>((resolve) => {
//       const onTick = (downloaded: number, total: number) => {
//         this.emitter.emit("docker-install-event", [null, { total, downloaded }]);
//       };

//       const onDone = () => {
//         this.dockerInstalled = true;
//         this.emitter.emit("docker-install-complete", { needsRestart: false });
//       };

//       const onFail = (msg: string) => {
//         this.emitter.emit("docker-install-event", [msg]);
//       };

//       const shouldFail = this.options.scenario === "dockerFail" || this.options.scenario === "flakyNet";
//       downloader.start(onTick, onDone, shouldFail ? onFail : undefined);
//       return(this.emitter);
//     });
//   }

//   async executeStep(step: number) {
//     if (step === 1) return this.turnWindowsFeatureOn();
//     if (step === 2) return this.downloadWsl();
//     if (step === 3) return this.downloadDocker();
//     throw new Error("Not implemented");
//   }
// }
