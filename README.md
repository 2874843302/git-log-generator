# Git Log AI

这是一个基于 AI 的 Git 提交日志自动化生成与管理工具。它能够深度解析 Git 提交记录（包括代码 Diff），并利用 DeepSeek 大模型将其转化为结构清晰、专业严谨的工作汇报。

## 🚀 核心特性

- **多维模版体系**：
  - **📝 日常日报**：条理清晰的每日工作汇总。
  - **📅 周报总结**：采用“总-分-总”结构，量化本周产出（提交数、接口数、Bug 数等）。
  - **🏆 绩效自述**：专家级汇报视角，突出业务价值产出与技术影响力沉淀。
  - **⚡ 极简汇报**：极度精简，每条内容严格控制在 30 字以内，直击要点。
- **模板风格实验室**：创新的网格化预览界面，支持平滑的聚焦缩放动画，实时查看各模版渲染效果。
- **深度代码分析**：支持解析 `diffContent`，AI 会分析具体函数、逻辑变更及 API 修改，而非简单的消息翻译。
- **专业生成规范**：
  - **禁止套话**：严禁使用“为后续奠定基础”等空洞描述。
  - **纯技术导向**：专注于逻辑作用、执行流程与技术细节。
  - **智能计划适配**：自动根据日报/周报语境生成“明日计划”或“下周计划”。
- **交互式 UI**：基于 Framer Motion 的动效系统，提供位置感知的弹窗动画与流畅的用户体验。

## 🛠️ 项目结构

- `backend/`: Node.js/Express 后端，处理 Git 数据采集与 AI Prompt 组装。
- `frontend/`: React 前端，提供可视化的日志管理与预览界面。

## 🚦 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) (建议版本 18+)
- [Git](https://git-scm.com/)

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

2. **一键安装依赖** (在根目录下运行)
   ```bash
   npm run install:all
   ```

### 运行项目

在根目录下运行以下命令同时启动前端与后端：
```bash
npm run dev
```
- 后端服务：`http://localhost:3001`
- 前端应用：`http://localhost:5173`

## ⚙️ 环境配置 （可选，也可在前端页面点击一键配置环境系统会自动创建配置文件，并填写内容）

### 后端 (`backend/.env`)

参考 `.env.example` 创建文件：
```env
# DeepSeek API 密钥
DEEPSEEK_API_KEY=your_api_key_here

# 默认搜索的仓库根目录
BASE_REPO_DIR=D:\your\projects\path

# 服务端口
PORT=3001
```
前端页面操作：

![img_1.png](img_1.png)

进入全局设置
1. 点击 **立即初始化** 按钮
2. 选择 **仓库根目录**
3. 填写 **DeepSeek API 密钥**

## 🧰 技术栈

- **Frontend**: React, Vite, Tailwind CSS, **Framer Motion**, Lucide React, React Markdown
- **Backend**: Node.js, Express, simple-git, Axios
- **AI**: DeepSeek Chat API

## 📝 开发者规范

在修改日志生成逻辑时，请注意：
1. **Prompt 规范**：修改 `backend/server/services/aiService.js` 中的指令，确保 AI 遵循“纯技术描述”原则。
2. **模版同步**：修改 `backend/server/constants/templates.js` 后，需同步更新 `frontend/src/constants/templateExamples.js` 以保持预览一致。
