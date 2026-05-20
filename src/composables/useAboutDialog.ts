import { ref } from 'vue';

const aboutDialogVisible = ref(false);

/**
 * 提供关于弹窗的全局显示状态，供标题栏入口和弹窗组件共享。
 *
 * @return 关于弹窗显示状态与打开/关闭方法。
 */
export function useAboutDialog() {
  /**
   * 打开关于弹窗，用于标题栏“关于”入口点击后展示项目信息。
   *
   * @return 无返回值。
   */
  function openAboutDialog() {
    aboutDialogVisible.value = true;
  }

  /**
   * 关闭关于弹窗，用于弹窗底部关闭按钮或后续扩展场景。
   *
   * @return 无返回值。
   */
  function closeAboutDialog() {
    aboutDialogVisible.value = false;
  }

  return {
    aboutDialogVisible,
    openAboutDialog,
    closeAboutDialog
  };
}
