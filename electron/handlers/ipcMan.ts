import os, { type } from 'os';
import { ipcMain } from 'electron';
import Installer from '../installer_class';
import { app } from 'electron';


ipcMain.handle('os', (ev, ...isArgumentsObject) => {
    const platform = os.platform();
    console.log("on Called");
    return platform;
});

ipcMain.handle('get-current-step', async (ev, ...args) => {
    try {
        const currentStep = await Installer.checkCurrentStep();
        console.log({ currentStep });
        return currentStep;
    } catch (error) {
        console.error(error);
    }
});

ipcMain.handle('execute-step', async (event, step: unknown) => {
    if (typeof step !== 'number') {
        return "Step is not valid";
    }
    const events = await Installer.executeStep(step);
    events.on('*', function (e: string,arg) {
        if (arg && Array.isArray(arg)) {
            const args = Array.from(arg)
            event.sender.send(e, ...args);
            return;
        }
        event.sender.send(e, arg);
    });
});


ipcMain.handle('system-restart-now', () => {
    app.setLoginItemSettings({
        openAtLogin: true,
        path: app.getPath('exe'), 
    })
    Installer.restart();
});