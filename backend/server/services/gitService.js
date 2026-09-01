const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');

// 项目识别标记文件（monorepo 内子项目判定）
const PROJECT_MARKER_FILES = ['package.json', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'go.mod', 'cargo.toml', 'pyproject.toml', 'setup.py', 'requirements.txt'];
// 扫描时跳过的目录
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'target', 'coverage', '.idea', '.vscode', '.qoder', '.agents']);

function hasProjectMarker(dir) {
    try {
        return fs.readdirSync(dir).some((name) => {
            const lower = String(name).toLowerCase();
            return PROJECT_MARKER_FILES.includes(lower) || lower.endsWith('.sln') || lower.endsWith('.csproj');
        });
    } catch (e) {
        return false;
    }
}

function listSubDirs(dir) {
    try {
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter((d) => d.isDirectory() && !EXCLUDE_DIRS.has(d.name) && !d.name.startsWith('.'))
            .map((d) => path.join(dir, d.name));
    } catch (e) {
        return [];
    }
}

/**
 * monorepo 展开：仓库根目录下带项目标记文件的子目录（两层内），>=2 个才认为是多项目
 */
function expandMonorepo(repoRoot) {
    const projects = [];
    for (const d1 of listSubDirs(repoRoot)) {
        if (hasProjectMarker(d1)) {
            projects.push(d1);
            continue;
        }
        for (const d2 of listSubDirs(d1)) {
            if (hasProjectMarker(d2)) projects.push(d2);
        }
    }
    return projects.length >= 2 ? projects : [];
}

/**
 * 选择最外层目录时自动识别内部仓库/项目：
 * - 选中目录本身是 git 仓库：多项目则展开为子项目列表，否则返回自身
 * - 选中目录不是仓库：递归（深度3）查找内部 git 仓库，monorepo 同样展开
 * @returns {Promise<{repos: string[], monorepo: boolean}>}
 */
async function detectRepos(rootPath) {
    if (await isGitRepo(rootPath)) {
        const projects = expandMonorepo(rootPath);
        return { repos: projects.length > 0 ? projects : [rootPath], monorepo: projects.length > 0 };
    }

    const found = [];
    const walk = async (dir, depth) => {
        if (depth > 3 || found.length >= 20) return;
        if (await isGitRepo(dir)) {
            const projects = expandMonorepo(dir);
            if (projects.length > 0) found.push(...projects);
            else found.push(dir);
            return; // 已进入仓库，不再下钻
        }
        for (const sub of listSubDirs(dir)) {
            await walk(sub, depth + 1);
        }
    };
    await walk(rootPath, 0);
    return { repos: found, monorepo: false };
}

/**
 * 获取路径所在 git 仓库的根目录（用于子项目标识展示）
 * @returns {Promise<string|null>}
 */
async function getRepoRoot(repoPath) {
    try {
        const root = (await simpleGit(repoPath).revparse(['--show-toplevel'])).trim();
        return root || null;
    } catch (e) {
        return null;
    }
}

/**
 * 单仓库多项目支持：若选中目录是 git 仓库的子目录，
 * 返回 ['--', 子路径] 作为 pathspec，使 log/show 只统计涉及该子目录的提交。
 * 选中仓库根目录时返回空数组（行为不变）。
 */
async function getSubPathSpec(git, repoPath) {
    try {
        const root = (await git.revparse(['--show-toplevel'])).trim();
        const norm = (p) => path.resolve(p).replace(/[\\/]+$/, '');
        if (root && norm(root) !== norm(repoPath)) {
            return ['--', repoPath];
        }
    } catch (e) {
        // 非仓库等异常：不加过滤，交由上层容错
    }
    return [];
}

/**
 * 获取 Git 提交记录
 * @param {string} repoPath 仓库路径
 * @param {string} startDate 开始日期 (YYYY-MM-DD)
 * @param {string} endDate 结束日期 (YYYY-MM-DD)
 * @param {string} author 作者名 (可选)
 * @param {Array} branches 分支列表 (可选)
 */
async function getGitLogs(repoPath, startDate, endDate, author, branches) {
    const git = simpleGit(repoPath);
    
    // 如果没有指定分支，默认使用 --all
    const useAll = !branches || branches.length === 0;

    const options = {
        '--all': useAll ? true : undefined,
        '--after': startDate ? `${startDate} 00:00:00` : undefined,
        '--before': endDate ? `${endDate} 23:59:59` : undefined,
        '--author': author || undefined,
    };

    // 如果指定了分支，将分支名添加到选项中
    const args = [];
    if (!useAll) {
        args.push(...branches);
    }

    // 过滤掉 undefined 的选项并转换为数组
    const filteredOptions = Object.entries(options)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => (v === true ? k : `${k}=${v}`));

    // 单仓库多项目：子目录作为独立“仓库”时按子路径过滤提交
    const pathSpec = await getSubPathSpec(git, repoPath);

    try {
        const logs = await git.log([...filteredOptions, ...args, ...pathSpec]);
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
    // 单仓库多项目：子路径过滤缓存 (repoPath -> pathSpec)
    const pathSpecCache = {};
    const specFor = async (repoPath) => {
        if (!pathSpecCache[repoPath]) {
            pathSpecCache[repoPath] = await getSubPathSpec(simpleGit(repoPath), repoPath);
        }
        return pathSpecCache[repoPath];
    };

    return await Promise.all(logs.map(async (log) => {
        try {
            const repoPath = repoPathsMap[log.repoName];
            if (!repoPath) return log;
            const git = simpleGit(repoPath);
            const pathSpec = await specFor(repoPath);

            // 1. 获取文件统计 (--stat)，子目录项目只统计该子路径内的变更
            const stats = await git.show([log.hash, '--stat', '--format=%b', ...pathSpec]);
            const lines = stats.split('\n');
            const statInfo = lines.slice(lines.findIndex(line => line.includes('|')) || 0).join('\n').trim();

            let diffContent = '';
            if (includeDiffContent) {
                // 2. 获取具体代码变更 (diff)，限制大小以防 Token 溢出
                const diff = await git.show([log.hash, '--patch', '--format=%b', ...pathSpec]);
                diffContent = diff.length > 2000 ? diff.substring(0, 2000) + '\n...(部分代码已省略)' : diff;
            }

            return { ...log, diffStat: statInfo, diffContent };
        } catch (e) {
            return { ...log, diffStat: '', diffContent: '' };
        }
    }));
}

/**
 * 判断路径是否为 git 仓库（仓库迁移/误选目录时用于校验）
 * @param {string} repoPath 路径
 * @returns {Promise<boolean>}
 */
async function isGitRepo(repoPath) {
    try {
        return await simpleGit(repoPath).checkIsRepo();
    } catch (error) {
        return false;
    }
}

/**
 * 获取仓库所有作者
 * @param {Array} repoPaths 仓库路径列表
 */
async function getAuthors(repoPaths) {
    let allAuthors = new Set();
    for (const path of repoPaths) {
        try {
            const git = simpleGit(path);
            const result = await git.raw(['log', '--all', '--format=%an']);
            result.split('\n').forEach(a => {
                const name = a.trim();
                if (name) allAuthors.add(name);
            });
        } catch (error) {
            // 容忍非 git 仓库路径（如误选的普通文件夹），跳过并继续
            console.error(`读取仓库 ${path} 作者失败:`, error.message);
        }
    }
    return Array.from(allAuthors);
}

/**
 * 获取仓库所有分支（按仓库分组）
 * @param {Array} repoPaths 仓库路径列表
 */
async function getBranches(repoPaths) {
    let repoBranches = [];
    for (const path of repoPaths) {
        try {
            const git = simpleGit(path);
            const repoName = path.replace(/[\\/]$/, '').split(/[\\/]/).pop();
            const result = await git.branch(); // 不传参数默认只获取本地分支
            const branches = new Set();
            
            result.all.forEach(b => {
                // simpleGit.branch() 返回的 result.all 包含本地分支
                let name = b.trim();
                if (name && name !== 'HEAD' && !name.startsWith('remotes/')) branches.add(name);
            });

            repoBranches.push({
                path,
                repoName,
                branches: Array.from(branches)
            });
        } catch (error) {
            console.error(`读取仓库 ${path} 分支失败:`, error);
        }
    }
    return repoBranches;
}

module.exports = {
    getGitLogs,
    enrichLogs,
    getAuthors,
    getBranches,
    isGitRepo,
    detectRepos,
    getRepoRoot
};
