import os from 'os';
import { WindowInstaller } from './window';
// import { SimulatedWindowInstaller, SimOptions } from './mockWindows';
import { Installer } from './abstract';

let installer: Installer | null = null;
if (os.platform() === 'win32') {
    installer = new WindowInstaller();
}
if (os.platform() === "darwin") {
    installer = new WindowInstaller();
}
// if (true) {
//     installer = new SimulatedWindowInstaller({
//         scenario: "happy",      // "happy" | "slow" | "needsRestart" | "wslFail" | "dockerFail" | "flakyNet"
//         seed: 42,                   // deterministic progress for CI
//         dockerVersion: "4.31.1",    // simulate desired version
//         wslVersion: "1",            // simulate WSL2
//     });
// }
if (!installer) {
    throw new Error("Something went wrong installer is null");
}

export default installer!;