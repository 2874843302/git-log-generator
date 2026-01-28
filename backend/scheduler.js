const { exec } = require('child_process');
const path = require('path');
const { app } = require('electron');

/**
 * Windows 任务计划程序管理服务
 */
class SchedulerService {
    constructor() {
        this.taskName = 'GitLogGeneratorAutoSync';
    }

    /**
     * 更新或创建 Windows 任务计划
     * @param {boolean} enabled 是否启用
     * @param {string} time 触发时间 (HH:mm)
     */
    async syncTask(enabled, time) {
        if (process.platform !== 'win32') return;

        // 1. 先尝试删除旧任务（无论是否存在）
        await this.deleteTask();

        // 2. 如果启用了定时任务，则创建新任务
        if (enabled && time) {
            await this.createTask(time);
        }
    }

    /**
     * 创建定时启动任务
     * @param {string} time 时间格式 HH:mm
     */
    createTask(time) {
        return new Promise((resolve, reject) => {
            const exePath = app.getPath('exe');
            // 使用 schtasks 创建每日任务
            // /create: 创建任务
            // /tn: 任务名称
            // /tr: 运行的程序路径
            // /sc: 计划频率 (daily)
            // /st: 开始时间 (HH:mm)
            // /f: 强制创建，如果已存在则覆盖
            const command = `schtasks /create /tn "${this.taskName}" /tr "\\"${exePath}\\"" /sc daily /st ${time} /f`;
            
            console.log(`[Scheduler] 正在创建 Windows 任务: ${command}`);
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[Scheduler] 创建任务失败: ${stderr}`);
                    return reject(new Error('无法创建 Windows 任务计划: ' + stderr));
                }
                console.log(`[Scheduler] 任务创建成功: ${stdout}`);
                resolve(stdout);
            });
        });
    }

    /**
     * 删除定时启动任务
     */
    deleteTask() {
        return new Promise((resolve) => {
            const command = `schtasks /delete /tn "${this.taskName}" /f`;
            
            console.log(`[Scheduler] 正在尝试删除 Windows 任务: ${this.taskName}`);
            
            exec(command, (error, stdout, stderr) => {
                // 如果任务不存在，会返回错误，我们忽略它
                if (error) {
                    console.log(`[Scheduler] 删除任务时（可能不存在）: ${stderr}`);
                } else {
                    console.log(`[Scheduler] 任务删除成功: ${stdout}`);
                }
                resolve();
            });
        });
    }
}

module.exports = new SchedulerService();
