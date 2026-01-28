import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, MinusCircle, User, Bot, Loader2, Sparkles, GripHorizontal, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';

const ChatBot = ({ actions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const dragControls = useDragControls();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '你好！我是小飞，你的 AI 助手。我可以帮你检索 Git 记录、生成工作日志，或者解答应用使用中的任何问题。' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // 处理工具调用
  const processToolCall = async (toolCall) => {
    const { name, arguments: argsString } = toolCall.function;
    const args = JSON.parse(argsString);
    
    console.log(`[ChatBot] 执行工具调用: ${name}`, args);

    try {
      switch (name) {
        case 'check_logs':
          await actions.checkLogs();
          return "已为你触发日志检查，请查看结果。";
        case 'auto_fill_logs':
          await actions.autoFillLogs(args.mode);
          return `已开始按 ${args.mode === 'daily' ? '按天' : '平均分配'} 模式为你补全日志。`;
        case 'split_generate_and_sync':
          await actions.splitGenerateAndSync(args.offset1, args.offset2);
          return `已开始为你执行分段同步（偏移量：${args.offset1} 和 ${args.offset2}）。`;
        case 'open_settings':
          actions.openSettings();
          return "已为你打开设置界面。";
        default:
          return `未知工具: ${name}`;
      }
    } catch (err) {
      console.error(`工具调用 ${name} 失败:`, err);
      return `执行操作时出错: ${err.message}`;
    }
  };

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = { role: 'user', content: inputValue.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await api.chatWithAssistant({
        messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content }))
      });

      if (response) {
        let assistantContent = response.content || '';
        
        // 如果有工具调用，执行它们
        if (response.tool_calls && response.tool_calls.length > 0) {
          const toolResults = [];
          for (const toolCall of response.tool_calls) {
            const result = await processToolCall(toolCall);
            toolResults.push(result);
          }
          
          // 如果 AI 没有返回文字内容，或者内容较短，追加工具执行结果
          if (!assistantContent || assistantContent.length < 5) {
            assistantContent = toolResults.join('\n');
          } else {
            assistantContent += `\n\n> **小飞执行了以下操作**：\n> ${toolResults.join('\n> ')}`;
          }
        }

        if (assistantContent) {
          setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
        } else {
          throw new Error('AI 响应内容为空');
        }
      } else {
        throw new Error('AI 响应为空');
      }
    } catch (error) {
      console.error('Chat Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `抱歉，小飞遇到了一点问题：${error.message}。请检查 API Key 配置或网络连接。` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {/* 悬浮按钮 */}
        {!isOpen && (
          <motion.button
            key="chat-button"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 400 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="absolute bottom-0 right-0 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <MessageSquare size={24} />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
          </motion.button>
        )}

        {/* 聊天窗口 */}
        {isOpen && (
          <motion.div
            key="chat-window"
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            initial={{ scale: 0, opacity: 0, originX: 1, originY: 1 }}
            animate={{ scale: 1, opacity: 1, originX: 1, originY: 1 }}
            exit={{ scale: 0, opacity: 0, originX: 1, originY: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={`absolute bottom-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
              isMinimized ? 'h-14 w-72' : 'h-[650px] w-[480px]'
            }`}
            style={{ touchAction: 'none' }}
          >
            {/* 头部 - 拖拽句柄 */}
            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className={`bg-blue-600 text-white flex items-center justify-between shrink-0 cursor-move active:cursor-grabbing select-none transition-all ${
                isMinimized ? 'p-3' : 'p-4'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="bg-white/20 p-1.5 rounded-lg shrink-0">
                  <Sparkles size={18} className="text-blue-100" />
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm leading-none truncate">小飞助手</h3>
                    {!isMinimized && <GripHorizontal size={14} className="opacity-50 shrink-0" />}
                  </div>
                  {!isMinimized && (
                    <p className="text-[10px] text-blue-100 mt-1 flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      在线并准备就绪 (按住此处拖动)
                    </p>
                  )}
                  {isMinimized && (
                    <p className="text-[10px] text-blue-100 mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      在线
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {isMinimized ? <Maximize2 size={18} /> : <MinusCircle size={18} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* 消息区域 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-white border border-gray-200 text-blue-600 shadow-sm'
                        }`}>
                          {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm overflow-hidden break-words ${
                          msg.role === 'user' 
                            ? 'bg-blue-600 text-white rounded-tr-none' 
                            : 'bg-white text-gray-700 border border-gray-100 rounded-tl-none'
                        }`}>
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm max-w-full prose-p:leading-relaxed prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:max-w-full prose-pre:overflow-x-auto prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none break-words">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <div className="break-words whitespace-pre-wrap">{msg.content}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex gap-2 items-center bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none shadow-sm">
                        <Loader2 className="animate-spin text-blue-600" size={16} />
                        <span className="text-xs text-gray-400">小飞正在思考...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* 输入区域 */}
                <div className="p-4 bg-white border-t border-gray-100">
                  <div className="flex gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="有问题尽管问小飞..."
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm resize-none py-1 max-h-24"
                      rows={1}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!inputValue.trim() || isLoading}
                      className={`p-2 rounded-lg transition-all ${
                        !inputValue.trim() || isLoading 
                          ? 'text-gray-300' 
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                      }`}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatBot;
