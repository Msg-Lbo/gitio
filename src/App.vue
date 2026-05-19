<template>
  <n-config-provider :theme="isDark ? darkTheme : null" :theme-overrides="themeOverrides">
    <main :class="['flex h-screen flex-col overflow-hidden transition-colors duration-300', { dark: isDark }]">
      <WindowTitleBar />
      <section class="mx-auto flex min-h-0 w-full max-w-[1760px] flex-1 flex-col gap-3 px-4 py-4">
        <WorkbenchHeader />
        <section class="grid min-h-0 flex-1 gap-3 xl:grid-cols-[300px_minmax(0,1fr)_390px]">
          <WorkbenchSidebar />
          <CommitGraph />
          <InspectorPanel />
        </section>
      </section>
      <CommandConfirmModal />
      <UpdateModal />
    </main>
  </n-config-provider>
</template>

<script setup lang="ts">
import { darkTheme } from 'naive-ui';
import CommandConfirmModal from '@/components/CommandConfirmModal.vue';
import CommitGraph from '@/components/CommitGraph.vue';
import InspectorPanel from '@/components/InspectorPanel.vue';
import WorkbenchHeader from '@/components/WorkbenchHeader.vue';
import WorkbenchSidebar from '@/components/WorkbenchSidebar.vue';
import UpdateModal from '@/components/UpdateModal.vue';
import WindowTitleBar from '@/components/WindowTitleBar.vue';
import { useTheme } from '@/composables/workbench/useTheme';
import { useWorkbenchBoot } from '@/composables/workbench/useWorkbenchBoot';

const { isDark, themeOverrides } = useTheme();
useWorkbenchBoot();
</script>
