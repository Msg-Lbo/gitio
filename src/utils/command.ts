/**
 * 将用户输入的命令行拆分为参数数组，支持单引号、双引号和反斜杠转义。
 *
 * @param input 用户输入的命令文本，可以包含或省略开头的 `git`。
 * @return 适合传给后端 Git CLI 的参数数组。
 */
export function parseGitCommand(input: string) {
  const args: string[] = [];
  const chars = [...input.trim()];
  let current = '';
  let quote: 'single' | 'double' | null = null;
  let escaped = false;

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const nextChar = chars[index + 1];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && nextChar && /[\s"'\\]/.test(nextChar)) {
      escaped = true;
      continue;
    }

    if (char === "'" && quote !== 'double') {
      quote = quote === 'single' ? null : 'single';
      continue;
    }

    if (char === '"' && quote !== 'single') {
      quote = quote === 'double' ? null : 'double';
      continue;
    }

    if (/\s/.test(char) && !quote) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    args.push(current);
  }

  return args[0] === 'git' ? args.slice(1) : args;
}

export type GitCommandRiskLevel = 'safe' | 'warning' | 'danger';

export interface GitCommandRisk {
  level: GitCommandRiskLevel;
  title: string;
  description: string;
}

const safeCommandRisk: GitCommandRisk = {
  level: 'safe',
  title: '普通命令',
  description: '该命令未命中高风险规则。'
};

/**
 * 根据 Git 参数数组识别可能破坏本地变更或重写远端历史的命令风险。
 *
 * @param args 不包含 `git` 本身的 Git 参数数组。
 * @return 用于确认弹窗展示的风险等级和说明。
 */
export function detectGitCommandRisk(args: string[]): GitCommandRisk {
  const command = args[0]?.toLowerCase();
  const rawRest = args.slice(1);
  const rest = args.slice(1).map((arg) => arg.toLowerCase());

  if (!command) {
    return safeCommandRisk;
  }

  if (command === 'reset' && hasLongOption(rest, '--hard')) {
    return {
      level: 'danger',
      title: '会丢弃工作区变更',
      description: '`git reset --hard` 会重置暂存区和工作区，未提交内容可能无法恢复。'
    };
  }

  if (command === 'reset' && !rest.includes('--')) {
    return {
      level: 'warning',
      title: '可能移动当前 HEAD',
      description: '`git reset` 可能移动当前分支指针或重置暂存区，请确认目标提交和影响范围。'
    };
  }

  if (command === 'clean') {
    const isForced = hasLongOption(rest, '--force') || hasShortFlag(rest, 'f');
    const isDryRun = hasLongOption(rest, '--dry-run') || hasShortFlag(rest, 'n');
    const isInteractive = hasLongOption(rest, '--interactive') || hasShortFlag(rest, 'i');

    if (isForced && !isDryRun && !isInteractive) {
      return {
        level: 'danger',
        title: '会删除未跟踪文件',
        description: '`git clean` 搭配 force 参数会删除未跟踪文件，删除后通常不能通过 Git 恢复。'
      };
    }

    return {
      level: 'warning',
      title: '将检查未跟踪文件',
      description: '`git clean` 作用于未跟踪文件，请确认不会误删本地临时文件。'
    };
  }

  if (command === 'push' && (hasLongOption(rest, '--force', '--force-with-lease') || hasShortFlag(rest, 'f') || hasForceRefspec(rest))) {
    return {
      level: 'danger',
      title: '可能重写远端历史',
      description: '强制推送会覆盖远端分支历史，可能影响其他协作者的提交。'
    };
  }

  if (command === 'push' && (hasLongOption(rest, '--delete') || hasShortFlag(rest, 'd') || hasDeleteRefspec(rest))) {
    return {
      level: 'danger',
      title: '会删除远端引用',
      description: '`git push --delete` 或删除 refspec 会移除远端分支或标签，请确认目标引用无误。'
    };
  }

  if (command === 'push' && hasLongOption(rest, '--mirror')) {
    return {
      level: 'danger',
      title: '会镜像覆盖远端引用',
      description: '`git push --mirror` 会同步删除和覆盖远端引用，影响范围通常大于普通推送。'
    };
  }

  if (command === 'push' && hasLongOption(rest, '--prune')) {
    return {
      level: 'warning',
      title: '可能删除远端引用',
      description: '`git push --prune` 会清理远端不存在于本地的引用，请确认分支映射无误。'
    };
  }

  if (command === 'checkout' && (hasLongOption(rest, '--force') || hasShortFlag(rest, 'f'))) {
    return {
      level: 'danger',
      title: '可能丢弃本地变更',
      description: '`git checkout --force` 会强制切换并丢弃冲突的工作区变更。'
    };
  }

  if (command === 'checkout' && hasShortFlag(rawRest, 'B')) {
    return {
      level: 'warning',
      title: '可能重置本地分支',
      description: '`git checkout -B` 会创建或重置分支，请确认不会覆盖已有分支指向。'
    };
  }

  if (command === 'switch' && hasLongOption(rest, '--discard-changes')) {
    return {
      level: 'danger',
      title: '会丢弃本地变更',
      description: '`git switch --discard-changes` 会放弃当前工作区中阻塞切换的变更。'
    };
  }

  if (command === 'switch' && hasShortFlag(rawRest, 'C')) {
    return {
      level: 'warning',
      title: '可能重置本地分支',
      description: '`git switch -C` 会创建或重置分支，请确认不会覆盖已有分支指向。'
    };
  }

  if (command === 'branch' && hasShortFlag(rawRest, 'D')) {
    return {
      level: 'danger',
      title: '会强制删除分支',
      description: '`git branch -D` 会删除尚未合并的本地分支，请确认分支内容已不需要。'
    };
  }

  if (command === 'branch' && (hasLongOption(rest, '--delete') || hasShortFlag(rawRest, 'd'))) {
    return {
      level: 'warning',
      title: '会删除本地分支',
      description: '`git branch -d` 会删除本地分支，请确认分支已经合并或不再需要。'
    };
  }

  if (command === 'stash' && ['clear', 'drop'].includes(rest[0])) {
    return {
      level: 'danger',
      title: '会删除 stash 内容',
      description: '`git stash clear/drop` 会删除暂存的工作内容，删除后恢复成本较高。'
    };
  }

  if (command === 'commit' && hasLongOption(rest, '--amend')) {
    return {
      level: 'warning',
      title: '会改写最近一次提交',
      description: '`git commit --amend` 会替换最近一次提交，已推送提交需要谨慎修改。'
    };
  }

  if (command === 'tag' && (hasLongOption(rest, '--delete') || hasLongOption(rest, '--force') || hasShortFlag(rest, 'd') || hasShortFlag(rest, 'f'))) {
    return {
      level: 'warning',
      title: '会修改本地标签',
      description: '`git tag -d/-f` 会删除或覆盖本地标签，请确认不会影响后续发布流程。'
    };
  }

  if (command === 'rm') {
    return {
      level: 'warning',
      title: '会从索引移除文件',
      description: '`git rm` 会删除或取消跟踪文件，请确认目标路径无误。'
    };
  }

  if (command === 'filter-branch') {
    return {
      level: 'danger',
      title: '会重写大量提交历史',
      description: '`git filter-branch` 会批量改写历史，可能影响所有协作者和远端引用。'
    };
  }

  if (command === 'reflog' && rest[0] === 'expire' && (rest.includes('--expire=now') || rest.includes('--expire-unreachable=now'))) {
    return {
      level: 'danger',
      title: '会清理恢复记录',
      description: '`git reflog expire` 可能删除用于恢复误操作的记录，请确认不再需要回滚。'
    };
  }

  if (command === 'rebase') {
    return {
      level: 'warning',
      title: '会改写提交基线',
      description: '`git rebase` 会重放提交并可能产生冲突，已推送分支需谨慎使用。'
    };
  }

  if (command === 'restore' && !hasLongOption(rest, '--staged')) {
    return {
      level: 'warning',
      title: '可能丢弃工作区变更',
      description: '`git restore` 默认会还原工作区文件，请确认目标文件不包含未保存内容。'
    };
  }

  if (command === 'checkout' && rest.includes('--')) {
    return {
      level: 'warning',
      title: '可能还原工作区文件',
      description: '`git checkout -- <path>` 会把文件恢复到指定版本，可能覆盖本地修改。'
    };
  }

  return safeCommandRisk;
}

/**
 * 把命令文本转为用于展示的安全标题。
 *
 * @param command Git 命令文本。
 * @return 去除 `git` 前缀后的简短命令。
 */
export function commandLabel(command: string) {
  return command.replace(/^\s*git\s+/, '').trim();
}

/**
 * 判断参数中是否包含指定长选项，兼容 `--name=value` 形式。
 *
 * @param args Git 参数数组。
 * @param options 需要匹配的长选项。
 * @return 命中任一长选项时返回 true。
 */
function hasLongOption(args: string[], ...options: string[]) {
  return args.some((arg) => options.includes(arg.split('=')[0]));
}

/**
 * 判断参数中是否包含指定短选项，兼容 `-fd` 这类组合短选项。
 *
 * @param args Git 参数数组。
 * @param flag 需要匹配的短选项字符。
 * @return 命中短选项时返回 true。
 */
function hasShortFlag(args: string[], flag: string) {
  return args.some((arg) => /^-[^-]/.test(arg) && arg.slice(1).includes(flag));
}

/**
 * 判断 push 参数里是否包含 `:branch` 这类删除远端引用的 refspec。
 *
 * @param args Git push 的参数数组。
 * @return 存在删除 refspec 时返回 true。
 */
function hasDeleteRefspec(args: string[]) {
  return args.some((arg) => arg.startsWith(':') && arg.length > 1);
}

/**
 * 判断 push 参数里是否包含 `+branch` 这类强制更新 refspec。
 *
 * @param args Git push 的参数数组。
 * @return 存在强制更新 refspec 时返回 true。
 */
function hasForceRefspec(args: string[]) {
  return args.some((arg) => arg.startsWith('+') && arg.length > 1);
}
