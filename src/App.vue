<template>
  <n-config-provider :theme="isDark ? darkTheme : null" :theme-overrides="themeOverrides">
    <main :class="['min-h-screen px-4 py-4 transition-colors duration-300', { dark: isDark }]">
      <section class="mx-auto flex h-[calc(100vh-32px)] max-w-[1760px] flex-col gap-3">
        <WorkbenchHeader />
        <section class="grid min-h-0 flex-1 gap-3 xl:grid-cols-[300px_minmax(0,1fr)_390px]">
          <WorkbenchSidebar />
          <CommitGraph />
          <InspectorPanel />
        </section>
      </section>
      <CommandConfirmModal />
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
import { useTheme } from '@/composables/workbench/useTheme';
import { useWorkbenchBoot } from '@/composables/workbench/useWorkbenchBoot';

const { isDark, themeOverrides } = useTheme();
useWorkbenchBoot();
</script>
