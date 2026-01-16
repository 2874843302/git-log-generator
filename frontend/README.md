# Git Log Generator - Frontend

这是项目的客户端部分，使用 React + Vite 构建。

## 功能特性

- **可视化图表**：使用 Recharts 展示提交频率。
- **Git 日志查看**：支持多仓库日志汇总。
- **AI 日志生成**：支持多种模版（日报、周报、技术总结等）及自定义选项。
- **Markdown 预览**：实时预览生成的日志内容。

## 开发启动

在 `frontend` 目录下运行：

```bash
npm install
npm run dev
```

## 环境变量

可以创建 `.env` 文件来配置后端 API 地址：

```env
VITE_API_BASE=http://localhost:3001/api
```

更多详细信息请参阅[根目录 README](../README.md)。
