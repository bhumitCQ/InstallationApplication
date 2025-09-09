import { exec, spawn, type ExecOptions } from 'child_process';

export const execPromise = (command: string, args: Array<string>): Promise<[string, string | null]> => {
    return new Promise((resolve, reject) => exec(command, {
        windowsHide: true,
    }, (error, stdout, stderr) => {
        if (error || stderr) {
            return resolve([stdout, error?.message ?? stderr]);
        }
        return resolve([stdout, ""]);
    }));
}