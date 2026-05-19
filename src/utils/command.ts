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

/**
 * 把命令文本转为用于展示的安全标题。
 *
 * @param command Git 命令文本。
 * @return 去除 `git` 前缀后的简短命令。
 */
export function commandLabel(command: string) {
  return command.replace(/^\s*git\s+/, '').trim();
}
