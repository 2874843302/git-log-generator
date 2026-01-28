import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from './services/api';
import dayjs from 'dayjs';
import { GitCommit, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// 导入拆分后的组件
import ConfigPanel from './components/ConfigPanel';
import LogGenerator from './components/LogGenerator';
import CommitVisualizer from './components/CommitVisualizer';
import MarkdownPreview from './components/MarkdownPreview';
import FolderPickerModal from './components/FolderPickerModal';
import BranchPickerModal from './components/BranchPickerModal';
import SupplementModal from './components/SupplementModal';
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
  const [splitIndex, setSplitIndex] = useState(null); // 分割点索引，null 表示不分割
  const [splitDateOffset1, setSplitDateOffset1] = useState(0); // 分段1的日期偏移（相对于endDate）
  const [splitDateOffset2, setSplitDateOffset2] = useState(1); // 分段2的日期偏移（相对于endDate）
  const [templates, setTemplates] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState('daily');
  const [generatedLog, setGeneratedLog] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [referenceLog, setReferenceLog] = useState('');
  const [templateOptions, setTemplateOptions] = useState({
    includeTomorrow: false,
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
  const [xuexitongLogUrl, setXuexitongLogUrl] = useState('https://note.chaoxing.com/pc/index');
  const [xuexitongUsername, setXuexitongUsername] = useState('');
  const [xuexitongPassword, setXuexitongPassword] = useState('');
  const [browserPath, setBrowserPath] = useState('');
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(true);
  const [successSound, setSuccessSound] = useState('yeah.mp3');
  const [failureSound, setFailureSound] = useState('啊咧？.mp3');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [autoLaunchEnabled, setAutoLaunchEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('18:00');
  const [titleTemplate, setTitleTemplate] = useState('');
  const [countdown, setCountdown] = useState('');
  const [pickerConfig, setPickerConfig] = useState({ isOpen: false, type: '', initialPath: '', originPos: null });
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [branchPickerPos, setBranchPickerPos] = useState({ x: '50%', y: '50%' });
  const [supplementModalOpen, setSupplementModalOpen] = useState(false);
  const [supplementModalPos, setSupplementModalPos] = useState(null);
  const [supplementPrompt, setSupplementPrompt] = useState('');
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
  const [checkingLogs, setCheckingLogs] = useState(false);
  const [missingLogDates, setMissingLogDates] = useState(null);

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
      const percent = progress?.percent;
      setDownloadProgress(typeof percent === 'number' ? Math.floor(percent) : 0);
    });

    const removeDownloadedListener = window.electron.receive('update-downloaded', () => {
      setUpdateStatus('downloaded');
    });

    const removeErrorListener = window.electron.receive('update-error', (err) => {
      setUpdateError(typeof err === 'string' ? err : (err?.message || String(err)));
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
    // 使用 encodeURIComponent 处理文件名中的特殊字符（如 ？），确保 URL 解析正确
    const audio = new Audio(`./sound/${encodeURIComponent(soundFile)}`);
    audio.play().catch(err => console.error('播放音效失败:', err));
  }, [notificationSoundEnabled, successSound, failureSound]);

  /**
   * 同步笔记到学习通
   */
  const handleSyncToXuexitong = React.useCallback(async (content, isFoolMode = false, targetDate = null, headless = false, silentNotify = false) => {
    console.log(`[Frontend] handleSyncToXuexitong 被调用, headless: ${headless}, isFoolMode: ${isFoolMode}, silentNotify: ${silentNotify}`);
    const syncDate = targetDate || endDate;
    
    // 生成同步标题
    let syncTitle = `工作日志 ${syncDate}`;
    if (titleTemplate) {
      const formattedDate = dayjs(syncDate).format('YYYYMMDD');
      const formattedDateHyphen = dayjs(syncDate).format('YYYY-MM-DD');
      const formattedDateCN = dayjs(syncDate).format('YYYY年M月D日');
      
      syncTitle = titleTemplate
        .replace(/{date}/g, formattedDate)
        .replace(/{author}/g, selectedAuthor || defaultUser || 'Unknown')
        .replace(/{repo}/g, repoPaths.length > 0 ? (repoPaths[0].split(/[/\\]/).pop() || 'MultiRepos') : 'MultiRepos');
      
      syncTitle = syncTitle.replace(/\d{4}-\d{2}-\d{2}/g, formattedDateHyphen);
      syncTitle = syncTitle.replace(/\d{4}年\d{1,2}月\d{1,2}日/g, formattedDateCN);
      syncTitle = syncTitle.replace(/20260102/g, formattedDate);
    }

    try {
      const res = await api.createXuexitongNote({
        content,
        title: syncTitle,
        headless,
        silentNotify
      });
      if (res.success) {
        if (!silentNotify) {
          playNotificationSound('success');
          api.showNotification({
            title: '同步成功',
            body: isFoolMode 
              ? `${syncDate} 的工作日志已成功同步到学习通`
              : '同步成功！笔记已保存到学习通。',
            silent: true
          });
        }
        return { success: true, date: syncDate };
      }
    } catch (err) {
      if (!silentNotify) {
        playNotificationSound('failure');
        const errorMsg = err.message || '同步失败，请检查学习通配置';
        api.showNotification({ 
          title: '同步失败', 
          body: isFoolMode 
            ? `${syncDate} 的工作日志同步失败: ${errorMsg}` 
            : errorMsg,
          silent: true
        });
      }
      console.error('Sync Error:', err);
      return { success: false, date: syncDate, error: err.message };
    }
  }, [endDate, playNotificationSound, titleTemplate, selectedAuthor, defaultUser, repoPaths]);

  const generateLog = React.useCallback(async (customLogs = null, customTemplate = null, customRepoPaths = null, customOptions = null) => {
    // 检查参数是否为 React 事件对象
    const isEvent = customLogs && customLogs.nativeEvent;
    const actualLogs = isEvent ? null : customLogs;

    setLoading(true);
    setError('');
    try {
      const targetLogs = actualLogs || logs.filter(log => !ignoredHashes.has(log.hash));
      const currentOptions = customOptions || templateOptions;
      const isSupplementEnabled = currentOptions.includeTomorrow;
      const hasSupplement = isSupplementEnabled && ((customOptions && customOptions.supplementPrompt) || supplementPrompt);
      
      if (targetLogs.length === 0 && !hasSupplement) {
        setError(isSupplementEnabled ? '没有可供生成的有效提交记录，且未填写补充内容' : '没有可供生成的有效提交记录，请开启“补充内容”并填写，或检查 Git 提交');
        setLoading(false);
        return;
      }

      console.log('开始请求 AI 生成，参数:', {
        logsCount: targetLogs.length,
        template: customTemplate || selectedTemplate,
        includeTomorrow: isSupplementEnabled,
        apiKeyPresent: !!apiKey
      });

      const res = await api.generateAiLog({
        logs: targetLogs,
        repoPaths: customRepoPaths || repoPaths,
        templateKey: customTemplate || selectedTemplate,
        customPrompt: customPrompt,
        tomorrowPlanPrompt: isSupplementEnabled ? ((customOptions && customOptions.supplementPrompt !== undefined) ? customOptions.supplementPrompt : supplementPrompt) : '',
        referenceLog: selectedTemplate === 'custom' ? referenceLog : '',
        options: currentOptions,
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
  }, [logs, ignoredHashes, selectedTemplate, repoPaths, customPrompt, supplementPrompt, referenceLog, templateOptions, apiKey]);

  /**
   * 分段生成并同步多日日志
   */
  const handleSplitGenerateAndSync = React.useCallback(async () => {
    if (splitIndex === null || logs.length === 0) return;

    setLoading(true);
    setError('');
    
    const results = [];
    try {
      // 1. 划分日志
      const part1Logs = []; // 上半部分（较新的日志，默认今日）
      const part2Logs = []; // 下半部分（较旧的日志，默认昨日）
      
      logs.forEach((log, idx) => {
        if (ignoredHashes.has(log.hash)) return;
        if (idx < splitIndex) {
          part1Logs.push(log);
        } else {
          part2Logs.push(log);
        }
      });

      // 2. 确定日期：使用自定义偏移量
      const date1 = dayjs(endDate).subtract(splitDateOffset1, 'day').format('YYYY-MM-DD');
      const date2 = dayjs(endDate).subtract(splitDateOffset2, 'day').format('YYYY-MM-DD');

      console.log(`[分段同步] 开始处理。日期1(${date1}): ${part1Logs.length}条, 日期2(${date2}): ${part2Logs.length}条`);

      // 3. 并行生成 AI 日志内容
      console.log('[分段同步] 正在并行生成 AI 日志内容...');
      const generationPromises = [];

      // 准备 Part 2 (较旧)
      if (part2Logs.length > 0) {
        const part2Options = { ...templateOptions, includeTomorrow: false };
        generationPromises.push(
          generateLog(part2Logs, selectedTemplate, repoPaths, part2Options)
            .then(content => ({ id: 'part2', content, date: date2 }))
        );
      }

      // 准备 Part 1 (较新)
      if (part1Logs.length > 0) {
        generationPromises.push(
          generateLog(part1Logs, selectedTemplate, repoPaths, templateOptions)
            .then(content => ({ id: 'part1', content, date: date1 }))
        );
      }

      const generatedContents = await Promise.all(generationPromises);
      console.log(`[分段同步] AI 内容生成完毕 (共 ${generatedContents.length} 份)`);

      // 4. 串行同步到学习通 (保持串行以避免并发冲突)
      for (const item of generatedContents) {
        if (item.content) {
          console.log(`[分段同步] 正在同步日期 ${item.date}...`);
          const result = await handleSyncToXuexitong(item.content, true, item.date, false, true); // 静默同步
          
          if (!result?.success) {
            results.push({ date: item.date, success: false, error: result?.error });
          } else {
            results.push({ date: item.date, success: true });
          }
          
          // 给同步操作留出间隔，避免过于频繁导致失败
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.warn(`[分段同步] 日期 ${item.date} 内容为空，跳过同步`);
          results.push({ date: item.date, success: false, error: 'AI 生成内容为空' });
        }
      }

      // 5. 统一通知结果
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        const failedDates = failed.map(f => f.date).join(', ');
        api.showNotification({
          title: '分段同步部分失败',
          body: `以下日期的日志同步失败: ${failedDates}。请检查网络或配置。`,
          silent: false
        });
        playNotificationSound('failure');
      } else {
        api.showNotification({
          title: '分段同步完成',
          body: '多日工作日志已分别生成并同步成功。',
          silent: false
        });
        playNotificationSound('success');
      }
      
      setSplitIndex(null); 
    } catch (err) {
      console.error('[分段同步] 出错:', err);
      setError(`分段同步失败: ${err.message}`);
      playNotificationSound('failure');
    } finally {
      setLoading(false);
    }
  }, [splitIndex, logs, ignoredHashes, endDate, splitDateOffset1, splitDateOffset2, templateOptions, selectedTemplate, repoPaths, generateLog, handleSyncToXuexitong, playNotificationSound]);

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
      const configToUpdate = { FOOL_MODE_SELECTED_REPOS: selectedRepos.join(',') };
      if (customOptions && customOptions.supplementPrompt !== undefined) {
        configToUpdate.SUPPLEMENT_PROMPT = customOptions.supplementPrompt;
        setSupplementPrompt(customOptions.supplementPrompt);
      }
      await api.updateConfig(configToUpdate);
      setFoolModeRepos(selectedRepos);
    } catch (err) {
      console.error('[傻瓜模式] 保存仓库配置失败:', err);
    }

    // 2. 获取日志
    console.log('[傻瓜模式] 正在获取 Git 日志...', { today, author: defaultUser, selectedRepos });
    
    setLoading(true);
    setError('');
    try {
      let fetchedLogs = [];
      if (selectedRepos && selectedRepos.length > 0) {
        const fetchedLogsRes = await api.getGitLogs({
          repoPaths: selectedRepos,
          startDate: today,
          endDate: today,
          author: defaultUser,
          branches: {}
        });
        fetchedLogs = fetchedLogsRes?.logs || [];
        setLogs(fetchedLogs);
      } else {
        setLogs([]);
      }

      const foolModeOptions = customOptions || {
        includeTomorrow: true,
        includeReflections: false,
        includeProblems: false,
        includeDiffContent: false
      };

      const isSupplementEnabled = foolModeOptions.includeTomorrow;
      const hasSupplement = isSupplementEnabled && ((customOptions && customOptions.supplementPrompt) || supplementPrompt);

      // 3. 如果有日志或有补充内容，调用 AI 生成
      if (fetchedLogs.length > 0 || hasSupplement) {
        console.log(`[傻瓜模式] 准备调用 AI 生成 (日志: ${fetchedLogs.length}条, 补充内容开启: ${isSupplementEnabled})`);
        
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
        console.warn('[傻瓜模式] 未获取到任何日志记录且无补充内容，任务结束');
        api.showNotification({
          title: '定时任务跳过',
          body: `${today} 未发现 Git 提交记录且未填写补充内容，无需生成。`,
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
  const handleCheckLogs = async () => {
    if (checkingLogs) return;
    
    setCheckingLogs(true);
    setMissingLogDates(null);
    
    try {
      // 使用无头模式在后台检查
      const res = await api.checkXuexitongLogs({ headless: true });
      if (res.success) {
        setMissingLogDates(res.missingDates);
        if (res.missingDates.length === 0) {
          api.showNotification({
            title: '日志检查完成',
            body: '本周的工作日日志均已同步，太棒了！',
            silent: false
          });
          playNotificationSound('success');
        } else {
          api.showNotification({
            title: '发现缺失日志',
            body: `本周工作日中，有 ${res.missingDates.length} 天未发现日志：${res.missingDates.join(', ')}`,
            silent: false
          });
          playNotificationSound('failure');
        }
      }
    } catch (err) {
      console.error('检查日志失败:', err);
      api.showNotification({
        title: '检查失败',
        body: err.message || '无法连接学习通或检查过程中出错',
        silent: false
      });
      playNotificationSound('failure');
    } finally {
      setCheckingLogs(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await api.getConfig();
      // 无论是否有值都进行设置，确保与文件同步
      setBaseDir(res.BASE_REPO_DIR || '');
      setApiKey(res.DEEPSEEK_API_KEY || '');
      setDefaultUser(res.DEFAULT_USER || '');
      setXuexitongUrl(res.XUEXITONG_NOTE_URL || 'https://note.chaoxing.com/pc/index');
      setXuexitongLogUrl(res.XUEXITONG_LOG_CHECK_URL || res.XUEXITONG_NOTE_URL || 'https://note.chaoxing.com/pc/index');
      setXuexitongUsername(res.XUEXITONG_USERNAME || '');
      setXuexitongPassword(res.XUEXITONG_PASSWORD || '');
      setBrowserPath(res.BROWSER_PATH || '');
      setNotificationSoundEnabled(res.NOTIFICATION_SOUND_ENABLED === 'true' || res.NOTIFICATION_SOUND_ENABLED === true);
      
      // 兼容旧版本的默认音效文件名
      const sSound = res.SUCCESS_SOUND === 'success.mp3' ? 'yeah.mp3' : (res.SUCCESS_SOUND || 'yeah.mp3');
      const fSound = res.FAILURE_SOUND === 'failure.mp3' ? '啊咧？.mp3' : (res.FAILURE_SOUND || '啊咧？.mp3');
      setSuccessSound(sSound);
      setFailureSound(fSound);
      
      setScheduleEnabled(res.SCHEDULE_ENABLED === 'true' || res.SCHEDULE_ENABLED === true);
      setScheduleTime(res.SCHEDULE_TIME || '18:00');
      setTitleTemplate(res.TITLE_TEMPLATE || '');
      
      // 加载补充内容
      if (res.SUPPLEMENT_PROMPT) {
        setSupplementPrompt(res.SUPPLEMENT_PROMPT);
      }
      
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

      // 获取开机自启状态
      const autoLaunch = await api.getAutoLaunch();
      setAutoLaunchEnabled(autoLaunch);
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
      if (key === 'XUEXITONG_LOG_CHECK_URL') setXuexitongLogUrl(value);
      if (key === 'XUEXITONG_USERNAME') setXuexitongUsername(value);
      if (key === 'XUEXITONG_PASSWORD') setXuexitongPassword(value);
      if (key === 'BROWSER_PATH') setBrowserPath(value);
      if (key === 'NOTIFICATION_SOUND_ENABLED') setNotificationSoundEnabled(value === 'true' || value === true);
      if (key === 'SUCCESS_SOUND') setSuccessSound(value);
      if (key === 'FAILURE_SOUND') setFailureSound(value);
      if (key === 'SCHEDULE_ENABLED') setScheduleEnabled(value === 'true' || value === true);
      if (key === 'SCHEDULE_TIME') setScheduleTime(value);
      if (key === 'TITLE_TEMPLATE') setTitleTemplate(value);
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

  const updateAutoLaunchEnabled = async (enable) => {
    try {
      const success = await api.setAutoLaunch(enable);
      if (success) {
        setAutoLaunchEnabled(enable);
      }
    } catch (err) {
      console.error('更新开机自启失败', err);
    }
  };

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
            checkLogs={handleCheckLogs}
            checkingLogs={checkingLogs}
            missingLogDates={missingLogDates}
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
            xuexitongLogUrl={xuexitongLogUrl}
            updateXuexitongLogUrl={(val) => updateConfig('XUEXITONG_LOG_CHECK_URL', val)}
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
                  generateLog={splitIndex !== null ? handleSplitGenerateAndSync : generateLog}
                  loading={loading}
            openSupplementModal={(pos) => {
              setSupplementModalPos(pos);
              setSupplementModalOpen(true);
            }}
            supplementPrompt={supplementPrompt}
            setSupplementPrompt={setSupplementPrompt}
            openTemplatePreview={(pos) => {
              setTemplatePreviewPos(pos);
              setTemplatePreviewOpen(true);
            }}
            splitIndex={splitIndex}
          />
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <div className="flex items-center gap-2">
                  <span>Version 2.3.0</span>
                  <button 
                    onClick={() => window.electron.send('check-for-update')}
                className="hover:text-blue-500 transition-colors cursor-pointer"
                title="检查更新"
              >
                <RefreshCw size={10} className={updateStatus === 'checking' ? 'animate-spin' : ''} />
              </button>
            </div>
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
                    splitIndex={splitIndex}
                    setSplitIndex={setSplitIndex}
                    endDate={endDate}
                    splitDateOffset1={splitDateOffset1}
                    setSplitDateOffset1={setSplitDateOffset1}
                    splitDateOffset2={splitDateOffset2}
                    setSplitDateOffset2={setSplitDateOffset2}
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
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
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
                    <p className="text-xs text-gray-500">发现新版本 {updateInfo?.version || '未知'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {updateStatus === 'available' && (
                    <>
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 max-h-32 overflow-y-auto">
                        <p className="font-medium mb-1">更新内容：</p>
                        <div dangerouslySetInnerHTML={{ 
                          __html: Array.isArray(updateInfo?.releaseNotes) 
                            ? updateInfo.releaseNotes.map(n => typeof n === 'string' ? n : (n?.note || '')).filter(Boolean).join('<br/>')
                            : (typeof updateInfo?.releaseNotes === 'string' ? updateInfo.releaseNotes : '优化性能与修复已知问题')
                        }}></div>
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
                      <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm space-y-2">
                        <div className="flex items-center gap-2 font-medium">
                          <AlertCircle className="w-4 h-4" />
                          更新失败
                        </div>
                        <p className="text-xs opacity-80">{updateError}</p>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => setUpdateStatus('idle')}
                          className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                          关闭
                        </button>
                        <button 
                          onClick={() => {
                            setUpdateStatus('checking');
                            window.electron.send('check-for-update');
                          }}
                          className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                        >
                          重试
                        </button>
                      </div>
                      <p className="text-[10px] text-center text-gray-400">
                        如果持续失败，请前往 <a href="https://github.com/2874843302/git-log-generator/releases" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">GitHub Releases</a> 手动下载
                      </p>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {supplementModalOpen && (
          <SupplementModal 
            isOpen={supplementModalOpen}
            onClose={() => setSupplementModalOpen(false)}
            initialValue={supplementPrompt}
            onSave={(val) => setSupplementPrompt(val)}
            originPos={supplementModalPos}
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
                titleTemplate={titleTemplate}
                updateTitleTemplate={(val) => updateConfig('TITLE_TEMPLATE', val)}
                initEnv={initEnv}
                loading={loading}
              originPos={settingsModalPos}
              autoLaunchEnabled={autoLaunchEnabled}
              updateAutoLaunchEnabled={updateAutoLaunchEnabled}
              xuexitongLogUrl={xuexitongLogUrl}
              updateXuexitongLogUrl={(val) => updateConfig('XUEXITONG_LOG_CHECK_URL', val)}
            />
          )}

          {foolModeOpen && (
            <FoolModeModal 
              isOpen={foolModeOpen}
              onClose={() => setFoolModeOpen(false)}
              onGenerate={handleFoolModeGenerate}
              onReposChange={setFoolModeRepos}
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
