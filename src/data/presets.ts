import type { CommandPreset } from '@/types/git';

export const commandPresets: CommandPreset[] = [
  {
    title: '拉取并变基',
    description: '适合保持线性提交历史的团队流。',
    command: 'git pull --rebase --autostash',
    provider: 'Git'
  },
  {
    title: '推送当前分支',
    description: '推送 HEAD 到同名远端分支。',
    command: 'git push origin HEAD',
    provider: 'Git'
  },
  {
    title: '合并主干',
    description: '把 origin/main 合并到当前分支。',
    command: 'git merge origin/main',
    provider: 'Git'
  },
  {
    title: '变基主干',
    description: '把当前分支变基到 origin/main，保持提交线性。',
    command: 'git rebase origin/main',
    provider: 'Git'
  },
  {
    title: 'GitLab MR 推送',
    description: '推送并创建 Merge Request。',
    command: 'git push -o merge_request.create -o merge_request.remove_source_branch origin HEAD',
    provider: 'GitLab'
  },
  {
    title: 'GitLab Squash MR',
    description: '推送时设置 MR squash。',
    command: 'git push -o merge_request.create -o merge_request.squash origin HEAD',
    provider: 'GitLab'
  },
  {
    title: 'Gerrit Review',
    description: '推送当前提交到 Gerrit review 分支。',
    command: 'git push origin HEAD:refs/for/main',
    provider: 'Gerrit'
  },
  {
    title: 'Gerrit Topic',
    description: '携带 topic 推送到 Gerrit。',
    command: 'git push origin HEAD:refs/for/main%topic=feature-topic',
    provider: 'Gerrit'
  }
];
