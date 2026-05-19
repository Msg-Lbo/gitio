import { computed, ref } from 'vue';
import { getVersion } from '@tauri-apps/api/app';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import packageInfo from '../../package.json';
import changelogText from '../../CHANGELOG.md?raw';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'latest' | 'downloading' | 'installing' | 'error';

const currentVersion = ref(packageInfo.version);
const latestVersion = ref('');
const releaseDate = ref('');
const releaseNotes = ref('打开应用时会自动检查更新。');
const status = ref<UpdateStatus>('idle');
const errorMessage = ref('');
const updateModalVisible = ref(false);
const downloadedBytes = ref(0);
const downloadTotalBytes = ref(0);
const downloadStarted = ref(false);

const pendingUpdate = ref<Update | null>(null);
let didCheckOnStartup = false;

const hasAvailableUpdate = computed(() => ['available', 'downloading', 'installing'].includes(status.value));
const checking = computed(() => status.value === 'checking');
const updating = computed(() => status.value === 'downloading' || status.value === 'installing');
const canInstallUpdate = computed(() => status.value === 'available' && !checking.value && !updating.value);
const downloadPercent = computed(() => {
  if (status.value === 'installing') {
    return 100;
  }

  if (!downloadTotalBytes.value) {
    return downloadStarted.value ? 1 : 0;
  }

  return Math.min(100, Math.round((downloadedBytes.value / downloadTotalBytes.value) * 100));
});

/**
 * 从本地内置的 CHANGELOG 中提取指定版本的完整更新日志。
 *
 * @param version 版本号，支持带或不带 `v` 前缀。
 * @return 对应版本段的 markdown 文本。
 */
function extractChangelogSection(version: string) {
  const normalizedVersion = version.replace(/^v/, '');
  const startMarker = `## [${normalizedVersion}]`;
  const startIndex = changelogText.indexOf(startMarker);

  if (startIndex === -1) {
    return '';
  }

  const afterStart = changelogText.slice(startIndex);
  const nextSectionMatch = afterStart.slice(startMarker.length).match(/\n## \[/);
  const section = nextSectionMatch
    ? afterStart.slice(0, startMarker.length + (nextSectionMatch.index ?? 0))
    : afterStart;

  return section.trim();
}

/**
 * 把未知异常转换成可展示的中文错误文本。
 *
 * @param error 捕获到的异常对象。
 * @return 适合界面展示的错误文本。
 */
function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error || '未知错误');
}

/**
 * 读取 Tauri 配置中的真实应用版本，失败时回退到 package.json。
 *
 * @return 无返回值。
 */
async function loadCurrentVersion() {
  try {
    currentVersion.value = await getVersion();
  } catch {
    currentVersion.value = packageInfo.version;
  }
}

/**
 * 解析下载进度事件，更新进度条所需的累计字节数。
 *
 * @param event Tauri updater 下载事件。
 * @return 无返回值。
 */
function handleDownloadEvent(event: DownloadEvent) {
  if (event.event === 'Started') {
    downloadStarted.value = true;
    downloadedBytes.value = 0;
    downloadTotalBytes.value = event.data.contentLength ?? 0;
    return;
  }

  if (event.event === 'Progress') {
    downloadedBytes.value += event.data.chunkLength;
    return;
  }

  downloadStarted.value = true;
  downloadedBytes.value = downloadTotalBytes.value || downloadedBytes.value;
}

/**
 * 使用 Tauri updater 检查新版本，并保存可安装的更新对象。
 *
 * @return 无返回值。
 */
async function checkForUpdates() {
  if (checking.value || updating.value) {
    return;
  }

  await loadCurrentVersion();
  status.value = 'checking';
  errorMessage.value = '';

  try {
    pendingUpdate.value = await check({ timeout: 30000 });

    if (!pendingUpdate.value) {
      latestVersion.value = currentVersion.value;
      releaseDate.value = '';
      releaseNotes.value = '当前已是最新版本。';
      status.value = 'latest';
      return;
    }

    latestVersion.value = pendingUpdate.value.version;
    releaseDate.value = pendingUpdate.value.date ?? '';
    releaseNotes.value = extractChangelogSection(pendingUpdate.value.version) || pendingUpdate.value.body?.trim() || '暂无更新日志。';
    status.value = 'available';
  } catch (error) {
    pendingUpdate.value = null;
    latestVersion.value = '';
    releaseDate.value = '';
    errorMessage.value = normalizeError(error);
    releaseNotes.value = `检查更新失败：${errorMessage.value}`;
    status.value = 'error';
  }
}

/**
 * 安装已检查到的新版本，下载完成后触发安装并重启应用。
 *
 * @return 无返回值。
 */
async function installUpdate() {
  if (updating.value) {
    return;
  }

  if (!pendingUpdate.value) {
    await checkForUpdates();
  }

  const update = pendingUpdate.value;
  if (!update) {
    return;
  }

  status.value = 'downloading';
  errorMessage.value = '';
  downloadStarted.value = false;
  downloadedBytes.value = 0;
  downloadTotalBytes.value = 0;

  try {
    await update.downloadAndInstall(handleDownloadEvent, { timeout: 120000 });
    status.value = 'installing';
    await relaunch();
  } catch (error) {
    errorMessage.value = normalizeError(error);
    releaseNotes.value = `更新安装失败：${errorMessage.value}`;
    status.value = 'error';
  }
}

/**
 * 打开更新弹窗，供标题栏版本号点击调用。
 *
 * @return 无返回值。
 */
function openUpdateModal() {
  updateModalVisible.value = true;
}

/**
 * 应用启动时只自动检查一次，避免组件重挂载造成重复请求。
 *
 * @return 无返回值。
 */
async function checkOnStartup() {
  if (didCheckOnStartup) {
    return;
  }

  didCheckOnStartup = true;
  await checkForUpdates();
}

/**
 * 提供应用在线更新状态和操作方法。
 *
 * @return 在线更新状态、计算属性和操作函数。
 */
export function useAppUpdater() {
  return {
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
    hasAvailableUpdate,
    checking,
    updating,
    canInstallUpdate,
    checkForUpdates,
    installUpdate,
    openUpdateModal,
    checkOnStartup,
    loadCurrentVersion
  };
}
