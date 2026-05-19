<template>
  <n-modal v-model:show="commandConfirmVisible" preset="card" title="确认执行命令" class="max-w-[720px]" :mask-closable="!commandRunning">
    <div class="space-y-4">
      <p class="text-sm text-slate-500 dark:text-slate-400">即将在当前仓库执行以下 Git 命令，请确认无误后继续。</p>
      <pre class="terminal-view soft-scrollbar max-h-[260px] p-4">{{ pendingCommand }}</pre>
      <div class="flex justify-end gap-2">
        <n-button :disabled="commandRunning" @click="cancelPendingCommand">取消</n-button>
        <n-button type="primary" :loading="commandRunning" @click="confirmPendingCommand">执行</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { useCommands } from '@/composables/workbench/useCommands';

const {
  commandConfirmVisible,
  commandRunning,
  pendingCommand,
  cancelPendingCommand,
  confirmPendingCommand
} = useCommands();
</script>
