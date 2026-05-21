<template>
  <section class="glass-panel flex min-h-0 min-w-0 flex-col rounded-xl">
    <div class="flex shrink-0 items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-slate-800">
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-[0.24em] text-slate-500">Graph</p>
        <h2 class="truncate text-lg font-black text-slate-950 dark:text-white">{{ selectedBranch || '未选择分支' }}</h2>
      </div>
      <div class="flex items-center gap-2">
        <n-button size="small" secondary @click="exportSelectedBranchLog">导出</n-button>
        <n-button size="small" type="primary" :loading="loading" @click="refreshCommitLine">刷新</n-button>
      </div>
    </div>

    <div class="grid shrink-0 gap-2 border-b border-slate-200/70 px-4 py-3 dark:border-slate-800 md:grid-cols-[minmax(0,1fr)_220px_auto]">
      <n-input v-model:value="commitGraphKeyword" size="small" clearable placeholder="搜索提交、哈希、引用或作者" />
      <n-select v-model:value="commitGraphAuthor" size="small" clearable filterable :options="commitGraphAuthorOptions" placeholder="按作者筛选" />
      <n-button size="small" secondary :disabled="!commitGraphKeyword && !commitGraphAuthor" @click="clearCommitGraphFilters">清空筛选</n-button>
    </div>

    <n-scrollbar class="min-h-0 flex-1" trigger="hover">
      <div class="p-3">
        <div v-if="selectedCommitLine.length" class="py-1">
          <div class="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>显示 {{ filteredCommitLine.length }} / {{ selectedCommitLine.length }} 条提交</span>
            <span v-if="commitGraphKeyword || commitGraphAuthor">已启用筛选</span>
          </div>
          <article v-for="row in visibleGraphRows" :key="row.commit.hash" :class="['group grid h-8 items-center rounded px-1 transition hover:bg-slate-950/5 dark:hover:bg-white/5', selectedCommit?.hash === row.commit.hash ? 'bg-sky-500/10' : '']" :style="{ gridTemplateColumns: `${rowGraphWidth(row)}px minmax(0,1fr)` }" @click="selectCommit(row.commit)" @dblclick="runCommand(`git show --stat --patch ${row.commit.hash}`)">
            <svg class="h-8 overflow-visible" :width="rowGraphWidth(row)" :viewBox="`0 0 ${rowGraphWidth(row)} 32`" aria-hidden="true" shape-rendering="geometricPrecision">
              <line v-for="line in visibleTopLines(row)" :key="`top-${row.commit.hash}-${line.lane}`" :x1="graphLaneX(line.lane)" y1="0" :x2="graphLaneX(line.lane)" y2="18" :stroke="line.color" stroke-width="2" stroke-linecap="square" />
              <line v-for="line in visibleBottomLines(row)" :key="`bottom-${row.commit.hash}-${line.lane}`" :x1="graphLaneX(line.lane)" y1="14" :x2="graphLaneX(line.lane)" y2="32" :stroke="line.color" stroke-width="2" stroke-linecap="square" />
              <path v-for="(curve, curveIndex) in row.curves" :key="`curve-${row.commit.hash}-${curveIndex}`" :d="graphCurvePath(curve)" fill="none" :stroke="curve.color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <circle :cx="graphLaneX(row.nodeLane)" cy="16" r="4.5" :fill="row.nodeColor" :stroke="row.nodeColor" stroke-width="1.5" />
            </svg>
            <div class="flex min-w-0 items-center gap-2 overflow-hidden text-sm leading-8">
              <span class="min-w-0 flex-1 truncate font-semibold text-slate-950 dark:text-slate-100" :title="row.commit.subject">{{ row.commit.subject }}</span>
              <span v-if="row.commit.refs" class="hidden max-w-[220px] shrink truncate text-xs font-semibold text-sky-600 dark:text-sky-300 lg:inline" :title="compactRefs(row.commit.refs)">{{ compactRefs(row.commit.refs) }}</span>
              <span class="hidden max-w-[120px] shrink-0 truncate text-xs text-slate-500 dark:text-slate-400 md:inline" :title="row.commit.author">{{ row.commit.author }}</span>
              <span class="hidden shrink-0 text-xs text-slate-500 dark:text-slate-500 xl:inline">{{ row.commit.shortHash }}</span>
            </div>
          </article>
          <div v-if="!filteredCommitLine.length" class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">没有匹配当前筛选条件的提交。</div>
        </div>
        <div v-else class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">选择仓库和分支后显示提交图谱。</div>
      </div>
    </n-scrollbar>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCommands } from '@/composables/workbench/useCommands';
import { useRepositoryData } from '@/composables/workbench/useRepositoryData';

const {
  selectedBranch,
  loading,
  selectedCommitLine,
  filteredCommitLine,
  selectedCommit,
  commitGraphKeyword,
  commitGraphAuthor,
  commitGraphAuthorOptions,
  graphRows,
  graphLaneX,
  graphCurvePath,
  rowGraphWidth,
  visibleTopLines,
  visibleBottomLines,
  compactRefs,
  refreshCommitLine,
  selectCommit
} = useRepositoryData();

const {
  exportSelectedBranchLog,
  runCommand
} = useCommands();

const filteredCommitHashes = computed(() => new Set(filteredCommitLine.value.map((commit) => commit.hash)));
const visibleGraphRows = computed(() => graphRows.value.filter((row) => filteredCommitHashes.value.has(row.commit.hash)));

/**
 * 清空提交图谱筛选条件，恢复当前分支完整提交列表。
 *
 * @return 无返回值。
 */
function clearCommitGraphFilters() {
  commitGraphKeyword.value = '';
  commitGraphAuthor.value = '';
}
</script>
