import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from './services/api';
import dayjs from 'dayjs';
import { GitCommit, AlertCircle, Clock } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

// 导入拆分后的组件
import ConfigPanel from './components/ConfigPanel';
import LogGenerator from './components/LogGenerator';
import CommitVisualizer from './components/CommitVisualizer';
import MarkdownPreview from './components/MarkdownPreview';
import FolderPickerModal from './components/FolderPickerModal';
import BranchPickerModal from './components/BranchPickerModal';
import TomorrowPlanModal from './components/TomorrowPlanModal';
import TemplatePreviewModal from './components/TemplatePreviewModal';
import SettingsModal from './components/SettingsModal';
import FoolModeModal from './components/FoolModeModal';

function App() {
  // 状态管理
  const [repoPaths, setRepoPaths] = useState([]);
  const [foolModeRepos, setFoolModeRepos] = useState([]); // 傻瓜模式选中的仓库列表
  const [baseRepoDir, setBaseRepoDir] = useState('');
  const [startDate, setStartDate] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [authors, setAuthors] = useState([]);
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [branches, setBranches] = useState([]); // 现在是 [{ path, repoName, branches: [] }]
  const [selectedBranches, setSelectedBranches] = useState({}); // 现在是 { [path]: [] }
  const [logs, setLogs] = useState([]);
  const [ignoredHashes, setIgnoredHashes] = useState(new Set());
  const [templates, setTemplates] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState('daily');
  const [generatedLog, setGeneratedLog] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [referenceLog, setReferenceLog] = useState('');
  const [templateOptions, setTemplateOptions] = useState({
    includeTomorrow: true,
    includeReflections: false,
    includeProblems: true,
    includeDiffContent: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('config'); // viz, result
  const [baseDir, setBaseDir] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [defaultUser, setDefaultUser] = useState('');
  const [xuexitongUrl, setXuexitongUrl] = useState('https://note.chaoxing.com/pc/index');
  const [xuexitongUsername, setXuexitongUsername] = useState('');
  const [xuexitongPassword, setXuexitongPassword] = useState('');
  const [browserPath, setBrowserPath] = useState('');
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(true);
  const [successSound, setSuccessSound] = useState('success.mp3');
  const [failureSound, setFailureSound] = useState('failure.mp3');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('18:00');
  const [countdown, setCountdown] = useState('');
  const [pickerConfig, setPickerConfig] = useState({ isOpen: false, type: '', initialPath: '', originPos: null });
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [branchPickerPos, setBranchPickerPos] = useState({ x: '50%', y: '50%' });
  const [tomorrowPlanModalOpen, setTomorrowPlanModalOpen] = useState(false);
  const [tomorrowPlanModalPos, setTomorrowPlanModalPos] = useState(null);
  const [tomorrowPlanPrompt, setTomorrowPlanPrompt] = useState('');
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
  const [templatePreviewPos, setTemplatePreviewPos] = useState(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsModalPos, setSettingsModalPos] = useState(null);
  const [foolModeOpen, setFoolModeOpen] = useState(false);
  const [foolModePos, setFoolModePos] = useState(null);

  // 更新相关状态
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, downloading, downloaded, error
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    fetchTemplates();
    fetchConfig();

    // 注册更新相关的监听
    const removeCheckListener = window.electron.receive('checking-for-update', () => {
      setUpdateStatus('checking');
    });

    const removeAvailableListener = window.electron.receive('update-available', (info) => {
      setUpdateInfo(info);
      setUpdateStatus('available');
    });

    const removeNotAvailableListener = window.electron.receive('update-not-available', () => {
      setUpdateStatus('idle');
    });

    const removeProgressListener = window.electron.receive('download-progress', (progress) => {
      setUpdateStatus('downloading');
      setDownloadProgress(Math.floor(progress.percent));
    });

    const removeDownloadedListener = window.electron.receive('update-downloaded', () => {
      setUpdateStatus('downloaded');
    });

    const removeErrorListener = window.electron.receive('update-error', (err) => {
      setUpdateError(err);
      setUpdateStatus('error');
    });

    // 自动检查更新
    window.electron.send('check-for-update');

    return () => {
      if (removeCheckListener) removeCheckListener();
      if (removeAvailableListener) removeAvailableListener();
      if (removeNotAvailableListener) removeNotAvailableListener();
      if (removeProgressListener) removeProgressListener();
      if (removeDownloadedListener) removeDownloadedListener();
      if (removeErrorListener) removeErrorListener();
    };
  }, []);

  // 自动选中默认用户
  useEffect(() => {
    if (defaultUser && authors.includes(defaultUser)) {
      setSelectedAuthor(defaultUser);
    }
  }, [defaultUser, authors]);

  // 定时任务触发记录，防止同一分钟内重复触发
  const lastTriggeredRef = useRef('');

  /**
   * 播放通知音效
   */
  const playNotificationSound = React.useCallback((type) => {
    if (!notificationSoundEnabled) return;
    
    const soundFile = type === 'success' ? successSound : failureSound;
    const audio = new Audio(`/sound/${soundFile}`);
    audio.play().catch(err => console.error('播放音效失败:', err));
  }, [notificationSoundEnabled, successSound, failureSound]);

  /**
   * 同步笔记到学习通
   */
  const handleSyncToXuexitong = React.useCallback(async (content, isFoolMode = false, targetDate = null, headless = false) => {
    console.log(`[Frontend] handleSyncToXuexitong 被调用, headless: ${headless}, isFoolMode: ${isFoolMode}`);
    const syncDate = targetDate || endDate;
    try {
      const res = await api.createXuexitongNote({
        content,
        title: `工作日志 ${syncDate}`,
        headless
      });
      if (res.success) {
        // 播放成功音效
        playNotificationSound('success');
        
        api.showNotification({
          title: '同步成功',
          body: isFoolMode 
            ? `${syncDate} 的工作日志已成功同步到学习通`
            : '同步成功！笔记已保存到学习通。',
          silent: true // 已经手动播放了音效，所以通知设为静音
        });
      }
    } catch (err) {
      // 播放失败音效
      playNotificationSound('failure');
      
      const errorMsg = err.message || '同步失败，请检查学习通配置';
      api.showNotification({ 
        title: '同步失败', 
        body: isFoolMode 
          ? `${syncDate} 的工作日志同步失败: ${errorMsg}` 
          : errorMsg,
        silent: true
      });
      console.error('Sync Error:', err);
    }
  }, [endDate, playNotificationSound]);

  const generateLog = React.useCallback(async (customLogs = null, customTemplate = null, customRepoPaths = null, customOptions = null) => {
    // 检查参数是否为 React 事件对象
    const isEvent = customLogs && customLogs.nativeEvent;
    const actualLogs = isEvent ? null : customLogs;

    setLoading(true);
    setError('');
    try {
      const targetLogs = actualLogs || logs.filter(log => !ignoredHashes.has(log.hash));
      if (targetLogs.length === 0) {
        setError('没有可供生成的有效提交记录（所有记录已被忽略或未获取）');
        setLoading(false);
        return;
      }

      console.log('开始请求 AI 生成，参数:', {
        logsCount: targetLogs.length,
        template: customTemplate || selectedTemplate,
        apiKeyPresent: !!apiKey
      });

      const res = await api.generateAiLog({
        logs: targetLogs,
        repoPaths: customRepoPaths || repoPaths,
        templateKey: customTemplate || selectedTemplate,
        customPrompt: customPrompt,
        tomorrowPlanPrompt: tomorrowPlanPrompt,
        referenceLog: selectedTemplate === 'custom' ? referenceLog : '',
        options: customOptions || templateOptions,
        apiKey: apiKey // 确保传递 API Key
      });
      
      console.log('AI 生成返回结果:', res);

      if (res && res.content) {
        setGeneratedLog(res.content);
        setActiveTab('result');
        return res.content; // 返回生成的内容
      } else {
        console.warn('AI 返回内容为空:', res);
        setError('AI 未能生成有效内容，请稍后再试');
        return null;
      }
    } catch (err) {
      console.error('generateLog 捕获到错误:', err);
      setError(err.message || '生成日志失败，请检查 API 配置');
      return null;
    } finally {
      setLoading(false);
    }
  }, [logs, ignoredHashes, selectedTemplate, repoPaths, customPrompt, tomorrowPlanPrompt, referenceLog, templateOptions, apiKey]);

  /**
   * 傻瓜模式一键生成逻辑
   */
  const handleFoolModeGenerate = React.useCallback(async (selectedRepos, templateKey = 'concise', targetDate = null, customOptions = null, headless = false) => {
    console.log('[傻瓜模式] 开始执行...', { selectedRepos, templateKey, targetDate, headless });
    setFoolModeOpen(false);
    
    // 1. 设置基础状态
    const today = targetDate || dayjs().format('YYYY-MM-DD');
    setStartDate(today);
    setEndDate(today);
    setRepoPaths(selectedRepos);
    setSelectedAuthor(defaultUser);
    setSelectedTemplate(templateKey);
    
    // 保存傻瓜模式选择的仓库到数据库
    try {
      await api.updateConfig({ FOOL_MODE_SELECTED_REPOS: selectedRepos.join(',') });
      setFoolModeRepos(selectedRepos);
    } catch (err) {
      console.error('[傻瓜模式] 保存仓库配置失败:', err);
    }

    // 2. 获取日志
    console.log('[傻瓜模式] 正在获取 Git 日志...', { today, author: defaultUser, selectedRepos });
    
    // 直接在这里调用 API 获取日志，而不是依赖 fetchLogs 内部的状态
    setLoading(true);
    setError('');
    try {
      const fetchedLogsRes = await api.getGitLogs({
        repoPaths: selectedRepos,
        startDate: today,
        endDate: today,
        author: defaultUser,
        branches: {}
      });
      
      const fetchedLogs = fetchedLogsRes?.logs || [];
      setLogs(fetchedLogs);

      // 3. 如果有日志，根据指定的模版生成报告
      if (fetchedLogs && fetchedLogs.length > 0) {
        console.log(`[傻瓜模式] 成功获取 ${fetchedLogs.length} 条日志，开始调用 AI 生成...`);
        const foolModeOptions = customOptions || {
          includeTomorrow: false,
          includeReflections: false,
          includeProblems: false,
          includeDiffContent: false
        };
        
        const content = await generateLog(fetchedLogs, templateKey, selectedRepos, foolModeOptions);
        
        if (content) {
          console.log('[傻瓜模式] AI 生成完成，开始自动同步学习通...');
          await handleSyncToXuexitong(content, true, today, headless);
        } else {
          console.warn('[傻瓜模式] AI 生成内容为空，取消同步');
          api.showNotification({
            title: '定时任务失败',
            body: 'AI 生成内容为空，请检查模板配置或 API Key 是否正确。',
            silent: false
          });
          playNotificationSound('failure');
        }
      } else {
        console.warn('[傻瓜模式] 未获取到任何日志记录，任务结束');
        api.showNotification({
          title: '定时任务跳过',
          body: `${today} 未发现任何 Git 提交记录，无需生成。`,
          silent: false
        });
      }
    } catch (err) {
      console.error('[傻瓜模式] 执行过程出错:', err);
      setError(`执行失败: ${err.message}`);
      api.showNotification({
        title: '定时任务出错',
        body: `原因: ${err.message}`,
        silent: false
      });
      playNotificationSound('failure');
    } finally {
      setLoading(false);
    }
  }, [defaultUser, generateLog, handleSyncToXuexitong]);

  /**
   * 定时任务逻辑
   */
  useEffect(() => {
    let timer;
    if (scheduleEnabled && scheduleTime && typeof scheduleTime === 'string' && scheduleTime.includes(':')) {
      console.log(`[定时任务] 计时器已启动，目标时间: ${scheduleTime}, 当前已选仓库: ${foolModeRepos?.length || 0}个`);
      
      timer = setInterval(() => {
        try {
          const now = dayjs();
          const [targetHour, targetMinute] = scheduleTime.split(':').map(Number);
          
          if (isNaN(targetHour) || isNaN(targetMinute)) return;

          // 计算今天的目标触发时间
          const todayTarget = dayjs().hour(targetHour).minute(targetMinute).second(0).millisecond(0);
          
          // 确定下一个目标时间（用于倒计时显示）
          let nextTarget = todayTarget;
          if (now.isAfter(todayTarget)) {
            nextTarget = todayTarget.add(1, 'day');
          }
          
          // 计算倒计时
          const diff = nextTarget.diff(now);
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          
          setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
          
          // 触发逻辑：
          // 1. 当前时间的小时和分钟与目标一致
          // 2. 该特定的“日期+时间”尚未触发过
          const currentTriggerKey = `${now.format('YYYY-MM-DD')} ${scheduleTime}`;
          
          if (now.hour() === targetHour && now.minute() === targetMinute) {
            if (lastTriggeredRef.current !== currentTriggerKey) {
              const hasRepos = foolModeRepos && foolModeRepos.length > 0;
              console.log(`[定时任务] 时间匹配成功! Key: ${currentTriggerKey}, 是否有仓库: ${hasRepos}`);
              
              if (hasRepos) {
                console.log(`[定时任务] 开始执行自动同步...`);
                lastTriggeredRef.current = currentTriggerKey;
                api.updateConfig({ LAST_TRIGGERED_DATE: currentTriggerKey });
                // 定时任务触发时，开启无头模式（headless: true）
                handleFoolModeGenerate(foolModeRepos, 'concise', null, null, true);
              } else {
                console.warn('[定时任务] 触发时间已到，但未配置仓库，跳过执行');
                lastTriggeredRef.current = currentTriggerKey;
                api.updateConfig({ LAST_TRIGGERED_DATE: currentTriggerKey });
                
                api.showNotification({
                  title: '定时任务未执行',
                  body: '触发时间已到，但尚未在“傻瓜模式”中选择任何仓库。',
                  silent: false
                });
                playNotificationSound('failure');
              }
            }
          }
        } catch (err) {
          console.error('定时任务计时器错误:', err);
        }
      }, 1000);
    } else {
      setCountdown('');
    }
    return () => clearInterval(timer);
  }, [scheduleEnabled, scheduleTime, foolModeRepos, handleFoolModeGenerate, playNotificationSound]);

  // API 调用逻辑
  const fetchConfig = async () => {
    try {
      const res = await api.getConfig();
      // 无论是否有值都进行设置，确保与文件同步
      setBaseDir(res.BASE_REPO_DIR || '');
      setApiKey(res.DEEPSEEK_API_KEY || '');
      setDefaultUser(res.DEFAULT_USER || '');
      setXuexitongUrl(res.XUEXITONG_NOTE_URL || 'https://note.chaoxing.com/pc/index');
      setXuexitongUsername(res.XUEXITONG_USERNAME || '');
      setXuexitongPassword(res.XUEXITONG_PASSWORD || '');
      setBrowserPath(res.BROWSER_PATH || '');
      setNotificationSoundEnabled(res.NOTIFICATION_SOUND_ENABLED === 'true' || res.NOTIFICATION_SOUND_ENABLED === true);
      setSuccessSound(res.SUCCESS_SOUND || 'success.mp3');
      setFailureSound(res.FAILURE_SOUND || 'failure.mp3');
      setScheduleEnabled(res.SCHEDULE_ENABLED === 'true' || res.SCHEDULE_ENABLED === true);
      setScheduleTime(res.SCHEDULE_TIME || '18:00');
      
      // 加载上次触发日期，防止重启后在同一分钟内重复触发
      if (res.LAST_TRIGGERED_DATE) {
        lastTriggeredRef.current = res.LAST_TRIGGERED_DATE;
      }
      
      // 加载傻瓜模式选中的仓库
      if (res.FOOL_MODE_SELECTED_REPOS) {
        setFoolModeRepos(res.FOOL_MODE_SELECTED_REPOS.split(',').filter(Boolean));
      }
      
      // 加载上次选择的仓库
      if (res.LAST_SELECTED_REPOS) {
        const paths = res.LAST_SELECTED_REPOS.split(',').filter(p => p.trim());
        if (paths.length > 0) {
          setRepoPaths(paths);
          fetchAuthors(paths);
          fetchBranches(paths);
        }
      }
    } catch (err) {
      console.error('获取配置信息失败', err);
    }
  };

  const initEnv = async () => {
    try {
      setLoading(true);
      const res = await api.initEnv();
      if (res.success) {
        playNotificationSound('success');
        api.showNotification({
          title: '初始化成功',
          body: '开发环境已成功初始化',
          silent: true
        });
      } else {
        playNotificationSound('failure');
        api.showNotification({
          title: '初始化失败',
          body: res.message,
          silent: true
        });
      }
      fetchConfig(); // 重新加载配置
    } catch (err) {
      playNotificationSound('failure');
      setError(err.message || '初始化环境失败');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (key, value) => {
    try {
      await api.updateConfig({ [key]: value });
      if (key === 'BASE_REPO_DIR') setBaseDir(value);
      if (key === 'DEEPSEEK_API_KEY') setApiKey(value);
      if (key === 'DEFAULT_USER') setDefaultUser(value);
      if (key === 'XUEXITONG_NOTE_URL') setXuexitongUrl(value);
      if (key === 'XUEXITONG_USERNAME') setXuexitongUsername(value);
      if (key === 'XUEXITONG_PASSWORD') setXuexitongPassword(value);
      if (key === 'BROWSER_PATH') setBrowserPath(value);
      if (key === 'NOTIFICATION_SOUND_ENABLED') setNotificationSoundEnabled(value === 'true' || value === true);
      if (key === 'SUCCESS_SOUND') setSuccessSound(value);
      if (key === 'FAILURE_SOUND') setFailureSound(value);
      if (key === 'SCHEDULE_ENABLED') setScheduleEnabled(value === 'true' || value === true);
      if (key === 'SCHEDULE_TIME') setScheduleTime(value);
    } catch (err) {
      console.error(`更新配置 ${key} 失败`, err);
    }
  };

  // 监听仓库列表变动，自动保存到配置
  useEffect(() => {
    // 只有在 repoPaths 有值或者明确变空时才同步（避免初始化时的干扰）
    // 实际上我们可以直接同步，因为 fetchConfig 只在初始化执行一次
    const saveRepos = async () => {
      const repoString = repoPaths.join(',');
      try {
        await api.updateConfig({ 'LAST_SELECTED_REPOS': repoString });
      } catch (err) {
        console.error('保存仓库列表失败', err);
      }
    };
    
    // 延迟执行，避免频繁 IO
    const timer = setTimeout(() => {
      saveRepos();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [repoPaths]);

  const selectFolder = (e) => {
    const rect = e?.currentTarget?.getBoundingClientRect();
    const pos = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
    setPickerConfig({ isOpen: true, type: 'repo', initialPath: baseDir, originPos: pos });
  };

  const updateBaseDir = (e) => {
    const rect = e?.currentTarget?.getBoundingClientRect();
    const pos = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
    setPickerConfig({ isOpen: true, type: 'base', initialPath: baseDir, originPos: pos });
  };

  const handleFolderSelect = async (path) => {
    if (pickerConfig.type === 'base') {
      updateConfig('BASE_REPO_DIR', path);
    } else if (pickerConfig.type === 'repo') {
      if (!repoPaths.includes(path)) {
        const newPaths = [...repoPaths, path];
        setRepoPaths(newPaths);
        fetchAuthors(newPaths);
        fetchBranches(newPaths);
      }
    }
    setPickerConfig({ ...pickerConfig, isOpen: false });
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.getTemplates();
      setTemplates(res);
    } catch (err) {
      console.error('获取模版失败', err);
    }
  };

  const removeFolder = (path) => {
    const newPaths = repoPaths.filter(p => p !== path);
    setRepoPaths(newPaths);
    
    // 清理该仓库的选择状态
    const newSelectedBranches = { ...selectedBranches };
    delete newSelectedBranches[path];
    setSelectedBranches(newSelectedBranches);

    if (newPaths.length > 0) {
      fetchAuthors(newPaths);
      fetchBranches(newPaths);
    } else {
      setAuthors([]);
      setBranches([]);
      setSelectedBranches({});
    }
  };

  const fetchAuthors = async (paths) => {
    try {
      const res = await api.getGitAuthors(paths);
      const fetchedAuthors = res?.authors || [];
      setAuthors(fetchedAuthors);
      
      // 如果设置了默认用户，且在列表中存在，则自动选中
      if (defaultUser && fetchedAuthors.includes(defaultUser)) {
        setSelectedAuthor(defaultUser);
      }
    } catch (err) {
      console.error('获取作者列表失败', err);
      setAuthors([]);
    }
  };

  const fetchBranches = async (paths) => {
    try {
      const res = await api.getGitBranches(paths);
      setBranches(res?.branches || []);
    } catch (err) {
      console.error('获取分支列表失败', err);
      setBranches([]);
    }
  };

  const fetchLogs = async (customParams = null) => {
    // 检查是否传入了有效的自定义参数，避免将 React 事件对象误判为参数
    const hasCustomParams = customParams && customParams.repoPaths;
    
    const params = hasCustomParams ? customParams : {
      repoPaths,
      startDate,
      endDate,
      author: selectedAuthor,
      branches: selectedBranches
    };

    if (params.repoPaths.length === 0) {
      setError('请至少添加一个仓库路径');
      return;
    }
    setLoading(true);
    setError('');
    setIgnoredHashes(new Set());
    try {
      const res = await api.getGitLogs(params);
      setLogs(res.logs);
      if (res.logs.length > 0) {
        setActiveTab('viz');
        return res.logs; // 返回 logs 供链式调用
      } else {
        setError('未找到指定条件下的提交记录');
        return [];
      }
    } catch (err) {
      setError(err.message || '无法获取 Git 记录，请检查路径是否正确');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const toggleIgnore = (hash) => {
    const newIgnored = new Set(ignoredHashes);
    if (newIgnored.has(hash)) {
      newIgnored.delete(hash);
    } else {
      newIgnored.add(hash);
    }
    setIgnoredHashes(newIgnored);
  };

  const ignoreMerges = () => {
    const newIgnored = new Set(ignoredHashes);
    
    // 找出所有合并提交
    const mergeLogs = logs.filter(log => 
      log.message.toLowerCase().startsWith('merge ') || 
      log.message.toLowerCase().includes('merge branch') ||
      log.message.toLowerCase().includes('merge pull request')
    );

    if (mergeLogs.length === 0) return;

    // 检查是否所有合并提交都已经处于忽略状态
    const allMergesIgnored = mergeLogs.every(log => newIgnored.has(log.hash));

    if (allMergesIgnored) {
      // 如果全部都已忽略，则取消忽略它们
      mergeLogs.forEach(log => newIgnored.delete(log.hash));
    } else {
      // 否则，将它们全部加入忽略列表
      mergeLogs.forEach(log => newIgnored.add(log.hash));
    }
    
    setIgnoredHashes(newIgnored);
  };

  const toggleBranch = (repoPath, branch) => {
    setSelectedBranches(prev => {
      const repoSelected = prev[repoPath] || [];
      const newRepoSelected = repoSelected.includes(branch)
        ? repoSelected.filter(b => b !== branch)
        : [...repoSelected, branch];
      
      return {
        ...prev,
        [repoPath]: newRepoSelected
      };
    });
  };

  // 数据处理
  const chartData = (() => {
    const dataMap = {};
    logs.forEach(log => {
      const date = dayjs(log.date).format('MM-DD');
      dataMap[date] = (dataMap[date] || 0) + 1;
    });
    return Object.entries(dataMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  })();

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden">
      {/* 左侧固定侧边栏 - 配置区 */}
      <aside className="w-80 border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-100 shrink-0">
          <h1 className="text-xl font-bold flex items-center gap-2 text-blue-600">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm">
              <GitCommit className="text-white" size={20} />
            </div>
            <span>Git Log AI</span>
          </h1>
          <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-semibold">Smart Workflow Generator</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          <ConfigPanel 
            repoPaths={repoPaths}
            selectFolder={selectFolder}
            removeFolder={removeFolder}
            authors={authors}
            selectedAuthor={selectedAuthor}
            setSelectedAuthor={setSelectedAuthor}
            branches={branches}
            selectedBranches={selectedBranches}
            toggleBranch={toggleBranch}
            setSelectedBranches={setSelectedBranches}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            fetchLogs={fetchLogs}
            loading={loading}
            openBranchPicker={(pos) => {
              setBranchPickerOpen(true);
              setBranchPickerPos(pos);
            }}
            openSettings={(pos) => {
              setSettingsModalOpen(true);
              setSettingsModalPos(pos);
            }}
            openFoolMode={(pos) => {
              setFoolModeOpen(true);
              setFoolModePos(pos);
            }}
            apiKey={apiKey}
            baseDir={baseDir}
            defaultUser={defaultUser}
            notificationSoundEnabled={notificationSoundEnabled}
            successSound={successSound}
            failureSound={failureSound}
          />

          <LogGenerator 
            logs={logs}
            templates={templates}
            selectedTemplate={selectedTemplate}
            setSelectedTemplate={setSelectedTemplate}
            templateOptions={templateOptions}
            setTemplateOptions={setTemplateOptions}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
            referenceLog={referenceLog}
            setReferenceLog={setReferenceLog}
            generateLog={generateLog}
            loading={loading}
            openTomorrowPlanModal={(pos) => {
              setTomorrowPlanModalPos(pos);
              setTomorrowPlanModalOpen(true);
            }}
            tomorrowPlanPrompt={tomorrowPlanPrompt}
            setTomorrowPlanPrompt={setTomorrowPlanPrompt}
            openTemplatePreview={(pos) => {
              setTemplatePreviewPos(pos);
              setTemplatePreviewOpen(true);
            }}
          />
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>Version 2.1.2</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              API Connected
            </span>
          </div>
        </div>
      </aside>

      {/* 右侧主内容区 */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* 顶部状态栏 */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 z-10">
          <div className="flex items-center gap-8">
            <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button 
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'viz' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('viz')}
              >
                1. 提交分析
              </button>
              <button 
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'result' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('result')}
              >
                2. 生成结果
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
             {/* 倒计时显示 */}
             {countdown && (
               <div className="flex items-center gap-3 px-4 py-1.5 bg-blue-50 border border-blue-100 rounded-full group relative overflow-hidden">
                 <div className="flex items-center gap-2 relative z-10">
                   <Clock size={14} className="text-blue-600 animate-pulse" />
                   <div className="flex items-baseline gap-1.5">
                     <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">自动同步倒计时</span>
                     <span className="text-xs font-mono font-bold text-blue-700">{countdown}</span>
                   </div>
                 </div>
                 <div className="h-4 w-[1px] bg-blue-200 mx-1"></div>
                 <div className="text-[10px] font-bold text-blue-500 relative z-10">
                   {scheduleTime}
                 </div>
               </div>
             )}

             {loading && (
               <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
                 <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></div>
                 处理中...
               </div>
             )}
          </div>
        </header>

        {/* 内容滚动区 */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <div className="text-sm font-medium">{error}</div>
            </div>
          )}

          {logs.length === 0 && activeTab === 'viz' && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
              <div className="bg-gray-100 p-6 rounded-full mb-4">
                <GitCommit size={48} className="text-gray-300" />
              </div>
              <p className="text-lg font-medium text-gray-500">等待获取数据</p>
              <p className="text-sm mt-1">请在左侧侧边栏配置仓库并点击“获取提交记录”</p>
            </div>
          )}

          <div className="max-w-5xl mx-auto">
            {activeTab === 'viz' && logs.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CommitVisualizer 
                  logs={logs}
                  chartData={chartData}
                  ignoredHashes={ignoredHashes}
                  toggleIgnore={toggleIgnore}
                  ignoreMerges={ignoreMerges}
                />
              </div>
            )}

            {activeTab === 'result' && (
              <div className="animate-in fade-in zoom-in-95 duration-500">
                <MarkdownPreview 
                  generatedLog={generatedLog} 
                  onSyncToXuexitong={handleSyncToXuexitong}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 全局文件夹选择器 */}
      <AnimatePresence>
        {pickerConfig.isOpen && (
          <FolderPickerModal 
            isOpen={pickerConfig.isOpen}
            onClose={() => setPickerConfig({ ...pickerConfig, isOpen: false })}
            onSelect={handleFolderSelect}
            initialPath={pickerConfig.initialPath}
            title={pickerConfig.type === 'base' ? "设置基础工作目录" : "选择 Git 仓库"}
            originPos={pickerConfig.originPos}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {branchPickerOpen && (
          <BranchPickerModal 
            isOpen={branchPickerOpen}
            onClose={() => setBranchPickerOpen(false)}
            branches={branches}
            selectedBranches={selectedBranches}
            toggleBranch={toggleBranch}
            setSelectedBranches={setSelectedBranches}
            originPos={branchPickerPos}
          />
        )}
      </AnimatePresence>

      {/* 更新提醒弹窗 */}
      <AnimatePresence>
        {updateStatus !== 'idle' && updateStatus !== 'checking' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">版本更新</h3>
                    <p className="text-xs text-gray-500">发现新版本 {updateInfo?.version}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {updateStatus === 'available' && (
                    <>
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 max-h-32 overflow-y-auto">
                        <p className="font-medium mb-1">更新内容：</p>
                        <div dangerouslySetInnerHTML={{ __html: updateInfo?.releaseNotes || '优化性能与修复已知问题' }}></div>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => setUpdateStatus('idle')}
                          className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                          以后再说
                        </button>
                        <button 
                          onClick={() => window.electron.send('start-download-update')}
                          className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                        >
                          立即下载
                        </button>
                      </div>
                    </>
                  )}

                  {updateStatus === 'downloading' && (
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>正在下载更新...</span>
                        <span>{downloadProgress}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-blue-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {updateStatus === 'downloaded' && (
                    <>
                      <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        新版本已准备就绪！
                      </div>
                      <button 
                        onClick={() => window.electron.send('quit-and-install')}
                        className="w-full px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 shadow-lg shadow-green-200 transition-all"
                      >
                        重启并安装
                      </button>
                    </>
                  )}

                  {updateStatus === 'error' && (
                    <>
                      <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        更新出错: {updateError}
                      </div>
                      <button 
                        onClick={() => setUpdateStatus('idle')}
                        className="w-full px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-all"
                      >
                        关闭
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tomorrowPlanModalOpen && (
          <TomorrowPlanModal 
            isOpen={tomorrowPlanModalOpen}
            onClose={() => setTomorrowPlanModalOpen(false)}
            initialValue={tomorrowPlanPrompt}
            onSave={(val) => setTomorrowPlanPrompt(val)}
            originPos={tomorrowPlanModalPos}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {templatePreviewOpen && (
          <TemplatePreviewModal 
            isOpen={templatePreviewOpen}
            onClose={() => setTemplatePreviewOpen(false)}
            originPos={templatePreviewPos}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsModalOpen && (
            <SettingsModal 
              isOpen={settingsModalOpen}
              onClose={() => setSettingsModalOpen(false)}
              baseDir={baseDir}
              updateBaseDir={(e) => updateBaseDir(e)}
              apiKey={apiKey}
              updateApiKey={(val) => updateConfig('DEEPSEEK_API_KEY', val)}
              defaultUser={defaultUser}
              updateDefaultUser={(val) => updateConfig('DEFAULT_USER', val)}
              xuexitongUrl={xuexitongUrl}
              updateXuexitongUrl={(val) => updateConfig('XUEXITONG_NOTE_URL', val)}
              xuexitongUsername={xuexitongUsername}
              updateXuexitongUsername={(val) => updateConfig('XUEXITONG_USERNAME', val)}
              xuexitongPassword={xuexitongPassword}
                updateXuexitongPassword={(val) => updateConfig('XUEXITONG_PASSWORD', val)}
                browserPath={browserPath}
                updateBrowserPath={(val) => updateConfig('BROWSER_PATH', val)}
                notificationSoundEnabled={notificationSoundEnabled}
                updateNotificationSoundEnabled={(val) => updateConfig('NOTIFICATION_SOUND_ENABLED', val)}
                successSound={successSound}
                updateSuccessSound={(val) => updateConfig('SUCCESS_SOUND', val)}
                failureSound={failureSound}
                updateFailureSound={(val) => updateConfig('FAILURE_SOUND', val)}
                scheduleEnabled={scheduleEnabled}
                updateScheduleEnabled={(val) => updateConfig('SCHEDULE_ENABLED', val)}
                scheduleTime={scheduleTime}
                updateScheduleTime={(val) => updateConfig('SCHEDULE_TIME', val)}
                initEnv={initEnv}
                loading={loading}
              originPos={settingsModalPos}
            />
          )}

          {foolModeOpen && (
            <FoolModeModal 
              isOpen={foolModeOpen}
              onClose={() => setFoolModeOpen(false)}
              onGenerate={handleFoolModeGenerate}
              originPos={foolModePos}
            />
          )}
        </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}

export default App;
