/**
 * localStorage 使用的键名，集中维护避免各模块重复硬编码。
 */
export const STORAGE_KEYS = {
  repoPath: 'gitio.repoPath',
  theme: 'gitio.theme',
  repositories: 'gitio.savedRepositories',
  commands: 'gitio.savedCommands',
  pushCommands: 'gitio.repositoryPushCommands',
  floatingCommands: 'gitio.floatingCommandIds'
} as const;

/**
 * 从 localStorage 读取 JSON 数据，读取失败时返回默认值。
 *
 * @param key localStorage 键名。
 * @param fallback 解析失败或无数据时的默认值。
 * @return 解析后的数据。
 */
export function loadStorage<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * 生成前端本地数据 ID，用于仓库收藏和指令收藏。
 *
 * @return 唯一 ID 字符串。
 */
export function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 根据路径推断仓库别名，未设置别名时降低用户输入成本。
 *
 * @param path 仓库路径。
 * @return 推断出的仓库名。
 */
export function inferRepoAlias(path: string) {
  const normalized = path.replaceAll('\\', '/').replace(/\/+$/, '');
  return normalized.split('/').pop() || '未命名仓库';
}

/**
 * 格式化文件大小，提升 `.git` 浏览器可读性。
 *
 * @param size 文件字节数。
 * @return 可读文件大小。
 */
export function formatSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 拆分多行文本并去掉空行。
 *
 * @param text 多行文本。
 * @return 非空文本行。
 */
export function splitLines(text?: string) {
  return (text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
