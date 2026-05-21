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
      <div class="flex justify-end gap-2">
        <n-button :disabled="commandRunning" @click="cancelPendingCommand">取消</n-button>
        <n-button :type="confirmButtonType" :disabled="confirmBlocked" :loading="commandRunning" @click="confirmPendingCommand">执行</n-button>
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
  commandRunning,
  pendingCommand,
  pendingCommandRisk,
  cancelPendingCommand,
  confirmPendingCommand
} = useCommands();

const confirmBlocked = computed(() => pendingCommandRisk.value.level === 'danger' && !commandDangerAcknowledged.value);
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
