const simpleGit = require('simple-git');

/**
 * 获取 Git 提交记录
 * @param {string} repoPath 仓库路径
 * @param {string} startDate 开始日期 (YYYY-MM-DD)
 * @param {string} endDate 结束日期 (YYYY-MM-DD)
 * @param {string} author 作者名 (可选)
 */
async function getGitLogs(repoPath, startDate, endDate, author) {
    const git = simpleGit(repoPath);
    const options = {
        '--all': true, // 获取所有分支的记录
        '--after': startDate ? `${startDate} 00:00:00` : undefined,
        '--before': endDate ? `${endDate} 23:59:59` : undefined,
        '--author': author || undefined,
    };

    // 过滤掉 undefined 的选项
    const filteredOptions = Object.fromEntries(
        Object.entries(options).filter(([_, v]) => v !== undefined)
    );

    try {
        const logs = await git.log(filteredOptions);
        return logs.all;
    } catch (error) {
        throw new Error(`无法读取 Git 记录: ${error.message}`);
    }
}

/**
 * 为指定的提交记录获取详细的变更信息
 * @param {Object} repoPathsMap 仓库路径映射 (repoName -> path)
 * @param {Array} logs 提交记录列表
 * @param {boolean} includeDiffContent 是否包含具体的代码 diff
 */
async function enrichLogs(repoPathsMap, logs, includeDiffContent) {
    return await Promise.all(logs.map(async (log) => {
        try {
            const path = repoPathsMap[log.repoName];
            if (!path) return log;
            const git = simpleGit(path);

            // 1. 获取文件统计 (--stat)
            const stats = await git.show([log.hash, '--stat', '--format=%b']);
            const lines = stats.split('\n');
            const statInfo = lines.slice(lines.findIndex(line => line.includes('|')) || 0).join('\n').trim();

            let diffContent = '';
            if (includeDiffContent) {
                // 2. 获取具体代码变更 (diff)，限制大小以防 Token 溢出
                const diff = await git.show([log.hash, '--patch', '--format=%b']);
                diffContent = diff.length > 2000 ? diff.substring(0, 2000) + '\n...(部分代码已省略)' : diff;
            }

            return { ...log, diffStat: statInfo, diffContent };
        } catch (e) {
            return { ...log, diffStat: '', diffContent: '' };
        }
    }));
}

/**
 * 获取仓库所有作者
 * @param {Array} repoPaths 仓库路径列表
 */
async function getAuthors(repoPaths) {
    let allAuthors = new Set();
    for (const path of repoPaths) {
        const git = simpleGit(path);
        const result = await git.raw(['log', '--all', '--format=%an']);
        result.split('\n').forEach(a => {
            const name = a.trim();
            if (name) allAuthors.add(name);
        });
    }
    return Array.from(allAuthors);
}

module.exports = {
    getGitLogs,
    enrichLogs,
    getAuthors
};
