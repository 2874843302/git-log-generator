import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Folder, Key, RefreshCw, Loader2, Check, Settings, ShieldCheck, AlertCircle, Eye, EyeOff, User, Share2, ChevronDown, ChevronUp, Volume2, Play, Clock, Calendar, Type } from 'lucide-react';

const SettingsModal = ({ 
  isOpen, 
  onClose, 
  baseDir, 
  updateBaseDir, 
  apiKey, 
  updateApiKey, 
  defaultUser,
  updateDefaultUser,
  xuexitongLogUrl,
  updateXuexitongLogUrl,
  xuexitongUsername,
  updateXuexitongUsername,
  xuexitongPassword,
  updateXuexitongPassword,
  browserPath,
  updateBrowserPath,
  notificationSoundEnabled,
  updateNotificationSoundEnabled,
  successSound,
  updateSuccessSound,
  failureSound,
  updateFailureSound,
  scheduleEnabled,
  updateScheduleEnabled,
  scheduleTime,
  updateScheduleTime,
  titleTemplate,
  updateTitleTemplate,
  emailAddress,
  updateEmailAddress,
  dailyEmailEnabled,
  updateDailyEmailEnabled,
  weeklyEmailEnabled,
  updateWeeklyEmailEnabled,
  initEnv,
  loading,
  originPos,
  autoLaunchEnabled,
  updateAutoLaunchEnabled
}) => {
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localDefaultUser, setLocalDefaultUser] = useState(defaultUser);
  const [localXuexitongLogUrl, setLocalXuexitongLogUrl] = useState(xuexitongLogUrl);
  const [localXuexitongUsername, setLocalXuexitongUsername] = useState(xuexitongUsername);
  const [localXuexitongPassword, setLocalXuexitongPassword] = useState(xuexitongPassword);
  const [localBrowserPath, setLocalBrowserPath] = useState(browserPath);
  const [localScheduleTime, setLocalScheduleTime] = useState(scheduleTime);
  const [localTitleTemplate, setLocalTitleTemplate] = useState(titleTemplate);
  const [localEmailAddress, setLocalEmailAddress] = useState(emailAddress || '');
  const [detectedBrowsers, setDetectedBrowsers] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showXuexitongPwd, setShowXuexitongPwd] = useState(false);
  const [activeTab, setActiveTab] = useState('general'); // general, automation, system
  const [soundList, setSoundList] = useState([]);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState({ loading: false, result: null }); // null, 'success', 'error'
  const [testEmailError, setTestEmailError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchSounds();
    }
  }, [isOpen]);

  const fetchSounds = async () => {
    try {
      const sounds = await api.listSounds();
      setSoundList(sounds);
    } catch (err) {
      console.error('获取音效列表失败', err);
    }
  };

  const playPreview = (soundName) => {
    // 使用 encodeURIComponent 处理文件名中的特殊字符，并确保路径拼接正确
    const audio = new Audio(`./sound/${encodeURIComponent(soundName)}`);
    audio.play().catch(err => console.error('播放预览失败', err));
  };

  useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  useEffect(() => {
    setLocalDefaultUser(defaultUser);
  }, [defaultUser]);

  useEffect(() => {
    setLocalXuexitongLogUrl(xuexitongLogUrl);
  }, [xuexitongLogUrl]);

  useEffect(() => {
    setLocalXuexitongUsername(xuexitongUsername);
  }, [xuexitongUsername]);

  useEffect(() => {
    setLocalXuexitongPassword(xuexitongPassword);
  }, [xuexitongPassword]);

  useEffect(() => {
    setLocalBrowserPath(browserPath);
  }, [browserPath]);

  useEffect(() => {
    setLocalScheduleTime(scheduleTime);
  }, [scheduleTime]);

  useEffect(() => {
    setLocalTitleTemplate(titleTemplate);
  }, [titleTemplate]);

  useEffect(() => {
    setLocalEmailAddress(emailAddress || '');
  }, [emailAddress]);

  const handleDetectBrowsers = async () => {
    try {
      setIsDetecting(true);
      const browsers = await api.detectBrowsers();
      setDetectedBrowsers(browsers);
    } catch (err) {
      console.error('检测浏览器失败', err);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleApplyBrowser = (path) => {
    setLocalBrowserPath(path);
    updateBrowserPath(path);
  };

  const handleSaveBrowserPath = () => {
    updateBrowserPath(localBrowserPath);
  };

  const handleSaveKey = () => {
    updateApiKey(localApiKey);
  };

  const handleSaveUser = () => {
    updateDefaultUser(localDefaultUser.toLowerCase().replace(/\s+/g, ''));
  };

  const handleSaveXuexitongLogUrl = () => {
    updateXuexitongLogUrl(localXuexitongLogUrl);
  };

  const handleSaveXuexitongCreds = () => {
    updateXuexitongUsername(localXuexitongUsername);
    updateXuexitongPassword(localXuexitongPassword);
  };

  const handleSaveScheduleTime = () => {
    if (!localScheduleTime) return;
    updateScheduleTime(localScheduleTime);
  };

  const handleSaveTitleTemplate = () => {
    updateTitleTemplate(localTitleTemplate);
  };

  const handleSaveEmail = () => {
    updateEmailAddress(localEmailAddress);
  };

  const handleTestEmail = async () => {
    if (!localEmailAddress) {
      setTestEmailStatus({ loading: false, result: 'error' });
      setTestEmailError('请先输入收件邮箱地址');
      setTimeout(() => setTestEmailStatus({ loading: false, result: null }), 3000);
      return;
    }

    setTestEmailStatus({ loading: true, result: null });
    setTestEmailError('');
    
    try {
      const result = await api.sendTestEmail(localEmailAddress);
      if (result.success) {
        setTestEmailStatus({ loading: false, result: 'success' });
        setTimeout(() => setTestEmailStatus({ loading: false, result: null }), 5000);
      } else {
        setTestEmailStatus({ loading: false, result: 'error' });
        setTestEmailError(result.error || '发送失败');
        setTimeout(() => setTestEmailStatus({ loading: false, result: null }), 8000);
      }
    } catch (err) {
      setTestEmailStatus({ loading: false, result: 'error' });
      setTestEmailError(err.message || '网络错误');
      setTimeout(() => setTestEmailStatus({ loading: false, result: null }), 8000);
    }
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

        {/* 标签页导航 */}
        <div className="flex border-b border-gray-100 bg-gray-50/50">
          {[
            { id: 'general', label: '基础配置', icon: Settings },
            { id: 'automation', label: '同步任务', icon: Share2 },
            { id: 'system', label: '系统交互', icon: ShieldCheck },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold transition-all relative ${
                activeTab === tab.id ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                />
              )}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div
                key="general"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* 0. 系统设置 - 开机自启 */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <Settings size={14} />
                    <span>系统偏好</span>
                  </div>
                  <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-gray-700">开机自动启动</span>
                        <p className="text-[10px] text-gray-400">在 Windows 启动时自动运行软件</p>
                      </div>
                      <button 
                        onClick={() => updateAutoLaunchEnabled(!autoLaunchEnabled)}
                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                          autoLaunchEnabled ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            autoLaunchEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </section>

                {/* 1. 环境初始化 */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <RefreshCw size={14} />
                    <span>环境初始化</span>
                  </div>
                  <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                        一键准备环境配置文件。
                      </p>
                    </div>
                    <button 
                      onClick={initEnv}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 active:scale-95 shrink-0"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      初始化
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

                {/* 8. API 密钥 */}
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

                {/* 10. 学习通标题模板设置 */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <Type size={14} />
                    <span>学习通笔记标题模板</span>
                  </div>
                  <div className="space-y-3">
                    <div className="relative">
                      <textarea 
                        value={localTitleTemplate}
                        onChange={(e) => setLocalTitleTemplate(e.target.value)}
                        placeholder="例如: [工作日志] {date} - {author}"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-4 py-3 text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all font-mono min-h-[80px] resize-none"
                      />
                      <p className="text-[10px] text-gray-400 px-1">
                        同步到学习通时的笔记标题。支持 {`{date}`} (YYYYMMDD格式)、{`{author}`}、{`{repo}`}。
                      </p>
                    </div>
                    <button 
                      onClick={handleSaveTitleTemplate}
                      disabled={localTitleTemplate === titleTemplate}
                      className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                        localTitleTemplate === titleTemplate 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20'
                      }`}
                    >
                      <Check size={16} />
                      保存标题模板
                    </button>
                  </div>
                </section>
              </motion.div>
            )}

            {activeTab === 'automation' && (
              <motion.div
                key="automation"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* 4. 学习通配置 */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <Share2 size={14} />
                    <span>学习通自动化配置</span>
                  </div>
                  <div className="bg-indigo-50/30 border border-indigo-100 rounded-2xl p-4 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-indigo-600 uppercase">工作日志页面 URL</label>
                        {!xuexitongLogUrl && (
                          <span className="flex items-center gap-1 text-[9px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            <AlertCircle size={10} />
                            需配置
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={localXuexitongLogUrl}
                          onChange={(e) => setLocalXuexitongLogUrl(e.target.value)}
                          placeholder="https://noteyd.chaoxing.com/pc/note_notebook/notebook_list?libId=0"
                          className="flex-1 px-4 py-2 bg-white border border-indigo-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <button 
                          onClick={handleSaveXuexitongLogUrl}
                          disabled={localXuexitongLogUrl === xuexitongLogUrl}
                          className={`p-2 rounded-xl transition-all shadow-sm ${
                            localXuexitongLogUrl === xuexitongLogUrl
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          <Check size={16} />
                        </button>
                      </div>
                      <p className="text-[9px] text-gray-400 leading-tight px-1">
                        用于检查日志完成情况及同步笔记。<b>建议填入包含笔记列表的 URL</b>（例如带有 notebook_list 的链接）。
                      </p>
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
                </section>

                {/* 7. 定时任务设置 */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <Clock size={14} />
                    <span>自动任务设置</span>
                  </div>
                  <div className="bg-blue-50/30 border border-blue-100/50 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-gray-700 block">启用每日自动同步</span>
                        <p className="text-[10px] text-gray-400">在设定时间自动生成今日日志并同步到学习通</p>
                      </div>
                      <button 
                        onClick={() => updateScheduleEnabled(!scheduleEnabled)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${scheduleEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <motion.div 
                          animate={{ x: scheduleEnabled ? 22 : 2 }}
                          className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-blue-600 uppercase">触发时间 (每天)</label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input 
                            type="time"
                            value={localScheduleTime}
                            onChange={(e) => setLocalScheduleTime(e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-blue-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <button 
                          onClick={handleSaveScheduleTime}
                          disabled={localScheduleTime === scheduleTime}
                          className={`p-2 rounded-xl transition-all ${
                            localScheduleTime === scheduleTime 
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-sm shadow-blue-200'
                          }`}
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 邮件提醒配置 */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <AlertCircle size={14} />
                    <span>邮件提醒配置</span>
                  </div>
                  <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-2xl p-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-indigo-600 uppercase">提醒邮箱地址</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="email"
                          value={localEmailAddress}
                          onChange={(e) => setLocalEmailAddress(e.target.value)}
                          placeholder="例如: yourname@example.com"
                          className="flex-1 px-4 py-2 bg-white border border-indigo-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <button 
                          onClick={handleSaveEmail}
                          disabled={localEmailAddress === emailAddress}
                          className={`p-2 rounded-xl transition-all shadow-sm ${
                            localEmailAddress === emailAddress
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          <Check size={16} />
                        </button>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-end">
                          <button 
                            onClick={handleTestEmail}
                            disabled={testEmailStatus.loading}
                            className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1.5 px-2 py-1 bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {testEmailStatus.loading ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <Play size={10} fill="currentColor" />
                            )}
                            发送测试邮件
                          </button>
                        </div>
                        
                        <AnimatePresence>
                          {testEmailStatus.result && (
                            <motion.div
                              initial={{ opacity: 0, height: 0, y: -5 }}
                              animate={{ opacity: 1, height: 'auto', y: 0 }}
                              exit={{ opacity: 0, height: 0, y: -5 }}
                              className={`flex items-start gap-2 p-2.5 rounded-xl border text-[10px] font-medium ${
                                testEmailStatus.result === 'success' 
                                  ? 'bg-green-50 border-green-100 text-green-700' 
                                  : 'bg-red-50 border-red-100 text-red-600'
                              }`}
                            >
                              {testEmailStatus.result === 'success' ? (
                                <Check size={12} className="mt-0.5 shrink-0" />
                              ) : (
                                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                              )}
                              <div className="leading-normal">
                                {testEmailStatus.result === 'success' 
                                  ? '测试邮件已发送！请检查您的收件箱（包括垃圾箱）。' 
                                  : testEmailError}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
            </div>

            <div className="space-y-3 border-t border-indigo-100/50 pt-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-bold text-gray-700 block">每日未完成提醒</span>
                          <p className="text-[9px] text-gray-400">每天 20:00 检查，若未同步则发送邮件</p>
                        </div>
                        <button 
                          onClick={() => updateDailyEmailEnabled(!dailyEmailEnabled)}
                          className={`w-10 h-5 rounded-full relative transition-colors ${dailyEmailEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
                        >
                          <motion.div 
                            animate={{ x: dailyEmailEnabled ? 22 : 2 }}
                            className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm"
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-bold text-gray-700 block">每周未完成提醒</span>
                          <p className="text-[9px] text-gray-400">每周五 21:00 检查本周缺失，若有则发送邮件</p>
                        </div>
                        <button 
                          onClick={() => updateWeeklyEmailEnabled(!weeklyEmailEnabled)}
                          className={`w-10 h-5 rounded-full relative transition-colors ${weeklyEmailEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
                        >
                          <motion.div 
                            animate={{ x: weeklyEmailEnabled ? 22 : 2 }}
                            className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </motion.div>
            )}

            {activeTab === 'system' && (
              <motion.div
                key="system"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* 5. 浏览器设置 */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <Eye size={14} />
                    <span>浏览器路径配置</span>
                  </div>
                  <div className="bg-blue-50/30 border border-blue-100/50 rounded-2xl p-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-blue-600 uppercase">浏览器可执行文件路径</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text"
                          value={localBrowserPath}
                          onChange={(e) => setLocalBrowserPath(e.target.value)}
                          placeholder="例如: C:\Program Files\Google\Chrome\Application\chrome.exe"
                          className="flex-1 px-4 py-2 bg-white border border-blue-100 rounded-xl text-[10px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button 
                          onClick={handleSaveBrowserPath}
                          disabled={localBrowserPath === browserPath}
                          className={`p-2 rounded-xl transition-all shadow-sm ${
                            localBrowserPath === browserPath
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-blue-600 uppercase">检测到的浏览器</label>
                        <button 
                          onClick={handleDetectBrowsers}
                          disabled={isDetecting}
                          className="text-[9px] px-2 py-1 bg-white border border-blue-200 text-blue-600 rounded-md hover:bg-blue-50 transition-colors flex items-center gap-1"
                        >
                          {isDetecting ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                          立即检测
                        </button>
                      </div>

                      <div className="space-y-2">
                        {detectedBrowsers.length > 0 ? (
                          detectedBrowsers.map((b, idx) => (
                            <div key={idx} className="flex flex-col gap-1 p-2 bg-white border border-blue-50 rounded-xl hover:border-blue-200 transition-all group">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-gray-700">{b.name}</span>
                                <button 
                                  onClick={() => handleApplyBrowser(b.path)}
                                  className={`px-2 py-1 text-[9px] font-bold rounded-lg transition-all ${
                                    localBrowserPath === b.path 
                                      ? 'bg-green-50 text-green-600 cursor-default'
                                      : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-sm'
                                  }`}
                                >
                                  {localBrowserPath === b.path ? '已应用' : '应用此路径'}
                                </button>
                              </div>
                              <span className="text-[9px] text-gray-400 truncate font-mono" title={b.path}>{b.path}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 bg-white/50 border border-dashed border-blue-100 rounded-xl">
                            <p className="text-[10px] text-gray-400">点击“检测”自动查找本地已安装浏览器</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 6. 音效设置 */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <Volume2 size={14} />
                    <span>音效反馈设置</span>
                  </div>
                  <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-700">启用通知音效</span>
                      <button 
                        onClick={() => updateNotificationSoundEnabled(!notificationSoundEnabled)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${notificationSoundEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <motion.div 
                          animate={{ x: notificationSoundEnabled ? 22 : 2 }}
                          className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-indigo-600 uppercase">成功音效</label>
                      <div className="flex items-center gap-2">
                        <select 
                          value={successSound}
                          onChange={(e) => updateSuccessSound(e.target.value)}
                          className="flex-1 px-4 py-2 bg-white border border-indigo-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
                        >
                          {soundList.map(sound => (
                            <option key={sound.name} value={sound.name}>{sound.name}</option>
                          ))}
                        </select>
                        <button 
                          onClick={() => playPreview(successSound)}
                          className="p-2 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition-colors"
                        >
                          <Play size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-indigo-600 uppercase">失败音效</label>
                      <div className="flex items-center gap-2">
                        <select 
                          value={failureSound}
                          onChange={(e) => updateFailureSound(e.target.value)}
                          className="flex-1 px-4 py-2 bg-white border border-indigo-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
                        >
                          {soundList.map(sound => (
                            <option key={sound.name} value={sound.name}>{sound.name}</option>
                          ))}
                        </select>
                        <button 
                          onClick={() => playPreview(failureSound)}
                          className="p-2 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition-colors"
                        >
                          <Play size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
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
