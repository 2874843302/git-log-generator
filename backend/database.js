const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db;

/**
 * 初始化数据库
 * @param {string} userDataPath 用户数据目录
 */
function initDatabase(userDataPath) {
    const dbPath = path.join(userDataPath, 'settings.db');
    
    // 确保目录存在
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath);

    // 创建设置表
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log('数据库初始化成功:', dbPath);
}

/**
 * 获取设置值
 * @param {string} key 键名
 * @param {any} defaultValue 默认值
 * @returns {any}
 */
function getSetting(key, defaultValue = null) {
    if (!db) {
        console.warn(`数据库尚未初始化，无法读取设置 [${key}]`);
        return defaultValue;
    }
    try {
        const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
        const row = stmt.get(key);
        return row ? JSON.parse(row.value) : defaultValue;
    } catch (error) {
        console.error(`读取设置 [${key}] 失败:`, error);
        return defaultValue;
    }
}

/**
 * 保存设置值
 * @param {string} key 键名
 * @param {any} value 值
 */
function setSetting(key, value) {
    if (!db) {
        console.warn(`数据库尚未初始化，无法保存设置 [${key}]`);
        return;
    }
    try {
        const stmt = db.prepare(`
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(key, JSON.stringify(value));
    } catch (error) {
        console.error(`保存设置 [${key}] 失败:`, error);
    }
}

/**
 * 获取所有设置
 * @returns {Object}
 */
function getAllSettings() {
    if (!db) {
        console.warn('数据库尚未初始化，无法获取所有设置');
        return {};
    }
    try {
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = JSON.parse(row.value);
        });
        return settings;
    } catch (error) {
        console.error('获取所有设置失败:', error);
        return {};
    }
}

module.exports = {
    initDatabase,
    getSetting,
    setSetting,
    getAllSettings
};
