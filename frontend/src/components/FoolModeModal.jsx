import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Check, Loader2, AlertCircle, Github, Search, Calendar } from 'lucide-react';
import axios from 'axios';
import dayjs from 'dayjs';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

const FoolModeModal = ({ isOpen, onClose, onGenerate, originPos }) => {
  const [repos, setRepos] = useState([]);
  const [selectedRepos, setSelectedRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));

  useEffect(() => {
    if (isOpen) {
      fetchRepos();
    }
  }, [isOpen]);

  const fetchRepos = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE}/git-repos`);
      setRepos(res.data.repos);
      // 默认全选
      setSelectedRepos(res.data.repos.map(r => r.path));
    } catch (err) {
      setError(err.response?.data?.error || '无法获取仓库列表，请检查基础目录配置');
    } finally {
      setLoading(false);
    }
  };

  const toggleRepo = (path) => {
    setSelectedRepos(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const filteredRepos = repos.filter(repo => 
    repo.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
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
        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
      >
        {/* 顶部标题装饰 */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
            <Zap size={120} />
          </div>
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-xl border border-white/30 shadow-inner">
                <Zap size={28} className="text-blue-100 fill-blue-100" />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight">傻瓜模式</h3>
                <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1 opacity-80">一键扫描 · 自动生成 · 极速出片</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-all active:scale-90"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <Loader2 size={48} className="text-blue-500 animate-spin" />
                <Zap size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-400" />
              </div>
              <p className="text-gray-400 text-sm font-bold animate-pulse">正在扫描基础目录下的 Git 仓库...</p>
            </div>
          ) : error ? (
            <div className="py-12 px-6 bg-red-50 rounded-3xl border border-red-100 flex flex-col items-center gap-4 text-center">
              <div className="p-3 bg-red-100 rounded-2xl text-red-500">
                <AlertCircle size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="text-red-900 font-bold">扫描失败</h4>
                <p className="text-red-600 text-xs leading-relaxed max-w-xs">{error}</p>
              </div>
              <button 
                onClick={onClose}
                className="mt-2 px-6 py-2 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 transition-colors"
              >
                返回修改配置
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 搜索、日期和统计 */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex flex-1 gap-3 w-full sm:w-auto">
                  <div className="relative flex-1">
                    <input 
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="搜索仓库名称..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 outline-none transition-all"
                    />
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                  <div className="relative w-40">
                    <input 
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 outline-none transition-all appearance-none"
                    />
                    <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold shrink-0">
                  <span className="text-gray-400">已选 <span className="text-blue-600">{selectedRepos.length}</span> / {repos.length}</span>
                  <button 
                    onClick={() => setSelectedRepos(selectedRepos.length === repos.length ? [] : repos.map(r => r.path))}
                    className="text-blue-500 hover:text-blue-600 underline decoration-2 underline-offset-4"
                  >
                    {selectedRepos.length === repos.length ? '取消全选' : '全选所有'}
                  </button>
                </div>
              </div>

              {/* 仓库列表网格 */}
              <div className="max-h-72 overflow-y-auto custom-scrollbar px-2 py-2 -mx-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredRepos.map((repo) => (
                  <motion.div
                    key={repo.path}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleRepo(repo.path)}
                    className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${
                      selectedRepos.includes(repo.path)
                        ? 'bg-blue-50 border-blue-500 shadow-lg shadow-blue-500/10'
                        : 'bg-white border-gray-100 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-xl transition-colors ${
                        selectedRepos.includes(repo.path) ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-500'
                      }`}>
                        <Github size={16} />
                      </div>
                      <span className={`text-xs font-bold truncate ${
                        selectedRepos.includes(repo.path) ? 'text-blue-900' : 'text-gray-600'
                      }`}>
                        {repo.name}
                      </span>
                    </div>
                    {selectedRepos.includes(repo.path) && (
                      <div className="bg-blue-500 text-white rounded-full p-0.5">
                        <Check size={12} strokeWidth={4} />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* 操作按钮 */}
              <div className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    disabled={selectedRepos.length === 0}
                    onClick={() => onGenerate(selectedRepos, 'concise', selectedDate)}
                    className={`py-4 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                      selectedRepos.length === 0
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 shadow-lg shadow-blue-500/10'
                    }`}
                  >
                    <Zap size={16} className="fill-blue-600" />
                    立即生成极简日志
                  </button>
                  <button
                    disabled={selectedRepos.length === 0}
                    onClick={() => onGenerate(selectedRepos, 'daily', selectedDate)}
                    className={`py-4 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                      selectedRepos.length === 0
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5'
                    }`}
                  >
                    <Zap size={16} className="fill-white" />
                    立即生成普通日报
                  </button>
                </div>
                <p className="text-center text-[10px] text-gray-400 mt-4 font-medium">
                  点击后将自动：<span className="text-gray-600">设置今日日期</span> → <span className="text-gray-600">选中默认用户</span> → <span className="text-gray-600">提取代码变更</span> → <span className="text-gray-600">AI 生成报告</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default FoolModeModal;
