import { onMounted, onUnmounted } from 'vue';
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { Window } from '@tauri-apps/api/window';
import {
  FLOATING_DATA_CHANGED_EVENT,
  FLOATING_RUN_COMMAND_EVENT,
  FLOATING_SWITCH_REPOSITORY_EVENT,
  QUICK_FLOAT_WINDOW_LABEL
} from '@/constants/floating';
import type { FloatingRunCommandPayload, FloatingSwitchRepositoryPayload } from '@/types/git';
import { useCommands } from '@/composables/workbench/useCommands';
import { useRepositories } from '@/composables/workbench/useRepositories';
import { floatingCommandIds, repoPath } from '@/composables/workbench/state';
import { STORAGE_KEYS, loadStorage } from '@/composables/workbench/utils';

/**
 * 让主窗口监听悬浮窗发来的项目切换和快捷命令事件。
 *
 * @return 无返回值。
 */
export function useFloatingWindowBridge() {
  const { runCommand } = useCommands();
  const { switchRepository } = useRepositories();
  const unlisteners: UnlistenFn[] = [];

  onMounted(async () => {
    unlisteners.push(await listen(FLOATING_DATA_CHANGED_EVENT, () => {
      floatingCommandIds.value = loadStorage<string[]>(STORAGE_KEYS.floatingCommands, []);
    }));

    unlisteners.push(await listen<FloatingRunCommandPayload>(FLOATING_RUN_COMMAND_EVENT, async ({ payload }) => {
      repoPath.value = payload.repoPath || repoPath.value;
      await focusMainWindow();
      runCommand(payload.command);
    }));

    unlisteners.push(await listen<FloatingSwitchRepositoryPayload>(FLOATING_SWITCH_REPOSITORY_EVENT, async ({ payload }) => {
      await focusMainWindow();
      await switchRepository(payload.repository);
      await emitTo(QUICK_FLOAT_WINDOW_LABEL, FLOATING_DATA_CHANGED_EVENT);
    }));
  });

  onUnmounted(() => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  });
}

/**
 * 将主窗口拉到前台，确保命令确认弹窗能被用户看见。
 *
 * @return 无返回值。
 */
async function focusMainWindow() {
  const mainWindow = await Window.getByLabel('main');
  if (!mainWindow) {
    return;
  }

  await mainWindow.show();
  await mainWindow.unminimize();
  await mainWindow.setFocus();
}
