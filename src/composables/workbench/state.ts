import { computed, ref, watch } from 'vue';
import type { GlobalThemeOverrides } from 'naive-ui';
import type { BranchItem, CommitNode, GitFileEntry, GitStatusEntry, RepoOverview, RepositoryPushCommand, SavedCommand, SavedRepository } from '@/types/git';
import { detectGitCommandRisk } from '@/utils/command';
import { loadStorage, splitLines, STORAGE_KEYS } from './utils';

export type InspectorPanelValue = 'changes' | 'commit' | 'commands' | 'files' | 'config';

export const isDark = ref(false);
export const rightPanel = ref<InspectorPanelValue>('changes');
export const repoPath = ref(localStorage.getItem(STORAGE_KEYS.repoPath) || '');
export const repoAlias = ref('');
export const editingRepoId = ref('');
export const savedRepositories = ref<SavedRepository[]>(loadStorage<SavedRepository[]>(STORAGE_KEYS.repositories, []));
export const overview = ref<RepoOverview | null>(null);
export const branches = ref<BranchItem[]>([]);
export const selectedBranch = ref('');
export const selectedCommitLine = ref<CommitNode[]>([]);
export const selectedCommit = ref<CommitNode | null>(null);
export const commitLineLimit = ref(120);
export const commitLineLoadingMore = ref(false);
export const commitGraphKeyword = ref('');
export const commitGraphAuthor = ref('');
export const loading = ref(false);
export const commandRunning = ref(false);
export const commandConfirmVisible = ref(false);
export const pendingCommand = ref('');
export const pendingCommandArgs = ref<string[]>([]);
export const commandDangerAcknowledged = ref(false);
export const commandAlias = ref('');
export const customCommand = ref('git status --short --branch');
export const editingCommandId = ref('');
export const savedCommands = ref<SavedCommand[]>(loadStorage<SavedCommand[]>(STORAGE_KEYS.commands, []));
export const repositoryPushCommands = ref<RepositoryPushCommand[]>(loadStorage<RepositoryPushCommand[]>(STORAGE_KEYS.pushCommands, []));
export const floatingCommandIds = ref<string[]>(loadStorage<string[]>(STORAGE_KEYS.floatingCommands, []));
export const repositoryPushDraft = ref('');
export const commandOutput = ref('');
export const commandProgressPercent = ref(0);
export const commandProgressText = ref('');
export const commandRunId = ref('');
export const commandStopRequested = ref(false);
export const branchName = ref('');
export const commitMessage = ref('');
export const commitRef = ref('HEAD');
export const gitPath = ref('');
export const gitEntries = ref<GitFileEntry[]>([]);
export const activeEditorPath = ref('');
export const activeEditorContent = ref('');
export const repoConfig = ref('');
export const globalConfig = ref('');
export const globalConfigPath = ref('');

export const inspectorPanels = [
  { label: '变更', value: 'changes' },
  { label: '提交', value: 'commit' },
  { label: '命令', value: 'commands' },
  { label: '文件', value: 'files' },
  { label: '配置', value: 'config' }
] as const;

export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#0ea5e9',
    primaryColorHover: '#0284c7',
    primaryColorPressed: '#0369a1',
    borderRadius: '8px'
  }
};

export const currentRepoAlias = computed(() => savedRepositories.value.find((repo) => repo.path === repoPath.value)?.alias || '');
export const statusLines = computed(() => splitLines(overview.value?.status).filter((line) => !line.startsWith('##')));
export const statusEntries = computed(() => statusLines.value.map(parseStatusEntry).filter((entry): entry is GitStatusEntry => Boolean(entry)));
export const remoteLines = computed(() => splitLines(overview.value?.remotes));
export const branchOptions = computed(() => branches.value.map((branch) => ({
  label: `${branch.displayName}${branch.isCurrent ? '  当前' : ''}`,
  value: branch.name
})));
export const currentRepositoryPushCommand = computed(() => repositoryPushCommands.value.find((item) => item.repoPath === repoPath.value.trim())?.command || 'git push origin HEAD');
export const pendingCommandRisk = computed(() => detectGitCommandRisk(pendingCommandArgs.value));
export const canLoadMoreCommitLine = computed(() => selectedCommitLine.value.length >= commitLineLimit.value);
export const commitGraphAuthorOptions = computed(() => {
  const authorCounts = new Map<string, number>();

  for (const commit of selectedCommitLine.value) {
    const author = commit.author.trim() || 'unknown';
    authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
  }

  return [...authorCounts.entries()]
    .sort(([leftAuthor], [rightAuthor]) => leftAuthor.localeCompare(rightAuthor))
    .map(([author, count]) => ({
      label: `${author} (${count})`,
      value: author
    }));
});
export const filteredCommitLine = computed(() => {
  const keyword = commitGraphKeyword.value.trim().toLowerCase();
  const author = commitGraphAuthor.value.trim();

  return selectedCommitLine.value.filter((commit) => {
    if (author && commit.author !== author) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return [commit.subject, commit.author, commit.refs, commit.hash, commit.shortHash]
      .some((value) => value.toLowerCase().includes(keyword));
  });
});
export const floatingCommands = computed(() => floatingCommandIds.value
  .map((id) => savedCommands.value.find((command) => command.id === id))
  .filter((command): command is SavedCommand => Boolean(command)));

watch(repoPath, (value) => {
  localStorage.setItem(STORAGE_KEYS.repoPath, value);
});

watch(isDark, (value) => {
  document.documentElement.classList.toggle('dark', value);
  localStorage.setItem(STORAGE_KEYS.theme, value ? 'dark' : 'light');
});

watch(savedRepositories, (value) => {
  localStorage.setItem(STORAGE_KEYS.repositories, JSON.stringify(value));
}, { deep: true });

watch(savedCommands, (value) => {
  localStorage.setItem(STORAGE_KEYS.commands, JSON.stringify(value));
}, { deep: true });

watch(repositoryPushCommands, (value) => {
  localStorage.setItem(STORAGE_KEYS.pushCommands, JSON.stringify(value));
}, { deep: true });

watch(floatingCommandIds, (value) => {
  localStorage.setItem(STORAGE_KEYS.floatingCommands, JSON.stringify(value));
}, { deep: true });

watch(selectedCommitLine, (commits) => {
  if (commitGraphAuthor.value && !commits.some((commit) => commit.author === commitGraphAuthor.value)) {
    commitGraphAuthor.value = '';
  }
});

watch(filteredCommitLine, (commits) => {
  if (selectedCommit.value && commits.some((commit) => commit.hash === selectedCommit.value?.hash)) {
    return;
  }

  selectedCommit.value = commits[0] || null;
});

/**
 * 将 `git status --short --branch` 的文件行解析为可操作的变更条目。
 *
 * @param line status 输出中的单行文件状态。
 * @return 解析后的文件变更条目。
 */
function parseStatusEntry(line: string): GitStatusEntry | null {
  if (line.length < 4) {
    return null;
  }

  const indexStatus = line[0] || ' ';
  const worktreeStatus = line[1] || ' ';
  const rawPath = line.slice(3).trim();
  if (!rawPath) {
    return null;
  }

  const [originalPath, path] = splitStatusPath(rawPath);
  const untracked = indexStatus === '?' && worktreeStatus === '?';

  return {
    id: `${indexStatus}${worktreeStatus}:${rawPath}`,
    path,
    originalPath,
    indexStatus,
    worktreeStatus,
    statusLabel: statusLabel(indexStatus, worktreeStatus),
    staged: indexStatus !== ' ' && indexStatus !== '?',
    unstaged: (worktreeStatus !== ' ' && worktreeStatus !== '?') || untracked,
    untracked
  };
}

/**
 * 解析 rename/copy 状态的路径，普通状态直接返回同一路径。
 *
 * @param rawPath status 输出中的路径文本。
 * @return 原始路径和当前路径。
 */
function splitStatusPath(rawPath: string) {
  const separator = ' -> ';
  const separatorIndex = rawPath.lastIndexOf(separator);
  if (separatorIndex === -1) {
    return [rawPath, rawPath];
  }

  return [rawPath.slice(0, separatorIndex), rawPath.slice(separatorIndex + separator.length)];
}

/**
 * 将 Git 双列短状态转换为中文标签。
 *
 * @param indexStatus 暂存区状态字符。
 * @param worktreeStatus 工作区状态字符。
 * @return 中文状态标签。
 */
function statusLabel(indexStatus: string, worktreeStatus: string) {
  if (indexStatus === '?' && worktreeStatus === '?') {
    return '未跟踪';
  }

  const labels = [statusCharLabel(indexStatus, '已暂存'), statusCharLabel(worktreeStatus, '工作区')].filter(Boolean);
  return labels.join(' / ') || '未知';
}

/**
 * 将单个 Git 状态字符转换为中文片段。
 *
 * @param status Git 状态字符。
 * @param scope 状态所属区域。
 * @return 中文状态片段。
 */
function statusCharLabel(status: string, scope: string) {
  const labelMap: Record<string, string> = {
    M: '修改',
    A: '新增',
    D: '删除',
    R: '重命名',
    C: '复制',
    U: '冲突'
  };

  if (!labelMap[status]) {
    return '';
  }

  return `${scope}${labelMap[status]}`;
}
