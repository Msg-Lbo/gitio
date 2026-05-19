import { onMounted } from 'vue';
import { isDark, repoPath } from './state';
import { STORAGE_KEYS } from './utils';
import { refreshAll } from './useRepositoryData';

let booted = false;

/**
 * 初始化主题和上次打开的仓库，只应在应用根组件调用一次。
 *
 * @return 无返回值。
 */
export function useWorkbenchBoot() {
  onMounted(() => {
    if (booted) {
      return;
    }

    booted = true;
    isDark.value = localStorage.getItem(STORAGE_KEYS.theme) === 'dark';
    document.documentElement.classList.toggle('dark', isDark.value);
    if (repoPath.value) {
      requestAnimationFrame(() => {
        void refreshAll();
      });
    }
  });
}
