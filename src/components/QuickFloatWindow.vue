<template>
  <main class="quick-float-root flex h-screen w-screen overflow-hidden bg-transparent text-slate-100">
    <button v-if="!expanded" class="flex h-10 w-10 items-center justify-center bg-transparent p-0" type="button" title="单击展开，按住拖动" @click="handleCollapsedClick" @pointerdown="handleCollapsedPointerDown" @pointermove="handleCollapsedPointerMove" @pointerup="handleCollapsedPointerEnd" @pointercancel="handleCollapsedPointerEnd">
      <img :src="appIcon" alt="Gitio" class="h-10 w-10 rounded-xl" draggable="false" />
    </button>

    <section v-else class="flex min-h-0 w-full flex-col bg-[#06111f]">
      <header class="flex shrink-0 cursor-move items-center justify-between gap-3 border-b border-white/10 px-4 py-3" @mousedown="startDrag">
        <div class="min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-300/80">Gitio Float</p>
          <h1 class="truncate text-sm font-black text-white">{{ activeRepositoryName }}</h1>
        </div>
        <button class="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-200 transition hover:bg-white/10" type="button" @mousedown.stop @click.stop="collapseWindow">收起</button>
      </header>

      <div class="soft-scrollbar min-h-0 flex-1 space-y-4 overflow-auto p-3">
        <section class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-xs font-black uppercase tracking-[0.2em] text-slate-300">项目</h2>
            <span class="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">{{ savedRepositories.length }}</span>
          </div>
          <div v-if="savedRepositories.length" class="space-y-1">
            <button v-for="repo in savedRepositories" :key="repo.id" :class="['w-full rounded-xl border px-3 py-2 text-left transition', repo.path === repoPath ? 'border-sky-300/60 bg-sky-400/15 text-sky-100' : 'border-white/8 bg-white/[0.04] text-slate-200 hover:bg-white/10']" type="button" @click="switchQuickRepository(repo)">
              <span class="block truncate text-sm font-bold">{{ repo.alias }}</span>
              <span class="mono block truncate text-[10px] text-slate-400">{{ repo.path }}</span>
            </button>
          </div>
          <p v-else class="rounded-xl border border-dashed border-white/10 p-3 text-xs text-slate-400">主窗口收藏项目后，这里会显示快捷切换入口。</p>
        </section>

        <section class="space-y-2">
          <h2 class="text-xs font-black uppercase tracking-[0.2em] text-slate-300">固定指令</h2>
          <div class="grid grid-cols-2 gap-2">
            <button class="rounded-xl bg-sky-500 px-3 py-2 text-sm font-black text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400" type="button" :disabled="!repoPath" @click="runQuickCommand(currentPushCommand)">Push</button>
            <button class="rounded-xl bg-teal-500 px-3 py-2 text-sm font-black text-white transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400" type="button" :disabled="!repoPath" @click="runQuickCommand('git pull --rebase --autostash')">Rebase Pull</button>
          </div>
        </section>

        <section class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-xs font-black uppercase tracking-[0.2em] text-slate-300">自定义指令</h2>
            <span class="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">{{ floatingCommands.length }}</span>
          </div>
          <div v-if="floatingCommands.length" class="space-y-1">
            <div v-for="command in floatingCommands" :key="command.id" class="group flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 transition hover:bg-white/10">
              <button class="min-w-0 flex-1 text-left" type="button" @click="runQuickCommand(command.command)">
                <span class="block truncate text-sm font-bold text-slate-100">{{ command.alias }}</span>
                <span class="mono block truncate text-[10px] text-slate-400">{{ command.command }}</span>
              </button>
              <button class="shrink-0 rounded-full px-2 py-1 text-xs font-black text-slate-500 opacity-70 transition hover:bg-red-500/20 hover:text-red-200 group-hover:opacity-100" type="button" title="从悬浮窗移除" @click="removeFloatingCommand(command.id)">×</button>
            </div>
          </div>
          <p v-else class="rounded-xl border border-dashed border-white/10 p-3 text-xs text-slate-400">在主窗口 Saved Commands 上右键，可添加到这里。</p>
        </section>
      </div>

      <footer class="shrink-0 border-t border-white/10 px-3 py-2 text-[11px] text-slate-400">
        {{ statusText }}
      </footer>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { emit, emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  FLOATING_DATA_CHANGED_EVENT,
  FLOATING_RUN_COMMAND_EVENT,
  FLOATING_SWITCH_REPOSITORY_EVENT
} from '@/constants/floating';
import appIcon from '../../docs/assets/gitio-logo.svg';
import type { FloatingRunCommandPayload, FloatingSwitchRepositoryPayload, RepositoryPushCommand, SavedCommand, SavedRepository } from '@/types/git';
import { commandLabel } from '@/utils/command';
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

const activeRepositoryName = computed(() => {
  const active = savedRepositories.value.find((repo) => repo.path === repoPath.value);
  return active?.alias || inferRepoAlias(repoPath.value) || '未选择项目';
});
const currentPushCommand = computed(() => currentRepositoryPushCommand.value);

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
 * 请求主窗口切换当前项目，真正的仓库刷新仍由主窗口完成。
 *
 * @param repository 要切换的收藏项目。
 * @return 无返回值。
 */
async function switchQuickRepository(repository: SavedRepository) {
  repoPath.value = repository.path;
  statusText.value = `正在切换：${repository.alias}`;
  await emitTo<FloatingSwitchRepositoryPayload>('main', FLOATING_SWITCH_REPOSITORY_EVENT, { repository });
}

/**
 * 请求主窗口执行快捷命令，继续使用主窗口原有确认弹窗。
 *
 * @param command 完整 Git 命令。
 * @return 无返回值。
 */
async function runQuickCommand(command: string) {
  if (!repoPath.value.trim()) {
    statusText.value = '请先选择项目';
    return;
  }

  statusText.value = `等待确认：${commandLabel(command)}`;
  await emitTo<FloatingRunCommandPayload>('main', FLOATING_RUN_COMMAND_EVENT, { command, repoPath: repoPath.value });
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
</script>
