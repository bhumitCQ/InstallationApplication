const path = require('path');
const { spawn } = require('child_process');

const dockerDesktopPath = path.join(
        "C:\\Program Files",
    "Docker",
    "Docker",
    "Docker Desktop.exe"
);
spawn(dockerDesktopPath, [], {
    detached: true,
    windowsHide: false,
    stdio: "ignore",
}).unref();