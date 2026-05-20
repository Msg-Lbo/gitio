<template>
  <n-config-provider :theme="isDark ? darkTheme : null" :theme-overrides="themeOverrides">
    <QuickFloatWindow v-if="isQuickWindow" />
    <main v-else :class="['flex h-screen flex-col overflow-hidden transition-colors duration-300', { dark: isDark }]">
      <WindowTitleBar />
      <section class="mx-auto flex min-h-0 w-full max-w-[1760px] flex-1 flex-col gap-3 px-4 py-4">
        <WorkbenchHeader />
        <section class="grid min-h-0 flex-1 gap-3 xl:grid-cols-[300px_minmax(0,1fr)_390px]">
          <WorkbenchSidebar />
          <CommitGraph />
          <InspectorPanel />
        </section>
      </section>
      <AboutModal />
      <CommandConfirmModal />
      <UpdateModal />
    </main>
  </n-config-provider>
</template>

<script setup lang="ts">
import { darkTheme } from 'naive-ui';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { QUICK_FLOAT_WINDOW_LABEL } from '@/constants/floating';
import AboutModal from '@/components/AboutModal.vue';
import CommandConfirmModal from '@/components/CommandConfirmModal.vue';
import CommitGraph from '@/components/CommitGraph.vue';
import InspectorPanel from '@/components/InspectorPanel.vue';
import QuickFloatWindow from '@/components/QuickFloatWindow.vue';
import WorkbenchHeader from '@/components/WorkbenchHeader.vue';
import WorkbenchSidebar from '@/components/WorkbenchSidebar.vue';
import UpdateModal from '@/components/UpdateModal.vue';
import WindowTitleBar from '@/components/WindowTitleBar.vue';
import { useFloatingWindowBridge } from '@/composables/useFloatingWindowBridge';
import { useTheme } from '@/composables/workbench/useTheme';
import { useWorkbenchBoot } from '@/composables/workbench/useWorkbenchBoot';
import { STORAGE_KEYS } from '@/composables/workbench/utils';

const { isDark, themeOverrides } = useTheme();
const isQuickWindow = getCurrentWindow().label === QUICK_FLOAT_WINDOW_LABEL;

if (isQuickWindow) {
  const currentTheme = localStorage.getItem(STORAGE_KEYS.theme) === 'dark';
  isDark.value = currentTheme;
  document.documentElement.classList.toggle('dark', currentTheme);
} else {
  useWorkbenchBoot();
  useFloatingWindowBridge();
}
</script>
