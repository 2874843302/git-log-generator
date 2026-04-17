const { contextBridge, ipcRenderer } = require('electron');

const electronApi = {
    invoke: (channel, data) => {
        if (typeof channel === 'string' && channel.startsWith('api:')) {
            return ipcRenderer.invoke(channel, data);
        }
        return Promise.reject(new Error(`Illegal IPC channel: ${channel}`));
    },

    send: (channel, data) => {
        const validChannels = [
            'toMain',
            'check-for-update',
            'start-download-update',
            'quit-and-install',
        ];

        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },

    receive: (channel, func) => {
        const validChannels = [
            'fromMain',
            'update-available',
            'update-not-available',
            'update-error',
            'checking-for-update',
            'download-progress',
            'update-downloaded',
        ];

        if (validChannels.includes(channel)) {
            const subscription = (_event, ...args) => func(...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
        }

        return () => {};
    },

    // Compatibility helper for code that expects a dedicated version API.
    getAppVersion: () => ipcRenderer.invoke('api:getAppVersion'),
};

contextBridge.exposeInMainWorld('electron', electronApi);
contextBridge.exposeInMainWorld('electronAPI', electronApi);
