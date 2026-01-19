import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dayjs from 'dayjs';
import { Download, FileText, Copy, Check, Terminal } from 'lucide-react';

const MarkdownPreview = ({ generatedLog }) => {
  const [copied, setCopied] = useState(false);

  // 清除 Markdown 格式的函数
  const stripMarkdown = (md) => {
    if (!md) return '';
    return md
      .replace(/^#+\s+/gm, '') // 移除标题符号
      .replace(/(\*\*|__)(.*?)\1/g, '$2') // 移除粗体
      .replace(/(\*|_)(.*?)\1/g, '$2') // 移除斜体
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // 移除链接，保留文本
      .replace(/`([^`]+)`/g, '$1') // 移除行内代码块
      .replace(/^\s*[-*+]\s+/gm, '• ') // 将无序列表符号统一为圆点
      .replace(/^\s*>\s+/gm, '') // 移除引用符号
      .trim();
  };

  const handleCopy = async () => {
    if (!generatedLog) return;
    try {
      const plainText = stripMarkdown(generatedLog);
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const handleDownload = () => {
    if (!generatedLog) return;
    const blob = new Blob([generatedLog], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-log-${dayjs().format('YYYY-MM-DD')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-500">
      {/* 顶部工具栏 */}
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Terminal size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">AI 生成成果</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Markdown Production</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {generatedLog && (
            <>
              <div className="relative group">
                <button 
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    copied 
                      ? 'bg-green-50 text-green-600' 
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? '已复制' : '复制内容'}
                </button>
                
                {/* 悬浮提示 */}
                {!copied && (
                  <div className="absolute top-1/2 right-full -translate-y-1/2 mr-3 w-48 p-2.5 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                    <div className="font-bold mb-1 text-blue-400 flex items-center gap-1">
                      <Terminal size={10} /> 复制说明
                    </div>
                    <p className="leading-relaxed opacity-90">
                      此按钮将清除 Markdown 标记复制纯文本。如需保留格式，请手动选中文本复制。
                    </p>
                    {/* 右侧箭头 */}
                    <div className="absolute top-1/2 left-full -translate-y-1/2 border-4 border-transparent border-l-gray-900" />
                  </div>
                )}
              </div>
              <button 
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
              >
                <Download size={14} />
                下载报告
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {generatedLog ? (
          <div className="flex-1 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-50 bg-gray-50/30">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/20"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/20"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-400/20"></div>
              </div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Preview.md</span>
            </div>
            <div className="flex-1 overflow-auto p-8 custom-scrollbar">
              <div className="prose prose-slate max-w-none prose-headings:font-black prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-gray-600 prose-p:leading-relaxed prose-li:text-gray-600 prose-strong:text-gray-900 prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded prose-pre:bg-gray-900 prose-pre:rounded-2xl">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {generatedLog}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-gray-200">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-indigo-100 rounded-full blur-2xl opacity-40 animate-pulse"></div>
              <div className="relative w-20 h-20 bg-indigo-50 text-indigo-300 rounded-3xl flex items-center justify-center border border-indigo-100">
                <FileText size={40} className="opacity-40" />
              </div>
            </div>
            <h4 className="text-gray-800 font-black text-lg mb-2">等待灵感生成</h4>
            <p className="text-gray-400 text-sm font-medium max-w-[240px] text-center leading-relaxed">
              请在左侧配置完成后，点击“AI 生成日志”来查看您的工作成果
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownPreview;
