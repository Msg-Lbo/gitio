import { createDiscreteApi } from 'naive-ui';
import { repoPath } from './state';

export const { message } = createDiscreteApi(['message']);

/**
 * 统一处理异步异常并以 Naive UI message 展示，避免界面静默失败。
 *
 * @param error 捕获到的异常。
 * @return 无返回值。
 */
export function showError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  message.error(text);
}

/**
 * 校验当前是否已输入仓库路径。
 *
 * @return 是否具备仓库路径。
 */
export function ensureRepo() {
  if (repoPath.value.trim()) {
    return true;
  }

  message.warning('请先选择 Git 仓库');
  return false;
}
