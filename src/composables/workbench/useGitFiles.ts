import { listGitDirectory, readGitFile, writeGitFile } from '@/services/gitApi';
import type { GitFileEntry } from '@/types/git';
import { formatSize } from './utils';
import { ensureRepo, message, showError } from './guards';
import { activeEditorContent, activeEditorPath, gitEntries, gitPath, repoPath } from './state';

/**
 * 加载 `.git` 目录内指定路径的文件列表。
 *
 * @param relativePath `.git` 内相对目录，未传时使用当前浏览目录。
 * @return 无返回值。
 */
export async function loadGitDirectory(relativePath = gitPath.value) {
  if (!ensureRepo()) {
    return;
  }
  gitPath.value = relativePath;
  gitEntries.value = await listGitDirectory(repoPath.value, relativePath);
}

/**
 * 打开 `.git` 条目，目录进入下一级，文件读取到编辑器。
 *
 * @param entry `.git` 文件或目录条目。
 * @return 无返回值。
 */
async function openGitEntry(entry: GitFileEntry) {
  try {
    if (entry.isDir) {
      await loadGitDirectory(entry.path);
      return;
    }

    activeEditorPath.value = entry.path;
    activeEditorContent.value = await readGitFile(repoPath.value, entry.path);
  } catch (error) {
    showError(error);
  }
}

/**
 * 返回 `.git` 浏览器的上级目录。
 *
 * @return 无返回值。
 */
function goGitParent() {
  if (!gitPath.value) {
    return loadGitDirectory('');
  }

  const next = gitPath.value.split('/').slice(0, -1).join('/');
  return loadGitDirectory(next);
}

/**
 * 保存当前 `.git` 文件编辑器中的内容。
 *
 * @return 无返回值。
 */
async function saveActiveGitFile() {
  if (!activeEditorPath.value) {
    message.warning('请先选择文件');
    return;
  }

  try {
    await writeGitFile(repoPath.value, activeEditorPath.value, activeEditorContent.value);
    message.success(`${activeEditorPath.value} 已保存`);
  } catch (error) {
    showError(error);
  }
}

/**
 * 暴露 `.git` 文件浏览和编辑状态。
 *
 * @return `.git` 文件状态与操作。
 */
export function useGitFiles() {
  return {
    gitPath,
    gitEntries,
    activeEditorPath,
    activeEditorContent,
    loadGitDirectory,
    openGitEntry,
    goGitParent,
    saveActiveGitFile,
    formatSize
  };
}
