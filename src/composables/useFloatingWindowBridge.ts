import { onMounted, onUnmounted } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { FLOATING_DATA_CHANGED_EVENT } from '@/constants/floating';
import { floatingCommandIds } from '@/composables/workbench/state';
import { STORAGE_KEYS, loadStorage } from '@/composables/workbench/utils';

/**
 * 让主窗口监听悬浮窗快捷数据变更，保持自定义悬浮指令标记同步。
 *
 * @return 无返回值。
 */
export function useFloatingWindowBridge() {
  const unlisteners: UnlistenFn[] = [];

  onMounted(async () => {
    unlisteners.push(await listen(FLOATING_DATA_CHANGED_EVENT, () => {
      floatingCommandIds.value = loadStorage<string[]>(STORAGE_KEYS.floatingCommands, []);
    }));
  });

  onUnmounted(() => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  });
}
