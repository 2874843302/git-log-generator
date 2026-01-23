/**
 * 封装 Electron IPC 调用
 * 既然不再区分前后端，我们直接通过频道名称进行通信，不再模拟 HTTP 请求
 */

const api = {
  // 配置相关
  getConfig: () => window.electron.invoke('api:getConfig'),
  updateConfig: (config) => window.electron.invoke('api:updateConfig', config),
  getEnvStatus: () => window.electron.invoke('api:getEnvStatus'),
  initEnv: () => window.electron.invoke('api:initEnv'),
  detectBrowsers: () => window.electron.invoke('api:detectBrowsers'),

  // 文件系统相关
  listDir: (dirPath) => window.electron.invoke('api:listDir', { dirPath }),
  getDrives: () => window.electron.invoke('api:getDrives'),

  // Git 相关
  getGitAuthors: (repoPaths) => window.electron.invoke('api:getGitAuthors', { repoPaths }),
  getGitBranches: (repoPaths) => window.electron.invoke('api:getGitBranches', { repoPaths }),
  getGitLogs: (params) => window.electron.invoke('api:getGitLogs', params),

  // AI & 模版相关
  getTemplates: () => window.electron.invoke('api:getTemplates'),
  generateAiLog: (data) => window.electron.invoke('api:generateAiLog', data),

  // 学习通相关
  createXuexitongNote: (data) => window.electron.invoke('api:createXuexitongNote', data),

  // 系统相关
  showNotification: (data) => window.electron.invoke('api:showNotification', data),
  listSounds: () => window.electron.invoke('api:listSounds'),
};

export default api;
