import os from 'os';
import { WindowInstaller } from './window';

let installer: WindowInstaller | null = null;
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