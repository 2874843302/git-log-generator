const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electron', {
    /**
     * 发送消息到主进程
     * @param {string} channel 频道名称
     * @param {any} data 数据
     */
    send: (channel, data) => {
        const validChannels = ['toMain'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    /**
     * 接收来自主进程的消息
     * @param {string} channel 频道名称
     * @param {function} func 回调函数
     */
    receive: (channel, func) => {
        const validChannels = ['fromMain'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
});
