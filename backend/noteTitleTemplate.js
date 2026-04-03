/**
 * 学习通笔记标题：与 frontend/src/utils/noteTitleTemplate.js 保持逻辑一致（修改时请同步两处）。
 * 未配置 TITLE_TEMPLATE 时默认「工作日志-YYYY-MM-DD」（占位符 {date-hyphen}）。
 */

const DEFAULT_NOTE_TITLE_TEMPLATE = '工作日志-{date-hyphen}';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** @param {string} ymd - YYYYMMDD 或 YYYY-MM-DD */
function parseDateParts(dateStr) {
  let y;
  let mo;
  let da;
  if (dateStr.includes('-')) {
    const p = dateStr.split('-');
    y = parseInt(p[0], 10);
    mo = parseInt(p[1], 10);
    da = parseInt(p[2], 10);
  } else {
    y = parseInt(dateStr.slice(0, 4), 10);
    mo = parseInt(dateStr.slice(4, 6), 10);
    da = parseInt(dateStr.slice(6, 8), 10);
  }
  if (!y || !mo || !da) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return { y, mo, da };
}

/**
 * @param {string} [rawTemplate] - 用户配置的 TITLE_TEMPLATE，空则使用默认
 * @param {string|Date} dateInput - YYYYMMDD、YYYY-MM-DD 或 Date
 * @param {{ author?: string, repo?: string }} [options]
 * @returns {string}
 */
function buildNoteTitleFromTemplate(rawTemplate, dateInput, options = {}) {
  const author = options.author != null ? String(options.author) : 'Unknown';
  const repo = options.repo != null ? String(options.repo) : 'MultiRepos';

  const template =
    rawTemplate && String(rawTemplate).trim()
      ? String(rawTemplate)
      : DEFAULT_NOTE_TITLE_TEMPLATE;

  let ymdStr;
  if (typeof dateInput === 'string') {
    ymdStr = dateInput.includes('-') ? dateInput.replace(/-/g, '') : dateInput;
  } else if (dateInput instanceof Date) {
    const d = dateInput;
    ymdStr = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  } else {
    throw new Error('dateInput must be YYYYMMDD, YYYY-MM-DD, or Date');
  }

  const { y, mo, da } = parseDateParts(ymdStr);
  const formattedDate = `${y}${pad2(mo)}${pad2(da)}`;
  const formattedDateHyphen = `${y}-${pad2(mo)}-${pad2(da)}`;
  const formattedDateCN = `${y}年${mo}月${da}日`;

  let syncTitle = template
    .replace(/{date}/g, formattedDate)
    .replace(/{date-hyphen}/g, formattedDateHyphen)
    .replace(/{date-cn}/g, formattedDateCN)
    .replace(/{author}/g, author)
    .replace(/{repo}/g, repo);

  if (
    template.includes('YYYY') ||
    template.includes('MM') ||
    template.includes('DD')
  ) {
    const yyyy = String(y);
    const mm = pad2(mo);
    const dd = pad2(da);
    syncTitle = syncTitle
      .replace(/YYYY/g, yyyy)
      .replace(/MM/g, mm)
      .replace(/DD/g, dd);
  }

  // 与前端一致：清除模板里可能残留的旧日期字面量
  syncTitle = syncTitle.replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g, formattedDateHyphen);
  syncTitle = syncTitle.replace(/\d{4}年\d{1,2}月\d{1,2}日/g, formattedDateCN);
  syncTitle = syncTitle.replace(/\d{8}/g, formattedDate);

  return syncTitle;
}

module.exports = {
  DEFAULT_NOTE_TITLE_TEMPLATE,
  buildNoteTitleFromTemplate,
};
