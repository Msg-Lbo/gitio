<template>
  <n-modal v-model:show="commandConfirmVisible" preset="card" title="确认执行命令" class="max-w-[720px]" :mask-closable="!commandRunning">
    <div class="space-y-4">
      <p class="text-sm text-slate-500 dark:text-slate-400">即将在当前仓库执行以下 Git 命令，请确认无误后继续。</p>
      <n-alert v-if="pendingCommandRisk.level !== 'safe'" :type="pendingCommandRisk.level === 'danger' ? 'error' : 'warning'" :title="pendingCommandRisk.title" :bordered="false">
        {{ pendingCommandRisk.description }}
      </n-alert>
      <n-checkbox v-if="pendingCommandRisk.level === 'danger'" v-model:checked="commandDangerAcknowledged" :disabled="commandRunning">
        我已确认该操作可能造成不可恢复影响，仍要继续执行。
      </n-checkbox>
      <pre class="terminal-view soft-scrollbar max-h-[260px] p-4">{{ pendingCommand }}</pre>
      <div v-if="commandRunning" class="rounded-xl border border-sky-100 bg-sky-50/80 p-3 dark:border-sky-900/60 dark:bg-sky-950/30">
        <div class="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Git 命令执行中</span>
          <span>{{ progressLabel }}</span>
        </div>
        <n-progress type="line" :percentage="commandProgressPercent" :processing="commandProgressPercent < 100" :show-indicator="false" />
        <p class="mt-2 truncate text-xs text-slate-600 dark:text-slate-300">{{ commandProgressText || '等待 Git 输出...' }}</p>
      </div>
      <div class="flex justify-end gap-2">
        <n-button v-if="commandRunning" type="error" secondary @click="cancelRunningCommand">{{ stopButtonLabel }}</n-button>
        <n-button v-else @click="cancelPendingCommand">取消</n-button>
        <n-button v-if="!commandRunning" :type="confirmButtonType" :disabled="confirmBlocked" @click="confirmPendingCommand">执行</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCommands } from '@/composables/workbench/useCommands';

const {
  commandConfirmVisible,
  commandDangerAcknowledged,
  commandProgressPercent,
  commandProgressText,
  commandRunning,
  pendingCommand,
  pendingCommandRisk,
  cancelRunningCommand,
  cancelPendingCommand,
  confirmPendingCommand
} = useCommands();

const confirmBlocked = computed(() => pendingCommandRisk.value.level === 'danger' && !commandDangerAcknowledged.value);
const progressLabel = computed(() => commandProgressPercent.value > 0 ? `${commandProgressPercent.value}%` : '等待进度');
const stopButtonLabel = computed(() => pendingCommand.value.toLowerCase().startsWith('git push') ? '停止推送' : '停止命令');
const confirmButtonType = computed(() => {
  if (pendingCommandRisk.value.level === 'danger') {
    return 'error';
  }

  if (pendingCommandRisk.value.level === 'warning') {
    return 'warning';
  }

  return 'primary';
});
</script>
