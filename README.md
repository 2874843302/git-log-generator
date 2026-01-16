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

在 `backend` 目录下，我们配置了同时启动后端和前端的脚本：

```bash
cd backend
npm run dev
```

运行后：
- 后端服务将启动在 `http://localhost:5000` (具体取决于 `.env` 配置)
- 前端应用将启动在 `http://localhost:5173` (Vite 默认端口)

## 环境配置

### 后端 (.env)

在 `backend` 目录下参考 `.env.example` 创建一个 `.env` 文件，并配置以下变量：

```env
DEEPSEEK_API_KEY=your_api_key_here
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
