import { computed, type Ref } from 'vue';
import type { CommitNode } from '@/types/git';

export interface GraphRow {
  commit: CommitNode;
  nodeLane: number;
  topLines: GraphLine[];
  bottomLines: GraphLine[];
  curves: GraphCurve[];
}

export interface GraphLine {
  lane: number;
  color: string;
}

export interface GraphCurve {
  fromLane: number;
  toLane: number;
  color: string;
  type: 'out' | 'in';
}

const commitColors = ['#60a5fa', '#2dd4bf', '#a78bfa', '#fbbf24', '#fb7185', '#38bdf8', '#4ade80', '#f472b6', '#c084fc', '#22d3ee'];

/**
 * 生成提交图谱所需的行数据、宽度和 SVG 绘制工具函数。
 *
 * @param selectedCommitLine 当前分支的提交列表。
 * @return 提交图谱渲染状态和工具函数。
 */
export function useCommitGraph(selectedCommitLine: Ref<CommitNode[]>) {
  const graphRows = computed(() => buildGraphRows(selectedCommitLine.value));
  const graphWidth = computed(() => {
    const maxLane = Math.max(
      1,
      ...graphRows.value.map((row) => Math.max(
        row.nodeLane,
        ...row.topLines.map((line) => line.lane),
        ...row.bottomLines.map((line) => line.lane),
        ...row.curves.map((curve) => curve.toLane)
      ))
    );

    return Math.max(70, maxLane * 15 + 48);
  });

  return {
    graphRows,
    graphWidth,
    graphLaneX,
    graphCurvePath,
    visibleTopLines,
    visibleBottomLines,
    commitColor,
    laneColor,
    commitRefs,
    compactRefs,
    shortParents
  };
}

/**
 * 根据提交父子关系构造 Git Graph lane，保证 merge 线连接到真实父提交所在分支。
 *
 * @param commits 按 git log 顺序排列的提交节点。
 * @return 可直接渲染的 graph 行。
 */
function buildGraphRows(commits: CommitNode[]): GraphRow[] {
  const lanes: Array<CommitNode | null> = [];
  const rows: GraphRow[] = [];
  const commitMap = new Map(commits.map((commit) => [commit.hash, commit]));

  for (const commit of commits) {
    let nodeLane = lanes.findIndex((laneCommit) => laneCommit?.hash === commit.hash);
    if (nodeLane === -1) {
      nodeLane = firstEmptyLane(lanes);
      lanes[nodeLane] = commit;
    }

    const topLines = lanes
      .map((laneCommit, lane) => laneCommit ? ({ lane, color: laneColor(lane) }) : null)
      .filter((line): line is GraphLine => Boolean(line));
    const parents = commit.parents.map((parent) => commitMap.get(parent)).filter((parent): parent is CommitNode => Boolean(parent));
    const primaryParent = parents[0];
    const bottom = [...lanes];
    const extraParents = parents.filter((parent) => parent.hash !== primaryParent?.hash);
    const curves: GraphCurve[] = [];

    if (primaryParent) {
      const existingPrimaryLane = bottom.findIndex((laneCommit) => laneCommit?.hash === primaryParent.hash);
      if (existingPrimaryLane >= 0 && existingPrimaryLane !== nodeLane) {
        curves.push({
          fromLane: existingPrimaryLane,
          toLane: nodeLane,
          color: laneColor(existingPrimaryLane),
          type: 'in'
        });
        bottom[nodeLane] = primaryParent;
        bottom[existingPrimaryLane] = null;
      } else {
        bottom[nodeLane] = primaryParent;
      }
    } else {
      bottom[nodeLane] = null;
    }

    for (const parent of extraParents) {
      let parentLane = bottom.findIndex((laneCommit) => laneCommit?.hash === parent.hash);
      if (parentLane === -1) {
        parentLane = firstEmptyLane(bottom, nodeLane + 1);
        bottom[parentLane] = parent;
      }
      if (parentLane !== nodeLane) {
        curves.push({ fromLane: nodeLane, toLane: parentLane, color: laneColor(parentLane), type: 'out' });
      }
    }

    const bottomLines = bottom
      .map((laneCommit, lane) => laneCommit ? ({ lane, color: laneColor(lane) }) : null)
      .filter((line): line is GraphLine => Boolean(line));
    rows.push({ commit, nodeLane, topLines, bottomLines, curves });

    lanes.splice(0, lanes.length, ...bottom);
    trimEmptyLaneTail(lanes);
  }

  return rows;
}

/**
 * 查找可复用的空 lane。
 *
 * @param lanes 当前 lane 提交数组。
 * @param start 起始查找位置。
 * @return lane 索引。
 */
function firstEmptyLane(lanes: Array<CommitNode | null>, start = 0) {
  for (let index = start; index < lanes.length; index += 1) {
    if (!lanes[index]) {
      return index;
    }
  }
  return lanes.length;
}

/**
 * 清理末尾空 lane，避免 graph 占用过宽。
 *
 * @param lanes 当前 lane 提交数组。
 * @return 无返回值。
 */
function trimEmptyLaneTail(lanes: Array<CommitNode | null>) {
  while (lanes.length && !lanes[lanes.length - 1]) {
    lanes.pop();
  }
}

/**
 * 将 lane 索引转换为 SVG x 坐标。
 *
 * @param lane lane 索引。
 * @return SVG x 坐标。
 */
function graphLaneX(lane: number) {
  return 26 + lane * 15;
}

/**
 * 生成分支进入或汇入的圆滑曲线，避免直角框形连接。
 *
 * @param curve 分支曲线数据。
 * @return SVG path d 属性。
 */
function graphCurvePath(curve: GraphCurve) {
  const fromX = graphLaneX(curve.fromLane);
  const toX = graphLaneX(curve.toLane);

  if (curve.type === 'out') {
    return `M ${fromX} 16 C ${fromX} 25 ${toX} 20 ${toX} 32`;
  }

  return `M ${fromX} 0 C ${fromX} 12 ${toX} 7 ${toX} 16`;
}

/**
 * 过滤顶部竖线。汇入曲线会完整接管来源 lane 的上半段，避免断层和重叠。
 *
 * @param row 当前 graph 行。
 * @return 顶部可见竖线列表。
 */
function visibleTopLines(row: GraphRow) {
  return row.topLines.filter((line) => !row.curves.some((curve) => curve.type === 'in' && curve.fromLane === line.lane));
}

/**
 * 过滤底部竖线。分出曲线会完整接管目标 lane 的下半段，避免断层和重叠。
 *
 * @param row 当前 graph 行。
 * @return 底部可见竖线列表。
 */
function visibleBottomLines(row: GraphRow) {
  return row.bottomLines.filter((line) => !row.curves.some((curve) => curve.type === 'out' && curve.toLane === line.lane));
}

/**
 * 根据作者稳定生成提交节点颜色，同一作者在提交线中始终使用同一颜色。
 *
 * @param author 提交作者名称。
 * @return CSS 颜色值。
 */
function commitColor(author: string) {
  let hash = 0;
  for (const char of author) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return commitColors[hash % commitColors.length];
}

/**
 * 根据 lane 稳定生成线条颜色，避免同一分支线因为提交作者不同而断色。
 *
 * @param lane lane 索引。
 * @return CSS 颜色值。
 */
function laneColor(lane: number) {
  return commitColors[lane % commitColors.length];
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
