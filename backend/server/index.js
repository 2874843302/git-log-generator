const express = require('express');
const cors = require('cors');
require('dotenv').config();

// 导入路由
const gitRoutes = require('./routes/gitRoutes');
const aiRoutes = require('./routes/aiRoutes');
const folderRoutes = require('./routes/folderRoutes');
const systemRoutes = require('./routes/systemRoutes');
const noteRoutes = require('./routes/noteRoutes');

const app = express();
const port = process.env.PORT || 3001;

// 中间件配置
app.use(cors());
app.use(express.json());

// 注册路由 (注意: 学习通同步路由已添加)
console.log('正在加载路由...');
app.use('/api', gitRoutes);
app.use('/api', aiRoutes);
app.use('/api', folderRoutes);
app.use('/api', systemRoutes);
app.use('/api', noteRoutes);
console.log('路由加载完成: /api/create-note 已注册');

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
});
