import { nextTick } from 'vue';
import { getCommitLine, getRepoOverview, listBranches } from '@/services/gitApi';
import type { CommitNode } from '@/types/git';
import { useCommitGraph } from '@/composables/useCommitGraph';
import { ensureRepo, message, showError } from './guards';
import {
  branchOptions,
  commitGraphAuthor,
  commitGraphAuthorOptions,
  commitGraphKeyword,
  canLoadMoreCommitLine,
  branches,
  commitLineLimit,
  commitLineLoadingMore,
  currentRepositoryPushCommand,
  filteredCommitLine,
  loading,
  overview,
  repoPath,
  repositoryPushDraft,
  rightPanel,
  selectedBranch,
  selectedCommit,
  selectedCommitLine,
  statusEntries,
  statusLines
} from './state';
import { loadConfigs } from './useConfigFiles';
import { loadGitDirectory } from './useGitFiles';

const commitLineBatchSize = 120;
const graph = useCommitGraph(selectedCommitLine);

/**
 * 刷新仓库概览、`.git` 文件列表和配置内容。
 *
 * @return 无返回值。
 */
export async function refreshAll() {
  if (!ensureRepo()) {
    return;
  }

  loading.value = true;
  await nextTick();
  try {
    overview.value = await getRepoOverview(repoPath.value);
    repositoryPushDraft.value = currentRepositoryPushCommand.value;
    await Promise.all([loadBranches(), loadGitDirectory(), loadConfigs()]);
    message.success('仓库信息已刷新');
  } catch (error) {
    showError(error);
  } finally {
    loading.value = false;
  }
}

/**
 * 清空当前仓库派生数据，避免切换仓库时短暂显示上一个仓库的提交详情。
 *
 * @return 无返回值。
 */
export function resetRepositoryData() {
  overview.value = null;
  branches.value = [];
  selectedBranch.value = '';
  selectedCommitLine.value = [];
  selectedCommit.value = null;
  commitLineLimit.value = commitLineBatchSize;
}

/**
 * 加载本地和远端分支，并按当前分支初始化提交线选择。
 *
 * @param resetSelection 是否根据当前仓库分支重置选择。
 * @return 无返回值。
 */
export async function loadBranches(resetSelection = true) {
  if (!ensureRepo()) {
    return;
  }

  branches.value = await listBranches(repoPath.value);
  if (!branches.value.length) {
    selectedBranch.value = '';
    selectedCommitLine.value = overview.value?.commitLine || [];
    selectedCommit.value = filteredCommitLine.value[0] || null;
    return;
  }

  if (resetSelection || !branches.value.some((branch) => branch.name === selectedBranch.value)) {
    selectedBranch.value = branches.value.find((branch) => branch.isCurrent)?.name || overview.value?.branch || branches.value[0].name;
    commitLineLimit.value = commitLineBatchSize;
  }

  await loadSelectedCommitLine();
}

/**
 * 按当前选择分支加载提交线。
 *
 * @return 无返回值。
 */
export async function loadSelectedCommitLine() {
  if (!ensureRepo() || !selectedBranch.value) {
    selectedCommitLine.value = overview.value?.commitLine || [];
    selectedCommit.value = filteredCommitLine.value[0] || null;
    return;
  }

  selectedCommitLine.value = await getCommitLine(repoPath.value, selectedBranch.value, commitLineLimit.value);
  selectedCommit.value = filteredCommitLine.value[0] || null;
}

/**
 * 继续读取更早的提交记录，避免固定数量截断导致历史不可见。
 *
 * @return 无返回值。
 */
async function loadMoreCommitLine() {
  if (!ensureRepo() || !selectedBranch.value || commitLineLoadingMore.value) {
    return;
  }

  const previousLimit = commitLineLimit.value;
  commitLineLimit.value += commitLineBatchSize;
  commitLineLoadingMore.value = true;

  try {
    selectedCommitLine.value = await getCommitLine(repoPath.value, selectedBranch.value, commitLineLimit.value);
  } catch (error) {
    commitLineLimit.value = previousLimit;
    showError(error);
  } finally {
    commitLineLoadingMore.value = false;
  }
}

/**
 * 左侧选择分支后刷新中间提交图谱。
 *
 * @param branch 分支名或远端 ref。
 * @return 无返回值。
 */
async function selectBranch(branch: string) {
  selectedBranch.value = branch;
  await loadSelectedCommitLine();
}

/**
 * 选择中间图谱中的提交，并切换右侧 Inspector 到提交详情。
 *
 * @param commit 提交节点。
 * @return 无返回值。
 */
function selectCommit(commit: CommitNode) {
  selectedCommit.value = commit;
  rightPanel.value = 'commit';
}

/**
 * 刷新当前分支提交线，同时保持分支选择不变。
 *
 * @return 无返回值。
 */
async function refreshCommitLine() {
  if (!ensureRepo()) {
    return;
  }

  loading.value = true;
  try {
    await loadBranches(false);
    message.success('提交线已刷新');
  } catch (error) {
    showError(error);
  } finally {
    loading.value = false;
  }
}

/**
 * 暴露仓库概览、分支、提交线和图谱状态。
 *
 * @return 仓库数据状态与操作。
 */
export function useRepositoryData() {
  return {
    overview,
    branches,
    selectedBranch,
    selectedCommitLine,
    filteredCommitLine,
    selectedCommit,
    commitGraphKeyword,
    commitGraphAuthor,
    commitGraphAuthorOptions,
    canLoadMoreCommitLine,
    commitLineLoadingMore,
    loading,
    statusLines,
    statusEntries,
    branchOptions,
    ...graph,
    refreshAll,
    loadBranches,
    loadSelectedCommitLine,
    resetRepositoryData,
    selectBranch,
    selectCommit,
    refreshCommitLine,
    loadMoreCommitLine
  };
}
