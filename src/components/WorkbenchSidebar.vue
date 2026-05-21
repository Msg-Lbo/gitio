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
          <p class="mb-2 text-[11px] text-slate-500 dark:text-slate-400">右键保存指令可悬浮、编辑或删除。</p>
          <div class="flex flex-col gap-1">
            <button v-for="savedCommand in savedCommands" :key="savedCommand.id" class="rounded-md px-3 py-2 text-left text-sm transition hover:bg-slate-950/5 dark:hover:bg-white/5" type="button" :title="isSavedCommandFloating(savedCommand) ? '已在悬浮窗中，左键执行，右键管理' : '左键执行，右键管理'" @click="runCommand(savedCommand.command)" @contextmenu.prevent="openSavedCommandMenu($event, savedCommand)">
              <span class="flex min-w-0 items-center gap-2">
                <span class="block min-w-0 flex-1 truncate font-bold">{{ savedCommand.alias }}</span>
                <n-tag v-if="isSavedCommandFloating(savedCommand)" size="tiny" type="success" round>悬浮</n-tag>
              </span>
              <span class="mono block truncate text-[11px] text-slate-500">{{ savedCommand.command }}</span>
            </button>
          </div>
          <n-dropdown trigger="manual" placement="bottom-start" :show="savedCommandMenuVisible" :x="savedCommandMenuPosition.x" :y="savedCommandMenuPosition.y" :options="savedCommandMenuOptions" @select="handleSavedCommandMenuSelect" @clickoutside="closeSavedCommandMenu" />
        </section>
      </div>
    </n-scrollbar>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DropdownOption } from 'naive-ui';
import type { SavedCommand } from '@/types/git';
import { useCommands } from '@/composables/workbench/useCommands';
import { useRepositories } from '@/composables/workbench/useRepositories';
import { useRepositoryData } from '@/composables/workbench/useRepositoryData';

type SavedCommandMenuKey = 'floating' | 'edit' | 'delete';

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
  removeSavedCommandFromFloating,
  editSavedCommand,
  removeSavedCommand,
  isSavedCommandFloating
} = useCommands();

const savedCommandMenuVisible = ref(false);
const savedCommandMenuPosition = ref({ x: 0, y: 0 });
const selectedSavedCommand = ref<SavedCommand | null>(null);
const savedCommandMenuOptions = computed<DropdownOption[]>(() => [
  {
    label: selectedSavedCommand.value && isSavedCommandFloating(selectedSavedCommand.value) ? '取消悬浮' : '悬浮',
    key: 'floating'
  },
  {
    label: '编辑',
    key: 'edit'
  },
  {
    label: '删除',
    key: 'delete'
  }
]);

/**
 * 在保存命令上打开右键菜单，提供悬浮、编辑和删除入口。
 *
 * @param event 鼠标右键事件，用于定位菜单。
 * @param savedCommand 当前被右键点击的保存命令。
 * @return 无返回值。
 */
function openSavedCommandMenu(event: MouseEvent, savedCommand: SavedCommand) {
  selectedSavedCommand.value = savedCommand;
  savedCommandMenuPosition.value = { x: event.clientX, y: event.clientY };
  savedCommandMenuVisible.value = true;
}

/**
 * 处理保存命令右键菜单操作。
 *
 * @param key 菜单项标识。
 * @return 无返回值。
 */
function handleSavedCommandMenuSelect(key: string | number) {
  const savedCommand = selectedSavedCommand.value;
  closeSavedCommandMenu();

  if (!savedCommand) {
    return;
  }

  if (key === 'floating') {
    if (isSavedCommandFloating(savedCommand)) {
      removeSavedCommandFromFloating(savedCommand);
      return;
    }

    addSavedCommandToFloating(savedCommand);
    return;
  }

  if (key === 'edit') {
    editSavedCommand(savedCommand);
    return;
  }

  if (key === 'delete') {
    removeSavedCommand(savedCommand.id);
  }
}

/**
 * 关闭保存命令右键菜单并清理选中命令。
 *
 * @return 无返回值。
 */
function closeSavedCommandMenu() {
  savedCommandMenuVisible.value = false;
  selectedSavedCommand.value = null;
}
</script>
