const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

// API: 选择本地文件夹 (仅限 Windows)
router.get('/select-folder', (req, res) => {
    const command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '请选择 Git 仓库目录'; if($f.ShowDialog() -eq 'OK') { $f.SelectedPath }"`;
    
    exec(command, (error, stdout) => {
        if (error) {
            return res.status(500).json({ error: '无法打开文件夹对话框' });
        }
        const selectedPath = stdout.trim();
        res.json({ path: selectedPath });
    });
});

module.exports = router;
