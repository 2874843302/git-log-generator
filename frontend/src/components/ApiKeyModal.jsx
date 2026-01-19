import React, { useState, useMemo } from 'react';
import { X, Key, Eye, EyeOff, Save, Loader2, ShieldCheck, Info } from 'lucide-react';
import { motion } from 'framer-motion';

const ApiKeyModal = ({ 
  isOpen, 
  onClose, 
  apiKey, 
  onSave,
  originPos = null
}) => {
  // 计算点击位置相对于屏幕中心的偏移量，用于位置感知动画
  const offset = useMemo(() => {
    if (!originPos) return { x: 0, y: 0 };
    return {
      x: originPos.x - window.innerWidth / 2,
      y: originPos.y - window.innerHeight / 2
    };
  }, [originPos]);

  const [showKey, setShowKey] = useState(false);
  const [localKey, setLocalKey] = useState(apiKey || '');
  const [isSaving, setIsSaving] = useState(false);

  // 同步外部状态
  React.useEffect(() => {
    if (isOpen) {
      setLocalKey(apiKey || '');
    }
  }, [isOpen, apiKey]);

  const handleSave = async () => {
    if (localKey === apiKey) return;
    setIsSaving(true);
    await onSave(localKey);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 overflow-hidden">
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
        className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-white/20"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Key size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-800 uppercase tracking-widest leading-tight">
                API Key 配置
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">DeepSeek AI Configuration</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex gap-3">
            <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
              API Key 将被安全地存储在本地服务器的 <code className="bg-blue-100 px-1 rounded">.env</code> 文件中，仅用于与 DeepSeek 服务进行通信。
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">
              DeepSeek API Key
            </label>
            <div className="relative group">
              <input 
                type={showKey ? "text" : "password"}
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-4 pr-12 py-4 text-sm font-medium text-gray-700 shadow-inner focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
              />
              <button 
                onClick={() => setShowKey(!showKey)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 italic ml-1 flex items-center gap-1">
              <ShieldCheck size={12} />
              您的密钥在传输和存储过程中都是加密处理的
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-3.5 text-sm font-bold text-gray-500 hover:bg-white hover:shadow-sm rounded-2xl transition-all active:scale-95 border border-transparent hover:border-gray-100"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || localKey === apiKey}
            className={`flex-[2] flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-black rounded-2xl transition-all active:scale-95 shadow-lg ${
              localKey !== apiKey 
                ? 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
            }`}
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isSaving ? '正在保存...' : '确认并保存'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ApiKeyModal;
