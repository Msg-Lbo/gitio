import { inspectorPanels, rightPanel, type InspectorPanelValue } from './state';

/**
 * 切换右侧 Inspector 面板。
 *
 * @param panel 目标面板名称。
 * @return 无返回值。
 */
function setInspector(panel: InspectorPanelValue) {
  rightPanel.value = panel;
}

/**
 * 暴露 Inspector 导航状态。
 *
 * @return Inspector 状态与操作。
 */
export function useInspector() {
  return {
    rightPanel,
    inspectorPanels,
    setInspector
  };
}
