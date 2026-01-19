import React, { useState, useMemo, useEffect } from 'react';
import { X, Calendar, MessageSquare, Sparkles, Save } from 'lucide-react';
import { motion } from 'framer-motion';

const TomorrowPlanModal = ({ 
  isOpen, 
  onClose, 
  initialValue, 
  onSave,
  originPos = null
}) => {
  const [plan, setPlan] = useState(initialValue || '');
  
  // 计算位置感知动画偏移量
  const offset = useMemo(() => {
    if (!originPos) return { x: 0, y: 0 };
    return {
      x: originPos.x - window.innerWidth / 2,
      y: originPos.y - window.innerHeight / 2
    };
  }, [originPos]);

  useEffect(() => {
    if (isOpen) {
      setPlan(initialValue || '');
    }
  }, [isOpen, initialValue]);

  const handleSave = () => {
    onSave(plan);
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
        className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-white/20"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-800 uppercase tracking-widest leading-tight">
                明日计划描述
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Plan Enrichment Prompt</p>
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
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex gap-3">
            <Sparkles size={18} className="text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-indigo-700 font-medium leading-relaxed">
              输入几个关键词或简短描述，AI 将基于此丰富您的明日计划。例如：“继续重构模块、修复反馈的3个Bug、准备周会演示”。
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">
              描述您的计划
            </label>
            <div className="relative group">
              <textarea 
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="请输入计划关键词..."
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium text-gray-700 shadow-inner focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all min-h-[120px] resize-none custom-scrollbar"
              />
              <div className="absolute right-4 bottom-4 text-gray-300">
                <MessageSquare size={18} />
              </div>
            </div>
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
            className="flex-[2] flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-black rounded-2xl transition-all active:scale-95 shadow-lg bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700"
          >
            <Save size={18} />
            确认计划并保存
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default TomorrowPlanModal;
