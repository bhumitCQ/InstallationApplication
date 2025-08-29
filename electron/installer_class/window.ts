import EventEmitter2 from "mitt";
import { execPromise } from "../utils";
import { Installer } from "./abstract";
import { exec, execFile, execSync, spawn } from "child_process";
import { DismExecutor } from "./dimParser";
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { app } from "electron";
import { pipeline } from "stream";
import { promisify } from "util";

const streamPipeline = promisify(pipeline);

const wslURL = 'https://github.com/microsoft/WSL/releases/download/2.5.10/wsl.2.5.10.0.x64.msi';
const dockerURL = 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe';

export class WindowInstaller extends Installer {
    constructor() {
        super();
        this.#init();
    }
    async #init() {
        const dockerDesktopPath = path.join(
            "C:\\Program Files",
            "Docker",
            "Docker",
            "Docker Desktop.exe"
        );
        try {
            spawn(dockerDesktopPath, [], {
                detached: true,
                windowsHide: false,
                stdio: "ignore",
            }).unref();
        } catch (error) {
            console.error(error);
        }
    }

    async checkWSLAndVMP(): Promise<{ wsl: boolean, vmp: boolean }> {
        const result =  await new Promise<{ wsl: boolean, vmp: boolean }>((resolve) => {
            // Query both features at once
            const features = [
                "Microsoft-Windows-Subsystem-Linux",
                "VirtualMachinePlatform"
            ];
            const ps = `$names = @('${features[0]}','${features[1]}'); Get-WindowsOptionalFeature -Online | Where-Object { $_.FeatureName -in $names } | Select-Object FeatureName,State | ConvertTo-Json -Compress`;
            execFile(
                "powershell.exe",
                [
                    "-Command",
                    ps
                ],
                { windowsHide: true },
                (err, stdout, stderr) => {
                    if (err) {
                        console.error(err);
                        return resolve({ wsl: false, vmp: false });
                    }
                    try {
                        console.log(stdout);
                        const parsed = JSON.parse(stdout);
                        // Sometimes it's a single object if only one item, ensure array
                        const arr = Array.isArray(parsed) ? parsed : [parsed];
                        const result = {
                            wsl: arr.some(f => f.FeatureName === features[0] && f.State == "2"),
                            vmp: arr.some(f => f.FeatureName === features[1] && f.State == "2")
                        };
                        return resolve(result);
                    } catch (e) {
                        return resolve({ wsl: false, vmp: false });
                    }
                }
            );
        });
        return result;
    }

    async downloadDocker() {
        const events = EventEmitter2();
        (async () => {
            try {
                // 1) Download as stream for real progress
                const resp = await axios.get(dockerURL, {
                    responseType: "stream",
                    validateStatus: (s) => s >= 200 && s < 400
                });
                const totalHeader = resp.headers["content-length"];
                const total = totalHeader ? Number(totalHeader) : 0;
                const baseDir = app.getPath('temp');
                fs.ensureDir(baseDir);
                const exePath = path.join(baseDir, "DockerDesktopInstaller.exe");
                const logOut = path.join(baseDir, "docker_install_out.log");
                const logErr = path.join(baseDir, "docker_install_err.log");

                const writer = fs.createWriteStream(exePath);
                let downloaded = 0;
                resp.data.on("data", (chunk: Buffer) => {
                    downloaded += chunk.length;
                    // error=null, status={…}
                    events.emit("docker-install-event", [null, { total, downloaded }]);
                });

                await streamPipeline(resp.data, writer);

                const args = ["install", "--quiet", "--accept-license", "--backend=wsl-2"];
                const child = spawn(exePath, args, {
                    windowsHide: true,
                    stdio: "ignore",
                });
                child.on("error", (err) => {
                    console.error(err);
                    events.emit(
                        "docker-install-event",
                        `Installer launch failed: ${err?.message ?? String(err)}`
                    );
                });

                child.on("exit", (code) => {
                    if (code === 0) {
                        const dockerDesktopPath = path.join(
                             "C:\\Program Files",
                            "Docker",
                            "Docker",
                            "Docker Desktop.exe"
                        );
                        try {
                            spawn(dockerDesktopPath, [], {
                                detached: true,
                                windowsHide: false,
                                stdio: "ignore",
                            }).unref();
                            events.emit("docker-install-complete", { needsRestart: false });
                            return;
                        } catch (error) {
                            console.error(error);
                        }
                        events.emit(
                            "docker-install-event",
                            `Docker install failed (exit code ${code}).`
                        );
                    }
                });
            } catch (err: any) {
                events.emit("docker-install-event", err?.message ?? String(err));
            }
        })();

        return events;
    }

    async turnWindowsFeatureOn(): Promise<import('mitt').Emitter<{}>> {
        const events = EventEmitter2();
        const vmp = new DismExecutor([
            '/online',
            '/enable-feature',
            '/featurename:VirtualMachinePlatform',
            '/all',
            '/norestart'
        ]);
        let isVMPErrored = false;
        vmp.on('error', (e) => {
            isVMPErrored = true;
            events.emit('vmp-event', [e.message]);
        });
        vmp.on('progress', (e) => {
            events.emit('vmp-event', [null, e.percent]);
        });
        vmp.on('close', () => {
            events.emit('vmp-event-complete');
            if (isVMPErrored) {
                return;
            }
            const wsl = new DismExecutor([
                '/online',
                '/enable-feature',
                '/featurename:Microsoft-Windows-Subsystem-Linux',
                '/all',
                '/norestart'
            ]);
            wsl.on('error', (e) => {
                events.emit('wsl-event', [e.message]);
            });
            wsl.on('progress', (e) => {
                events.emit('wsl-event', [null, e.percent]);
            });
            wsl.on('close', (e) => {
                events.emit('wsl-event-complete');
            });
            wsl.run();
        });
        vmp.run();
        return events;
    }

    async  downloadWsl() {
        const events =  EventEmitter2();
        (async () => {
            try {
                // Request MSI as a stream so we can track progress in Node
                const resp = await axios.get(wslURL, {
                    responseType: "stream",
                    validateStatus: (s) => s >= 200 && s < 400
                });

                const totalHeader = resp.headers["content-length"];
                const total = totalHeader ? Number(totalHeader) : 0;

                const tmpFile = path.join(app.getPath("desktop"), "wsl_update_x64.msi");
                const writer = fs.createWriteStream(tmpFile);

                let downloaded = 0;
                resp.data.on("data", (chunk: Buffer) => {
                    downloaded += chunk.length;
                    events.emit("wsl-install-event", [null, { total, downloaded }]);
                });
                await streamPipeline(resp.data, writer);
                const child = spawn("msiexec.exe", ["/i", tmpFile, "/qn", "/norestart"], {
                    windowsHide: false,
                    stdio: "ignore"
                });
                child.on("error", (err) => {
                    events.emit("wsl-install-event", `Installer launch failed: ${err?.message ?? String(err)}`);
                });
                child.on("exit", (code) => {
                    console.log(code);
                    if (code === 0 || code === 3010) {
                        const needsRestart = code === 3010;
                        events.emit("wsl-install-complete", { needsRestart });
                        return;
                    }
                    events.emit(
                        "wsl-install-event",
                        `WSL is required. The installer was closed or failed (exit code ${code}).`
                    );
                });
            } catch (err: any) {
                events.emit("wsl-install-event", err?.message ?? String(err));
            }
        })();

        return events;
    }
    async executeStep(step: number) {
        if (step == 1) {
            return this.turnWindowsFeatureOn();
        }
        if (step == 2) {
            return this.downloadWsl();
        }
        if (step == 3) {
            return this.downloadDocker();
        }
        throw new Error("Not impleted");
    }

    parseWslStdout(stdout: string) {
        const map = new Map<string, string>();
        stdout = stdout.replaceAll(stdout[1], '');
        stdout.split('\r\n').map((line) => {
            let [key, value] = line.split(':');
            if (key === 'WSL version') {
                value = value.split('.')[0].trim();
            }
            map.set(key, value);
        });
        const obj = {
            wslVersion: map.get('WSL version')!,
            kernalVersion: map.get('Kernel version'),
        }
        return obj;
    }

    async checkWslVersion(): Promise<false | number> {
        const [stdout, error] = await execPromise("wsl.exe --version");
        if (error) {
            return false;
        }
        const wslParsedResponse = this.parseWslStdout(stdout);
        return parseInt(wslParsedResponse.wslVersion)
    }

    async checkCurrentStep(): Promise<number> {
        // Order matters: enable features -> install WSL -> install Docker -> images
        const isWslAndVMPEnabled = await this.checkWSLAndVMP();
        if (!isWslAndVMPEnabled.vmp || !isWslAndVMPEnabled.wsl) {
            return 0;
        }

        const wslVersion = await this.checkWslVersion();
        console.log(wslVersion);
        if (wslVersion !== 2) {
            return 1;
        }

        const dockerVersion = await this.checkDockerVersion();
        if (!dockerVersion) {
            return 2;
        }

        return 3;
    }


    async moveToNextStep(): Promise<boolean> {
        // Implement your logic here
        return true;
    }

    async restart(): Promise<void> {
        execSync("shutdown /r /t 0");
    }
}
