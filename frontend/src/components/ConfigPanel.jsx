import React, { useState, useRef, useEffect } from 'react';
import { Settings, Plus, Folder, Trash2, Calendar, Loader2, GitBranch, ChevronRight, Key, Eye, EyeOff, Save, User, Check, RefreshCw, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ConfigPanel = ({ 
  repoPaths, 
  selectFolder, 
  removeFolder, 
  authors, 
  selectedAuthor, 
  setSelectedAuthor, 
  branches,
  selectedBranches,
  toggleBranch,
  setSelectedBranches,
  startDate, 
  setStartDate, 
  endDate, 
  setEndDate, 
  fetchLogs, 
  loading,
  openBranchPicker,
  openSettings,
  openFoolMode,
  apiKey,
  baseDir,
  defaultUser
}) => {

  const [authorDropdownOpen, setAuthorDropdownOpen] = useState(false);
  const authorDropdownRef = useRef(null);

  // 检查是否已完成所有关键全局配置 (API Key, 基础目录, 默认用户)
  const isConfigComplete = apiKey && baseDir && defaultUser;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (authorDropdownRef.current && !authorDropdownRef.current.contains(event.target)) {
        setAuthorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSelectedBranchesCount = () => {
    return Object.values(selectedBranches).reduce((acc, curr) => acc + curr.length, 0);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      {/* 傻瓜模式入口 - 仅在配置完成后显示 */}
      <AnimatePresence>
        {isConfigComplete && (
          <motion.section 
            initial={{ opacity: 0, height: 0, mb: 0 }}
            animate={{ opacity: 1, height: 'auto', mb: 24 }}
            exit={{ opacity: 0, height: 0, mb: 0 }}
            className="overflow-hidden"
          >
            <button
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  openFoolMode({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                }}
                className="w-full group relative flex items-center gap-3 p-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all active:scale-[0.98] border border-white/10"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                  <Zap size={40} className="text-white" />
                </div>
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md border border-white/30">
                  <Zap size={18} className="text-white fill-white" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-white tracking-tight">傻瓜模式</p>
                  <p className="text-[9px] text-blue-100/80 font-bold uppercase">一键生成今日简报</p>
                </div>
              </button>
          </motion.section>
        )}
      </AnimatePresence>

      {/* 基础配置区 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
            <Folder size={14} />
            <span>项目仓库</span>
          </div>
          <button 
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              openSettings({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
            }}
            className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-all border border-blue-100"
            title="全局设置"
          >
            <Settings size={10} />
            全局设置
          </button>
        </div>
        
        <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-semibold text-gray-500">已添加仓库</label>
              <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md">{repoPaths.length} 个</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
              {repoPaths.map((path, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200 group hover:border-blue-200 transition-all shadow-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                    <span className="text-[11px] text-gray-700 truncate font-medium">
                      {path.replace(/[\\/]$/, '').split(/[\\/]/).pop()}
                    </span>
                  </div>
                  <button 
                    onClick={() => removeFolder(path)}
                    className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button 
                onClick={selectFolder}
                className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center gap-2 text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all text-[11px] font-bold"
              >
                <Plus size={14} /> 添加新仓库
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 筛选条件区 */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
          <Calendar size={14} />
          <span>筛选与分支</span>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-400 mb-1 block">开始日期</label>
              <input 
                type="date"
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:ring-2 focus:ring-blue-500/20 outline-none bg-white shadow-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 mb-1 block">结束日期</label>
              <input 
                type="date"
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:ring-2 focus:ring-blue-500/20 outline-none bg-white shadow-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {authors.length > 0 && (
            <div className="animate-in fade-in slide-in-from-top-1" ref={authorDropdownRef}>
              <label className="text-[10px] font-bold text-gray-400 mb-1.5 block uppercase tracking-wider">分析作者</label>
              <div className="relative">
                <button 
                  onClick={() => setAuthorDropdownOpen(!authorDropdownOpen)}
                  className={`w-full flex items-center justify-between pl-3 pr-3 py-2.5 text-[11px] font-bold border rounded-xl outline-none bg-white shadow-sm transition-all hover:border-blue-300 active:scale-[0.98] ${
                    authorDropdownOpen ? 'border-blue-400 ring-4 ring-blue-500/5' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <User size={14} className="text-blue-500 shrink-0" />
                    <span className="truncate">{selectedAuthor || '全部活跃作者'}</span>
                  </div>
                  <ChevronRight size={14} className={`text-gray-400 transition-transform duration-300 ${authorDropdownOpen ? 'rotate-90' : 'rotate-0'}`} />
                </button>

                <AnimatePresence>
                  {authorDropdownOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 4, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute z-[60] w-full bg-white border border-gray-100 rounded-2xl shadow-2xl shadow-blue-900/10 overflow-hidden p-1.5"
                    >
                      <button
                        onClick={() => {
                          setSelectedAuthor('');
                          setAuthorDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                          selectedAuthor === '' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <User size={14} />
                          <span>全部活跃作者</span>
                        </div>
                        {selectedAuthor === '' && <Check size={14} />}
                      </button>
                      
                      <div className="h-px bg-gray-50 my-1 mx-2" />
                      
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {authors.map(author => (
                          <button
                            key={author}
                            onClick={() => {
                              setSelectedAuthor(author);
                              setAuthorDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                              selectedAuthor === author ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'
                            }`}
                          >
                            <span className="truncate">{author}</span>
                            {selectedAuthor === author && <Check size={14} />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {branches.length > 0 && (
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-400 block border-b border-gray-100 pb-1 uppercase">
                分支配置
              </label>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                  };
                  console.log('Opening branch picker at:', pos);
                  openBranchPicker(pos);
                }}
                className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all group relative z-10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <GitBranch size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-bold text-gray-700">选择分析分支</p>
                    <p className="text-[10px] text-gray-400 font-medium">已选 {getSelectedBranchesCount()} 个分支</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
              </button>

              {getSelectedBranchesCount() > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(selectedBranches).map(([path, repoBranches]) => (
                    repoBranches.map(branch => (
                      <div 
                        key={`${path}-${branch}`}
                        className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-md text-[9px] font-bold"
                      >
                        {branch}
                      </div>
                    ))
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="pt-2 sticky bottom-0 bg-white">
        <button 
          onClick={fetchLogs}
          disabled={loading || repoPaths.length === 0}
          className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98]"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Calendar size={18} />}
          获取提交记录
        </button>
      </div>
    </div>
  );
};

export default ConfigPanel;
