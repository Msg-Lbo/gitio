import { isDark, themeOverrides } from './state';

/**
 * 在亮色和暗色主题之间切换。
 *
 * @return 无返回值。
 */
function toggleTheme() {
  isDark.value = !isDark.value;
}

/**
 * 暴露主题状态和切换动作。
 *
 * @return 主题状态与操作。
 */
export function useTheme() {
  return {
    isDark,
    themeOverrides,
    toggleTheme
  };
}
