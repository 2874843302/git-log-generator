import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Folder, ChevronLeft, HardDrive, Check, X, Search, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const FolderPickerModal = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  initialPath, 
  title = "选择文件夹",
  originPos = null
}) => {
  // 计算点击位置相对于屏幕中心的偏移量
  const offset = useMemo(() => {
    if (!originPos) return { x: 0, y: 0 };
    return {
      x: originPos.x - window.innerWidth / 2,
      y: originPos.y - window.innerHeight / 2
    };
  }, [originPos]);
  const [currentPath, setCurrentPath] = useState('');
  const [folders, setFolders] = useState([]);
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchDrives();
      fetchDir(initialPath || '');
    }
  }, [isOpen, initialPath]);

  const fetchDrives = async () => {
    try {
      const res = await api.getDrives();
      setDrives(res.drives);
    } catch (err) {
      console.error('获取盘符失败');
    }
  };

  const fetchDir = async (path) => {
    // 处理 Windows 根目录情况，如果路径为空则获取盘符列表
    if (!path && process.platform === 'win32') {
      fetchDrives();
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.listDir(path);
      setCurrentPath(res.currentPath);
      setFolders(res.folders);
    } catch (err) {
      setError(err.message || '无法读取目录');
    } finally {
      setLoading(false);
    }
  };

  const filteredFolders = folders.filter(f => 
    f.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-hidden">
      {/* 背景遮罩 */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md"
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
        className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/20"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Folder size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-800 uppercase tracking-widest leading-tight">
                {title}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Directory Navigator</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        {/* Path Breadcrumbs */}
        <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-1 min-w-max">
            {currentPath.split(/[/\\]/).filter(Boolean).map((part, idx, arr) => (
              <React.Fragment key={idx}>
                <button 
                  onClick={() => {
                    const path = currentPath.split(/[/\\]/).slice(0, idx + 1).join('/') + '/';
                    fetchDir(path);
                  }}
                  className="px-2 py-1 rounded-md hover:bg-white hover:shadow-sm text-[11px] font-bold text-gray-500 hover:text-blue-600 transition-all"
                >
                  {part}
                </button>
                {idx < arr.length - 1 && <span className="text-gray-300 text-[10px]">/</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Search & Navigation */}
        <div className="px-6 py-4 border-b border-gray-100 flex gap-3 bg-white shrink-0">
          <button 
            onClick={() => {
              const parts = currentPath.split(/[/\\]/).filter(Boolean);
              if (parts.length <= 1) {
                // 如果已经在根目录（如 D:），则不做操作或返回盘符列表
                return;
              }
              const newPath = parts.slice(0, -1).join('/') + '/';
              fetchDir(newPath);
            }}
            disabled={currentPath.split(/[/\\]/).filter(Boolean).length <= 1}
            className="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-600 transition-all active:scale-95 border border-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="返回上级"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text"
              placeholder="搜索当前目录下的文件夹..."
              className="w-full pl-11 pr-4 h-10 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Drives Sidebar */}
          <div className="w-20 border-r border-gray-100 bg-gray-50/30 p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar shrink-0">
            {drives.map(drive => (
              <button
                key={drive}
                onClick={() => fetchDir(drive)}
                className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                  currentPath.startsWith(drive) 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                    : 'hover:bg-white hover:shadow-sm text-gray-400 hover:text-blue-500 border border-transparent hover:border-blue-100'
                }`}
              >
                <HardDrive size={20} />
                <span className="text-[10px] font-black">{drive.replace(/[/\\]/, '')}</span>
              </button>
            ))}
          </div>

          {/* Folder List */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <span className="text-xs font-bold uppercase tracking-widest">读取目录中...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-red-400 p-8 text-center bg-red-50/50 rounded-[32px] border border-red-100">
                <AlertCircle size={40} className="mb-4 opacity-50" />
                <h4 className="text-sm font-black uppercase mb-1">访问受限</h4>
                <p className="text-xs font-medium leading-relaxed opacity-80 mb-6">{error}</p>
                <button 
                  onClick={() => {
                    const parts = currentPath.split(/[/\\]/).filter(Boolean);
                    if (parts.length <= 1) return;
                    fetchDir(parts.slice(0, -1).join('/') + '/');
                  }}
                  className="px-6 py-2 bg-red-100 text-red-600 rounded-xl text-xs font-bold hover:bg-red-200 transition-all"
                >
                  返回上级目录
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredFolders.map(folder => (
                  <button
                    key={folder}
                    onDoubleClick={() => {
                      const separator = currentPath.endsWith('/') || currentPath.endsWith('\\') ? '' : '/';
                      fetchDir(currentPath + separator + folder + '/');
                    }}
                    className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-gray-50 bg-gray-50/30 hover:bg-white hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all group text-left relative overflow-hidden"
                  >
                    <div className="w-8 h-8 bg-amber-50 text-amber-500 rounded-lg flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                      <Folder size={18} fill="currentColor" className="opacity-80" />
                    </div>
                    <span className="text-xs font-bold text-gray-700 truncate w-full group-hover:text-blue-700">{folder}</span>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    </div>
                  </button>
                ))}
                {filteredFolders.length === 0 && (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-300 gap-3">
                    <Folder size={48} className="opacity-10" />
                    <span className="text-xs font-bold uppercase tracking-widest">空目录</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm max-w-full sm:max-w-[320px]">
            <div className="w-6 h-6 bg-green-50 text-green-500 rounded-lg flex items-center justify-center shrink-0">
              <Check size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Current Selection</p>
              <p className="text-[11px] font-bold text-gray-700 truncate">{currentPath || '未选择'}</p>
            </div>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-2xl transition-all active:scale-95"
            >
              取消
            </button>
            <button 
              onClick={() => onSelect(currentPath)}
              disabled={!currentPath}
              className="flex-1 sm:flex-none px-8 py-3 bg-blue-600 text-white text-sm font-black rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
            >
              确认选择
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default FolderPickerModal;
