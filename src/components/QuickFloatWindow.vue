<template>
  <main class="quick-float-root flex h-screen w-screen overflow-hidden bg-transparent text-slate-100">
    <button v-if="!expanded" class="flex h-10 w-10 items-center justify-center bg-transparent p-0" type="button" title="单击展开，按住拖动" @click="handleCollapsedClick" @pointerdown="handleCollapsedPointerDown" @pointermove="handleCollapsedPointerMove" @pointerup="handleCollapsedPointerEnd" @pointercancel="handleCollapsedPointerEnd">
      <img :src="appIcon" alt="Gitio" class="h-10 w-10 rounded-xl" draggable="false" />
    </button>

    <section v-else class="relative flex min-h-0 w-full flex-col bg-[#06111f]">
      <header class="flex shrink-0 cursor-move items-center justify-between gap-3 border-b border-white/10 px-4 py-3" @mousedown="startDrag">
        <div class="min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-300/80">Gitio Float</p>
          <h1 class="truncate text-sm font-black text-white">{{ activeRepositoryName }}</h1>
        </div>
        <button class="rounded-md border border-white/10 px-3 py-1 text-xs font-bold text-slate-200 transition hover:bg-white/10" type="button" @mousedown.stop @click.stop="collapseWindow">收起</button>
      </header>

      <div class="soft-scrollbar min-h-0 flex-1 space-y-4 overflow-auto p-3">
        <section class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-xs font-black uppercase tracking-[0.2em] text-slate-300">项目</h2>
            <span class="rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">{{ savedRepositories.length }}</span>
          </div>
          <div v-if="savedRepositories.length">
            <n-select class="quick-repository-select" :value="repoPath" :options="repositorySelectOptions" :filter="filterRepositoryOption" :theme-overrides="repositorySelectThemeOverrides" size="medium" filterable :disabled="quickCommandRunning" placeholder="选择项目" @update:value="handleRepositorySelect" />
          </div>
          <p v-else class="rounded-md border border-dashed border-white/10 p-3 text-xs text-slate-400">主窗口收藏项目后，这里会显示快捷切换入口。</p>
        </section>

        <section class="space-y-2">
          <h2 class="text-xs font-black uppercase tracking-[0.2em] text-slate-300">固定指令</h2>
          <div class="grid grid-cols-2 gap-2">
            <button class="rounded-md bg-sky-500 px-3 py-2 text-sm font-black text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400" type="button" :disabled="!repoPath || quickCommandRunning" @click="runQuickCommand(currentPushCommand)">Push</button>
            <button class="rounded-md bg-teal-500 px-3 py-2 text-sm font-black text-white transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400" type="button" :disabled="!repoPath || quickCommandRunning" @click="runQuickCommand('git pull --rebase --autostash')">Rebase Pull</button>
          </div>
        </section>

        <section class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-xs font-black uppercase tracking-[0.2em] text-slate-300">自定义指令</h2>
            <span class="rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">{{ floatingCommands.length }}</span>
          </div>
          <div v-if="floatingCommands.length" class="space-y-1">
            <div v-for="command in floatingCommands" :key="command.id" class="group flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.04] px-3 py-2 transition hover:bg-white/10">
              <button class="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-50" type="button" :disabled="quickCommandRunning" @click="runQuickCommand(command.command)">
                <span class="block truncate text-sm font-bold text-slate-100">{{ command.alias }}</span>
                <span class="mono block truncate text-[10px] text-slate-400">{{ command.command }}</span>
              </button>
              <button class="shrink-0 rounded-md px-2 py-1 text-xs font-black text-slate-500 opacity-70 transition hover:bg-red-500/20 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-30 group-hover:opacity-100" type="button" title="从悬浮窗移除" :disabled="quickCommandRunning" @click="removeFloatingCommand(command.id)">×</button>
            </div>
          </div>
          <p v-else class="rounded-md border border-dashed border-white/10 p-3 text-xs text-slate-400">在主窗口 Saved Commands 上右键，可添加到这里。</p>
        </section>

        <section v-if="quickCommandOutput" class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-xs font-black uppercase tracking-[0.2em] text-slate-300">最近结果</h2>
            <span :class="quickOutputStatusClass">{{ quickOutputStatusText }}</span>
          </div>
          <div class="rounded-lg border border-white/8 bg-black/20 p-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="mono truncate text-xs font-bold text-slate-100">{{ commandLabel(quickCommandOutput.command) }}</p>
                <p class="mono mt-1 truncate text-[10px] text-slate-500">{{ quickCommandOutput.repoPath }}</p>
              </div>
              <span v-if="quickCommandOutput.finishedAt" class="shrink-0 text-[10px] text-slate-500">{{ quickCommandOutput.finishedAt }}</span>
            </div>

            <div class="mt-3 space-y-2">
              <div v-if="quickCommandOutput.stdout" class="space-y-1">
                <p class="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">标准输出</p>
                <pre class="mono max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-md bg-emerald-950/30 p-2 text-[11px] leading-5 text-emerald-50">{{ quickCommandOutput.stdout }}</pre>
              </div>
              <div v-if="quickCommandOutput.stderr" class="space-y-1">
                <p class="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">错误输出</p>
                <pre class="mono max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-md bg-amber-950/30 p-2 text-[11px] leading-5 text-amber-50">{{ quickCommandOutput.stderr }}</pre>
              </div>
              <div v-if="quickCommandOutput.error" class="space-y-1">
                <p class="text-[10px] font-black uppercase tracking-[0.16em] text-red-300">异常信息</p>
                <pre class="mono max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-md bg-red-950/30 p-2 text-[11px] leading-5 text-red-50">{{ quickCommandOutput.error }}</pre>
              </div>
              <div v-if="quickCommandOutput.code === null" class="space-y-2">
                <div class="rounded-md border border-dashed border-sky-300/20 p-2 text-[11px] text-sky-100">
                  命令执行中，等待输出...
                </div>
                <div class="rounded-md border border-sky-300/20 bg-sky-950/20 p-2">
                  <div class="mb-1 flex items-center justify-between gap-2 text-[10px] text-sky-100/70">
                    <span>执行进度</span>
                    <span>{{ quickProgressLabel }}</span>
                  </div>
                  <n-progress type="line" :percentage="quickCommandOutput.progress ?? 0" :processing="(quickCommandOutput.progress ?? 0) < 100" :show-indicator="false" />
                  <p class="mt-1 truncate text-[10px] text-sky-50/80">{{ quickCommandOutput.progressText || '等待 Git 输出...' }}</p>
                  <div class="mt-2 flex justify-end">
                    <button class="rounded-md border border-red-300/20 px-2 py-1 text-[10px] font-black text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50" type="button" :disabled="quickStopDisabled" @click="cancelQuickCommandRunning">停止</button>
                  </div>
                </div>
              </div>
              <p v-else-if="!quickCommandOutput.stdout && !quickCommandOutput.stderr && !quickCommandOutput.error" class="rounded-md border border-dashed border-white/10 p-2 text-[11px] text-slate-400">命令执行完成，没有输出。</p>
            </div>

            <div class="mt-3 flex justify-end gap-2">
              <button class="rounded-md border border-white/10 px-3 py-1 text-xs font-bold text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50" type="button" :disabled="!quickOutputText" @click="copyQuickOutput">复制输出</button>
              <button class="rounded-md border border-white/10 px-3 py-1 text-xs font-bold text-slate-300 transition hover:bg-white/10" type="button" @click="clearQuickOutput">清空</button>
            </div>
          </div>
        </section>
      </div>

      <footer class="shrink-0 border-t border-white/10 px-3 py-2 text-[11px] text-slate-400">
        {{ statusText }}
      </footer>

      <div v-if="pendingQuickCommand" :class="quickConfirmPanelClass">
        <div :class="quickConfirmArrowClass"></div>
        <div class="flex items-center justify-between gap-2">
          <p :class="quickConfirmTitleClass">{{ pendingQuickRisk.title }}</p>
          <span v-if="pendingQuickRisk.level !== 'safe'" :class="quickRiskBadgeClass">{{ pendingQuickRisk.level === 'danger' ? '危险' : '注意' }}</span>
        </div>
        <p v-if="pendingQuickRisk.level !== 'safe'" class="mt-1 rounded-md bg-black/20 px-2 py-1.5 text-[11px] leading-5 text-slate-200">{{ pendingQuickRisk.description }}</p>
        <label v-if="pendingQuickRisk.level === 'danger'" class="mt-2 flex items-start gap-2 rounded-md border border-red-300/20 bg-red-950/20 px-2 py-2 text-[11px] leading-5 text-red-50">
          <input v-model="dangerAcknowledged" class="mt-1 h-3.5 w-3.5 accent-red-400" type="checkbox" :disabled="quickCommandRunning" />
          <span>我已确认该操作可能造成不可恢复影响，仍要继续执行。</span>
        </label>
        <p class="mt-1 text-[11px] leading-5 text-slate-400">将在当前悬浮窗选中的仓库执行：</p>
        <pre class="mono mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/30 p-2 text-[11px] leading-5 text-slate-100">{{ pendingQuickCommand }}</pre>
        <div class="mt-3 flex justify-end gap-2">
          <button class="rounded-md border border-white/10 px-3 py-1 text-xs font-bold text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50" type="button" :disabled="quickCommandRunning" @click="cancelQuickCommand">取消</button>
          <button :class="quickConfirmButtonClass" type="button" :disabled="quickCommandRunning || quickConfirmBlocked" @click="confirmQuickCommand">{{ quickCommandRunning ? '执行中' : '执行' }}</button>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { SelectOption } from 'naive-ui';
import { FLOATING_DATA_CHANGED_EVENT } from '@/constants/floating';
import appIcon from '../../docs/assets/gitio-logo.svg';
import type { GitCommandResult, RepositoryPushCommand, SavedCommand, SavedRepository } from '@/types/git';
import { cancelGitCommand, executeGitStreaming, GIT_COMMAND_PROGRESS_EVENT } from '@/services/gitApi';
import { commandLabel, detectGitCommandRisk, parseGitCommand } from '@/utils/command';
import { inferRepoAlias, loadStorage, STORAGE_KEYS } from '@/composables/workbench/utils';
import {
  currentRepositoryPushCommand,
  floatingCommandIds,
  floatingCommands,
  isDark,
  repoPath,
  repositoryPushCommands,
  savedCommands,
  savedRepositories
} from '@/composables/workbench/state';

const collapsedSize = new LogicalSize(40, 40);
const expandedSize = new LogicalSize(360, 560);
const dragBlurProtectionMs = 800;
const appWindow = getCurrentWindow();
const expanded = ref(false);
const statusText = ref('左键展开悬浮窗');
const collapsedPointer = ref({ x: 0, y: 0, dragging: false });
const dragBlurProtected = ref(false);
const pendingQuickCommand = ref('');
const pendingQuickCommandArgs = ref<string[]>([]);
const pendingQuickRepoPath = ref('');
const quickCommandRunning = ref(false);
const quickCommandOutput = ref<QuickCommandOutput | null>(null);
const dangerAcknowledged = ref(false);
const quickCommandRunId = ref('');
const quickCommandStopRequested = ref(false);

const activeRepositoryName = computed(() => {
  const active = savedRepositories.value.find((repo) => repo.path === repoPath.value);
  return active?.alias || inferRepoAlias(repoPath.value) || '未选择项目';
});
const repositorySelectOptions = computed<SelectOption[]>(() => {
  const options = savedRepositories.value.map((repo) => ({
    label: repo.alias,
    value: repo.path
  }));
  const hasCurrentRepository = options.some((option) => option.value === repoPath.value);

  if (!repoPath.value.trim() || hasCurrentRepository) {
    return options;
  }

  return [
    {
      label: `${activeRepositoryName.value}（未收藏）`,
      value: repoPath.value,
      disabled: true
    },
    ...options
  ];
});
const currentPushCommand = computed(() => currentRepositoryPushCommand.value);
const repositorySelectThemeOverrides = {
  peers: {
    InternalSelection: {
      border: '1px solid rgba(125, 211, 252, 0.22)',
      borderActive: '1px solid rgba(125, 211, 252, 0.72)',
      borderFocus: '1px solid rgba(125, 211, 252, 0.72)',
      borderHover: '1px solid rgba(125, 211, 252, 0.48)',
      borderRadius: '7px',
      boxShadowActive: '0 0 0 3px rgba(14, 165, 233, 0.18)',
      boxShadowFocus: '0 0 0 3px rgba(14, 165, 233, 0.18)',
      color: 'rgba(15, 23, 42, 0.92)',
      colorActive: 'rgba(8, 47, 73, 0.92)',
      colorDisabled: 'rgba(15, 23, 42, 0.72)',
      textColor: '#f8fafc',
      placeholderColor: '#64748b',
      arrowColor: '#7dd3fc',
      heightMedium: '44px'
    },
    InternalSelectMenu: {
      borderRadius: '7px',
      color: '#08111f',
      boxShadow: '0 18px 40px rgba(0, 0, 0, 0.38)',
      optionTextColor: '#cbd5e1',
      optionTextColorActive: '#f8fafc',
      optionTextColorPressed: '#f8fafc',
      optionTextColorPending: '#f8fafc',
      optionColorPending: 'rgba(14, 165, 233, 0.18)',
      optionColorActive: 'rgba(14, 165, 233, 0.24)',
      optionColorActivePending: 'rgba(14, 165, 233, 0.32)',
      optionCheckColor: '#38bdf8'
    }
  }
};
const pendingQuickRisk = computed(() => detectGitCommandRisk(pendingQuickCommandArgs.value));
const quickConfirmBlocked = computed(() => pendingQuickRisk.value.level === 'danger' && !dangerAcknowledged.value);
const quickConfirmPanelClass = computed(() => [
  'absolute bottom-10 left-3 right-3 rounded-lg border p-3 shadow-2xl shadow-black/40',
  pendingQuickRisk.value.level === 'danger'
    ? 'border-red-300/40 bg-[#2a0f18]'
    : pendingQuickRisk.value.level === 'warning'
      ? 'border-amber-300/40 bg-[#241b0c]'
      : 'border-sky-300/30 bg-[#0b1d31]'
]);
const quickConfirmArrowClass = computed(() => [
  'absolute -bottom-2 left-8 h-4 w-4 rotate-45 border-b border-r',
  pendingQuickRisk.value.level === 'danger'
    ? 'border-red-300/40 bg-[#2a0f18]'
    : pendingQuickRisk.value.level === 'warning'
      ? 'border-amber-300/40 bg-[#241b0c]'
      : 'border-sky-300/30 bg-[#0b1d31]'
]);
const quickConfirmTitleClass = computed(() => [
  'text-xs font-black',
  pendingQuickRisk.value.level === 'danger'
    ? 'text-red-200'
    : pendingQuickRisk.value.level === 'warning'
      ? 'text-amber-200'
      : 'text-sky-200'
]);
const quickRiskBadgeClass = computed(() => [
  'rounded-md px-2 py-0.5 text-[10px] font-black',
  pendingQuickRisk.value.level === 'danger'
    ? 'bg-red-400/20 text-red-100'
    : 'bg-amber-400/20 text-amber-100'
]);
const quickConfirmButtonClass = computed(() => [
  'rounded-md px-3 py-1 text-xs font-black text-white transition disabled:cursor-not-allowed disabled:bg-slate-700',
  pendingQuickRisk.value.level === 'danger'
    ? 'bg-red-500 hover:bg-red-400'
    : pendingQuickRisk.value.level === 'warning'
      ? 'bg-amber-500 hover:bg-amber-400'
      : 'bg-sky-500 hover:bg-sky-400'
]);
const quickOutputText = computed(() => {
  if (!quickCommandOutput.value) {
    return '';
  }

  return [
    quickCommandOutput.value.stdout ? `标准输出:\n${quickCommandOutput.value.stdout}` : '',
    quickCommandOutput.value.stderr ? `错误输出:\n${quickCommandOutput.value.stderr}` : '',
    quickCommandOutput.value.error ? `异常信息:\n${quickCommandOutput.value.error}` : ''
  ].filter(Boolean).join('\n\n');
});
const quickOutputStatusText = computed(() => {
  const output = quickCommandOutput.value;
  if (!output) {
    return '';
  }

  if (output.code === null) {
    return '运行中';
  }

  if (output.error) {
    return '失败';
  }

  return output.code === 0 ? '成功' : `退出码 ${output.code}`;
});
const quickOutputStatusClass = computed(() => {
  const output = quickCommandOutput.value;
  const baseClass = 'rounded-md px-2 py-0.5 text-[10px] font-black';

  if (!output || output.code === null) {
    return `${baseClass} bg-sky-400/15 text-sky-200`;
  }

  if (output.error || output.code !== 0) {
    return `${baseClass} bg-red-400/15 text-red-200`;
  }

  return `${baseClass} bg-emerald-400/15 text-emerald-200`;
});
const quickProgressLabel = computed(() => {
  if (!quickCommandOutput.value) {
    return '等待进度';
  }

  return quickCommandOutput.value.progress !== null ? `${quickCommandOutput.value.progress}%` : '等待进度';
});
const quickStopDisabled = computed(() => !quickCommandRunId.value);

interface QuickCommandOutput {
  command: string;
  repoPath: string;
  code: number | null;
  stdout: string;
  stderr: string;
  error: string;
  progress: number | null;
  progressText: string;
  finishedAt: string;
}

let unlistenDataChanged: UnlistenFn | null = null;
let unlistenFocusChanged: UnlistenFn | null = null;
let unlistenMoved: UnlistenFn | null = null;
let dragBlurTimer: number | null = null;

onMounted(async () => {
  document.documentElement.classList.add('quick-float-html');
  document.body.classList.add('quick-float-body');
  refreshFloatingData();
  refreshTheme();
  window.addEventListener('storage', handleStorageChange);
  unlistenDataChanged = await listen(FLOATING_DATA_CHANGED_EVENT, refreshFloatingData);
  unlistenFocusChanged = await appWindow.onFocusChanged(async ({ payload: focused }) => {
    if (!focused && expanded.value) {
      if (dragBlurProtected.value) {
        return;
      }

      await collapseWindow();
    }
  });
  unlistenMoved = await appWindow.onMoved(() => {
    if (dragBlurProtected.value) {
      protectDragBlur();
    }
  });
  await appWindow.setAlwaysOnTop(true);
  await resizeFloatWindow();
});

onUnmounted(() => {
  document.documentElement.classList.remove('quick-float-html');
  document.body.classList.remove('quick-float-body');
  window.removeEventListener('storage', handleStorageChange);
  clearDragBlurTimer();
  unlistenDataChanged?.();
  unlistenFocusChanged?.();
  unlistenMoved?.();
});

/**
 * 展开悬浮窗并调整真实窗口尺寸，避免透明区域拦截桌面点击。
 *
 * @return 无返回值。
 */
async function expandWindow() {
  expanded.value = true;
  statusText.value = '选择项目或执行快捷指令';
  await resizeFloatWindow();
}

/**
 * 收起态单击展开；如果刚触发过拖动，则吞掉本次点击。
 *
 * @return 无返回值。
 */
async function handleCollapsedClick() {
  if (collapsedPointer.value.dragging) {
    collapsedPointer.value.dragging = false;
    return;
  }

  await expandWindow();
}

/**
 * 记录收起态指针起点，用于区分点击和拖动。
 *
 * @param event 指针事件。
 * @return 无返回值。
 */
function handleCollapsedPointerDown(event: PointerEvent) {
  collapsedPointer.value = { x: event.clientX, y: event.clientY, dragging: false };
}

/**
 * 指针移动超过阈值时启动系统级窗口拖动。
 *
 * @param event 指针事件。
 * @return 无返回值。
 */
async function handleCollapsedPointerMove(event: PointerEvent) {
  if (collapsedPointer.value.dragging) {
    return;
  }

  const moved = Math.hypot(event.clientX - collapsedPointer.value.x, event.clientY - collapsedPointer.value.y);
  if (moved < 4) {
    return;
  }

  collapsedPointer.value.dragging = true;
  await startDrag();
}

/**
 * 结束收起态指针交互，拖动状态保留到 click 阶段用于阻止误展开。
 *
 * @return 无返回值。
 */
function handleCollapsedPointerEnd() {
  if (!collapsedPointer.value.dragging) {
    collapsedPointer.value = { ...collapsedPointer.value, dragging: false };
  }
}

/**
 * 收起悬浮窗，只保留圆形入口。
 *
 * @return 无返回值。
 */
async function collapseWindow() {
  expanded.value = false;
  statusText.value = '左键展开悬浮窗';
  await resizeFloatWindow();
}

/**
 * 同步 Tauri 窗口尺寸到当前展开状态。
 *
 * @return 无返回值。
 */
async function resizeFloatWindow() {
  await appWindow.setSize(expanded.value ? expandedSize : collapsedSize);
}

/**
 * 让无边框悬浮窗可通过标题区域拖动。
 *
 * @return 无返回值。
 */
async function startDrag() {
  protectDragBlur();
  await appWindow.startDragging();
}

/**
 * 在窗口拖动期间临时忽略失焦收起，避免系统拖拽触发的 blur 误关闭悬浮窗。
 *
 * @return 无返回值。
 */
function protectDragBlur() {
  clearDragBlurTimer();
  dragBlurProtected.value = true;
  dragBlurTimer = window.setTimeout(() => {
    dragBlurProtected.value = false;
    dragBlurTimer = null;
    if (expanded.value) {
      void appWindow.setFocus();
    }
  }, dragBlurProtectionMs);
}

/**
 * 清理拖动失焦保护定时器，避免组件卸载后继续访问窗口实例。
 *
 * @return 无返回值。
 */
function clearDragBlurTimer() {
  if (!dragBlurTimer) {
    return;
  }

  window.clearTimeout(dragBlurTimer);
  dragBlurTimer = null;
}

/**
 * 下拉搜索同时匹配项目别名和路径，但列表中只展示别名。
 *
 * @param pattern 用户输入的搜索文本。
 * @param option 下拉选项。
 * @return 命中别名或路径时返回 true。
 */
function filterRepositoryOption(pattern: string, option: SelectOption) {
  const keyword = pattern.trim().toLowerCase();
  const label = String(option.label || '').toLowerCase();
  const value = String(option.value || '').toLowerCase();

  return label.includes(keyword) || value.includes(keyword);
}

/**
 * 处理悬浮窗项目下拉框选择，只更新悬浮窗当前项目。
 *
 * @param selectedPath 选中的仓库路径。
 * @return 无返回值。
 */
function handleRepositorySelect(selectedPath: string) {
  const repository = savedRepositories.value.find((repo) => repo.path === selectedPath);

  if (!repository) {
    return;
  }

  switchQuickRepository(repository);
}

/**
 * 仅切换悬浮窗当前项目，不唤醒主窗口，也不触发仓库加载。
 *
 * @param repository 要切换的收藏项目。
 * @return 无返回值。
 */
function switchQuickRepository(repository: SavedRepository) {
  if (quickCommandRunning.value) {
    return;
  }

  repoPath.value = repository.path;
  clearPendingQuickCommand();
  statusText.value = `已切换：${repository.alias}`;
}

/**
 * 在悬浮窗中弹出气泡确认框，确认后由悬浮窗直接执行 Git 命令。
 *
 * @param command 完整 Git 命令。
 * @return 无返回值。
 */
function runQuickCommand(command: string) {
  if (!repoPath.value.trim()) {
    statusText.value = '请先选择项目';
    return;
  }

  const args = parseGitCommand(command);
  if (!args.length) {
    statusText.value = '无效 Git 指令';
    return;
  }

  pendingQuickCommand.value = command;
  pendingQuickCommandArgs.value = args;
  pendingQuickRepoPath.value = repoPath.value;
  statusText.value = pendingQuickRisk.value.level === 'danger'
    ? `高风险确认：${commandLabel(command)}`
    : `等待确认：${commandLabel(command)}`;
}

/**
 * 取消悬浮窗内待确认命令。
 *
 * @return 无返回值。
 */
function cancelQuickCommand() {
  if (quickCommandRunning.value) {
    return;
  }

  clearPendingQuickCommand();
  statusText.value = '已取消执行';
}

/**
 * 执行悬浮窗气泡框中已确认的 Git 命令，不打开主窗口。
 *
 * @return 无返回值。
 */
async function confirmQuickCommand() {
  if (!pendingQuickCommand.value || !pendingQuickCommandArgs.value.length || quickCommandRunning.value) {
    return;
  }

  if (quickConfirmBlocked.value) {
    statusText.value = '请先确认危险操作风险';
    return;
  }

  const command = pendingQuickCommand.value;
  const commandArgs = [...pendingQuickCommandArgs.value];
  const commandRepoPath = pendingQuickRepoPath.value;
  quickCommandRunning.value = true;
  quickCommandRunId.value = createQuickRunId();
  quickCommandStopRequested.value = false;
  quickCommandOutput.value = createQuickCommandOutput(command, commandRepoPath);
  statusText.value = `执行中：${commandLabel(command)}`;
  let unlistenProgress: UnlistenFn | null = null;

  try {
    unlistenProgress = await listen<{ commandId: string; stream: 'stdout' | 'stderr'; line: string; progress: number | null }>(GIT_COMMAND_PROGRESS_EVENT, (event) => {
      if (!quickCommandOutput.value || event.payload.commandId !== quickCommandRunId.value) {
        return;
      }

      quickCommandOutput.value = {
        ...quickCommandOutput.value,
        progress: normalizeQuickProgress(event.payload.line, event.payload.progress, quickCommandOutput.value.progress),
        progressText: event.payload.line
      };
    });

    const result = await executeGitStreaming(commandRepoPath, commandArgs, quickCommandRunId.value);
    updateQuickCommandOutput(result);
    if (quickCommandStopRequested.value) {
      statusText.value = `已停止：${commandLabel(command)}`;
    } else {
      statusText.value = result.code === 0
        ? `执行完成：${commandLabel(command)}`
        : `退出码 ${result.code}：${commandLabel(command)}`;
    }
  } catch (error) {
    const message = normalizeQuickError(error);
    updateQuickCommandOutput(null, message);
    statusText.value = `执行失败：${message}`;
  } finally {
    unlistenProgress?.();
    quickCommandRunning.value = false;
    quickCommandRunId.value = '';
    quickCommandStopRequested.value = false;
    clearPendingQuickCommand();
  }
}

async function cancelQuickCommandRunning() {
  if (!quickCommandRunId.value) {
    return;
  }

  try {
    const cancelled = await cancelGitCommand(quickCommandRunId.value);
    if (cancelled) {
      quickCommandStopRequested.value = true;
      statusText.value = '正在停止命令...';
      if (quickCommandOutput.value) {
        quickCommandOutput.value = {
          ...quickCommandOutput.value,
          progressText: '正在停止命令...'
        };
      }
    } else {
      statusText.value = '未找到正在执行的命令';
    }
  } catch (error) {
    statusText.value = `停止失败：${normalizeQuickError(error)}`;
  }
}

/**
 * 清空悬浮窗命令确认框中的待执行数据。
 *
 * @return 无返回值。
 */
function clearPendingQuickCommand() {
  pendingQuickCommand.value = '';
  pendingQuickCommandArgs.value = [];
  pendingQuickRepoPath.value = '';
  dangerAcknowledged.value = false;
}

/**
 * 创建最近执行结果的运行中占位记录。
 *
 * @param command 完整 Git 命令文本。
 * @param commandRepoPath 命令执行仓库路径。
 * @return 用于悬浮窗展示的执行记录。
 */
function createQuickCommandOutput(command: string, commandRepoPath: string): QuickCommandOutput {
  return {
    command,
    repoPath: commandRepoPath,
    code: null,
    stdout: '',
    stderr: '',
    error: '',
    progress: 0,
    progressText: '',
    finishedAt: ''
  };
}

/**
 * 把 Git 命令执行结果写入最近结果面板。
 *
 * @param result Git 命令返回结果，异常时为空。
 * @param errorMessage 异常执行失败时的错误文本。
 * @return 无返回值。
 */
function updateQuickCommandOutput(result: GitCommandResult | null, errorMessage = '') {
  if (!quickCommandOutput.value) {
    return;
  }

  quickCommandOutput.value = {
    ...quickCommandOutput.value,
    code: result?.code ?? 1,
    stdout: result?.stdout || '',
    stderr: result?.stderr || '',
    error: errorMessage,
    progress: result?.code === 0 ? 100 : null,
    progressText: result ? '' : '命令已失败',
    finishedAt: new Date().toLocaleTimeString()
  };
}

function normalizeQuickProgress(line: string, progress: number | null, current: number | null) {
  if (progress === null) {
    return current;
  }

  const stage = line.replace(/^remote:\s*/i, '').toLowerCase();
  const ranges: Array<[string, number, number]> = [
    ['counting objects', 5, 15],
    ['compressing objects', 20, 25],
    ['writing objects', 45, 45],
    ['receiving objects', 20, 60],
    ['resolving deltas', 85, 13],
    ['checking out files', 80, 18]
  ];
  const range = ranges.find(([keyword]) => stage.includes(keyword));
  const next = range ? Math.min(Math.round(range[1] + (progress * range[2]) / 100), 99) : Math.min(progress, 99);

  return current === null ? next : Math.max(current, next);
}

function createQuickRunId() {
  return `quick-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 复制最近一次命令输出，便于用户排查失败原因。
 *
 * @return 无返回值。
 */
async function copyQuickOutput() {
  if (!quickOutputText.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(quickOutputText.value);
    statusText.value = '已复制最近输出';
  } catch (error) {
    statusText.value = `复制失败：${normalizeQuickError(error)}`;
  }
}

/**
 * 清空最近一次命令输出面板。
 *
 * @return 无返回值。
 */
function clearQuickOutput() {
  quickCommandOutput.value = null;
  statusText.value = '已清空最近结果';
}

/**
 * 从悬浮窗快捷区移除指定自定义指令。
 *
 * @param commandId 保存指令 ID。
 * @return 无返回值。
 */
async function removeFloatingCommand(commandId: string) {
  floatingCommandIds.value = floatingCommandIds.value.filter((id) => id !== commandId);
  statusText.value = '已从悬浮窗移除指令';
  await emit(FLOATING_DATA_CHANGED_EVENT);
}

/**
 * 从 localStorage 重新读取主窗口维护的项目和命令数据。
 *
 * @return 无返回值。
 */
function refreshFloatingData() {
  repoPath.value = localStorage.getItem(STORAGE_KEYS.repoPath) || '';
  savedRepositories.value = loadStorage<SavedRepository[]>(STORAGE_KEYS.repositories, []);
  savedCommands.value = loadStorage<SavedCommand[]>(STORAGE_KEYS.commands, []);
  repositoryPushCommands.value = loadStorage<RepositoryPushCommand[]>(STORAGE_KEYS.pushCommands, []);
  floatingCommandIds.value = loadStorage<string[]>(STORAGE_KEYS.floatingCommands, []);
}

/**
 * 将当前主题状态同步到悬浮窗，保证与主窗口保持一致。
 *
 * @return 无返回值。
 */
function refreshTheme() {
  isDark.value = localStorage.getItem(STORAGE_KEYS.theme) === 'dark';
  document.documentElement.classList.toggle('dark', isDark.value);
}

/**
 * 监听其他窗口 localStorage 变更，保持悬浮窗列表实时同步。
 *
 * @param event 浏览器 storage 事件。
 * @return 无返回值。
 */
function handleStorageChange(event: StorageEvent) {
  if (event.key === STORAGE_KEYS.theme) {
    refreshTheme();
    return;
  }

  if (!event.key || Object.values(STORAGE_KEYS).includes(event.key as typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS])) {
    refreshFloatingData();
  }
}

/**
 * 将未知异常转换为悬浮窗底部状态可展示的短文本。
 *
 * @param error 捕获到的异常。
 * @return 错误文本。
 */
function normalizeQuickError(error: unknown) {
  return error instanceof Error ? error.message : String(error || '未知错误');
}
</script>

<style scoped>
.quick-repository-select :deep(.n-base-selection-label) {
  padding-left: 12px;
}

.quick-repository-select :deep(.n-base-selection-input),
.quick-repository-select :deep(.n-base-selection-input__content),
.quick-repository-select :deep(.n-base-selection-placeholder) {
  font-size: 14px;
  font-weight: 800;
}
</style>
