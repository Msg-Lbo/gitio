<template>
  <header class="glass-panel flex shrink-0 flex-col gap-3 rounded-xl p-4 xl:flex-row xl:items-center xl:justify-between">
    <div class="flex min-w-0 items-center gap-3">
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-teal-500 text-lg font-black text-white shadow-lg shadow-sky-500/20">G</div>
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">Gitio Graph Workbench</p>
        <h1 class="truncate text-xl font-black text-slate-950 dark:text-white">{{ currentRepoAlias || inferRepoAlias(repoPath) || '选择仓库' }}</h1>
      </div>
      <n-tag v-if="overview?.branch" round type="info">{{ overview.branch }}</n-tag>
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-2 xl:max-w-[760px] xl:flex-row xl:items-center">
      <n-input v-model:value="repoPath" clearable placeholder="选择或输入 Git 仓库路径" @keyup.enter="refreshAll" />
      <n-button secondary strong @click="pickRepository">选择</n-button>
      <n-button type="primary" :loading="loading" @click="refreshAll">加载</n-button>
      <n-button secondary @click="saveRepository">收藏</n-button>
    </div>

    <div class="flex items-center gap-2">
      <n-button secondary @click="runCommand('git fetch --all --prune')">Fetch</n-button>
      <n-button secondary @click="runCommand('git pull --rebase --autostash')">Pull</n-button>
      <n-button type="primary" ghost @click="runRepositoryPush">Push</n-button>
      <n-button circle secondary :title="isDark ? '切换到亮色' : '切换到暗色'" @click="toggleTheme">
        <span class="text-base">{{ isDark ? '☾' : '☀' }}</span>
      </n-button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useCommands } from '@/composables/workbench/useCommands';
import { useRepositories } from '@/composables/workbench/useRepositories';
import { useRepositoryData } from '@/composables/workbench/useRepositoryData';
import { useTheme } from '@/composables/workbench/useTheme';

const {
  isDark,
  toggleTheme
} = useTheme();

const {
  repoPath,
  currentRepoAlias,
  pickRepository,
  inferRepoAlias,
  saveRepository
} = useRepositories();

const {
  overview,
  loading,
  refreshAll
} = useRepositoryData();

const {
  runCommand,
  runRepositoryPush
} = useCommands();
</script>
