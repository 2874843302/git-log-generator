import { splitLogsByWorkload } from './logAllocation.js';

const plain = text => text.normalize('NFKC').replace(/[*`]/g, '').replace(/^\s*(?:\d+\\?[.、．]|[-+])\s*/, '').trim();
const keyOf = text => plain(text).replace(/^(?:功能优化|需求处理|定制处理|问题处理|配置处理|pm处理|临时工作)[:：]\s*/, '').replace(/[\p{P}\s]/gu, '').toLowerCase();

function parseItems(content) {
  let headings = [];
  let project = '';
  let daily = null;
  const items = [];
  for (const raw of String(content || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const header = plain(line).match(/^(.+?)[:：]\s*(已完成|进行中)(?:\s*--?\s*(\d+)\s*h)?$/);
    if (header) {
      daily = { project: header[1].trim(), status: header[2], hours: header[3] != null };
      project = daily.project;
      headings = [];
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      daily = null;
      headings = headings.filter(item => item.level < heading[1].length);
      headings.push({ level: heading[1].length, text: line });
      project = headings.map(item => plain(item.text)).join('/');
      continue;
    }
    if (/^今日无工作日志内容[。.]?$/.test(line)) continue;
    const key = keyOf(line);
    if (key) items.push({ text: line, project, key: `${keyOf(project)}\0${key}`, daily, headings: [...headings] });
  }
  return items;
}

function renderItems(items) {
  const groups = [];
  for (const item of items) {
    const id = JSON.stringify([item.daily, item.headings]);
    if (groups.at(-1)?.id !== id) groups.push({ id, daily: item.daily, headings: item.headings, items: [] });
    groups.at(-1).items.push(item.text);
  }
  const timed = groups.filter(group => group.daily?.hours);
  // 删除条目或移动任务后重新分配原有的八小时标题，防止出现空项目占时。
  const hours = timed.map(() => 1);
  if (timed.length && timed.length <= 8) {
    const weights = timed.map(group => group.items.join('').length);
    for (let left = 8 - timed.length; left > 0; left -= 1) {
      let best = 0;
      for (let i = 1; i < weights.length; i += 1) {
        if (weights[i] / (hours[i] + 1) > weights[best] / (hours[best] + 1)) best = i;
      }
      hours[best] += 1;
    }
  }
  let number = 0;
  let timedIndex = 0;
  let previousHeadings = [];
  return groups.flatMap(group => {
    if (group.daily) {
      number += 1;
      previousHeadings = [];
      const duration = group.daily.hours ? `--${hours[timedIndex++]}h` : '';
      return [`${number}\\. ${group.daily.project}: ${group.daily.status}${duration}`, ...group.items];
    }
    const headings = group.headings.filter((heading, index) => heading.text !== previousHeadings[index]?.text).map(heading => heading.text);
    previousHeadings = group.headings;
    return [...headings, ...group.items];
  }).join('\n\n');
}

export function removeRepeatedWorkItems(content, previousContents = []) {
  const seen = new Set(previousContents.flatMap(parseItems).map(item => item.key));
  const unique = [];
  let removedCount = 0;
  for (const item of parseItems(content)) {
    if (seen.has(item.key)) removedCount += 1;
    else { seen.add(item.key); unique.push(item); }
  }
  return { content: renderItems(unique), removedCount };
}

export function rebalanceGeneratedContents(entries) {
  // 生成全部结束后才同步，此时可以把独立条目按原顺序重新连续分配。
  // API 真正失败的日期不参与，避免用其他日期的内容掩盖生成失败。
  const eligible = entries.filter(entry => entry.content || entry.needsRedistribution);
  const seen = new Set();
  const tasks = [];
  const cleaned = eligible.map((entry, index) => {
    const items = parseItems(entry.content).filter(item => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      tasks.push({ ...item, hash: String(tasks.length), message: item.text, repoName: item.project,
        date: `${entry.date.slice(0, 10)}T12:00:00`, sourceIndex: index });
      return true;
    });
    return { ...entry, content: renderItems(items), needsRedistribution: false };
  });
  let repaired = cleaned;
  if (cleaned.some(entry => !entry.content) && tasks.length >= eligible.length) {
    const groups = splitLogsByWorkload(tasks, eligible.map(entry => entry.date));
    repaired = groups.map(group => ({ date: group.date, content: renderItems(group.logs), error: null, needsRedistribution: false }));
  }
  const byDate = new Map(repaired.map(entry => [entry.date, entry]));
  return entries.map(entry => {
    const result = byDate.get(entry.date) || entry;
    return result.content ? result : { ...result, error: result.error || '去重后独立工作条目不足，无法覆盖所有日期，请缩小补全日期范围' };
  });
}
