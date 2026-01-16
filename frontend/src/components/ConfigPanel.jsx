import React from 'react';
import { Settings, Plus, Folder, Trash2, Calendar, Loader2 } from 'lucide-react';

const ConfigPanel = ({ 
  repoPaths, 
  selectFolder, 
  removeFolder, 
  authors, 
  selectedAuthor, 
  setSelectedAuthor, 
  branches,
  selectedBranches,
  setSelectedBranches,
  startDate, 
  setStartDate, 
  endDate, 
  setEndDate, 
  fetchLogs, 
  loading 
}) => {
  const toggleBranch = (branch) => {
    setSelectedBranches(prev => 
      prev.includes(branch) 
        ? prev.filter(b => b !== branch) 
        : [...prev, branch]
    );
  };

  return (
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

        {branches.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex justify-between items-center">
              <span>筛选分支</span>
              <button 
                onClick={() => setSelectedBranches(selectedBranches.length === branches.length ? [] : [...branches])}
                className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
              >
                {selectedBranches.length === branches.length ? '取消全选' : '全选'}
              </button>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-md bg-gray-50">
              {branches.map(branch => (
                <button
                  key={branch}
                  onClick={() => toggleBranch(branch)}
                  className={`px-2 py-1 rounded-full text-[10px] font-medium transition ${
                    selectedBranches.includes(branch)
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {branch}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">未选择任何分支时默认拉取所有分支</p>
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
  );
};

export default ConfigPanel;
