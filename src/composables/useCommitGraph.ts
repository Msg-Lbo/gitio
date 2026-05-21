import { computed } from 'vue';
import type { CommitNode } from '@/types/git';

export interface GraphRow {
  commit: CommitNode;
  nodeLane: number;
  nodeColor: string;
  topLines: GraphLine[];
  bottomLines: GraphLine[];
  curves: GraphCurve[];
}

export interface GraphLine {
  lane: number;
  color: string;
}

/**
 * 一条连接两条 lane 的弧线段。
 *
 * 坐标体系（单行高度 32px）：y=0 行顶；y=16 节点中线；y=32 行底。
 *
 * - `out`：节点中线 → 新 lane 底部（向下），用于次父分出全新的 sub-branch。
 * - `branch-in`：节点中线 → 已有 lane 顶部（向上），用于次父汇入到上方已存在的 lane。
 *                例如 merge commit 的次父正好等于上方某 sub-branch 的延续。
 * - `in`：lane 顶部 → 节点中线（向下），用于 sub-branch tip 顶部下来汇入本行节点（多分支收敛）。
 *         **会消耗** 该 lane 的顶部竖线。
 * - `join`：节点中线 → 更左 lane 底部（向下），用于 sub-branch tip 自身合回 mainline。
 * - `migrate`：右侧 lane 顶部 → 节点中线（向下），用于 first-parent 在右侧 lane 时拉回 nodeLane。
 *               **会消耗** 该 lane 的顶部竖线。
 */
export interface GraphCurve {
  fromLane: number;
  toLane: number;
  color: string;
  type: 'out' | 'in' | 'join' | 'migrate' | 'branch-in';
}

const authorColors = [
  '#22d3ee',
  '#f97316',
  '#a3e635',
  '#ec4899',
  '#8b5cf6',
  '#facc15',
  '#14b8a6',
  '#ef4444',
  '#38bdf8',
  '#84cc16',
  '#f472b6',
  '#6366f1',
  '#fb7185',
  '#10b981',
  '#eab308',
  '#06b6d4',
  '#d946ef',
  '#f59e0b',
  '#2dd4bf',
  '#c084fc',
  '#60a5fa',
  '#f43f5e',
  '#34d399',
  '#fde047'
];
const laneColors = ['#60a5fa', '#2dd4bf', '#a78bfa', '#fbbf24', '#fb7185', '#38bdf8', '#4ade80', '#f472b6', '#c084fc', '#22d3ee'];

/**
 * 生成提交图谱所需的行数据、宽度和 SVG 绘制工具函数。
 *
 * @param selectedCommitLine 当前分支的提交列表。
 * @return 提交图谱渲染状态和工具函数。
 */
export function useCommitGraph(selectedCommitLine: { readonly value: CommitNode[] }) {
  const graphRows = computed(() => buildGraphRows(selectedCommitLine.value));
  const authorColorMap = computed(() => buildAuthorColorMap(selectedCommitLine.value));
  const graphWidth = computed(() => {
    const maxLane = Math.max(1, ...graphRows.value.map(rowMaxLane));
    return Math.max(60, maxLane * 14 + 36);
  });

  return {
    graphRows,
    graphWidth,
    graphLaneX,
    graphCurvePath,
    rowGraphWidth,
    visibleTopLines,
    visibleBottomLines,
    commitColor: (author: string) => commitColor(author, authorColorMap.value),
    laneColor,
    commitRefs,
    compactRefs,
    shortParents
  };
}

/**
 * 计算单行实际占用的最大 lane，包含节点、穿过的竖线与曲线两端。
 *
 * @param row graph 行。
 * @return 当前行涉及到的最大 lane。
 */
function rowMaxLane(row: GraphRow) {
  return Math.max(
    row.nodeLane,
    ...row.topLines.map((line) => line.lane),
    ...row.bottomLines.map((line) => line.lane),
    ...row.curves.map((curve) => curve.fromLane),
    ...row.curves.map((curve) => curve.toLane)
  );
}

/**
 * 为单行计算 graph 列宽度，让 commit message 紧贴节点，又能容纳该行实际穿过的分支线。
 *
 * @param row graph 行。
 * @return 当前行的 graph 列宽度。
 */
function rowGraphWidth(row: GraphRow) {
  return graphLaneX(rowMaxLane(row)) + 10;
}

/**
 * 为当前提交列表内的作者分配高对比度颜色，尽量避免不同作者使用同色。
 *
 * @param commits 当前提交列表。
 * @return 作者到颜色的映射。
 */
function buildAuthorColorMap(commits: CommitNode[]) {
  const usedColors = new Set<string>();
  const colorMap = new Map<string, string>();
  const authors = [...new Set(commits.map((commit) => normalizeAuthor(commit.author)))].sort((left, right) => left.localeCompare(right));

  for (const author of authors) {
    const startIndex = hashString(author) % authorColors.length;
    let color = authorColors[startIndex];

    for (let offset = 0; offset < authorColors.length; offset += 1) {
      const candidate = authorColors[(startIndex + offset) % authorColors.length];
      if (!usedColors.has(candidate)) {
        color = candidate;
        break;
      }
    }

    usedColors.add(color);
    colorMap.set(author, color);
  }

  return colorMap;
}

interface LaneSlot {
  /** 该 lane 正在等待的下一个 commit 哈希。 */
  expecting: string;
  /** 该 lane 使用的颜色索引。 */
  colorIndex: number;
}

interface RowPlan {
  commit: CommitNode;
  /** 进入本行时各 lane 的占用状态（用于推导 topLines）。 */
  laneIn: Array<LaneSlot | null>;
  /** 离开本行时各 lane 的占用状态（用于推导 bottomLines）。 */
  laneOut: Array<LaneSlot | null>;
  /** 节点所在 lane（commit 在 graph 中的 x 列）。 */
  nodeLane: number;
  /** 节点圆点颜色索引。 */
  nodeColorIndex: number;
  /** 本行需要绘制的曲线。 */
  curves: GraphCurve[];
  /**
   * 由曲线消耗（顶部）的 lane 集合。这些 lane 在本行的「顶部竖线」要画到曲线接入点
   * （而非节点中线），但仍然需要画上半段竖线以保持连续性。
   */
  topConsumed: Set<number>;
  /**
   * 由曲线消耗（底部）的 lane 集合。这些 lane 在本行的「底部竖线」由曲线代替，无需再画。
   */
  bottomConsumed: Set<number>;
}

/**
 * 主入口：将 git log 输出的提交序列转换为可渲染的 graph 行。
 *
 * 流程：
 * 1. 逐行扫描提交，维护一个动态的 lane 数组（活动 lane 上记录正在等待的 commit）。
 * 2. 对每个 commit：
 *    a. 收集所有等待该 commit 的 lane（merge 汇入时可能多条），最左者作为 nodeLane，
 *       其余 lane 在本行画 in 曲线汇入 nodeLane（支持多 lane 同时汇入）。
 *    b. 释放被消耗的 lane，按 parents 顺序安置下一段：
 *       - first-parent 优先继承 nodeLane（mainline 颜色延续）；
 *       - first-parent 若已在更左 lane → join 到那条 lane（sub-branch tip）；
 *       - first-parent 若在更右 lane → migrate（把右 lane 迁回 nodeLane）；
 *       - 非首父：复用已存在 lane（已有人等同名 parent）或开最左空 lane（同时画 out 曲线）。
 * 3. 渲染阶段根据 laneIn 与 laneOut 的快照 + 曲线消耗记录，推导 topLines/bottomLines。
 *
 * @param commits 按 git log 顺序排列的提交节点（最新在前，topological order）。
 * @return 可直接渲染的 graph 行列表。
 */
function buildGraphRows(commits: CommitNode[]): GraphRow[] {
  const plans = planRows(commits);
  return plans.map((plan) => renderRow(plan));
}

/**
 * 逐行扫描提交，规划每行的 lane 状态变化与曲线。
 *
 * @param commits 按 git log 顺序排列的提交节点。
 * @return 每行的 lane 状态快照与曲线规划。
 */
function planRows(commits: CommitNode[]): RowPlan[] {
  const lanes: Array<LaneSlot | null> = [];
  const plans: RowPlan[] = [];
  let nextColorIndex = 1;

  /**
   * 分配一个新的 lane 颜色索引（lane 0 = mainline 颜色 0；其它新 lane 顺序递增）。
   *
   * @return 新分配的颜色索引。
   */
  const allocColorIndex = () => {
    const value = nextColorIndex;
    nextColorIndex += 1;
    return value;
  };

  for (const commit of commits) {
    const laneIn = cloneLanes(lanes);
    const curves: GraphCurve[] = [];
    const topConsumed = new Set<number>();
    const bottomConsumed = new Set<number>();

    // ---- 阶段 A：定位 nodeLane ----
    const expectingLanes: number[] = [];
    for (let lane = 0; lane < lanes.length; lane += 1) {
      const slot = lanes[lane];
      if (slot && slot.expecting === commit.hash) {
        expectingLanes.push(lane);
      }
    }

    let nodeLane: number;
    let nodeColorIndex: number;

    if (expectingLanes.length > 0) {
      // 取最左 lane 作为 nodeLane
      nodeLane = expectingLanes[0];
      nodeColorIndex = lanes[nodeLane]!.colorIndex;
      // 其它在等的 lane 在本行画 in 曲线汇入 nodeLane（顶部进入），然后释放
      for (let index = 1; index < expectingLanes.length; index += 1) {
        const otherLane = expectingLanes[index];
        const otherSlot = lanes[otherLane]!;
        curves.push({
          fromLane: otherLane,
          toLane: nodeLane,
          color: laneColor(otherSlot.colorIndex),
          type: 'in'
        });
        topConsumed.add(otherLane);
        lanes[otherLane] = null;
      }
    } else {
      // 没有 lane 在等：新分支起点（首行 root，或本地新分支）
      nodeLane = findFreeLane(lanes);
      if (nodeLane === lanes.length) {
        lanes.push(null);
      }
      nodeColorIndex = nodeLane === 0 ? 0 : allocColorIndex();
    }

    // 释放 nodeLane 自己（被 commit 消耗）
    lanes[nodeLane] = null;

    // ---- 阶段 B：处理 parents ----
    for (const [parentSlot, parentHash] of commit.parents.entries()) {
      const existingLane = lanes.findIndex((slot) => slot && slot.expecting === parentHash);

      if (parentSlot === 0) {
        // first-parent：让 mainline 颜色（nodeColorIndex）延续
        if (existingLane === -1) {
          // 新 parent：占用 nodeLane
          lanes[nodeLane] = { expecting: parentHash, colorIndex: nodeColorIndex };
        } else if (existingLane === nodeLane) {
          // 已经在 nodeLane（理论上不会发生，因为前面释放过）：保持
          lanes[nodeLane] = { expecting: parentHash, colorIndex: nodeColorIndex };
        } else if (existingLane < nodeLane) {
          // first-parent 已在更左 lane（mainline）→ 当前 commit 是 sub-branch tip，
          // 自己 join 到那条 lane
          curves.push({
            fromLane: nodeLane,
            toLane: existingLane,
            color: laneColor(lanes[existingLane]!.colorIndex),
            type: 'join'
          });
          // 注意：nodeLane 保持当前位置（让节点显示在 sub-branch lane 上）
        } else {
          // first-parent 在更右 lane → 把它迁回 nodeLane（让 mainline 始终在最左）
          // 颜色统一为当前节点（mainline）的颜色，让后续连续 mainline commit 颜色一致
          const rightSlot = lanes[existingLane]!;
          curves.push({
            fromLane: existingLane,
            toLane: nodeLane,
            color: laneColor(rightSlot.colorIndex),
            type: 'migrate'
          });
          topConsumed.add(existingLane);
          lanes[existingLane] = null;
          lanes[nodeLane] = { expecting: parentHash, colorIndex: nodeColorIndex };
        }
        continue;
      }

      // 非首父
      if (existingLane !== -1) {
        // 已有 lane 在等同一 parent：表示该 parent 是上方某 sub-branch 的延续。
        // 视觉上节点向上方该 lane 接一条曲线（git log `|\` 字符），但不能消耗该 lane 的
        // 顶部竖线 —— 因为上方仍有 mainline / sub-branch 持续在该 lane 上等待。
        if (existingLane !== nodeLane) {
          curves.push({
            fromLane: nodeLane,
            toLane: existingLane,
            color: laneColor(lanes[existingLane]!.colorIndex),
            type: 'branch-in'
          });
        }
        continue;
      }

      // 非首父且未被任何 lane 等：开一条新 lane（最左空 lane，但跳过 nodeLane）
      const branchLane = findFreeLaneExcluding(lanes, nodeLane);
      if (branchLane === lanes.length) {
        lanes.push(null);
      }
      const branchColor = allocColorIndex();
      lanes[branchLane] = { expecting: parentHash, colorIndex: branchColor };
      curves.push({
        fromLane: nodeLane,
        toLane: branchLane,
        color: laneColor(branchColor),
        type: 'out'
      });
      bottomConsumed.add(branchLane);
    }

    // ---- 阶段 C：裁掉末尾连续空 lane ----
    while (lanes.length > 0 && !lanes[lanes.length - 1]) {
      lanes.pop();
    }

    plans.push({
      commit,
      laneIn,
      laneOut: cloneLanes(lanes),
      nodeLane,
      nodeColorIndex,
      curves,
      topConsumed,
      bottomConsumed
    });
  }

  return plans;
}

/**
 * 根据每行的 lane 状态快照与曲线规划，推导出最终渲染数据。
 *
 * - 顶部竖线：来自上一行（laneIn）中还活着的 lane（包括 nodeLane 自身：节点上方延续）。
 *   被曲线消耗的 lane 仍然画上半段（顶部到曲线接入点），由 SVG 曲线接续。
 * - 底部竖线：来自下一行入口（laneOut）中还活着的 lane（包括 nodeLane：节点下方延续）。
 *   被 out 曲线创建的新 lane 由曲线代替底部竖线。
 *
 * @param plan 行规划。
 * @return 可渲染行数据。
 */
function renderRow(plan: RowPlan): GraphRow {
  const topLines: GraphLine[] = [];
  const bottomLines: GraphLine[] = [];

  for (let lane = 0; lane < plan.laneIn.length; lane += 1) {
    const slot = plan.laneIn[lane];
    if (!slot) {
      continue;
    }
    if (plan.topConsumed.has(lane)) {
      // 被 in/migrate 曲线消耗：顶部画到中线之上由曲线接续，不在此画完整 top line
      continue;
    }
    topLines.push({ lane, color: laneColor(slot.colorIndex) });
  }

  for (let lane = 0; lane < plan.laneOut.length; lane += 1) {
    const slot = plan.laneOut[lane];
    if (!slot) {
      continue;
    }
    if (plan.bottomConsumed.has(lane)) {
      // 由 out 曲线代替
      continue;
    }
    bottomLines.push({ lane, color: laneColor(slot.colorIndex) });
  }

  return {
    commit: plan.commit,
    nodeLane: plan.nodeLane,
    nodeColor: laneColor(plan.nodeColorIndex),
    topLines: uniqueSortedLines(topLines),
    bottomLines: uniqueSortedLines(bottomLines),
    curves: plan.curves
  };
}

/**
 * 复制 lane 数组快照，便于保留进入/离开状态。
 *
 * @param lanes 当前 lane 数组。
 * @return lane 数组的浅拷贝。
 */
function cloneLanes(lanes: Array<LaneSlot | null>): Array<LaneSlot | null> {
  return lanes.map((slot) => (slot ? { expecting: slot.expecting, colorIndex: slot.colorIndex } : null));
}

/**
 * 在 lane 数组里找最左空位（含末尾），返回索引。
 *
 * @param lanes lane 数组。
 * @return 空位 lane 索引，等于 `lanes.length` 时表示需要追加。
 */
function findFreeLane(lanes: Array<LaneSlot | null>): number {
  for (let lane = 0; lane < lanes.length; lane += 1) {
    if (!lanes[lane]) {
      return lane;
    }
  }
  return lanes.length;
}

/**
 * 在 lane 数组里找最左空位，但跳过 `excludeLane`（用于避免覆盖 nodeLane）。
 *
 * @param lanes lane 数组。
 * @param excludeLane 需要避开的 lane 索引。
 * @return 空位 lane 索引，等于 `lanes.length` 时表示需要追加。
 */
function findFreeLaneExcluding(lanes: Array<LaneSlot | null>, excludeLane: number): number {
  for (let lane = 0; lane < lanes.length; lane += 1) {
    if (lane === excludeLane) {
      continue;
    }
    if (!lanes[lane]) {
      return lane;
    }
  }
  return lanes.length;
}

/**
 * 将 lane 数组去重并按从左到右排序。
 *
 * @param lines lane 数组。
 * @return 排序后的唯一 lane 数组。
 */
function uniqueSortedLines(lines: GraphLine[]) {
  const lineMap = new Map<number, GraphLine>();

  for (const line of lines) {
    lineMap.set(line.lane, line);
  }

  return [...lineMap.values()].sort((left, right) => left.lane - right.lane);
}

/**
 * 将 lane 索引转换为 SVG x 坐标。
 *
 * @param lane lane 索引。
 * @return SVG x 坐标。
 */
function graphLaneX(lane: number) {
  return 20 + lane * 14;
}

/**
 * 生成跨 lane 圆滑曲线。所有曲线均使用三次贝塞尔，控制点在垂直中线（y=8 或 y=24），
 * 让跨多个 lane 时仍保持平滑过渡，类似 git log --graph。
 *
 * 坐标体系（单行高度 32px）：
 * - y=0：行顶部；
 * - y=16：节点中线（commit 圆点中心）；
 * - y=32：行底部。
 *
 * 各曲线起止：
 * - `out`/`join`：从节点中线（16）向下到目标 lane 底部（32），用于本行节点向新 lane 分出或汇回。
 * - `in`：从某 lane 顶部（0）向下到节点中线（16），用于上方某 lane 汇入本行节点。
 * - `migrate`：从右侧 lane 顶部（0）下来汇入 nodeLane 中线（16），等同 `in` 曲线的形状，
 *              用于 first-parent 从右侧 lane 迁回 mainline 的连续过渡。
 *
 * @param curve 分支曲线数据。
 * @return SVG path d 属性。
 */
function graphCurvePath(curve: GraphCurve) {
  const fromX = graphLaneX(curve.fromLane);
  const toX = graphLaneX(curve.toLane);

  if (curve.type === 'in' || curve.type === 'migrate') {
    // 起点稍微越过 viewBox 顶（-0.5），与上一行底部竖线 y=32 的 stroke-square 端点对齐
    return `M ${fromX} -0.5 C ${fromX} 8 ${toX} 8 ${toX} 16`;
  }
  if (curve.type === 'branch-in') {
    // 节点中线 → 上方已有 lane 顶部；端点越过 viewBox 顶 0.5px，避免亚像素缝隙
    return `M ${fromX} 16 C ${fromX} 8 ${toX} 8 ${toX} -0.5`;
  }
  // out / join：节点中线 → 下方目标 lane 底部；终点越过 viewBox 底 0.5px
  return `M ${fromX} 16 C ${fromX} 24 ${toX} 24 ${toX} 32.5`;
}

/**
 * 顶部竖线直接返回（已在规划阶段去重并排序）。
 *
 * @param row 当前 graph 行。
 * @return 顶部可见竖线列表。
 */
function visibleTopLines(row: GraphRow) {
  return row.topLines;
}

/**
 * 底部竖线直接返回（已在规划阶段去重并排序）。
 *
 * @param row 当前 graph 行。
 * @return 底部可见竖线列表。
 */
function visibleBottomLines(row: GraphRow) {
  return row.bottomLines;
}

/**
 * 根据作者稳定生成提交节点颜色，同一作者在提交线中始终使用同一颜色。
 *
 * @param author 提交作者名称。
 * @param authorColorMap 作者到颜色映射。
 * @return CSS 颜色值。
 */
function commitColor(author: string, authorColorMap: Map<string, string>) {
  const normalizedAuthor = normalizeAuthor(author);
  return authorColorMap.get(normalizedAuthor) || authorColors[hashString(normalizedAuthor) % authorColors.length];
}

/**
 * 根据 lane 颜色索引稳定生成线条颜色。
 *
 * @param colorIndex lane 颜色索引。
 * @return CSS 颜色值。
 */
function laneColor(colorIndex: number) {
  return laneColors[colorIndex % laneColors.length];
}

/**
 * 规范化作者名称，避免空作者或首尾空格造成颜色映射不稳定。
 *
 * @param author 提交作者名称。
 * @return 规范化后的作者名称。
 */
function normalizeAuthor(author: string) {
  return author.trim() || 'unknown';
}

/**
 * 将字符串稳定转换为无符号整数，用于作者颜色初始落点。
 *
 * @param value 待哈希字符串。
 * @return 无符号整数哈希值。
 */
function hashString(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash;
}

/**
 * 将 Git refs 文本拆分为标签列表。
 *
 * @param refs Git log refs 文本。
 * @return refs 标签数组。
 */
function commitRefs(refs: string) {
  return refs.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 5);
}

/**
 * 将 refs 压缩为适合 Git Graph 单行展示的文本。
 *
 * @param refs Git log refs 文本。
 * @return 压缩后的 refs 文本。
 */
function compactRefs(refs: string) {
  return commitRefs(refs).join('  ');
}

/**
 * 缩短父提交哈希展示。
 *
 * @param parents 父提交完整哈希列表。
 * @return 适合界面展示的短哈希文本。
 */
function shortParents(parents: string[]) {
  return parents.map((parent) => parent.slice(0, 7)).join(', ');
}
