<template>
  <aside class="glass-panel min-h-0 rounded-xl p-3">
    <n-scrollbar class="h-full" trigger="hover">
      <div class="flex flex-col gap-4 pr-1">
        <section>
          <div class="mb-2 flex items-center justify-between">
            <p class="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Repositories</p>
            <n-tag size="small" round>{{ savedRepositories.length }}</n-tag>
          </div>
          <div class="flex gap-2">
            <n-input v-model:value="repoAlias" size="small" placeholder="仓库别名" @keyup.enter="saveRepository" />
            <n-button size="small" secondary @click="saveRepository">{{ editingRepoId ? '更新' : '保存' }}</n-button>
          </div>
          <div class="mt-2 flex flex-col gap-1">
            <button v-for="repo in savedRepositories" :key="repo.id" :class="['rounded-md px-3 py-2 text-left text-sm transition', repo.path === repoPath ? 'bg-sky-500/15 text-sky-700 dark:text-sky-200' : 'hover:bg-slate-950/5 dark:hover:bg-white/5']" type="button" @click="switchRepository(repo)">
              <span class="block truncate font-bold">{{ repo.alias }}</span>
              <span class="block truncate text-xs text-slate-500 dark:text-slate-400">{{ repo.path }}</span>
            </button>
          </div>
        </section>

        <section>
          <div class="mb-2 flex items-center justify-between">
            <p class="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Branches</p>
            <n-button text size="tiny" @click="refreshCommitLine">刷新</n-button>
          </div>
          <n-select v-model:value="selectedBranch" size="small" filterable :options="branchOptions" placeholder="选择分支" @update:value="selectBranch" />
        </section>

        <section>
          <p class="mb-1 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Saved Commands</p>
          <p class="mb-2 text-[11px] text-slate-500 dark:text-slate-400">右键保存指令可添加到悬浮窗。</p>
          <div class="flex flex-col gap-1">
            <button v-for="savedCommand in savedCommands" :key="savedCommand.id" class="rounded-md px-3 py-2 text-left text-sm transition hover:bg-slate-950/5 dark:hover:bg-white/5" type="button" :title="isSavedCommandFloating(savedCommand) ? '已在悬浮窗中，左键执行' : '左键执行，右键添加到悬浮窗'" @click="runCommand(savedCommand.command)" @contextmenu.prevent="addSavedCommandToFloating(savedCommand)">
              <span class="flex min-w-0 items-center gap-2">
                <span class="block min-w-0 flex-1 truncate font-bold">{{ savedCommand.alias }}</span>
                <n-tag v-if="isSavedCommandFloating(savedCommand)" size="tiny" type="success" round>悬浮</n-tag>
              </span>
              <span class="mono block truncate text-[11px] text-slate-500">{{ savedCommand.command }}</span>
            </button>
          </div>
        </section>
      </div>
    </n-scrollbar>
  </aside>
</template>

<script setup lang="ts">
import { useCommands } from '@/composables/workbench/useCommands';
import { useRepositories } from '@/composables/workbench/useRepositories';
import { useRepositoryData } from '@/composables/workbench/useRepositoryData';

const {
  repoPath,
  repoAlias,
  editingRepoId,
  savedRepositories,
  saveRepository,
  switchRepository
} = useRepositories();

const {
  selectedBranch,
  branchOptions,
  refreshCommitLine,
  selectBranch
} = useRepositoryData();

const {
  savedCommands,
  runCommand,
  addSavedCommandToFloating,
  isSavedCommandFloating
} = useCommands();
</script>
