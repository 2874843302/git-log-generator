import React from 'react';
import dayjs from 'dayjs';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Eye, EyeOff } from 'lucide-react';

const CommitVisualizer = ({ logs, chartData, ignoredHashes, toggleIgnore }) => {
  return (
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
  );
};

export default CommitVisualizer;
