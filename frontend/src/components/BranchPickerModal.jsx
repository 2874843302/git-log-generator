import React, { useMemo, useState, useRef } from 'react';
import { X, GitBranch, Check, Layers, Info, ChevronDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 子弹窗：显示全部分支并支持搜索和排序
const AllBranchesModal = ({ repo, selectedBranches, toggleBranch, onClose }) => {
  const [search, setSearch] = useState('');
  
  // 按 ASCII 码排序所有分支
  const sortedBranches = useMemo(() => {
    return [...repo.branches].sort((a, b) => a.localeCompare(b));
  }, [repo.branches]);

  const filteredBranches = useMemo(() => {
    if (!search) return sortedBranches;
    return sortedBranches.filter(b => b.toLowerCase().includes(search.toLowerCase()));
  }, [sortedBranches, search]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] overflow-hidden border border-gray-100"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Layers size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">{repo.repoName}</h4>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">全部分支列表 ({repo.branches.length})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="p-4 bg-gray-50/50 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text"
              placeholder="搜索分支..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-1">
          {filteredBranches.map(branch => {
            const isSelected = (selectedBranches[repo.path] || []).includes(branch);
            return (
              <button
                key={branch}
                onClick={() => toggleBranch(repo.path, branch)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isSelected 
                    ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                    : 'bg-white border-transparent hover:bg-gray-50 text-gray-600'
                }`}
              >
                <span className="text-[11px] font-bold truncate pr-2 font-mono">{branch}</span>
                {isSelected && <Check size={14} className="shrink-0" />}
              </button>
            );
          })}
          {filteredBranches.length === 0 && (
            <div className="py-8 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
              未找到匹配的分支
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-50 text-center shrink-0">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-gray-900 text-white text-xs font-black rounded-2xl hover:bg-gray-800 transition-all active:scale-[0.98]"
          >
            返回
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const BranchPickerModal = ({ 
  isOpen, 
  onClose, 
  branches, 
  selectedBranches, 
  toggleBranch, 
  setSelectedBranches,
  originPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}) => {
  const [activeFullRepo, setActiveFullRepo] = useState(null);
  const scrollContainerRef = useRef(null);

  // 计算点击位置相对于屏幕中心的偏移量
  const offset = useMemo(() => {
    return {
      x: originPos.x - window.innerWidth / 2,
      y: originPos.y - window.innerHeight / 2
    };
  }, [originPos]);

  const handleSelectAllForRepo = (repoPath, repoBranches) => {
    const isAllSelected = (selectedBranches[repoPath] || []).length === repoBranches.length;
    setSelectedBranches(prev => ({
      ...prev,
      [repoPath]: isAllSelected ? [] : [...repoBranches]
    }));
  };

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const columnWidth = 320; // w-80 is 320px
      const gap = 24; // gap-6 is 24px
      const scrollAmount = columnWidth + gap;
      
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 overflow-hidden">
      {/* 背景遮罩 */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* 模态框主体 */}
      <motion.div 
        initial={{ 
          opacity: 0, 
          scale: 0.2, 
          x: offset.x, 
          y: offset.y,
          filter: 'blur(10px)'
        }}
        animate={{ 
          opacity: 1, 
          scale: 1, 
          x: 0, 
          y: 0,
          filter: 'blur(0px)'
        }}
        exit={{ 
          opacity: 0, 
          scale: 0.2, 
          x: offset.x, 
          y: offset.y,
          filter: 'blur(10px)'
        }}
        transition={{ 
          type: "spring", 
          damping: 25, 
          stiffness: 350,
          mass: 0.8
        }}
        className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-6xl flex flex-col max-h-[85vh] overflow-hidden border border-gray-100"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <GitBranch size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-800 uppercase tracking-widest leading-tight">
                配置项目分支
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Multi-Repo Branch Selector</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/30 relative group/modal">
          {/* Top Info Bar */}
          <div className="px-8 py-3 bg-blue-50/50 border-b border-blue-100 flex items-center gap-2">
            <Info size={14} className="text-blue-500" />
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              请选择需要包含在日志分析中的代码分支（支持跨仓库多选）
            </span>
          </div>

          {/* Navigation Arrows */}
          {branches.length > 3 && (
            <>
              <button 
                onClick={() => scroll('left')}
                className="absolute left-2 top-[60%] -translate-y-1/2 z-20 w-10 h-10 bg-white shadow-lg border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:scale-110 transition-all active:scale-95 border-2 hover:border-indigo-100"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={() => scroll('right')}
                className="absolute right-2 top-[60%] -translate-y-1/2 z-20 w-10 h-10 bg-white shadow-lg border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:scale-110 transition-all active:scale-95 border-2 hover:border-indigo-100"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {/* Repositories Grid */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-x-hidden overflow-y-hidden"
          >
            <div className="flex h-full p-8 gap-6 min-w-max">
              {branches.map((repo) => {
                const selectedCount = (selectedBranches[repo.path] || []).length;
                const isAllSelected = selectedCount === repo.branches.length;

                return (
                  <div 
                    key={repo.path} 
                    className="w-80 flex flex-col bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden"
                  >
                    {/* Repo Header */}
                    <div className="p-4 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Layers size={14} className="text-indigo-500 shrink-0" />
                        <span className="text-xs font-black text-gray-700 truncate uppercase tracking-tighter">
                          {repo.repoName}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleSelectAllForRepo(repo.path, repo.branches)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                          isAllSelected 
                            ? 'bg-indigo-100 text-indigo-600' 
                            : 'bg-gray-100 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50'
                        }`}
                      >
                        {isAllSelected ? 'NONE' : 'ALL'}
                      </button>
                    </div>

                    {/* Branches List */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-1">
                      {repo.branches.slice(0, 7).map((branch) => {
                        const isSelected = (selectedBranches[repo.path] || []).includes(branch);
                        return (
                          <button
                            key={`${repo.path}-${branch}`}
                            onClick={() => toggleBranch(repo.path, branch)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all group ${
                              isSelected 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                                : 'bg-white border-transparent hover:bg-gray-50 text-gray-600'
                            }`}
                          >
                            <span className="text-[11px] font-bold truncate pr-2">{branch}</span>
                            {isSelected && <Check size={14} className="shrink-0" />}
                          </button>
                        );
                      })}
                      
                      {repo.branches.length > 7 && (
                        <button
                          onClick={() => setActiveFullRepo(repo)}
                          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all font-bold text-[10px] uppercase tracking-widest mt-2"
                        >
                          显示更多 ({repo.branches.length - 7})
                          <ChevronDown size={14} />
                        </button>
                      )}
                    </div>

                    {/* Repo Footer */}
                    <div className="p-3 bg-gray-50/50 border-t border-gray-50 text-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Selected: {selectedCount} / {repo.branches.length}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2 overflow-hidden">
              {branches.slice(0, 5).map((repo, i) => (
                <div 
                  key={i} 
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600 uppercase"
                >
                  {repo.repoName.substring(0, 2)}
                </div>
              ))}
              {branches.length > 5 && (
                <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-400">
                  +{branches.length - 5}
                </div>
              )}
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Total Repositories</p>
              <p className="text-xs font-bold text-gray-700">{branches.length} Active Projects</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="px-10 py-3 bg-indigo-600 text-white text-sm font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95"
          >
            完成配置
          </button>
        </div>
      </motion.div>

      {/* 全部分支显示的子弹窗 */}
      <AnimatePresence>
        {activeFullRepo && (
          <AllBranchesModal 
            repo={activeFullRepo}
            selectedBranches={selectedBranches}
            toggleBranch={toggleBranch}
            onClose={() => setActiveFullRepo(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default BranchPickerModal;
