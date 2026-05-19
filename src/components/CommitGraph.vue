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

    <n-scrollbar class="min-h-0 flex-1" trigger="hover">
      <div class="p-3">
        <div v-if="selectedCommitLine.length" class="py-1">
          <article v-for="row in graphRows" :key="row.commit.hash" :class="['group grid h-8 items-center rounded px-1 transition hover:bg-slate-950/5 dark:hover:bg-white/5', selectedCommit?.hash === row.commit.hash ? 'bg-sky-500/10' : '']" :style="{ gridTemplateColumns: `${graphWidth}px minmax(0,1fr)` }" @click="selectCommit(row.commit)" @dblclick="runCommand(`git show --stat --patch ${row.commit.hash}`)">
            <svg class="h-8 overflow-visible" :width="graphWidth" :viewBox="`0 0 ${graphWidth} 32`" aria-hidden="true">
              <line v-for="line in visibleTopLines(row)" :key="`top-${row.commit.hash}-${line.lane}`" :x1="graphLaneX(line.lane)" y1="-1" :x2="graphLaneX(line.lane)" y2="17" :stroke="line.color" stroke-width="1.35" stroke-linecap="butt" opacity="0.9" />
              <line v-for="line in visibleBottomLines(row)" :key="`bottom-${row.commit.hash}-${line.lane}`" :x1="graphLaneX(line.lane)" y1="15" :x2="graphLaneX(line.lane)" y2="33" :stroke="line.color" stroke-width="1.35" stroke-linecap="butt" opacity="0.9" />
              <path v-for="curve in row.curves" :key="`curve-${row.commit.hash}-${curve.fromLane}-${curve.toLane}`" :d="graphCurvePath(curve)" fill="none" :stroke="curve.color" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" />
              <circle :cx="graphLaneX(row.nodeLane)" cy="16" r="4.2" :fill="commitColor(row.commit.author)" :stroke="laneColor(row.nodeLane)" stroke-width="1.5" />
            </svg>
            <div class="flex min-w-0 items-center gap-2 overflow-hidden text-sm leading-8">
              <span class="min-w-0 flex-1 truncate font-semibold text-slate-950 dark:text-slate-100" :title="row.commit.subject">{{ row.commit.subject }}</span>
              <span v-if="row.commit.refs" class="hidden max-w-[220px] shrink truncate text-xs font-semibold text-sky-600 dark:text-sky-300 lg:inline" :title="compactRefs(row.commit.refs)">{{ compactRefs(row.commit.refs) }}</span>
              <span class="hidden max-w-[120px] shrink-0 truncate text-xs text-slate-500 dark:text-slate-400 md:inline" :title="row.commit.author">{{ row.commit.author }}</span>
              <span class="hidden shrink-0 text-xs text-slate-500 dark:text-slate-500 xl:inline">{{ row.commit.shortHash }}</span>
            </div>
          </article>
        </div>
        <div v-else class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">选择仓库和分支后显示提交图谱。</div>
      </div>
    </n-scrollbar>
  </section>
</template>

<script setup lang="ts">
import { useCommands } from '@/composables/workbench/useCommands';
import { useRepositoryData } from '@/composables/workbench/useRepositoryData';

const {
  selectedBranch,
  loading,
  selectedCommitLine,
  selectedCommit,
  graphRows,
  graphWidth,
  graphLaneX,
  graphCurvePath,
  visibleTopLines,
  visibleBottomLines,
  commitColor,
  laneColor,
  compactRefs,
  refreshCommitLine,
  selectCommit
} = useRepositoryData();

const {
  exportSelectedBranchLog,
  runCommand
} = useCommands();
</script>
