<template>
  <header class="window-titlebar flex h-9 select-none items-center border-b border-white/10 bg-[#071524] text-white" @dblclick="toggleMaximizeWindow">
    <div class="flex h-full min-w-0 flex-1 items-center gap-2 px-3" data-tauri-drag-region @mousedown="startWindowDrag">
      <img :src="appIcon" alt="" class="h-4 w-4 shrink-0 rounded-sm" data-tauri-drag-region />
      <span class="truncate text-[13px] font-semibold" data-tauri-drag-region>Gitio</span>
      <button
        type="button"
        class="version-badge"
        :class="{ 'version-badge-update': hasAvailableUpdate }"
        :title="hasAvailableUpdate ? `发现新版本 v${latestVersion}` : '查看版本与更新'"
        @mousedown.stop
        @dblclick.stop
        @click="openUpdateModal"
      >
        v{{ currentVersion }}
      </button>
      <button
        type="button"
        class="version-badge"
        title="查看项目信息"
        @mousedown.stop
        @dblclick.stop
        @click="openAboutDialog"
      >
        关于
      </button>
    </div>

    <div class="flex h-full shrink-0 items-center" @dblclick.stop>
      <button class="window-control" type="button" title="最小化" aria-label="最小化" @click="minimizeWindow">
        <span class="mb-1 block h-px w-3 bg-current"></span>
      </button>
      <button class="window-control" type="button" :title="isMaximized ? '还原' : '最大化'" :aria-label="isMaximized ? '还原' : '最大化'" @click="toggleMaximizeWindow">
        <span v-if="!isMaximized" class="block h-3 w-3 border border-current"></span>
        <span v-else class="relative block h-3 w-3">
          <span class="absolute left-0 top-1 block h-2.5 w-2.5 border border-current"></span>
          <span class="absolute left-1 top-0 block h-2.5 w-2.5 border border-current bg-[#071524]"></span>
        </span>
      </button>
      <button class="window-control window-control-close" type="button" title="关闭" aria-label="关闭" @click="closeWindow">
        <span class="relative block h-3.5 w-3.5">
          <span class="absolute left-1/2 top-0 h-3.5 w-px -translate-x-1/2 rotate-45 bg-current"></span>
          <span class="absolute left-1/2 top-0 h-3.5 w-px -translate-x-1/2 -rotate-45 bg-current"></span>
        </span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import appIcon from '../../docs/assets/gitio-logo.svg';
import { useAboutDialog } from '@/composables/useAboutDialog';
import { useAppUpdater } from '@/composables/useAppUpdater';

const appWindow = getCurrentWindow();
const isMaximized = ref(false);
const { openAboutDialog } = useAboutDialog();
const { currentVersion, latestVersion, hasAvailableUpdate, openUpdateModal, checkOnStartup, loadCurrentVersion } = useAppUpdater();
let unlistenResize: (() => void) | null = null;

/**
 * 同步当前窗口最大化状态，用于切换控制按钮图标。
 *
 * @return 无返回值。
 */
async function syncMaximizedState() {
  isMaximized.value = await appWindow.isMaximized();
}

/**
 * 从自绘标题栏拖动窗口。
 *
 * @param event 鼠标事件。
 * @return 无返回值。
 */
function startWindowDrag(event: MouseEvent) {
  if (event.button !== 0 || event.detail > 1) {
    return;
  }
  appWindow.startDragging();
}

/**
 * 最小化当前窗口。
 *
 * @return 无返回值。
 */
function minimizeWindow() {
  appWindow.minimize();
}

/**
 * 最大化或还原当前窗口。
 *
 * @return 无返回值。
 */
async function toggleMaximizeWindow() {
  await appWindow.toggleMaximize();
  await syncMaximizedState();
}

/**
 * 关闭当前窗口。
 *
 * @return 无返回值。
 */
function closeWindow() {
  appWindow.close();
}

onMounted(async () => {
  await loadCurrentVersion();
  await syncMaximizedState();
  unlistenResize = await appWindow.onResized(syncMaximizedState);
  checkOnStartup();
});

onUnmounted(() => {
  unlistenResize?.();
});
</script>
