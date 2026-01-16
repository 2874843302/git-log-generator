import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dayjs from 'dayjs';
import { Download, FileText } from 'lucide-react';

const MarkdownPreview = ({ generatedLog }) => {
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">AI 生成的工作日志</h3>
        <div className="flex gap-4">
          {generatedLog && (
            <button 
              onClick={() => {
                const blob = new Blob([generatedLog], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `work-log-${dayjs().format('YYYY-MM-DD')}.md`;
                a.click();
              }}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Download size={16} />
              下载 Markdown
            </button>
          )}
        </div>
      </div>
      
      {generatedLog ? (
        <div 
          className="prose prose-blue max-w-none bg-gray-50 p-6 rounded-lg border border-gray-200 font-sans text-gray-700 leading-relaxed overflow-auto"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {generatedLog}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <FileText size={48} className="mb-4 opacity-20" />
          <p>尚未生成日志，请在左侧配置并点击“AI 生成日志”</p>
        </div>
      )}
    </div>
  );
};

export default MarkdownPreview;
