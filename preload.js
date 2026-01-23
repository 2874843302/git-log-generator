const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electron', {
    /**
     * 调用主进程定义的 IPC 处理函数 (返回 Promise)
     * @param {string} channel 频道名称 (例如 'api:getConfig')
     * @param {any} data 传递给处理函数的数据
     */
    invoke: (channel, data) => {
        // 允许以 'api:' 开头的频道
        if (channel.startsWith('api:')) {
            return ipcRenderer.invoke(channel, data);
        }
        return Promise.reject(new Error(`非法 IPC 频道: ${channel}`));
    },
    
    /**
     * 发送异步消息到主进程
     */
    send: (channel, data) => {
        const validChannels = [
            'toMain',
            'check-for-update',
            'start-download-update',
            'quit-and-install'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    
    /**
     * 接收来自主进程的消息
     */
    receive: (channel, func) => {
        const validChannels = [
            'fromMain',
            'update-available',
            'update-not-available',
            'update-error',
            'checking-for-update',
            'download-progress',
            'update-downloaded'
        ];
        if (validChannels.includes(channel)) {
            const subscription = (event, ...args) => func(...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
        }
    }
});
