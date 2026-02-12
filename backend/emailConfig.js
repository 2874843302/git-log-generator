/**
 * 邮件发送服务器配置
 * 请在此处配置用于发送提醒邮件的 SMTP 账号信息
 */
module.exports = {
    // SMTP 服务器地址 (如: smtp.qq.com, smtp.163.com)
    get SMTP_HOST() { return process.env.SMTP_HOST || 'smtp.qq.com'; },
    
    // SMTP 端口 (通常 465 用于 SSL, 587 用于 STARTTLS)
    get SMTP_PORT() { return process.env.SMTP_PORT || 465; },
    
    // 发件人邮箱账号
    get SMTP_USER() { return process.env.SMTP_USER; },
    
    // 发件人邮箱密码或授权码 (注意：不是登录密码，是开启 SMTP 服务后获取的授权码)
    get SMTP_PASS() { return process.env.SMTP_PASS; },
    
    // 发件人显示名称
    get FROM_NAME() { return process.env.FROM_NAME || 'Git Log Generator'; }
};
