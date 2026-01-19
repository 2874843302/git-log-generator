import React, { useMemo } from 'react';
import { X, GitBranch, Check, Layers, Info } from 'lucide-react';
import { motion } from 'framer-motion';

const BranchPickerModal = ({ 
  isOpen, 
  onClose, 
  branches, 
  selectedBranches, 
  toggleBranch, 
  setSelectedBranches,
  originPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}) => {
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
        className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-5xl flex flex-col max-h-[85vh] overflow-hidden border border-gray-100"
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
        <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/30">
          {/* Top Info Bar */}
          <div className="px-8 py-3 bg-blue-50/50 border-b border-blue-100 flex items-center gap-2">
            <Info size={14} className="text-blue-500" />
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              请选择需要包含在日志分析中的代码分支（支持跨仓库多选）
            </span>
          </div>

          {/* Repositories Grid */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar">
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
                      {repo.branches.map((branch) => {
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
    </div>
  );
};

export default BranchPickerModal;
