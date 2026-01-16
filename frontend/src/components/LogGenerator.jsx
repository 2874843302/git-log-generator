import React from 'react';
import { FileText, AlertCircle, Loader2 } from 'lucide-react';

const LogGenerator = ({ 
  logs, 
  templates, 
  selectedTemplate, 
  setSelectedTemplate, 
  templateOptions, 
  setTemplateOptions, 
  customPrompt, 
  setCustomPrompt, 
  generateLog, 
  loading 
}) => {
  if (logs.length === 0) return null;

  return (
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
            {[
              { id: 'includeTomorrow', label: '明日计划' },
              { id: 'includeProblems', label: '遇到的问题' },
              { id: 'includeReflections', label: '心得收获' }
            ].map(opt => (
              <label key={opt.id} className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  checked={templateOptions[opt.id]}
                  onChange={(e) => setTemplateOptions({...templateOptions, [opt.id]: e.target.checked})}
                />
                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition">{opt.label}</span>
              </label>
            ))}
            
            <label className="flex items-center gap-2 cursor-pointer group relative">
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
  );
};

export default LogGenerator;
