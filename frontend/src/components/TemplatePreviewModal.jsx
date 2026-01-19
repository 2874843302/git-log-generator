import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, Sparkles, LayoutGrid, ArrowLeft } from 'lucide-react';
import { templateExamples } from '../constants/templateExamples';

/**
 * 模板示例预览弹窗组件
 * 采用创意网格布局与平滑的聚焦缩放动画
 */
const TemplatePreviewModal = ({ isOpen, onClose, originPos = null }) => {
  const [selectedId, setSelectedId] = useState(null);

  // 计算动画起始位置的偏移量
  const offset = useMemo(() => {
    if (!originPos) return { x: 0, y: 0 };
    return {
      x: originPos.x - window.innerWidth / 2,
      y: originPos.y - window.innerHeight / 2
    };
  }, [originPos]);

  // 选中的模板数据
  const selectedTemplate = selectedId ? templateExamples[selectedId] : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* 弹窗主体 */}
          <motion.div
            initial={{ 
              opacity: 0, 
              scale: 0.3, 
              x: offset.x, 
              y: offset.y,
              rotateX: 20
            }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              x: 0, 
              y: 0,
              rotateX: 0
            }}
            exit={{ 
              opacity: 0, 
              scale: 0.3, 
              x: offset.x, 
              y: offset.y,
              rotateX: 20
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl bg-white/90 backdrop-blur-xl rounded-[32px] shadow-2xl overflow-hidden border border-white/20 flex flex-col max-h-[90vh]"
          >
            {/* 顶部标题栏 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
                  <LayoutGrid className="text-green-600" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">模板风格实验室</h3>
                  <p className="text-xs text-gray-500">点击方块预览不同风格的日报内容结构</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
              <AnimatePresence mode="wait">
                {!selectedId ? (
                  // 网格列表视图
                  <motion.div
                    key="grid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                  >
                    {Object.entries(templateExamples).map(([id, item], index) => (
                      <motion.div
                        key={id}
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ 
                          opacity: 1, 
                          y: 0, 
                          scale: 1,
                          transition: { delay: index * 0.05 } 
                        }}
                        whileHover={{ 
                          scale: 1.05, 
                          rotateZ: 1,
                          transition: { type: 'spring', stiffness: 400, damping: 10 }
                        }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedId(id)}
                        className="group cursor-pointer aspect-square bg-gradient-to-br from-white to-gray-50 border border-gray-100 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-xl hover:shadow-green-500/10 transition-shadow overflow-hidden relative"
                      >
                        {/* 背景装饰 */}
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye size={16} className="text-green-500" />
                        </div>
                        
                        <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                          {item.title.split(' ')[0]}
                        </div>
                        <div className="text-sm font-bold text-gray-700 mb-2">
                          {item.title.split(' ')[1]}
                        </div>
                        <div className="text-[10px] text-gray-400 leading-tight">
                          {item.description}
                        </div>

                        {/* 底部渐变条 */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-green-400/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  // 详情视图
                  <motion.div
                    key="detail"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="h-full flex flex-col"
                  >
                    <button
                      onClick={() => setSelectedId(null)}
                      className="flex items-center gap-2 text-green-600 font-bold text-xs mb-6 hover:gap-3 transition-all w-fit group"
                    >
                      <ArrowLeft size={16} />
                      返回列表
                    </button>

                    <div className="bg-gray-900 rounded-[24px] p-8 shadow-2xl relative overflow-hidden flex-1">
                      {/* 代码风格修饰 */}
                      <div className="absolute top-4 left-6 flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                      </div>
                      <div className="absolute top-4 right-6 text-[10px] font-mono text-gray-500">
                        Markdown Preview
                      </div>

                      <div className="mt-6 font-mono text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 }}
                        >
                          {selectedTemplate.content}
                        </motion.div>
                      </div>

                      {/* 装饰图标 */}
                      <div className="absolute -bottom-10 -right-10 opacity-5">
                        <Sparkles size={200} className="text-white" />
                      </div>
                    </div>
                    
                    <div className="mt-6 flex items-center justify-between px-4">
                      <div className="text-xs text-gray-500 italic">
                        提示：生成的具体内容会根据您的 Git 提交记录动态变化。
                      </div>
                      <button
                        onClick={() => {
                          // 这里可以添加逻辑：选择该模板并关闭
                          setSelectedId(null);
                        }}
                        className="px-6 py-2 bg-green-600 text-white rounded-full text-xs font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-500/20"
                      >
                        了解更多
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TemplatePreviewModal;
