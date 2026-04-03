/**
 * 中国大陆工作日判定（法定节假日 + 调休补班）
 * 数据来源：https://timor.tech/api/holiday （按年缓存到本地 + 内存）
 * 规则：API 中有记录且 holiday===true 为放假日（不要求日志）；
 *       holiday===false 为补班（算工作日）；无记录则按周一～周五算工作日。
 */

const fs = require('fs');
const path = require('path');

/** @type {Map<number, Record<string, { holiday?: boolean, name?: string }>>} */
const memoryByYear = new Map();

function getCacheDir() {
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'holiday-cache');
    }
  } catch (_) {
    /* 非 Electron 环境 */
  }
  return path.join(__dirname, 'user_data', 'holiday-cache');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function monthDayKey(date) {
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toYYYYMMDD(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

/**
 * @param {Date} date
 * @param {Record<string, { holiday?: boolean }>} yearMap timor year 接口的 holiday 对象
 */
function isCnWorkdayWithMap(date, yearMap) {
  const w = date.getDay();
  const key = monthDayKey(date);
  if (yearMap && Object.prototype.hasOwnProperty.call(yearMap, key)) {
    return yearMap[key].holiday === false;
  }
  return w !== 0 && w !== 6;
}

function readDiskYear(year) {
  const fp = path.join(getCacheDir(), `${year}.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return null;
  }
}

function writeDiskYear(year, holidayObj) {
  const dir = getCacheDir();
  fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, `${year}.json`);
  fs.writeFileSync(fp, JSON.stringify(holidayObj), 'utf8');
}

async function fetchYearHoliday(year) {
  const url = `https://timor.tech/api/holiday/year/${year}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`节假日接口 HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== 0 || !data.holiday) {
    throw new Error(data.message || '节假日数据格式异常');
  }
  return data.holiday;
}

/**
 * 拉取或读取缓存的一年数据，写入 memoryByYear
 * @param {number} year
 */
async function ensureYear(year) {
  if (memoryByYear.has(year)) return memoryByYear.get(year);

  let map = readDiskYear(year);
  if (!map) {
    map = await fetchYearHoliday(year);
    try {
      writeDiskYear(year, map);
    } catch (e) {
      console.warn('[holidayCalendar] 写入本地缓存失败:', e.message);
    }
  }
  memoryByYear.set(year, map);
  return map;
}

async function ensureYearsForRange(startDate, endDate) {
  const y0 = startDate.getFullYear();
  const y1 = endDate.getFullYear();
  for (let y = y0; y <= y1; y++) {
    await ensureYear(y);
  }
}

/**
 * @param {Date} date
 */
function isCnWorkday(date) {
  const y = date.getFullYear();
  const map = memoryByYear.get(y);
  if (!map) {
    throw new Error(`节假日数据未加载: ${y}`);
  }
  return isCnWorkdayWithMap(date, map);
}

/** 仅周一～周五（不含法定节假日／不含周末补班） */
function collectPlainMonFri(monday, current) {
  const workdays = [];
  const temp = new Date(monday);
  temp.setHours(0, 0, 0, 0);
  const end = new Date(current);
  end.setHours(0, 0, 0, 0);
  while (temp <= end) {
    const d = temp.getDay();
    if (d !== 0 && d !== 6) workdays.push(new Date(temp));
    temp.setDate(temp.getDate() + 1);
  }
  return workdays;
}

/**
 * 本周一 00:00 至今天 00:00 内「应写工作日志」的日期 YYYYMMDD（可选应用节假日历）
 * @param {boolean} useHoliday
 * @returns {Promise<string[]>}
 */
async function mondayToTodayYYYYMMDDForLogCheck(useHoliday = true) {
  const current = new Date();
  current.setHours(0, 0, 0, 0);
  const dayOfWeek = current.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(current);
  monday.setDate(current.getDate() - daysSinceMonday);

  if (!useHoliday) {
    return collectPlainMonFri(monday, current).map(toYYYYMMDD);
  }

  try {
    await ensureYearsForRange(monday, current);
    const out = [];
    const temp = new Date(monday);
    while (temp <= current) {
      if (isCnWorkday(temp)) out.push(toYYYYMMDD(new Date(temp)));
      temp.setDate(temp.getDate() + 1);
    }
    return out;
  } catch (e) {
    console.warn('[holidayCalendar] 使用接口失败，回退为仅周一～周五:', e.message);
    return collectPlainMonFri(monday, current).map(toYYYYMMDD);
  }
}

/**
 * 从今天往前共 dayCount 个自然日内，应检查日志的日期 YYYYMMDD
 * @param {number} dayCount
 * @param {boolean} useHoliday
 */
async function recentNaturalDaysYYYYMMDDForLogCheck(dayCount = 7, useHoliday = true) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidates = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    candidates.push(d);
  }
  if (!useHoliday) {
    return candidates.filter((d) => d.getDay() !== 0 && d.getDay() !== 6).map(toYYYYMMDD);
  }
  const min = candidates[candidates.length - 1];
  const max = candidates[0];
  try {
    await ensureYearsForRange(min, max);
    return candidates.filter((d) => isCnWorkday(d)).map(toYYYYMMDD);
  } catch (e) {
    console.warn('[holidayCalendar] 使用接口失败，回退为仅周一～周五:', e.message);
    return candidates.filter((d) => d.getDay() !== 0 && d.getDay() !== 6).map(toYYYYMMDD);
  }
}

module.exports = {
  mondayToTodayYYYYMMDDForLogCheck,
  recentNaturalDaysYYYYMMDDForLogCheck,
  ensureYear,
  clearMemoryCache: () => memoryByYear.clear(),
};
