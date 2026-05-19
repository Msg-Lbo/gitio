import { commandPresets } from '@/data/presets';
import { executeGit, getRepoOverview } from '@/services/gitApi';
import type { SavedCommand } from '@/types/git';
import { commandLabel, parseGitCommand } from '@/utils/command';
import { createId } from './utils';
import { ensureRepo, message, showError } from './guards';
import {
  commandAlias,
  commandConfirmVisible,
  commandOutput,
  commandRunning,
  commitMessage,
  customCommand,
  editingCommandId,
  overview,
  pendingCommand,
  pendingCommandArgs,
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
  commandRunning.value = true;
  commandOutput.value = `$ ${command}\n`;
  rightPanel.value = 'commands';
  try {
    const result = await executeGit(repoPath.value, args);
    commandOutput.value += `${result.stdout}${result.stderr}` || `(exit ${result.code})`;
    if (result.code === 0) {
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
    commandRunning.value = false;
    commandConfirmVisible.value = false;
    pendingCommand.value = '';
    pendingCommandArgs.value = [];
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
  if (editingCommandId.value === id) {
    cancelCommandEdit();
  }
  message.success('自定义指令已删除');
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
 * 用输入框中的提交信息修改最近一次提交。
 *
 * @return 无返回值。
 */
function amendCommit() {
  if (!commitMessage.value.trim()) {
    message.warning('请输入提交信息');
    return;
  }
  return runCommand(`git commit --amend -m "${commitMessage.value.replaceAll('"', '\\"')}"`);
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
 * 暴露命令中心、确认弹窗和提交动作状态。
 *
 * @return 命令状态与操作。
 */
export function useCommands() {
  return {
    commandRunning,
    commandConfirmVisible,
    pendingCommand,
    commandAlias,
    customCommand,
    editingCommandId,
    savedCommands,
    repositoryPushDraft,
    commandOutput,
    commitMessage,
    commandPresets,
    saveRepositoryPushCommand,
    runRepositoryPush,
    resetRepositoryPushDraft,
    runCommand,
    cancelPendingCommand,
    confirmPendingCommand,
    runCustomCommand,
    usePreset,
    saveCustomCommand,
    selectSavedCommand,
    editSavedCommand,
    removeSavedCommand,
    clearCommandDraft,
    cancelCommandEdit,
    commitChanges,
    amendCommit,
    exportSelectedBranchLog
  };
}
