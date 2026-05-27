import { emit, listen } from '@tauri-apps/api/event';
import { commandPresets } from '@/data/presets';
import { FLOATING_DATA_CHANGED_EVENT } from '@/constants/floating';
import { cancelGitCommand, executeGitStreaming, getRepoOverview, GIT_COMMAND_PROGRESS_EVENT } from '@/services/gitApi';
import type { GitCommandProgressPayload, GitStatusEntry, SavedCommand } from '@/types/git';
import { commandLabel, parseGitCommand } from '@/utils/command';
import { createId } from './utils';
import { ensureRepo, message, showError } from './guards';
import {
  commandAlias,
  commandConfirmVisible,
  commandDangerAcknowledged,
  commandOutput,
  commandProgressPercent,
  commandProgressText,
  commandRunId,
  commandStopRequested,
  commandRunning,
  commitMessage,
  customCommand,
  editingCommandId,
  floatingCommandIds,
  overview,
  pendingCommand,
  pendingCommandArgs,
  pendingCommandRisk,
  repoPath,
  repositoryPushCommands,
  repositoryPushDraft,
  rightPanel,
  savedCommands,
  selectedBranch
} from './state';
import { loadBranches, loadSelectedCommitLine } from './useRepositoryData';

/**
 * 保存当前仓库专属 Push 指令，适配 Gerrit/GitLab 等不同仓库推送规则。
 *
 * @return 无返回值。
 */
function saveRepositoryPushCommand() {
  if (!ensureRepo()) {
    return;
  }

  const command = repositoryPushDraft.value.trim();
  if (!command) {
    message.warning('请输入 Push 指令');
    return;
  }

  const repoKey = repoPath.value.trim();
  const existed = repositoryPushCommands.value.find((item) => item.repoPath === repoKey);
  if (existed) {
    existed.command = command;
  } else {
    repositoryPushCommands.value.unshift({ repoPath: repoKey, command });
  }
  message.success('当前仓库 Push 指令已保存');
}

/**
 * 执行当前仓库专属 Push 指令，未配置则执行默认 push。
 *
 * @return 无返回值。
 */
function runRepositoryPush() {
  const command = repositoryPushDraft.value.trim() || 'git push origin HEAD';
  return runCommand(command);
}

/**
 * 暂存指定文件变更。
 *
 * @param entry Git status 文件变更条目。
 * @return 无返回值。
 */
function stageStatusEntry(entry: GitStatusEntry) {
  return runCommand(`git add -- ${quoteGitPath(entry.path)}`);
}

/**
 * 取消暂存指定文件。
 *
 * @param entry Git status 文件变更条目。
 * @return 无返回值。
 */
function unstageStatusEntry(entry: GitStatusEntry) {
  return runCommand(`git restore --staged -- ${quoteGitPath(entry.path)}`);
}

/**
 * 丢弃指定文件的工作区变更；未跟踪文件走 `git clean` 并触发危险确认。
 *
 * @param entry Git status 文件变更条目。
 * @return 无返回值。
 */
function discardStatusEntry(entry: GitStatusEntry) {
  if (entry.untracked) {
    return runCommand(`git clean -f -- ${quoteGitPath(entry.path)}`);
  }

  return runCommand(`git restore --worktree -- ${quoteGitPath(entry.path)}`);
}

/**
 * 将当前仓库 Push 指令恢复为默认值。
 *
 * @return 无返回值。
 */
function resetRepositoryPushDraft() {
  repositoryPushDraft.value = 'git push origin HEAD';
}

/**
 * 执行 Git 命令前先弹出确认框。
 *
 * @param command 用户命令文本。
 * @return 无返回值。
 */
export function runCommand(command: string) {
  if (!ensureRepo()) {
    return;
  }

  const args = parseGitCommand(command);
  if (!args.length) {
    message.warning('请输入有效 Git 命令');
    return;
  }

  pendingCommand.value = command;
  pendingCommandArgs.value = args;
  commandDangerAcknowledged.value = false;
  commandConfirmVisible.value = true;
}

/**
 * 取消当前待执行命令。
 *
 * @return 无返回值。
 */
function cancelPendingCommand() {
  if (commandRunning.value) {
    return;
  }

  commandConfirmVisible.value = false;
  pendingCommand.value = '';
  pendingCommandArgs.value = [];
  commandDangerAcknowledged.value = false;
}

/**
 * 停止当前仍在后端执行的 Git 子进程。
 *
 * @return 无返回值。
 */
async function cancelRunningCommand() {
  if (!commandRunning.value || !commandRunId.value) {
    return;
  }

  try {
    const cancelled = await cancelGitCommand(commandRunId.value);
    if (cancelled) {
      commandStopRequested.value = true;
      commandProgressText.value = '正在停止命令...';
    } else {
      message.warning('未找到正在执行的命令');
    }
  } catch (error) {
    showError(error);
  }
}

/**
 * 用户确认后执行当前待执行命令。
 *
 * @return 无返回值。
 */
async function confirmPendingCommand() {
  if (!pendingCommand.value || !pendingCommandArgs.value.length) {
    cancelPendingCommand();
    return;
  }

  if (pendingCommandRisk.value.level === 'danger' && !commandDangerAcknowledged.value) {
    message.warning('请先确认危险操作风险');
    return;
  }

  await executeConfirmedCommand(pendingCommand.value, pendingCommandArgs.value);
}

/**
 * 执行已经被用户确认过的 Git 命令，并刷新仓库状态和提交线。
 *
 * @param command 完整命令文本。
 * @param args Git 参数数组。
 * @return 无返回值。
 */
async function executeConfirmedCommand(command: string, args: string[]) {
  const runId = createId();
  let unlisten: (() => void) | null = null;
  let streamedOutput = false;
  commandRunning.value = true;
  commandRunId.value = runId;
  commandStopRequested.value = false;
  commandProgressPercent.value = 0;
  commandProgressText.value = '正在启动 Git 命令...';
  commandOutput.value = `$ ${command}\n`;
  rightPanel.value = 'commands';
  try {
    unlisten = await listen<GitCommandProgressPayload>(GIT_COMMAND_PROGRESS_EVENT, (event) => {
      if (event.payload.commandId !== runId) {
        return;
      }

      streamedOutput = true;
      commandOutput.value += `${event.payload.line}\n`;
      commandProgressText.value = event.payload.line;
      if (event.payload.progress !== null) {
        commandProgressPercent.value = Math.max(
          commandProgressPercent.value,
          normalizeGitProgress(event.payload.line, event.payload.progress)
        );
      }
    });

    const result = await executeGitStreaming(repoPath.value, args, runId);
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    if (!streamedOutput) {
      commandOutput.value = `$ ${command}\n${output || `(exit ${result.code})`}`;
    } else if (result.code !== 0) {
      commandOutput.value += `\n(exit ${result.code})`;
    }
    if (commandStopRequested.value) {
      message.info(`${commandLabel(command)} 已停止`);
    } else if (result.code === 0) {
      commandProgressPercent.value = 100;
      message.success(`${commandLabel(command)} 执行完成`);
    } else {
      message.warning(`${commandLabel(command)} 退出码 ${result.code}`);
    }
    overview.value = await getRepoOverview(repoPath.value);
    await loadBranches(false);
    await loadSelectedCommitLine();
  } catch (error) {
    showError(error);
  } finally {
    unlisten?.();
    commandRunning.value = false;
    commandRunId.value = '';
    commandStopRequested.value = false;
    commandProgressPercent.value = 0;
    commandProgressText.value = '';
    commandConfirmVisible.value = false;
    pendingCommand.value = '';
    pendingCommandArgs.value = [];
    commandDangerAcknowledged.value = false;
  }
}

/**
 * 执行当前自定义命令输入框中的内容。
 *
 * @return 无返回值。
 */
function runCustomCommand() {
  return runCommand(customCommand.value);
}

/**
 * 将预设命令填入自定义指令编辑器。
 *
 * @param alias 指令别名。
 * @param command Git 命令文本。
 * @return 无返回值。
 */
function usePreset(alias: string, command: string) {
  commandAlias.value = alias;
  customCommand.value = command;
  editingCommandId.value = '';
}

/**
 * 保存或更新自定义指令，并支持编辑别名。
 *
 * @return 无返回值。
 */
function saveCustomCommand() {
  const command = customCommand.value.trim();
  if (!command) {
    message.warning('请输入要保存的 Git 指令');
    return;
  }

  const alias = commandAlias.value.trim() || commandLabel(command);
  if (editingCommandId.value) {
    savedCommands.value = savedCommands.value.map((item) => item.id === editingCommandId.value ? { ...item, alias, command } : item);
    message.success('自定义指令已更新');
    cancelCommandEdit();
    return;
  }

  savedCommands.value.unshift({ id: createId(), alias, command });
  commandAlias.value = '';
  message.success('自定义指令已保存');
}

/**
 * 将已保存指令填入编辑器，不改变当前仓库。
 *
 * @param savedCommand 已保存指令。
 * @return 无返回值。
 */
function selectSavedCommand(savedCommand: SavedCommand) {
  commandAlias.value = savedCommand.alias;
  customCommand.value = savedCommand.command;
  editingCommandId.value = '';
}

/**
 * 进入指令编辑状态，允许修改别名和命令内容。
 *
 * @param savedCommand 已保存指令。
 * @return 无返回值。
 */
function editSavedCommand(savedCommand: SavedCommand) {
  commandAlias.value = savedCommand.alias;
  customCommand.value = savedCommand.command;
  editingCommandId.value = savedCommand.id;
}

/**
 * 删除指定自定义指令。
 *
 * @param id 指令 ID。
 * @return 无返回值。
 */
function removeSavedCommand(id: string) {
  savedCommands.value = savedCommands.value.filter((item) => item.id !== id);
  floatingCommandIds.value = floatingCommandIds.value.filter((commandId) => commandId !== id);
  if (editingCommandId.value === id) {
    cancelCommandEdit();
  }
  message.success('自定义指令已删除');
  notifyFloatingDataChanged();
}

/**
 * 将已保存的自定义指令加入悬浮窗快捷区，右键保存指令时调用。
 *
 * @param savedCommand 已保存指令。
 * @return 无返回值。
 */
function addSavedCommandToFloating(savedCommand: SavedCommand) {
  if (floatingCommandIds.value.includes(savedCommand.id)) {
    message.info('该指令已在悬浮窗中');
    return;
  }

  floatingCommandIds.value = [savedCommand.id, ...floatingCommandIds.value];
  message.success(`已添加到悬浮窗：${savedCommand.alias}`);
  notifyFloatingDataChanged();
}

/**
 * 将已保存的自定义指令从悬浮窗快捷区移除。
 *
 * @param savedCommand 已保存指令。
 * @return 无返回值。
 */
function removeSavedCommandFromFloating(savedCommand: SavedCommand) {
  if (!floatingCommandIds.value.includes(savedCommand.id)) {
    message.info('该指令未在悬浮窗中');
    return;
  }

  floatingCommandIds.value = floatingCommandIds.value.filter((commandId) => commandId !== savedCommand.id);
  message.success(`已取消悬浮：${savedCommand.alias}`);
  notifyFloatingDataChanged();
}

/**
 * 判断保存指令是否已经加入悬浮窗，用于主窗口提示当前状态。
 *
 * @param savedCommand 已保存指令。
 * @return 是否已经加入悬浮窗。
 */
function isSavedCommandFloating(savedCommand: SavedCommand) {
  return floatingCommandIds.value.includes(savedCommand.id);
}

/**
 * 通知悬浮窗重新读取 localStorage 中的快捷数据。
 *
 * @return 无返回值。
 */
function notifyFloatingDataChanged() {
  void emit(FLOATING_DATA_CHANGED_EVENT);
}

/**
 * 清空自定义指令编辑器。
 *
 * @return 无返回值。
 */
function clearCommandDraft() {
  commandAlias.value = '';
  customCommand.value = '';
  editingCommandId.value = '';
}

/**
 * 退出自定义指令编辑状态。
 *
 * @return 无返回值。
 */
function cancelCommandEdit() {
  editingCommandId.value = '';
  commandAlias.value = '';
}

/**
 * 使用输入框中的提交信息创建提交。
 *
 * @return 无返回值。
 */
function commitChanges() {
  if (!commitMessage.value.trim()) {
    message.warning('请输入提交信息');
    return;
  }
  return runCommand(`git commit -m "${commitMessage.value.replaceAll('"', '\\"')}"`);
}

/**
 * 修改最近一次提交。输入框为空时保留原提交信息，等价执行 `--no-edit`。
 *
 * @return 无返回值。
 */
function amendCommit() {
  const messageText = commitMessage.value.trim();
  if (!messageText) {
    return runCommand('git commit --amend --no-edit');
  }

  return runCommand(`git commit --amend -m "${messageText.replaceAll('"', '\\"')}"`);
}

/**
 * 导出当前选中分支的文本日志到命令输出区域。
 *
 * @return 无返回值。
 */
function exportSelectedBranchLog() {
  if (!selectedBranch.value) {
    message.warning('请先选择分支');
    return;
  }

  return runCommand(`git log --topo-order --date=relative --max-count=120 --pretty=format:%h %d %s ${selectedBranch.value}`);
}

/**
 * 将文件路径转换为可被前端命令解析器安全处理的双引号参数。
 *
 * @param path Git status 中的文件路径。
 * @return 已转义的命令参数。
 */
function quoteGitPath(path: string) {
  return `"${path.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function normalizeGitProgress(line: string, progress: number) {
  const stage = line.replace(/^remote:\s*/i, '').toLowerCase();
  const ranges: Array<[string, number, number]> = [
    ['counting objects', 5, 15],
    ['compressing objects', 20, 25],
    ['writing objects', 45, 45],
    ['receiving objects', 20, 60],
    ['resolving deltas', 85, 13],
    ['checking out files', 80, 18]
  ];
  const range = ranges.find(([keyword]) => stage.includes(keyword));
  if (!range) {
    return Math.min(progress, 99);
  }

  return Math.min(Math.round(range[1] + (progress * range[2]) / 100), 99);
}

/**
 * 暴露命令中心、确认弹窗和提交动作状态。
 *
 * @return 命令状态与操作。
 */
export function useCommands() {
  return {
    commandRunning,
    commandConfirmVisible,
    commandDangerAcknowledged,
    pendingCommand,
    pendingCommandRisk,
    commandAlias,
    customCommand,
    editingCommandId,
    savedCommands,
    repositoryPushDraft,
    commandOutput,
    commandProgressPercent,
    commandProgressText,
    commitMessage,
    commandPresets,
    saveRepositoryPushCommand,
    runRepositoryPush,
    resetRepositoryPushDraft,
    stageStatusEntry,
    unstageStatusEntry,
    discardStatusEntry,
    runCommand,
    cancelPendingCommand,
    cancelRunningCommand,
    confirmPendingCommand,
    runCustomCommand,
    usePreset,
    saveCustomCommand,
    selectSavedCommand,
    editSavedCommand,
    removeSavedCommand,
    addSavedCommandToFloating,
    removeSavedCommandFromFloating,
    isSavedCommandFloating,
    clearCommandDraft,
    cancelCommandEdit,
    commitChanges,
    amendCommit,
    exportSelectedBranchLog
  };
}
