# Git Log AI (Desktop Edition)

这是一个基于 AI 的 Git 提交日志自动化生成与管理工具，现已全面进化为 **Electron 桌面端应用**。它能够深度解析 Git 提交记录（包括代码 Diff），并利用 DeepSeek 大模型将其转化为结构清晰、专业严谨的工作汇报，同时支持一键同步至学习通等第三方平台。

## 🚀 核心特性

- **🤖 AI 智能生成**：
  - **多维模版体系**：支持日报、周报、绩效自述、极简汇报等多种专业模版。
  - **深度代码分析**：支持解析 `diffContent`，AI 会分析具体函数、逻辑变更及 API 修改，而非简单的消息翻译。
  - **禁止套话**：严禁空洞描述，专注于逻辑作用、执行流程与技术细节。
- **⚡ 傻瓜模式 (Fool Mode)**：
  - 一键选择多个仓库，自动获取当日提交，AI 生成并直接同步，极大简化操作流程。
- **⏰ 定时自动化同步**：
  - 支持设置每日定时任务，在指定时间自动执行“傻瓜模式”流程，全程后台静默执行（无头浏览器模式）。
- **🔗 学习通深度集成**：
  - 内置基于 Playwright 的自动化同步引擎，支持自动登录、笔记创建与内容填充。
- **💻 桌面端优化**：
  - **系统通知**：关键节点（如同步成功/失败）通过系统原生通知提醒。
  - **音效反馈**：成功或失败时播放个性化音效。
  - **SQLite 持久化**：配置信息与任务状态本地数据库存储，安全可靠。
  - **交互式 UI**：基于 Framer Motion 的位置感知弹窗与流畅动效。

## 🛠️ 项目结构

- `main.js`: Electron 主进程配置。
- `preload.js`: 进程间通信（IPC）预加载脚本。
- `backend/`: 核心逻辑层。
  - `ipcHandlers.js`: 处理前端请求的 IPC 处理程序。
  - `database.js`: SQLite 数据库访问层。
  - `server/services/`: AI 生成与 Git 数据采集核心服务。
- `frontend/`: 基于 React 和 Vite 的桌面端界面。

## 🚦 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) (建议版本 18+)
- [Git](https://git-scm.com/)
- 现代浏览器（Chrome/Edge/Firefox）用于 Playwright 自动化

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

### 运行与开发

在根目录下运行以下命令启动应用：
```bash
npm run dev
```

### 打包发布

```bash
npm run electron:build
```
打包后的安装包将生成在 `dist_electron_2.1.2/` 目录下。

## ⚙️ 配置说明

应用首次启动会引导或自动初始化配置。
- **DeepSeek API Key**: 用于 AI 报告生成（必须）。
- **Base Repo Dir**: 你的本地代码仓库根目录。
- **学习通配置**: 包括账号、密码及笔记页面 URL。
- **浏览器路径**: 可指定本地浏览器路径以提高自动化兼容性。

## 🧰 技术栈

- **Runtime**: Electron
- **Frontend**: React, Vite, Tailwind CSS, Framer Motion, Lucide React
- **Backend**: Node.js, Better-SQLite3, simple-git, Playwright
- **AI**: DeepSeek Chat API

## 📝 开发者规范

1. **IPC 通信**: 所有的后端操作必须通过 `ipcHandlers.js` 注册，前端通过 `window.api` 调用。
2. **数据存储**: 优先使用 SQLite 存储配置，敏感信息可通过 `.env` 迁移逻辑初始化。
3. **自动化测试**: 修改学习通同步逻辑时，请确保处理好 `headless` 模式的切换。
