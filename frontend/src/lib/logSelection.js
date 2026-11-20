export function isMergeCommit(log) {
  // Git 父节点是准确信号，合并提交即使修改了标题也能识别。
  if (log.parents != null) {
    const parents = Array.isArray(log.parents) ? log.parents : String(log.parents).trim().split(/\s+/).filter(Boolean);
    return parents.length > 1;
  }
  // 兼容旧数据；有父节点信息时不依赖标题，避免误判普通开发提交。
  return /^(?:merge\b|合并(?:分支|请求|拉取请求))/i.test(String(log.message || '').trim());
}

export function getDefaultIgnoredHashes(logs, previousIgnored = new Set()) {
  return new Set(logs.filter(log => isMergeCommit(log) || previousIgnored.has(log.hash)).map(log => log.hash));
}
