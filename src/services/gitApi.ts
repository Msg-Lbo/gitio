import { invoke } from '@tauri-apps/api/core';
import type { BranchItem, CommitNode, ConfigView, GitCommandResult, GitFileEntry, RepoOverview } from '@/types/git';

export const GIT_COMMAND_PROGRESS_EVENT = 'gitio:git-command-progress';

/**
 * 调用 Tauri 后端执行 Git 命令，参数不包含 `git` 本身。
 *
 * @param repoPath 仓库根目录路径。
 * @param args Git 参数数组。
 * @return Git 命令执行结果。
 */
export function executeGit(repoPath: string, args: string[]) {
  return invoke<GitCommandResult>('execute_git', {
    request: {
      repoPath,
      args
    }
  });
}

export function executeGitStreaming(repoPath: string, args: string[], commandId: string) {
  return invoke<GitCommandResult>('execute_git_streaming', {
    request: {
      repoPath,
      args,
      commandId
    }
  });
}

export function cancelGitCommand(commandId: string) {
  return invoke<boolean>('cancel_git_command', { commandId });
}

/**
 * 读取仓库状态、远端、最新提交和提交图谱等概览信息。
 *
 * @param repoPath 仓库根目录路径。
 * @return 仓库概览数据。
 */
export function getRepoOverview(repoPath: string) {
  return invoke<RepoOverview>('get_repo_overview', { repoPath });
}

/**
 * 读取仓库分支列表，包含本地和远端分支。
 *
 * @param repoPath 仓库根目录路径。
 * @return 分支列表。
 */
export function listBranches(repoPath: string) {
  return invoke<BranchItem[]>('list_branches', { repoPath });
}

/**
 * 读取指定分支或引用的结构化提交线。
 *
 * @param repoPath 仓库根目录路径。
 * @param targetRef 分支、tag 或提交引用。
 * @param maxCount 最多读取的提交数量。
 * @return 提交节点列表。
 */
export function getCommitLine(repoPath: string, targetRef: string, maxCount: number) {
  return invoke<CommitNode[]>('get_commit_line', { repoPath, targetRef, maxCount });
}

/**
 * 列出 `.git` 目录内指定路径下的文件和目录。
 *
 * @param repoPath 仓库根目录路径。
 * @param relativePath `.git` 目录内的相对路径。
 * @return 文件条目列表。
 */
export function listGitDirectory(repoPath: string, relativePath = '') {
  return invoke<GitFileEntry[]>('list_git_directory', { repoPath, relativePath });
}

/**
 * 读取 `.git` 目录内的文本文件内容。
 *
 * @param repoPath 仓库根目录路径。
 * @param relativePath `.git` 目录内的相对文件路径。
 * @return 文件文本内容。
 */
export function readGitFile(repoPath: string, relativePath: string) {
  return invoke<string>('read_git_file', { repoPath, relativePath });
}

/**
 * 保存 `.git` 目录内的文本文件内容。
 *
 * @param repoPath 仓库根目录路径。
 * @param relativePath `.git` 目录内的相对文件路径。
 * @param content 待保存内容。
 * @return 保存完成信号。
 */
export function writeGitFile(repoPath: string, relativePath: string, content: string) {
  return invoke<void>('write_git_file', { repoPath, relativePath, content });
}

/**
 * 读取仓库级和全局级 Git config 文件内容。
 *
 * @param repoPath 仓库根目录路径。
 * @return config 视图数据。
 */
export function readConfigs(repoPath: string) {
  return invoke<ConfigView>('read_configs', { repoPath });
}

/**
 * 保存仓库级 Git config。
 *
 * @param repoPath 仓库根目录路径。
 * @param content config 文件内容。
 * @return 保存完成信号。
 */
export function writeRepoConfig(repoPath: string, content: string) {
  return invoke<void>('write_repo_config', { repoPath, content });
}

/**
 * 保存当前用户的全局 Git config。
 *
 * @param content config 文件内容。
 * @return 保存完成信号。
 */
export function writeGlobalConfig(content: string) {
  return invoke<void>('write_global_config', { content });
}
