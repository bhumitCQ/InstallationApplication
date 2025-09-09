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

if (!installer) {
    throw new Error("Something went wrong installer is null");
}

export default installer!;