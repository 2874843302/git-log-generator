const DEFAULT_REMINDER_TIMES = { DAILY_EMAIL_TIME: '20:00', WEEKLY_EMAIL_TIME: '21:00' };

function buildReminderSchedules(config = {}) {
    const expressions = {};
    for (const [key, fallback] of Object.entries(DEFAULT_REMINDER_TIMES)) {
        const time = config[key] === undefined ? fallback : config[key];
        if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
            throw new Error('提醒时间必须为有效的 HH:mm 格式');
        }
        const [hour, minute] = time.split(':').map(Number);
        expressions[key] = `${minute} ${hour} * * ${key === 'WEEKLY_EMAIL_TIME' ? '5' : '*'}`;
    }
    return expressions;
}

module.exports = { DEFAULT_REMINDER_TIMES, buildReminderSchedules };
