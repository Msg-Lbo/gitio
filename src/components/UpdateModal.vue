<template>
  <n-modal v-model:show="updateModalVisible" preset="card" title="在线更新" class="max-w-[680px]" :mask-closable="!updating">
    <div class="space-y-4">
      <div class="grid gap-3 rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 text-sm dark:border-white/10 dark:bg-white/5 sm:grid-cols-2">
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">当前版本</p>
          <p class="mt-1 font-semibold text-slate-900 dark:text-slate-50">v{{ currentVersion }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">最新版本</p>
          <p class="mt-1 font-semibold text-slate-900 dark:text-slate-50">{{ latestVersionLabel }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">状态</p>
          <p class="mt-1 font-semibold" :class="statusClass">{{ statusText }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">发布日期</p>
          <p class="mt-1 font-semibold text-slate-900 dark:text-slate-50">{{ releaseDateLabel }}</p>
        </div>
      </div>

      <n-alert v-if="errorMessage" type="error" :bordered="false">
        {{ errorMessage }}
      </n-alert>

      <section>
        <div class="mb-2 flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-50">更新日志</h3>
          <span class="text-xs text-slate-500 dark:text-slate-400">来自 CHANGELOG / GitHub Release</span>
        </div>
        <n-scrollbar style="max-height: 360px" trigger="hover" class="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-[#071524]/70">
          <pre class="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 dark:text-slate-200">{{ releaseNotes }}</pre>
        </n-scrollbar>
      </section>

      <section v-if="updating || downloadStarted" class="space-y-2 rounded-xl border border-sky-200/70 bg-sky-50/70 p-4 dark:border-sky-400/20 dark:bg-sky-400/10">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium text-sky-900 dark:text-sky-100">{{ progressText }}</span>
          <span class="text-sky-700 dark:text-sky-200">{{ downloadSizeText }}</span>
        </div>
        <n-progress type="line" :percentage="downloadPercent" :processing="status === 'downloading'" :show-indicator="false" />
      </section>

      <div class="flex justify-end gap-2">
        <n-button :loading="checking" :disabled="updating" @click="checkForUpdates">检查更新</n-button>
        <n-button type="primary" strong :disabled="!canInstallUpdate" :loading="updating" @click="installUpdate">立即更新</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppUpdater } from '@/composables/useAppUpdater';

const {
  currentVersion,
  latestVersion,
  releaseDate,
  releaseNotes,
  status,
  errorMessage,
  updateModalVisible,
  downloadedBytes,
  downloadTotalBytes,
  downloadStarted,
  downloadPercent,
  checking,
  updating,
  canInstallUpdate,
  checkForUpdates,
  installUpdate
} = useAppUpdater();

const latestVersionLabel = computed(() => (latestVersion.value ? `v${latestVersion.value}` : '待检查'));
const releaseDateLabel = computed(() => formatReleaseDate(releaseDate.value));
const statusText = computed(() => {
  const labels = {
    idle: '待检查',
    checking: '正在检查更新',
    available: '发现新版本',
    latest: '已是最新版本',
    downloading: '正在下载更新',
    installing: '正在安装并重启',
    error: '检查或更新失败'
  } as const;

  return labels[status.value];
});
const statusClass = computed(() => {
  if (status.value === 'available') {
    return 'text-amber-500';
  }

  if (status.value === 'error') {
    return 'text-red-500';
  }

  if (status.value === 'latest') {
    return 'text-emerald-500';
  }

  return 'text-sky-500';
});
const progressText = computed(() => {
  if (status.value === 'installing') {
    return '下载完成，正在安装并重启...';
  }

  return '正在下载最新版安装包...';
});
const downloadSizeText = computed(() => {
  if (!downloadTotalBytes.value) {
    return formatBytes(downloadedBytes.value);
  }

  return `${formatBytes(downloadedBytes.value)} / ${formatBytes(downloadTotalBytes.value)}`;
});

/**
 * 格式化下载进度字节数，方便在进度条右侧展示。
 *
 * @param bytes 字节数。
 * @return 可读的容量文本。
 */
function formatBytes(bytes: number) {
  if (!bytes) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/**
 * 将 updater 返回的 ISO 发布时间转换为本地可读时间，避免界面直接展示毫秒和时区标记。
 *
 * @param value updater 返回的原始发布时间。
 * @return 形如 `2026-05-19 18:39` 的本地时间文本。
 */
function formatReleaseDate(value: string) {
  if (!value) {
    return '暂无';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const pad = (part: number) => String(part).padStart(2, '0');

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  ].join(' ');
}
</script>
