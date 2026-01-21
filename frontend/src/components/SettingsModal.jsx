import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Folder, Key, RefreshCw, Loader2, Check, Settings, ShieldCheck, AlertCircle, Eye, EyeOff, User, Share2, ChevronDown, ChevronUp } from 'lucide-react';

const SettingsModal = ({ 
  isOpen, 
  onClose, 
  baseDir, 
  updateBaseDir, 
  apiKey, 
  updateApiKey, 
  defaultUser,
  updateDefaultUser,
  xuexitongUrl,
  updateXuexitongUrl,
  xuexitongUsername,
  updateXuexitongUsername,
  xuexitongPassword,
  updateXuexitongPassword,
  initEnv,
  loading,
  originPos 
}) => {
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localDefaultUser, setLocalDefaultUser] = useState(defaultUser);
  const [localXuexitongUrl, setLocalXuexitongUrl] = useState(xuexitongUrl);
  const [localXuexitongUsername, setLocalXuexitongUsername] = useState(xuexitongUsername);
  const [localXuexitongPassword, setLocalXuexitongPassword] = useState(xuexitongPassword);
  const [showKey, setShowKey] = useState(false);
  const [showXuexitongPwd, setShowXuexitongPwd] = useState(false);
  const [isXuexitongOpen, setIsXuexitongOpen] = useState(false);

  useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  useEffect(() => {
    setLocalDefaultUser(defaultUser);
  }, [defaultUser]);

  useEffect(() => {
    setLocalXuexitongUrl(xuexitongUrl);
  }, [xuexitongUrl]);

  useEffect(() => {
    setLocalXuexitongUsername(xuexitongUsername);
  }, [xuexitongUsername]);

  useEffect(() => {
    setLocalXuexitongPassword(xuexitongPassword);
  }, [xuexitongPassword]);

  const handleSaveKey = () => {
    updateApiKey(localApiKey);
  };

  const handleSaveUser = () => {
    updateDefaultUser(localDefaultUser.toLowerCase().replace(/\s+/g, ''));
  };

  const handleSaveXuexitongUrl = () => {
    updateXuexitongUrl(localXuexitongUrl);
  };

  const handleSaveXuexitongCreds = () => {
    updateXuexitongUsername(localXuexitongUsername);
    updateXuexitongPassword(localXuexitongPassword);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
      />

      {/* 弹窗主体 */}
      <motion.div
        initial={originPos ? { 
          opacity: 0, 
          scale: 0,
          x: originPos.x - window.innerWidth / 2,
          y: originPos.y - window.innerHeight / 2
        } : { opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-blue-900/20 overflow-hidden border border-gray-100"
      >
        {/* 顶部标题栏 */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
              <Settings size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">全局设置</h3>
              <p className="text-blue-100 text-xs mt-0.5">配置环境、根目录及 API 密钥</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 1. 环境初始化 */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <RefreshCw size={14} />
                <span>环境初始化</span>
              </div>
            </div>
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                  一键复制 .env.example 为 .env，自动准备环境配置文件。
                </p>
              </div>
              <button 
                onClick={initEnv}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 active:scale-95 shrink-0"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                立即初始化
              </button>
            </div>
          </section>

          {/* 2. 工作根目录 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <Folder size={14} />
              <span>工作根目录</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-600 font-medium truncate">
                {baseDir || '未设置基础目录'}
              </div>
              <button 
                onClick={updateBaseDir}
                className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-blue-100 bg-white shadow-sm shrink-0"
                title="选择基础目录"
              >
                <Folder size={18} />
              </button>
            </div>
          </section>

          {/* 3. 默认用户 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <User size={14} />
              <span>默认用户 (拼音小写)</span>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <input 
                  type="text"
                  value={localDefaultUser}
                  onChange={(e) => setLocalDefaultUser(e.target.value)}
                  placeholder="例如: zhangsan"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all font-mono"
                />
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <button 
                onClick={handleSaveUser}
                disabled={localDefaultUser === defaultUser}
                className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  localDefaultUser === defaultUser 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20'
                }`}
              >
                <Check size={16} />
                保存默认用户
              </button>
            </div>
          </section>

          {/* 4. 学习通配置 */}
          <section className="space-y-3">
            <button 
              onClick={() => setIsXuexitongOpen(!isXuexitongOpen)}
              className="w-full flex items-center justify-between group"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider group-hover:text-blue-500 transition-colors">
                <Share2 size={14} className={isXuexitongOpen ? "text-blue-500" : ""} />
                <span>学习通自动化配置</span>
                <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-[9px] text-gray-400 rounded-md font-normal lowercase tracking-normal">可选</span>
              </div>
              {isXuexitongOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>

            <AnimatePresence>
              {isXuexitongOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-indigo-50/30 border border-indigo-100 rounded-2xl p-4 space-y-4 mt-1">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-indigo-600 uppercase">笔记页面 URL</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={localXuexitongUrl}
                          onChange={(e) => setLocalXuexitongUrl(e.target.value)}
                          placeholder="https://note.chaoxing.com/pc/index"
                          className="flex-1 px-4 py-2 bg-white border border-indigo-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <button 
                          onClick={handleSaveXuexitongUrl}
                          disabled={localXuexitongUrl === xuexitongUrl}
                          className={`p-2 rounded-xl transition-all shadow-sm ${
                            localXuexitongUrl === xuexitongUrl
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-indigo-600 uppercase">学习通账号/密码</label>
                      <div className="space-y-2">
                        <div className="relative">
                          <input 
                            type="text"
                            value={localXuexitongUsername}
                            onChange={(e) => setLocalXuexitongUsername(e.target.value)}
                            placeholder="手机号/超星号"
                            className="w-full px-4 py-2 bg-white border border-indigo-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                        <div className="relative">
                          <input 
                            type={showXuexitongPwd ? "text" : "password"}
                            value={localXuexitongPassword}
                            onChange={(e) => setLocalXuexitongPassword(e.target.value)}
                            placeholder="密码"
                            className="w-full px-4 py-2 bg-white border border-indigo-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <button 
                            onClick={() => setShowXuexitongPwd(!showXuexitongPwd)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-indigo-600"
                          >
                            {showXuexitongPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        <button 
                          onClick={handleSaveXuexitongCreds}
                          disabled={localXuexitongUsername === xuexitongUsername && localXuexitongPassword === xuexitongPassword}
                          className={`w-full py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                            localXuexitongUsername === xuexitongUsername && localXuexitongPassword === xuexitongPassword
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                          }`}
                        >
                          <Check size={14} />
                          保存账号密码
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* 5. API 密钥 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <Key size={14} />
              <span>DeepSeek API Key</span>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <input 
                  type={showKey ? "text" : "password"}
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  placeholder="在此输入您的 API 密钥..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-12 py-3 text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all font-mono"
                />
                <ShieldCheck size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <button 
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                  title={showKey ? "隐藏密钥" : "显示密钥"}
                >
                  {showKey ? <EyeOff size={16} className="text-blue-500" /> : <Eye size={16} />}
                </button>
              </div>
              <button 
                onClick={handleSaveKey}
                disabled={localApiKey === apiKey}
                className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  localApiKey === apiKey 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20'
                }`}
              >
                <Check size={16} />
                保存密钥配置
              </button>
            </div>
          </section>
        </div>

        {/* 底部说明 */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-start gap-2.5">
          <AlertCircle size={14} className="text-gray-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-gray-500 leading-relaxed">
            配置完成后，系统将自动读取 Git 仓库信息。API 密钥将安全地存储在您的本地 .env 文件中。
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsModal;
