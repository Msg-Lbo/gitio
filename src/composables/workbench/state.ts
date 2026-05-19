import { computed, ref, watch } from 'vue';
import type { GlobalThemeOverrides } from 'naive-ui';
import type { BranchItem, CommitNode, GitFileEntry, RepoOverview, RepositoryPushCommand, SavedCommand, SavedRepository } from '@/types/git';
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
export const loading = ref(false);
export const commandRunning = ref(false);
export const commandConfirmVisible = ref(false);
export const pendingCommand = ref('');
export const pendingCommandArgs = ref<string[]>([]);
export const commandAlias = ref('');
export const customCommand = ref('git status --short --branch');
export const editingCommandId = ref('');
export const savedCommands = ref<SavedCommand[]>(loadStorage<SavedCommand[]>(STORAGE_KEYS.commands, []));
export const repositoryPushCommands = ref<RepositoryPushCommand[]>(loadStorage<RepositoryPushCommand[]>(STORAGE_KEYS.pushCommands, []));
export const repositoryPushDraft = ref('');
export const commandOutput = ref('');
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
export const remoteLines = computed(() => splitLines(overview.value?.remotes));
export const branchOptions = computed(() => branches.value.map((branch) => ({
  label: `${branch.displayName}${branch.isCurrent ? '  当前' : ''}`,
  value: branch.name
})));
export const currentRepositoryPushCommand = computed(() => repositoryPushCommands.value.find((item) => item.repoPath === repoPath.value.trim())?.command || 'git push origin HEAD');

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
