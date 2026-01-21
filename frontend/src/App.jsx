import React, { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { GitCommit, AlertCircle } from 'lucide-react';
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

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

function App() {
  // 状态管理
  const [repoPaths, setRepoPaths] = useState([]);
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

  useEffect(() => {
    fetchTemplates();
    fetchConfig();
  }, []);

  // 当默认用户或作者列表变化时，自动选中默认用户
  useEffect(() => {
    if (defaultUser && authors.includes(defaultUser)) {
      setSelectedAuthor(defaultUser);
    }
  }, [defaultUser, authors]);

  // API 调用逻辑
  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE}/config`);
      // 无论是否有值都进行设置，确保与文件同步
      setBaseDir(res.data.BASE_REPO_DIR || '');
      setApiKey(res.data.DEEPSEEK_API_KEY || '');
      setDefaultUser(res.data.DEFAULT_USER || '');
      setXuexitongUrl(res.data.XUEXITONG_NOTE_URL || 'https://note.chaoxing.com/pc/index');
      setXuexitongUsername(res.data.XUEXITONG_USERNAME || '');
      setXuexitongPassword(res.data.XUEXITONG_PASSWORD || '');
    } catch (err) {
      console.error('获取配置信息失败', err);
    }
  };

  const initEnv = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE}/init-env`);
      alert(res.data.message + '\n' + res.data.details.join('\n'));
      fetchConfig(); // 重新加载配置
    } catch (err) {
      setError(err.response?.data?.message || '初始化环境失败');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (key, value) => {
    try {
      await axios.post(`${API_BASE}/config`, { key, value });
      if (key === 'BASE_REPO_DIR') setBaseDir(value);
      if (key === 'DEEPSEEK_API_KEY') setApiKey(value);
      if (key === 'DEFAULT_USER') setDefaultUser(value);
      if (key === 'XUEXITONG_NOTE_URL') setXuexitongUrl(value);
      if (key === 'XUEXITONG_USERNAME') setXuexitongUsername(value);
      if (key === 'XUEXITONG_PASSWORD') setXuexitongPassword(value);
    } catch (err) {
      setError(`更新配置 ${key} 失败`);
    }
  };

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
      const res = await axios.get(`${API_BASE}/templates`);
      setTemplates(res.data);
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
      const res = await axios.post(`${API_BASE}/git-authors`, { repoPaths: paths });
      const fetchedAuthors = res.data.authors;
      setAuthors(fetchedAuthors);
      
      // 如果设置了默认用户，且在列表中存在，则自动选中
      if (defaultUser && fetchedAuthors.includes(defaultUser)) {
        setSelectedAuthor(defaultUser);
      }
    } catch (err) {
      console.error('获取作者列表失败', err);
    }
  };

  const fetchBranches = async (paths) => {
    try {
      const res = await axios.post(`${API_BASE}/git-branches`, { repoPaths: paths });
      setBranches(res.data.branches);
    } catch (err) {
      console.error('获取分支列表失败', err);
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
      const res = await axios.post(`${API_BASE}/git-logs`, params);
      setLogs(res.data.logs);
      if (res.data.logs.length > 0) {
        setActiveTab('viz');
        return res.data.logs; // 返回 logs 供链式调用
      } else {
        setError('未找到指定条件下的提交记录');
        return [];
      }
    } catch (err) {
      setError(err.response?.data?.error || '无法获取 Git 记录，请检查路径是否正确');
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

  const generateLog = async (customLogs = null, customTemplate = null, customRepoPaths = null, customOptions = null) => {
    setLoading(true);
    setError('');
    try {
      const targetLogs = customLogs || logs.filter(log => !ignoredHashes.has(log.hash));
      if (targetLogs.length === 0) {
        setError('没有可供生成的有效提交记录（所有记录已被忽略或未获取）');
        setLoading(false);
        return;
      }

      const res = await axios.post(`${API_BASE}/generate-log`, {
        logs: targetLogs,
        repoPaths: customRepoPaths || repoPaths,
        templateKey: customTemplate || selectedTemplate,
        customPrompt: customPrompt,
        tomorrowPlanPrompt: tomorrowPlanPrompt,
        referenceLog: selectedTemplate === 'custom' ? referenceLog : '',
        options: customOptions || templateOptions
      });
      setGeneratedLog(res.data.content);
      setActiveTab('result');
    } catch (err) {
      setError(err.response?.data?.error || '生成日志失败，请检查 API 配置');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 傻瓜模式一键生成逻辑
   */
  const handleFoolModeGenerate = async (selectedRepos, templateKey = 'concise', targetDate = null) => {
    setFoolModeOpen(false);
    
    // 1. 设置基础状态
    const today = targetDate || dayjs().format('YYYY-MM-DD');
    setStartDate(today);
    setEndDate(today);
    setRepoPaths(selectedRepos);
    setSelectedAuthor(defaultUser);
    setSelectedTemplate(templateKey);

    // 2. 获取日志
    const fetchedLogs = await fetchLogs({
      repoPaths: selectedRepos,
      startDate: today,
      endDate: today,
      author: defaultUser,
      branches: {} // 傻瓜模式默认不限分支
    });

    // 3. 如果有日志，根据指定的模版生成报告 (傻瓜模式禁用所有附加板块)
    if (fetchedLogs && fetchedLogs.length > 0) {
      const foolModeOptions = {
        includeTomorrow: false,
        includeReflections: false,
        includeProblems: false,
        includeDiffContent: false
      };
      await generateLog(fetchedLogs, templateKey, selectedRepos, foolModeOptions);
    }
  };

  /**
   * 同步笔记到学习通
   */
  const handleSyncToXuexitong = async (content) => {
    try {
      const res = await axios.post(`${API_BASE}/create-note`, {
        content,
        title: `工作日志 ${dayjs().format('YYYY-MM-DD')}`
      });
      if (res.data.success) {
        alert('同步成功！笔记已保存到学习通。');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || '同步失败，请检查后端服务和学习通配置';
      alert(errorMsg);
      console.error('Sync Error:', err);
    }
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
            <span>Version 2.0.0</span>
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

      <style jsx global>{`
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
