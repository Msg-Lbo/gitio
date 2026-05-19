<template>
  <aside class="glass-panel flex min-h-0 flex-col rounded-xl">
    <div class="shrink-0 border-b border-slate-200/70 p-3 dark:border-slate-800">
      <p class="text-xs uppercase tracking-[0.24em] text-slate-500">Inspector</p>
      <div class="mt-3 grid grid-cols-5 gap-1">
        <button v-for="panel in inspectorPanels" :key="panel.value" :class="['rounded-md px-2 py-1.5 text-xs font-bold transition', rightPanel === panel.value ? 'bg-sky-600 text-white' : 'bg-slate-950/5 text-slate-600 hover:bg-slate-950/10 dark:bg-white/10 dark:text-slate-300']" type="button" @click="setInspector(panel.value)">
          {{ panel.label }}
        </button>
      </div>
    </div>

    <n-scrollbar style="max-height: calc(100vh - 188px)" trigger="hover">
      <div class="space-y-4 p-4">
        <section v-if="rightPanel === 'changes'" class="space-y-4">
          <div class="grid grid-cols-2 gap-2">
            <n-button secondary @click="runCommand('git add --all')">Stage All</n-button>
            <n-button secondary @click="runCommand('git status --short --branch')">Status</n-button>
          </div>
          <n-input v-model:value="commitMessage" type="textarea" :autosize="{ minRows: 3, maxRows: 6 }" placeholder="Commit message" />
          <div class="grid grid-cols-2 gap-2">
            <n-button type="primary" @click="commitChanges">Commit</n-button>
            <n-button secondary @click="amendCommit">Amend</n-button>
          </div>
        </section>

        <section v-else-if="rightPanel === 'commit'" class="space-y-4">
          <div v-if="selectedCommit" class="space-y-3">
            <h3 class="break-words text-lg font-black text-slate-950 dark:text-white">{{ selectedCommit.subject }}</h3>
            <div class="flex flex-wrap gap-2">
              <n-tag type="info" size="small">{{ selectedCommit.shortHash }}</n-tag>
              <n-tag v-for="refName in commitRefs(selectedCommit.refs)" :key="refName" size="small">{{ refName }}</n-tag>
            </div>
            <div class="space-y-1 text-sm text-slate-500 dark:text-slate-400">
              <p>作者：{{ selectedCommit.author }}</p>
              <p>时间：{{ selectedCommit.relativeTime }}</p>
              <p v-if="selectedCommit.parents.length">Parents：{{ shortParents(selectedCommit.parents) }}</p>
            </div>
            <n-button type="primary" ghost @click="runCommand(`git show --stat --patch ${selectedCommit.hash}`)">查看提交详情</n-button>
          </div>
          <p v-else class="text-sm text-slate-500">点击中间提交行后，这里显示提交详情。</p>
        </section>

        <section v-else-if="rightPanel === 'commands'" class="space-y-4">
          <h3 class="font-black text-slate-950 dark:text-white">命令中心</h3>
          <div class="rounded-lg border border-sky-400/30 bg-sky-500/10 p-3">
            <div class="mb-2 flex items-center justify-between gap-2">
              <p class="text-sm font-black text-slate-950 dark:text-white">当前仓库 Push 指令</p>
              <n-button size="small" secondary @click="saveRepositoryPushCommand">保存</n-button>
            </div>
            <n-input v-model:value="repositoryPushDraft" type="textarea" :autosize="{ minRows: 2, maxRows: 5 }" placeholder="git push origin HEAD:refs/for/main%topic=demo" />
            <div class="mt-2 flex gap-2">
              <n-button size="small" type="primary" ghost @click="runRepositoryPush">执行 Push</n-button>
              <n-button size="small" quaternary @click="resetRepositoryPushDraft">恢复默认</n-button>
            </div>
          </div>
          <n-input v-model:value="commandAlias" placeholder="指令别名" />
          <n-input v-model:value="customCommand" type="textarea" :autosize="{ minRows: 4, maxRows: 8 }" placeholder="git push origin HEAD:refs/for/main%topic=demo" />
          <div class="flex flex-wrap gap-2">
            <n-button type="primary" :loading="commandRunning" @click="runCustomCommand">执行</n-button>
            <n-button secondary @click="saveCustomCommand">{{ editingCommandId ? '更新' : '保存' }}</n-button>
            <n-button quaternary @click="clearCommandDraft">清空</n-button>
          </div>
          <pre class="terminal-view soft-scrollbar max-h-[260px] min-h-[180px] p-3">{{ commandOutput || '等待执行命令...' }}</pre>
        </section>

        <section v-else-if="rightPanel === 'files'" class="space-y-4">
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-black text-slate-950 dark:text-white">.git 文件</h3>
            <n-button size="small" secondary @click="goGitParent">上级</n-button>
          </div>
          <p class="truncate rounded-md bg-slate-950/5 p-2 text-xs text-slate-500 dark:bg-white/10">{{ overview?.gitDir || '.git' }}<span v-if="gitPath"> / {{ gitPath }}</span></p>
          <div class="rounded-lg border border-slate-200/70 dark:border-slate-700/70">
            <n-scrollbar style="max-height: 250px" trigger="hover">
              <button v-for="entry in gitEntries" :key="entry.path" class="flex w-full items-center justify-between border-b border-slate-200/70 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-sky-500/10 dark:border-slate-800" type="button" @click="openGitEntry(entry)">
                <span class="truncate">{{ entry.isDir ? '▸' : '•' }} {{ entry.name }}</span>
                <span class="text-xs text-slate-400">{{ entry.isDir ? 'dir' : formatSize(entry.size) }}</span>
              </button>
            </n-scrollbar>
          </div>
          <n-input v-model:value="activeEditorContent" type="textarea" :autosize="{ minRows: 8, maxRows: 18 }" placeholder="选择 .git 文本文件" />
          <n-button type="primary" :disabled="!activeEditorPath" @click="saveActiveGitFile">保存文件</n-button>
        </section>

        <section v-else class="space-y-4">
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-black text-slate-950 dark:text-white">Git Config</h3>
            <n-button size="small" secondary @click="loadConfigs">读取</n-button>
          </div>
          <p class="text-xs text-slate-500">仓库 Config</p>
          <n-input v-model:value="repoConfig" type="textarea" :autosize="{ minRows: 7, maxRows: 14 }" />
          <n-button type="primary" @click="saveRepoConfig">保存仓库 Config</n-button>
          <p class="truncate text-xs text-slate-500">全局 Config：{{ globalConfigPath || '~/.gitconfig' }}</p>
          <n-input v-model:value="globalConfig" type="textarea" :autosize="{ minRows: 7, maxRows: 14 }" />
          <n-button type="primary" ghost @click="saveGlobalConfig">保存全局 Config</n-button>
        </section>
      </div>
    </n-scrollbar>
  </aside>
</template>

<script setup lang="ts">
import { useCommands } from '@/composables/workbench/useCommands';
import { useConfigFiles } from '@/composables/workbench/useConfigFiles';
import { useGitFiles } from '@/composables/workbench/useGitFiles';
import { useInspector } from '@/composables/workbench/useInspector';
import { useRepositoryData } from '@/composables/workbench/useRepositoryData';

const {
  rightPanel,
  inspectorPanels,
  setInspector
} = useInspector();

const {
  selectedCommit,
  overview,
  commitRefs,
  shortParents
} = useRepositoryData();

const {
  commitMessage,
  repositoryPushDraft,
  commandAlias,
  customCommand,
  commandRunning,
  editingCommandId,
  commandOutput,
  runCommand,
  commitChanges,
  amendCommit,
  saveRepositoryPushCommand,
  runRepositoryPush,
  resetRepositoryPushDraft,
  runCustomCommand,
  saveCustomCommand,
  clearCommandDraft
} = useCommands();

const {
  gitPath,
  gitEntries,
  activeEditorContent,
  activeEditorPath,
  goGitParent,
  openGitEntry,
  formatSize,
  saveActiveGitFile
} = useGitFiles();

const {
  repoConfig,
  globalConfig,
  globalConfigPath,
  loadConfigs,
  saveRepoConfig,
  saveGlobalConfig
} = useConfigFiles();
</script>
