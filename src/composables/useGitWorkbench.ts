import { useCommands } from './workbench/useCommands';
import { useConfigFiles } from './workbench/useConfigFiles';
import { useGitFiles } from './workbench/useGitFiles';
import { useInspector } from './workbench/useInspector';
import { useRepositories } from './workbench/useRepositories';
import { useRepositoryData } from './workbench/useRepositoryData';
import { useTheme } from './workbench/useTheme';

/**
 * 聚合 Gitio 工作台各领域 composable，兼容需要完整上下文的调用方。
 *
 * @return 工作台完整状态和动作集合。
 */
export function useGitWorkbench() {
  return {
    ...useTheme(),
    ...useInspector(),
    ...useRepositories(),
    ...useRepositoryData(),
    ...useCommands(),
    ...useGitFiles(),
    ...useConfigFiles()
  };
}
