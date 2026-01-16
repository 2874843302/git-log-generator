/**
 * 默认模版基础定义 (仅定义角色和核心任务，具体板块由 options 动态控制)
 */
const templates = {
    daily: "作为一名软件工程师，请根据以下 Git 提交记录生成一份专业的日报。主要任务是汇总今日完成的工作。使用 Markdown 格式。",
    weekly: "请根据以下 Git 提交记录生成一份本周工作周报。主要任务是汇总本周主要成就和项目进展。使用 Markdown 格式。",
    technical: "请根据以下 Git 提交记录生成一份技术总结。主要任务是汇总技术架构变动和核心逻辑优化。使用 Markdown 格式。",
    release: "请根据以下 Git 提交记录生成一份正式的版本发布公告（Release Notes）。主要任务是列出新功能、优化和修复。使用 Markdown 格式。",
    kpi: "请根据以下 Git 提交记录生成一份绩效评估自述。主要任务是突出对业务和技术的关键贡献。使用 Markdown 格式。",
    concise: "请根据以下 Git 提交记录生成一份极简工作总结。用最精炼的语言列出主要事项。使用 Markdown 格式。",
    humorous: "请根据以下 Git 提交记录生成一份带有幽默感的程序员工作日志。在真实汇总工作的同时，加入一些程序员梗。使用 Markdown 格式。"
};

module.exports = {
    templates
};
