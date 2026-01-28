import React, { useState, useRef, useEffect } from 'react';
import { FileText, AlertCircle, Loader2, ChevronRight, Check, Sparkles, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LogGenerator = ({ 
  logs, 
  templates, 
  selectedTemplate, 
  setSelectedTemplate, 
  templateOptions, 
  setTemplateOptions, 
  customPrompt, 
  setCustomPrompt, 
  referenceLog,
  setReferenceLog,
  generateLog, 
  loading,
  openSupplementModal,
  supplementPrompt,
  setSupplementPrompt,
  openTemplatePreview,
  splitIndex
}) => {
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(event.target)) {
        setTemplateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (logs.length === 0) return null;

  return (
    <div className="space-y-6 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-left-4 duration-700">
      <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
        <FileText size={14} />
        <span>生成配置</span>
      </div>

      <div className="space-y-4">
        <div className="animate-in fade-in slide-in-from-top-1" ref={templateDropdownRef}>
          <div className="flex items-center justify-between mb-1.5 px-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">报告模版风格</label>
            <button 
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                openTemplatePreview({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
              }}
              className="text-[10px] text-green-600 hover:text-green-700 font-bold flex items-center gap-1 transition-colors"
            >
              <Eye size={10} />
              查看风格示例
            </button>
          </div>
          <div className="relative">
            <button 
              onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
              className={`w-full flex items-center justify-between pl-3 pr-3 py-2.5 text-[11px] font-bold border rounded-xl outline-none bg-white shadow-sm transition-all hover:border-green-300 active:scale-[0.98] ${
                templateDropdownOpen ? 'border-green-400 ring-4 ring-green-500/5' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Sparkles size={14} className="text-green-500 shrink-0" />
                <span className="truncate">
                  {(() => {
                    const labels = {
                      daily: '📝 日常日报',
                      weekly: '📅 周报总结',
                      kpi: '🏆 绩效自述',
                      concise: '⚡ 极简汇报',
                      custom: '✍️ 自定义模仿风格'
                    };
                    return labels[selectedTemplate] || selectedTemplate;
                  })()}
                </span>
              </div>
              <ChevronRight size={14} className={`text-gray-400 transition-transform duration-300 ${templateDropdownOpen ? 'rotate-90' : 'rotate-0'}`} />
            </button>

            <AnimatePresence>
              {templateDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 4, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute z-[60] w-full bg-white border border-gray-100 rounded-2xl shadow-2xl shadow-green-900/10 overflow-hidden p-1.5"
                >
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {Object.keys(templates).map(key => {
                      const labels = {
                        daily: '📝 日常日报',
                        weekly: '📅 周报总结',
                        kpi: '🏆 绩效自述',
                        concise: '⚡ 极简汇报'
                      };
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setSelectedTemplate(key);
                            setTemplateDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                            selectedTemplate === key ? 'bg-green-50 text-green-600' : 'hover:bg-gray-50 text-gray-600'
                          }`}
                        >
                          <span>{labels[key] || key}</span>
                          {selectedTemplate === key && <Check size={14} />}
                        </button>
                      );
                    })}
                    <div className="h-px bg-gray-50 my-1 mx-2" />
                    <button
                      onClick={() => {
                        setSelectedTemplate('custom');
                        setTemplateDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                        selectedTemplate === 'custom' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      <span>✍️ 自定义模仿风格</span>
                      {selectedTemplate === 'custom' && <Check size={14} />}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {selectedTemplate === 'custom' && (
          <div className="animate-in slide-in-from-top-2 duration-300">
            <label className="text-[10px] font-bold text-gray-400 mb-1 block uppercase">风格模仿参考</label>
            <textarea 
              placeholder="粘贴您以往的日志风格..."
              className="w-full p-2.5 border border-gray-200 rounded-lg text-[11px] h-32 resize-none focus:ring-2 focus:ring-green-500/20 outline-none bg-white shadow-sm custom-scrollbar"
              value={referenceLog}
              onChange={(e) => setReferenceLog(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 block uppercase">附加板块</label>
          <div className="grid grid-cols-1 gap-2 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
            {[
              { id: 'includeTomorrow', label: '补充内容', color: 'bg-blue-400' },
              { id: 'includeProblems', label: '遇到的问题', color: 'bg-red-400' },
              { id: 'includeReflections', label: '心得收获', color: 'bg-yellow-400' }
            ].map(opt => (
              <label key={opt.id} className="flex items-center justify-between cursor-pointer group">
                <span className="text-[11px] text-gray-600 font-medium flex items-center gap-2">
                  <div className={`w-1 h-1 rounded-full ${opt.color}`}></div>
                  {opt.label}
                  {opt.id === 'includeTomorrow' && templateOptions.includeTomorrow && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        openSupplementModal({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                      }}
                      className="ml-1 text-[10px] text-blue-500 hover:text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 animate-pulse hover:animate-none"
                    >
                      {supplementPrompt ? '已补充' : '点击补充'}
                    </button>
                  )}
                </span>
                <input 
                  type="checkbox" 
                  className="rounded-full text-green-600 focus:ring-green-500 w-3.5 h-3.5 border-gray-300"
                  checked={templateOptions[opt.id]}
                  onChange={(e) => setTemplateOptions({...templateOptions, [opt.id]: e.target.checked})}
                />
              </label>
            ))}
            
            <label className="flex items-center justify-between cursor-pointer group relative border-t border-gray-200/50 pt-2 mt-1">
              <span className="text-[11px] text-gray-600 font-bold flex items-center gap-1">
                深度代码分析
                <AlertCircle size={10} className="text-gray-400" />
              </span>
              <input 
                type="checkbox" 
                className="rounded-full text-green-600 focus:ring-green-500 w-3.5 h-3.5 border-gray-300"
                checked={templateOptions.includeDiffContent}
                onChange={(e) => setTemplateOptions({...templateOptions, includeDiffContent: e.target.checked})}
              />

              {/* 悬浮提示 */}
              <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-white border border-gray-200 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none translate-y-2 group-hover:translate-y-0">
                <div className="text-xs text-green-600 font-bold mb-1 flex items-center gap-1">
                  <AlertCircle size={12} /> 功能说明
                </div>
                <div className="text-[11px] text-gray-500 leading-relaxed font-medium">
                  该功能会读取详细的代码变更内容。适用于提交记录过于简略的情况，能够生成更深入的技术性描述。
                </div>
                <div className="absolute top-full left-4 -mt-1 border-8 border-transparent border-t-white" />
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 mb-1 block uppercase">额外指令 (可选)</label>
          <textarea 
            placeholder="例：强调重构部分，使用严谨的语气..."
            className="w-full p-2.5 border border-gray-200 rounded-lg text-[11px] h-20 resize-none focus:ring-2 focus:ring-green-500/20 outline-none bg-white shadow-sm custom-scrollbar"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
          />
        </div>

        <button 
          onClick={generateLog}
          disabled={loading}
          className={`w-full py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-lg active:scale-[0.98] ${
            splitIndex !== null 
              ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20 text-white' 
              : 'bg-green-600 hover:bg-green-700 shadow-green-500/20 text-white'
          } disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed`}
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : (splitIndex !== null ? <Sparkles size={18} /> : <FileText size={18} />)}
          {splitIndex !== null ? '分段生成' : 'AI 生成日志'}
        </button>
      </div>
    </div>
  );
};

export default LogGenerator;
