import { readConfigs, writeGlobalConfig, writeRepoConfig } from '@/services/gitApi';
import { ensureRepo, message, showError } from './guards';
import { globalConfig, globalConfigPath, repoConfig, repoPath } from './state';

/**
 * 读取仓库级和全局级 Git config。
 *
 * @return 无返回值。
 */
export async function loadConfigs() {
  if (!ensureRepo()) {
    return;
  }

  const configs = await readConfigs(repoPath.value);
  repoConfig.value = configs.repositoryConfig;
  globalConfig.value = configs.globalConfig;
  globalConfigPath.value = configs.globalConfigPath;
}

/**
 * 保存仓库 `.git/config` 文件。
 *
 * @return 无返回值。
 */
async function saveRepoConfig() {
  try {
    await writeRepoConfig(repoPath.value, repoConfig.value);
    message.success('仓库 Config 已保存');
  } catch (error) {
    showError(error);
  }
}

/**
 * 保存当前用户全局 `.gitconfig` 文件。
 *
 * @return 无返回值。
 */
async function saveGlobalConfig() {
  try {
    await writeGlobalConfig(globalConfig.value);
    message.success('全局 Config 已保存');
  } catch (error) {
    showError(error);
  }
}

/**
 * 暴露 Git config 读取和保存状态。
 *
 * @return Git config 状态与操作。
 */
export function useConfigFiles() {
  return {
    repoConfig,
    globalConfig,
    globalConfigPath,
    loadConfigs,
    saveRepoConfig,
    saveGlobalConfig
  };
}
