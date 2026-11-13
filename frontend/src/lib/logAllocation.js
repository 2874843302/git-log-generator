const normalizeText = value => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();

export function completionTime(log) {
  const time = Date.parse(log.completedAt || log.date);
  if (!Number.isFinite(time)) throw new Error('存在完成时间无效的提交，无法按时间分配');
  return time;
}

export function getLogWorkload(log) {
  // 日志内容量不能由生成文件、锁文件等代码行数决定。
  return Math.max(1, normalizeText(`${log.message || ''}\n${log.body || ''}`).length);
}

export function prepareAllocationLogs(logs) {
  logs.forEach(completionTime);
  const chronological = [...logs].sort((a, b) => completionTime(a) - completionTime(b));
  const byHash = new Map();
  const withoutHash = [];
  for (const log of chronological) {
    const project = log.repoPath || log.repoName || '';
    if (log.hash) byHash.set(`${project}\0${log.hash}`, log);
    else withoutHash.push(log);
  }
  // 同项目完全相同的任务描述只分配一次，完成节点取最后一次提交。
  // 不做模糊匹配，避免把不同修复或不同项目误删。
  const byContent = new Map();
  const unique = [];
  for (const log of [...byHash.values(), ...withoutHash].sort((a, b) => completionTime(a) - completionTime(b))) {
    const content = normalizeText(`${log.message || ''}\n${log.body || ''}`);
    if (content) byContent.set(`${log.repoPath || log.repoName || ''}\0${content}`, log);
    else unique.push(log);
  }
  return [...byContent.values(), ...unique].sort((a, b) => completionTime(a) - completionTime(b));
}

export function splitLogsByWorkload(logs, dates) {
  const ordered = prepareAllocationLogs(logs);
  const sortedDates = [...new Set(dates)].sort();
  const n = ordered.length;
  const days = Math.min(n, sortedDates.length);
  const groups = sortedDates.map(date => ({ date, logs: [] }));
  if (!days) return groups;
  if (days === n) {
    ordered.forEach((log, index) => { groups[index].logs = [log]; });
    return groups;
  }
  const prefix = [0];
  for (const log of ordered) prefix.push(prefix.at(-1) + getLogWorkload(log));

  // 全局最小化各天内容量的平方和（等价于最小化方差）。
  // 正权重使最优切点单调，可分治求解，避免逐天贪心与 O(days*n*n) 枚举。
  let previous = new Float64Array(n + 1).fill(Infinity);
  previous[0] = 0;
  const boundaries = [];
  for (let day = 1; day <= days; day += 1) {
    const current = new Float64Array(n + 1).fill(Infinity);
    const cuts = new Uint32Array(n + 1);
    const solve = (left, right, optLeft, optRight) => {
      if (left > right) return;
      const mid = Math.floor((left + right) / 2);
      let best = optLeft;
      for (let cut = optLeft; cut <= Math.min(mid - 1, optRight); cut += 1) {
        const weight = prefix[mid] - prefix[cut];
        const cost = previous[cut] + weight * weight;
        if (cost < current[mid]) {
          current[mid] = cost;
          best = cut;
        }
      }
      cuts[mid] = best;
      solve(left, mid - 1, optLeft, best);
      solve(mid + 1, right, best, optRight);
    };
    solve(day, n, day - 1, n - 1);
    boundaries.push(cuts);
    previous = current;
  }
  let end = n;
  for (let day = days - 1; day >= 0; day -= 1) {
    const start = boundaries[day][end];
    groups[day].logs = ordered.slice(start, end);
    end = start;
  }
  return groups;
}

export function findRepeatedWorkItems(content, previousContents) {
  const items = text => {
    let project = '';
    const result = [];
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.replace(/[*#`]/g, '').replace(/^\s*(?:\d+\\?[.、．]|[-+])\s*/, '').trim();
      const header = line.match(/^(.+?)[:：]\s*(?:已完成|进行中)(?:\s*--?\s*\d+h)?$/);
      if (header) { project = normalizeText(header[1]); continue; }
      if (!line || /^今日无工作日志内容[。.]?$/.test(line)) continue;
      const description = line.replace(/^(?:功能优化|需求处理|定制处理|问题处理|配置处理|pm处理|临时工作)[:：]\s*/, '');
      const key = normalizeText(description).replace(/[\p{P}\s]/gu, '').toLowerCase();
      if (key.length >= 8) result.push(`${project}\0${key}`);
    }
    return result;
  };
  const seen = new Set(previousContents.flatMap(items));
  const repeated = [];
  for (const item of items(content)) {
    if (seen.has(item)) repeated.push(item.split('\0')[1]);
    seen.add(item);
  }
  return repeated;
}
