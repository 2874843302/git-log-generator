import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  Calendar, GitCommit, FileText, Settings, 
  Download, Loader2, AlertCircle, Plus, Trash2, Folder,
  Eye, EyeOff
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

function App() {
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
  const [templateOptions, setTemplateOptions] = useState({
    includeTomorrow: true,
    includeReflections: false,
    includeProblems: true,
    includeDiffContent: false // 深度分析选项
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('config'); // config, viz, result

  useEffect(() => {
    fetchTemplates();
  }, []);

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
    setIgnoredHashes(new Set()); // 获取新记录时清空忽略列表
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
      // 过滤掉被忽略的提交
      const filteredLogs = logs.filter(log => !ignoredHashes.has(log.hash));
      
      if (filteredLogs.length === 0) {
        setError('没有可供生成的有效提交记录（所有记录已被忽略或未获取）');
        setLoading(false);
        return;
      }

      const res = await axios.post(`${API_BASE}/generate-log`, {
        logs: filteredLogs,
        repoPaths, // 传递仓库路径以便后端按需获取 diff
        templateKey: selectedTemplate,
        customPrompt: customPrompt,
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

  // 处理图表数据
  const getChartData = () => {
    const dataMap = {};
    logs.forEach(log => {
      const date = dayjs(log.date).format('MM-DD');
      dataMap[date] = (dataMap[date] || 0) + 1;
    });
    return Object.entries(dataMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const chartData = getChartData();

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
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2 text-gray-800 border-b pb-3">
                <Settings size={18} className="text-blue-500" />
                项目配置
              </h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex justify-between items-center">
                    <span>项目仓库列表</span>
                    <button 
                      onClick={selectFolder}
                      className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-xs font-semibold"
                    >
                      <Plus size={14} /> 添加仓库
                    </button>
                  </label>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {repoPaths.map((path, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 group">
                        <div className="flex items-center gap-2 min-w-0">
                          <Folder size={14} className="text-gray-400 shrink-0" />
                          <span className="text-xs text-gray-600 truncate" title={path}>
                            {path.split(/[\\/]/).pop()}
                          </span>
                        </div>
                        <button 
                          onClick={() => removeFolder(path)}
                          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {repoPaths.length === 0 && (
                      <div 
                        onClick={selectFolder}
                        className="border-2 border-dashed border-gray-200 rounded-lg py-6 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-blue-300 hover:text-blue-400 transition"
                      >
                        <Plus size={24} className="mb-1" />
                        <span className="text-xs">点击添加 Git 仓库</span>
                      </div>
                    )}
                  </div>
                </div>

                {authors.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">筛选作者</label>
                    <select 
                      className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                      value={selectedAuthor}
                      onChange={(e) => setSelectedAuthor(e.target.value)}
                    >
                      <option value="">全部作者</option>
                      {authors.map(author => (
                        <option key={author} value={author}>{author}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">开始日期</label>
                    <input 
                      type="date"
                      className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">结束日期</label>
                    <input 
                      type="date"
                      className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  onClick={fetchLogs}
                  disabled={loading || repoPaths.length === 0}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 font-medium shadow-sm"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Calendar size={18} />}
                  获取提交记录
                </button>
              </div>
            </div>

            {logs.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText size={18} />
                  日志生成
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">选择模版</label>
                    <select 
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                    >
                      {Object.keys(templates).map(key => {
                        const labels = {
                          daily: '📝 日常日报',
                          weekly: '📅 周报总结',
                          technical: '🛠️ 技术复盘',
                          release: '🚀 版本发布',
                          kpi: '🏆 绩效自述',
                          concise: '⚡ 极简汇报',
                          humorous: '☕ 程序员风'
                        };
                        return <option key={key} value={key}>{labels[key] || key}</option>;
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">包含板块</label>
                    <div className="space-y-2 bg-gray-50 p-3 rounded-md border border-gray-100">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          checked={templateOptions.includeTomorrow}
                          onChange={(e) => setTemplateOptions({...templateOptions, includeTomorrow: e.target.checked})}
                        />
                        <span className="text-sm text-gray-600 group-hover:text-gray-900 transition">明日计划</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          checked={templateOptions.includeProblems}
                          onChange={(e) => setTemplateOptions({...templateOptions, includeProblems: e.target.checked})}
                        />
                        <span className="text-sm text-gray-600 group-hover:text-gray-900 transition">遇到的问题</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          checked={templateOptions.includeReflections}
                          onChange={(e) => setTemplateOptions({...templateOptions, includeReflections: e.target.checked})}
                        />
                        <span className="text-sm text-gray-600 group-hover:text-gray-900 transition">心得收获</span>
                      </label>
                      <label 
                        className="flex items-center gap-2 cursor-pointer group relative"
                      >
                        <input 
                          type="checkbox" 
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          checked={templateOptions.includeDiffContent}
                          onChange={(e) => setTemplateOptions({...templateOptions, includeDiffContent: e.target.checked})}
                        />
                        <span className="text-sm text-gray-600 group-hover:text-gray-900 transition flex items-center gap-1">
                          深度代码分析
                          <AlertCircle size={12} className="text-gray-400" />
                        </span>

                        {/* 自定义警告提示气泡 */}
                        <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                          <p className="text-xs text-blue-600 font-bold mb-1 flex items-center gap-1">
                            <AlertCircle size={12} /> 功能说明
                          </p>
                          <p className="text-[11px] text-blue-500 leading-relaxed">
                            选择这个会产生详细的代码变更描述，内容比较多，适用于提交时描述不详细的选择并且对变更代码量有要求。
                          </p>
                          <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-blue-50" />
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">附加要求 (可选)</label>
                    <textarea 
                      placeholder="例如：请用幽默的语气，或者强调性能优化部分"
                      className="w-full p-2 border border-gray-300 rounded-md text-sm h-20 resize-none"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={generateLog}
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'AI 生成日志'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 右侧内容区 */}
          <div className="lg:col-span-3 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="mt-0.5" size={20} />
                <div>{error}</div>
              </div>
            )}

            {/* 标签页切换 */}
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

            {/* 可视化内容 */}
            {activeTab === 'viz' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-md font-semibold mb-6 text-gray-700">提交频率趋势</h3>
                  <div className="h-64 w-full">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                          <Tooltip 
                            cursor={{fill: '#f3f4f6'}} 
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                          />
                          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-400">
                        暂无数据，请先获取提交记录
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-semibold text-gray-700">提交详情 ({logs.length})</h3>
                    {ignoredHashes.size > 0 && (
                      <span className="text-xs text-gray-400">已忽略 {ignoredHashes.size} 条记录</span>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                    {logs.map((log, idx) => {
                      const isIgnored = ignoredHashes.has(log.hash);
                      return (
                        <div 
                          key={idx} 
                          className={`p-3 rounded-lg border transition ${
                            isIgnored 
                              ? 'bg-gray-100 border-gray-200 opacity-60 grayscale' 
                              : 'bg-gray-50 border-gray-100 hover:border-blue-200'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                                isIgnored ? 'bg-gray-200 text-gray-500 border-gray-300' : 'bg-blue-50 text-blue-600 border-blue-100'
                              }`}>
                                {log.hash.substring(0, 7)}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold border ${
                                isIgnored ? 'bg-gray-200 text-gray-500 border-gray-300' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              }`}>
                                {log.repoName}
                              </span>
                              {isIgnored && <span className="text-[10px] bg-gray-200 text-gray-500 px-1 rounded">已忽略</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-400">{dayjs(log.date).format('YYYY-MM-DD HH:mm')}</span>
                              <button 
                                onClick={() => toggleIgnore(log.hash)}
                                className={`p-1 rounded transition-colors ${
                                  isIgnored ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                }`}
                                title={isIgnored ? "恢复提交" : "忽略此提交"}
                              >
                                {isIgnored ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                            </div>
                          </div>
                          <p className={`text-sm font-medium ${isIgnored ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            {log.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Author: {log.author_name}</p>
                        </div>
                      );
                    })}
                    {logs.length === 0 && (
                      <div className="text-center py-8 text-gray-400">暂无提交记录</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 生成结果 */}
            {activeTab === 'result' && (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-800">AI 生成的工作日志</h3>
                  <div className="flex gap-4">
                    {generatedLog && (
                      <button 
                        onClick={() => {
                          const blob = new Blob([generatedLog], { type: 'text/markdown' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `work-log-${dayjs().format('YYYY-MM-DD')}.md`;
                          a.click();
                        }}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Download size={16} />
                        下载 Markdown
                      </button>
                    )}
                  </div>
                </div>
                
                {generatedLog ? (
                  <div 
                    className="prose prose-blue max-w-none bg-gray-50 p-6 rounded-lg border border-gray-200 font-sans text-gray-700 leading-relaxed overflow-auto"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {generatedLog}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <FileText size={48} className="mb-4 opacity-20" />
                    <p>尚未生成日志，请在左侧配置并点击“AI 生成日志”</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
