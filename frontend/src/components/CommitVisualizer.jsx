import React from 'react';
import dayjs from 'dayjs';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Eye, EyeOff, GitMerge, History, Activity } from 'lucide-react';

const CommitVisualizer = ({ logs, chartData, ignoredHashes, toggleIgnore, ignoreMerges }) => {
  const isAllMergesIgnored = () => {
    const mergeLogs = logs.filter(log => 
      log.message.toLowerCase().startsWith('merge ') || 
      log.message.toLowerCase().includes('merge branch') ||
      log.message.toLowerCase().includes('merge pull request')
    );
    return mergeLogs.length > 0 && mergeLogs.every(log => ignoredHashes.has(log.hash));
  };

  const allMergesIgnored = isAllMergesIgnored();

  return (
    <div className="space-y-6">
      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">总提交数</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-black text-gray-800 leading-none">{logs.length}</span>
            <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center">
              <History size={18} />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">有效记录</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-black text-green-500 leading-none">{logs.length - ignoredHashes.size}</span>
            <div className="w-8 h-8 bg-green-50 text-green-500 rounded-lg flex items-center justify-center">
              <Eye size={18} />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">忽略记录</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-black text-red-400 leading-none">{ignoredHashes.size}</span>
            <div className="w-8 h-8 bg-red-50 text-red-400 rounded-lg flex items-center justify-center">
              <EyeOff size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* 趋势图表 */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
            提交频率趋势
          </h3>
          <div className="flex items-center gap-2">
             <div className="flex items-center gap-1">
               <div className="w-2 h-2 rounded-full bg-blue-500"></div>
               <span className="text-[10px] text-gray-400 font-bold uppercase">Commits</span>
             </div>
          </div>
        </div>
        <div className="h-48 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}} 
                  contentStyle={{
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                  itemStyle={{fontSize: '12px', fontWeight: 'bold', color: '#3b82f6'}}
                  labelStyle={{fontSize: '10px', fontWeight: 'black', color: '#94a3b8', marginBottom: '4px'}}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
              <Activity size={32} />
              <span className="text-xs font-bold uppercase tracking-widest">No Data Available</span>
            </div>
          )}
        </div>
      </div>

      {/* 提交列表 */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col max-h-[600px]">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              提交流水线
            </h3>
            <button 
              onClick={ignoreMerges}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all border ${
                allMergesIgnored 
                  ? 'bg-blue-50 text-blue-600 border-blue-100' 
                  : 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100'
              }`}
              title={allMergesIgnored ? "恢复合并提交" : "一键忽略所有包含 'Merge' 关键字的提交"}
            >
              <GitMerge size={12} />
              {allMergesIgnored ? '恢复合并提交' : '忽略合并提交'}
            </button>
          </div>
          <div className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-tighter">
            Real-time Feed
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4 custom-scrollbar">
          {logs.map((log, idx) => {
            const isIgnored = ignoredHashes.has(log.hash);
            return (
              <div 
                key={idx} 
                className={`group relative p-4 rounded-2xl border transition-all duration-300 ${
                  isIgnored 
                    ? 'bg-gray-50 border-gray-100 opacity-50 grayscale' 
                    : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-md hover:shadow-blue-500/5'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg border uppercase tracking-tighter ${
                      isIgnored ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      #{log.hash.substring(0, 7)}
                    </span>
                    <span className={`text-[10px] px-2 py-1 rounded-lg uppercase font-black tracking-tighter border ${
                      isIgnored ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                    }`}>
                      {log.repoName}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                      {dayjs(log.date).format('MM-DD HH:mm')}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => toggleIgnore(log.hash)}
                    className={`p-2 rounded-xl transition-all ${
                      isIgnored 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50'
                    }`}
                    title={isIgnored ? "恢复提交" : "忽略此提交"}
                  >
                    {isIgnored ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                
                <p className={`text-sm font-bold leading-relaxed ${isIgnored ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {log.message}
                </p>
                
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-black text-gray-500 uppercase">
                      {log.author_name.substring(0, 2)}
                    </div>
                    <span className="text-[10px] font-bold text-gray-500">{log.author_name}</span>
                  </div>
                  {isIgnored && (
                    <span className="text-[9px] font-black text-gray-300 uppercase italic tracking-widest">Skipped in generation</span>
                  )}
                </div>
              </div>
            );
          })}
          
          {logs.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-gray-300 gap-2">
              <EyeOff size={32} />
              <span className="text-xs font-bold uppercase tracking-widest">No Logs Found</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommitVisualizer;
