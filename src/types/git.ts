export interface GitCommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RepoOverview {
  root: string;
  gitDir: string;
  branch: string;
  status: string;
  remotes: string;
  latestCommits: string;
  graph: string;
  commitLine: CommitNode[];
}

export interface CommitNode {
  hash: string;
  shortHash: string;
  parents: string[];
  refs: string;
  author: string;
  relativeTime: string;
  subject: string;
}

export interface BranchItem {
  name: string;
  displayName: string;
  isCurrent: boolean;
  isRemote: boolean;
}

export interface GitFileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

export interface ConfigView {
  repositoryConfig: string;
  globalConfig: string;
  globalConfigPath: string;
}

export interface CommandPreset {
  title: string;
  description: string;
  command: string;
  provider: 'Git' | 'GitLab' | 'Gerrit';
}

export interface SavedRepository {
  id: string;
  alias: string;
  path: string;
}

export interface SavedCommand {
  id: string;
  alias: string;
  command: string;
}

export interface RepositoryPushCommand {
  repoPath: string;
  command: string;
}

export interface GitStatusEntry {
  id: string;
  path: string;
  originalPath: string;
  indexStatus: string;
  worktreeStatus: string;
  statusLabel: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}
