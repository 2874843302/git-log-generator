# Git Log Generator

这是一个用于生成和可视化 Git 提交日志的工具。它包含一个基于 Node.js/Express 的后端和一个基于 React 的前端。

## 项目结构

- `backend/`: 后端服务器，使用 Express 处理 Git 数据请求。
- `frontend/`: 前端应用，使用 React 和 Recharts 进行数据可视化。

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) (建议版本 18+)
- [Git](https://git-scm.com/)

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

2. **安装后端依赖**
   ```bash
   cd backend
   npm install
   ```

3. **安装前端依赖**
   ```bash
   cd ../frontend
   npm install
   ```

### 运行项目

您可以直接在根目录下使用以下命令：

1. **一键安装所有依赖**
   ```bash
   npm run install:all
   ```

2. **启动开发服务器** (同时启动前端和后端)
   ```bash
   npm run dev
   ```

运行后：
- 后端服务将启动在 `http://localhost:3001`
- 前端应用将启动在 `http://localhost:5173`

## AI 日志生成说明

本工具通过调用 DeepSeek API 对 Git 提交记录进行分析和润色。

### 核心逻辑
1. **数据收集**：后端通过 `simple-git` 获取指定日期范围和作者的提交记录。
2. **Prompt 组装**：系统根据用户选择的模版（如日报、周报）和附加选项（如包含明日计划、心得感悟），动态生成发给 AI 的指令。
3. **AI 润色**：AI 会将零散的提交信息（如 "fix: typo"）转化为更具专业性的描述（如 "修复了代码中的拼写错误，提高了文档的准确性"），并按项目进行分类汇总。

### 支持的模版
- **日报/周报**：常规工作汇报。
- **技术总结**：侧重于架构变动和逻辑优化。
- **版本发布 (Release Notes)**：侧重于新功能和修复列表。
- **绩效评估 (KPI)**：突出核心贡献。
- **极简/幽默**：不同的表达风格。

## 环境配置

### 后端 (.env)

在 `backend` 目录下参考 `.env.example` 创建一个 `.env` 文件，并配置以下变量：

```env
# 必填：DeepSeek API 密钥
DEEPSEEK_API_KEY=your_api_key_here

# 可选：基础仓库目录（配置后点击“添加仓库”将默认打开此目录，提高效率）
BASE_REPO_DIR=D:\your\projects\path

# 可选：服务器端口
PORT=3001
```

### 前端 (.env)

在 `frontend` 目录下参考 `.env.example` 创建一个 `.env` 文件（可选）：

```env
VITE_API_BASE=http://localhost:3001/api
```

## 技术栈

- **后端**: Node.js, Express, simple-git
- **前端**: React, Vite, Tailwind CSS, Recharts, Lucide React

## 贡献指南

欢迎提交 Issue 或 Pull Request 来完善这个项目。

## 许可证

[ISC](LICENSE)
