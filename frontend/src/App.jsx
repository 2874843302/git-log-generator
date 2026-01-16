import React, { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { GitCommit, AlertCircle } from 'lucide-react';

// 导入拆分后的组件
import ConfigPanel from './components/ConfigPanel';
import LogGenerator from './components/LogGenerator';
import CommitVisualizer from './components/CommitVisualizer';
import MarkdownPreview from './components/MarkdownPreview';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

function App() {
  // 状态管理
  const [repoPaths, setRepoPaths] = useState([]);
  const [startDate, setStartDate] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [authors, setAuthors] = useState([]);
  const [selectedAuthor, setSelectedAuthor] = useState('');
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

  useEffect(() => {
    fetchTemplates();
  }, []);

  // API 调用逻辑
  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API_BASE}/templates`);
      setTemplates(res.data);
    } catch (err) {
      console.error('获取模版失败', err);
    }
  };

  const selectFolder = async () => {
    try {
      const res = await axios.get(`${API_BASE}/select-folder`);
      if (res.data.path && !repoPaths.includes(res.data.path)) {
        const newPaths = [...repoPaths, res.data.path];
        setRepoPaths(newPaths);
        fetchAuthors(newPaths);
      }
    } catch (err) {
      setError('无法打开文件夹选择器');
    }
  };

  const removeFolder = (path) => {
    const newPaths = repoPaths.filter(p => p !== path);
    setRepoPaths(newPaths);
    if (newPaths.length > 0) {
      fetchAuthors(newPaths);
    } else {
      setAuthors([]);
    }
  };

  const fetchAuthors = async (paths) => {
    try {
      const res = await axios.post(`${API_BASE}/git-authors`, { repoPaths: paths });
      setAuthors(res.data.authors);
    } catch (err) {
      console.error('获取作者列表失败', err);
    }
  };

  const fetchLogs = async () => {
    if (repoPaths.length === 0) {
      setError('请至少添加一个仓库路径');
      return;
    }
    setLoading(true);
    setError('');
    setIgnoredHashes(new Set());
    try {
      const res = await axios.post(`${API_BASE}/git-logs`, {
        repoPaths,
        startDate,
        endDate,
        author: selectedAuthor
      });
      setLogs(res.data.logs);
      if (res.data.logs.length > 0) {
        setActiveTab('viz');
      } else {
        setError('未找到指定条件下的提交记录');
      }
    } catch (err) {
      setError(err.response?.data?.error || '无法获取 Git 记录，请检查路径是否正确');
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

  const generateLog = async () => {
    setLoading(true);
    setError('');
    try {
      const filteredLogs = logs.filter(log => !ignoredHashes.has(log.hash));
      if (filteredLogs.length === 0) {
        setError('没有可供生成的有效提交记录（所有记录已被忽略或未获取）');
        setLoading(false);
        return;
      }

      const res = await axios.post(`${API_BASE}/generate-log`, {
        logs: filteredLogs,
        repoPaths,
        templateKey: selectedTemplate,
        customPrompt: customPrompt,
        referenceLog: selectedTemplate === 'custom' ? referenceLog : '',
        options: templateOptions
      });
      setGeneratedLog(res.data.content);
      setActiveTab('result');
    } catch (err) {
      setError(err.response?.data?.error || '生成日志失败，请检查 API 配置');
    } finally {
      setLoading(false);
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
    <div className="min-h-screen p-4 md:p-8 bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <GitCommit className="text-white" size={28} />
              </div>
              Git 工作日志生成器
            </h1>
            <p className="text-gray-500 mt-2 ml-1">将您的 Git 提交记录转化为专业的 AI 工作日志</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* 左侧配置栏 */}
          <div className="lg:col-span-1 space-y-6">
            <ConfigPanel 
              repoPaths={repoPaths}
              selectFolder={selectFolder}
              removeFolder={removeFolder}
              authors={authors}
              selectedAuthor={selectedAuthor}
              setSelectedAuthor={setSelectedAuthor}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              fetchLogs={fetchLogs}
              loading={loading}
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
            />
          </div>

          {/* 右侧内容区 */}
          <div className="lg:col-span-3 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="mt-0.5" size={20} />
                <div>{error}</div>
              </div>
            )}

            <div className="flex border-b border-gray-200">
              <button 
                className={`px-6 py-3 font-medium transition ${activeTab === 'viz' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('viz')}
              >
                数据可视化
              </button>
              <button 
                className={`px-6 py-3 font-medium transition ${activeTab === 'result' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('result')}
              >
                生成的日志
              </button>
            </div>

            {activeTab === 'viz' && (
              <CommitVisualizer 
                logs={logs}
                chartData={chartData}
                ignoredHashes={ignoredHashes}
                toggleIgnore={toggleIgnore}
              />
            )}

            {activeTab === 'result' && (
              <MarkdownPreview generatedLog={generatedLog} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
