<template>
  <n-modal v-model:show="aboutDialogVisible" preset="card" title="关于 Gitio" class="max-w-[620px]">
    <div class="space-y-5">
      <section class="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
        <div class="flex items-start gap-3">
          <span class="flex h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-lg shadow-sky-500/20">
            <img :src="appIcon" alt="Gitio" class="h-full w-full scale-[1.2]" />
          </span>
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-[0.32em] text-sky-600 dark:text-sky-300">Gitio</p>
            <h2 class="mt-1 text-lg font-black text-slate-950 dark:text-white">Git 图谱工作台</h2>
            <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              面向 PC 端的 Git 桌面工作台，把仓库状态、分支、提交图谱、配置文件和常用命令放进一个清晰的桌面界面。
            </p>
          </div>
        </div>
      </section>

      <section class="grid gap-3 text-sm sm:grid-cols-2">
        <div class="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/10 dark:bg-[#071524]/70">
          <p class="text-xs text-slate-500 dark:text-slate-400">当前版本</p>
          <p class="mt-1 font-semibold text-slate-900 dark:text-slate-50">v{{ currentVersion }}</p>
        </div>
        <div class="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/10 dark:bg-[#071524]/70">
          <p class="text-xs text-slate-500 dark:text-slate-400">许可证</p>
          <p class="mt-1 font-semibold text-slate-900 dark:text-slate-50">MIT License</p>
        </div>
      </section>

      <section class="space-y-3 rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm dark:border-white/10 dark:bg-[#071524]/70">
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">技术栈</p>
          <p class="mt-1 leading-6 text-slate-700 dark:text-slate-200">Tauri 2、Vue 3、TypeScript、Naive UI、TailwindCSS、Git CLI</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">版权信息</p>
          <p class="mt-1 leading-6 text-slate-700 dark:text-slate-200">Copyright © 2026 Msg-Lbo. Released under the MIT License.</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">仓库地址</p>
          <code class="mono mt-1 block break-all rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-200">{{ repositoryUrl }}</code>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm dark:border-white/10 dark:bg-[#071524]/70">
        <div class="mb-2 flex items-center justify-between gap-3">
          <h3 class="font-semibold text-slate-900 dark:text-slate-50">MIT 许可证</h3>
          <span class="text-xs text-slate-500 dark:text-slate-400">完整许可文本</span>
        </div>
        <pre class="soft-scrollbar max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-100 p-3 text-xs leading-5 text-slate-700 dark:bg-white/10 dark:text-slate-200">{{ mitLicenseText }}</pre>
      </section>

      <div class="flex justify-end">
        <n-button type="primary" strong @click="closeAboutDialog">关闭</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import appIcon from '../../docs/assets/gitio-logo.svg';
import { useAboutDialog } from '@/composables/useAboutDialog';
import { useAppUpdater } from '@/composables/useAppUpdater';

const repositoryUrl = 'https://github.com/Msg-Lbo/gitio';
const mitLicenseText = `MIT License

Copyright (c) 2026 Msg-Lbo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
const { currentVersion } = useAppUpdater();
const { aboutDialogVisible, closeAboutDialog } = useAboutDialog();
</script>
