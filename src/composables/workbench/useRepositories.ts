import { open } from '@tauri-apps/plugin-dialog';
import type { SavedRepository } from '@/types/git';
import { createId, inferRepoAlias } from './utils';
import { ensureRepo, message } from './guards';
import {
  activeEditorContent,
  activeEditorPath,
  currentRepoAlias,
  editingRepoId,
  gitPath,
  repoAlias,
  repoPath,
  repositoryPushCommands,
  repositoryPushDraft,
  savedRepositories
} from './state';
import { refreshAll, resetRepositoryData } from './useRepositoryData';

/**
 * 选择本地 Git 仓库目录。
 *
 * @return 无返回值。
 */
async function pickRepository() {
  const selected = await open({ directory: true, multiple: false });
  if (typeof selected === 'string') {
    repoPath.value = selected;
    repoAlias.value = repoAlias.value || inferRepoAlias(selected);
    await refreshAll();
  }
}

/**
 * 保存或更新当前仓库收藏，支持设置别名。
 *
 * @return 无返回值。
 */
function saveRepository() {
  if (!ensureRepo()) {
    return;
  }

  const alias = repoAlias.value.trim() || inferRepoAlias(repoPath.value);
  const targetPath = repoPath.value.trim();

  if (editingRepoId.value) {
    savedRepositories.value = savedRepositories.value.map((repo) => repo.id === editingRepoId.value ? { ...repo, alias, path: targetPath } : repo);
    message.success('仓库收藏已更新');
    cancelRepositoryEdit();
    return;
  }

  const existed = savedRepositories.value.find((repo) => repo.path === targetPath);
  if (existed) {
    existed.alias = alias;
    message.success('仓库别名已更新');
    return;
  }

  savedRepositories.value.unshift({ id: createId(), alias, path: targetPath });
  repoAlias.value = '';
  message.success('仓库已保存');
}

/**
 * 点击收藏仓库后切换当前工作仓库并刷新信息。
 *
 * @param repo 收藏仓库对象。
 * @return 无返回值。
 */
async function switchRepository(repo: SavedRepository) {
  repoPath.value = repo.path;
  repoAlias.value = repo.alias;
  repositoryPushDraft.value = repositoryPushCommands.value.find((item) => item.repoPath === repo.path)?.command || 'git push origin HEAD';
  editingRepoId.value = '';
  gitPath.value = '';
  activeEditorPath.value = '';
  activeEditorContent.value = '';
  resetRepositoryData();
  await refreshAll();
}

/**
 * 进入仓库收藏编辑状态。
 *
 * @param repo 收藏仓库对象。
 * @return 无返回值。
 */
function editRepository(repo: SavedRepository) {
  editingRepoId.value = repo.id;
  repoPath.value = repo.path;
  repoAlias.value = repo.alias;
}

/**
 * 删除指定仓库收藏。
 *
 * @param id 仓库收藏 ID。
 * @return 无返回值。
 */
function removeRepository(id: string) {
  savedRepositories.value = savedRepositories.value.filter((repo) => repo.id !== id);
  if (editingRepoId.value === id) {
    cancelRepositoryEdit();
  }
  message.success('仓库收藏已删除');
}

/**
 * 退出仓库收藏编辑状态。
 *
 * @return 无返回值。
 */
function cancelRepositoryEdit() {
  editingRepoId.value = '';
  repoAlias.value = '';
}

/**
 * 暴露仓库收藏和当前仓库路径状态。
 *
 * @return 仓库状态与操作。
 */
export function useRepositories() {
  return {
    repoPath,
    repoAlias,
    editingRepoId,
    savedRepositories,
    currentRepoAlias,
    pickRepository,
    inferRepoAlias,
    saveRepository,
    switchRepository,
    editRepository,
    removeRepository,
    cancelRepositoryEdit
  };
}

export { pickRepository, saveRepository, switchRepository, editRepository, removeRepository, cancelRepositoryEdit };
