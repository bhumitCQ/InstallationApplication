import os from 'os';
import { ipcMain } from 'electron';

ipcMain.on('os', (ev, ...isArgumentsObject) => {
    const platform = os.platform();
    ev.returnValue = platform;
    console.log("on Called");
    return platform;
});
