import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/composables/useCommitGraph.ts', import.meta.url), 'utf8');
const stripped = source.replace(/^import[^;]+from\s+'vue';?$/m, "const computed = (fn) => ({ value: fn() });");
const { outputText } = ts.transpileModule(stripped, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
});
const graphModule = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const { useCommitGraph } = graphModule;

/**
 * 用最简字段构造提交节点，便于测试 graph 算法。
 *
 * @param {string} hash 提交哈希。
 * @param {string[]} parents 父提交哈希列表。
 * @return 测试用提交节点。
 */
function commit(hash, parents) {
  return { hash, shortHash: hash, parents, refs: '', author: 'tester', relativeTime: 'now', subject: hash };
}

/**
 * 构造按 lane 查找节点的辅助函数。
 *
 * @param {Array} rows useCommitGraph 输出的行列表。
 * @return 帮助方法集合。
 */
function helpers(rows) {
  const byHash = new Map(rows.map((row) => [row.commit.hash, row]));
  return {
    laneOf: (hash) => byHash.get(hash).nodeLane,
    rowOf: (hash) => byHash.get(hash),
    maxLane: Math.max(...rows.map((row) => row.nodeLane))
  };
}

test('linear history keeps every commit in mainline lane 0', () => {
  const commits = [
    commit('a', ['b']),
    commit('b', ['c']),
    commit('c', [])
  ];

  const { graphRows } = useCommitGraph({ value: commits });
  const rows = graphRows.value;
  assert.equal(rows[0].nodeLane, 0);
  assert.equal(rows[1].nodeLane, 0);
  assert.equal(rows[2].nodeLane, 0);
});

test('diamond merge uses exactly two lanes', () => {
  const commits = [
    commit('M', ['A', 'B']),
    commit('B', ['X']),
    commit('A', ['X']),
    commit('X', [])
  ];

  const { graphRows } = useCommitGraph({ value: commits });
  const { laneOf, maxLane } = helpers(graphRows.value);

  assert.equal(laneOf('M'), 0, 'merge commit 应在 mainline');
  assert.equal(laneOf('X'), 0, '汇合点应回到 mainline');
  assert.notEqual(laneOf('A'), laneOf('B'), 'A 与 B 应在不同 lane');
  assert.equal(maxLane, 1, 'diamond 总共只用 2 个 lane（0 和 1）');
});

test('first parent stays on mainline through merge commits', () => {
  // c40f Merge -> first=46b9, second=120f -> 都直通 7d85
  const commits = [
    commit('c40f', ['46b9', '120f']),
    commit('120f', ['7d85']),
    commit('46b9', ['7d85']),
    commit('7d85', [])
  ];

  const { graphRows } = useCommitGraph({ value: commits });
  const { laneOf } = helpers(graphRows.value);

  assert.equal(laneOf('c40f'), 0);
  assert.equal(laneOf('46b9'), 0, '首父 46b9 必须留在 mainline');
  assert.equal(laneOf('7d85'), 0, 'mainline 末尾仍在 lane 0');
  assert.ok(laneOf('120f') > 0, '次父 120f 应在 sub-branch lane');
});

test('nested merges keep mainline on lane 0 across detour rows', () => {
  // 参考仓库片段：6f6a Merge "问题修复" → first=2a7d (也是 merge), second=06ad
  // 2a7d Merge "feat DID" → first=a1cb, second=f609
  const commits = [
    commit('6f6a', ['2a7d', '06ad']),
    commit('06ad', ['a1cb']),
    commit('2a7d', ['a1cb', 'f609']),
    commit('a1cb', ['f455']),
    commit('f609', ['f455']),
    commit('f455', [])
  ];

  const { graphRows } = useCommitGraph({ value: commits });
  const { laneOf, rowOf } = helpers(graphRows.value);

  assert.equal(laneOf('6f6a'), 0);
  assert.equal(laneOf('2a7d'), 0, '内层 merge 仍在 mainline');
  assert.equal(laneOf('a1cb'), 0, 'first-parent 链上的普通 commit 留在 mainline');
  assert.equal(laneOf('f455'), 0, '尾节点回到 mainline');
  assert.ok(laneOf('06ad') > 0, '06ad 应在 sub-branch');
  assert.ok(laneOf('f609') > 0, 'f609 应在 sub-branch');

  // 2a7d 行：a1cb 之前被 06ad 分支占用更左 lane（实际不是，06ad sub-branch lane=1，
  // 而 a1cb 在 06ad 之后被 06ad lane 1 等待）→ 2a7d 行 a1cb 在 nodeLane=0 右侧，
  // 应该出现 migrate 曲线把 a1cb 拉回 mainline，且 06ad 行 a1cb 在 lane 1。
  const row2a7d = rowOf('2a7d');
  const row06ad = rowOf('06ad');
  assert.ok(row06ad.bottomLines.some((line) => line.lane === 1), '06ad 行底部 lane 1 应有 a1cb 延续');
  assert.ok(
    row2a7d.curves.some((curve) => curve.type === 'migrate' || curve.type === 'in') ||
      row2a7d.topLines.some((line) => line.lane === 1),
    '2a7d 行应通过 migrate 曲线把 a1cb 从 sub-branch lane 拉回 mainline'
  );
});

test('pass-through verticals stay continuous when a branch is open', () => {
  const commits = [
    commit('M', ['A', 'B']),
    commit('B', ['X']),
    commit('A', ['X']),
    commit('X', [])
  ];

  const { graphRows } = useCommitGraph({ value: commits });
  const { rowOf } = helpers(graphRows.value);
  const bRow = rowOf('B');
  const aRow = rowOf('A');
  assert.ok(bRow.topLines.some((line) => line.lane === 0), 'B 行 lane 0 上半段必须有 mainline 竖线');
  assert.ok(bRow.bottomLines.some((line) => line.lane === 0), 'B 行 lane 0 下半段必须有 mainline 竖线');
  assert.ok(!aRow.bottomLines.some((line) => line.lane === 1), 'A 行 lane 1 下半段不应继续延伸（B 已 join 完）');
});

test('branch-off curve appears at the merge row, and sub-branch tip joins back', () => {
  const commits = [
    commit('M', ['A', 'B']),
    commit('B', ['A']),
    commit('A', [])
  ];

  const { graphRows } = useCommitGraph({ value: commits });
  const { rowOf } = helpers(graphRows.value);
  const mRow = rowOf('M');
  const bRow = rowOf('B');

  assert.ok(mRow.curves.some((curve) => curve.type === 'out'), 'Merge 行应有 out 曲线（分出到 sub-branch）');
  assert.ok(bRow.curves.some((curve) => curve.type === 'join'), 'sub-branch tip 行应有 join 曲线（汇回 mainline）');
});

test('parallel sub-branches occupy distinct lanes simultaneously', () => {
  // 模拟同时打开多个 sub-branch 的场景：
  // root 之上 mainline 持续，旁边 cloud_web 分支独立存在
  const commits = [
    commit('970b', ['b49e']),
    commit('818c', ['95d7']), // cloud_web tip
    commit('b49e', ['f987']),
    commit('f987', ['c8fe']),
    commit('c8fe', ['25d9']),
    commit('25d9', ['0a40']),
    commit('0a40', ['6859']),
    commit('6859', ['6f6a']),
    commit('6f6a', ['2a7d', '06ad']),
    commit('06ad', ['a1cb']),
    commit('2a7d', ['a1cb', 'f609']),
    commit('a1cb', ['f455']),
    commit('f609', ['f455']),
    commit('f455', ['eb28']),
    commit('eb28', ['d5c9']),
    commit('d5c9', ['db45']),
    commit('db45', ['1c71']),
    commit('1c71', ['adc0']),
    commit('95d7', ['ffaa']), // cloud_web 后续
    commit('adc0', ['eef7']),
    commit('eef7', []),
    commit('ffaa', [])
  ];

  const { graphRows } = useCommitGraph({ value: commits });
  const { laneOf, rowOf } = helpers(graphRows.value);

  // mainline 上所有 commit 都在 lane 0
  for (const hash of ['970b', 'b49e', 'f987', 'c8fe', '25d9', '0a40', '6859', '6f6a', '2a7d', 'a1cb', 'f455', 'eb28', 'd5c9', 'db45', '1c71', 'adc0', 'eef7']) {
    assert.equal(laneOf(hash), 0, `${hash} 应留在 mainline lane 0`);
  }
  // cloud_web 分支（818c → 95d7 → ffaa）保持自己的 lane（>0），不应被踩到 lane 0
  assert.ok(laneOf('818c') > 0, '818c (cloud_web) 应该在 mainline 右侧 lane');
  assert.ok(laneOf('95d7') > 0, '95d7 (cloud_web) 应保持在 sub-branch lane');
  // 测试期间 sub-branch 818c→95d7→ffaa 应该一直存在（它们之间穿过 mainline 多行，必须保持竖线连续）
  const rowsBetween = ['b49e', 'f987', 'c8fe', '25d9', '0a40', '6859', '6f6a', '2a7d', 'a1cb', 'f455', 'eb28', 'd5c9', 'db45', '1c71', 'adc0'];
  for (const hash of rowsBetween) {
    const row = rowOf(hash);
    const cloudLane = laneOf('818c');
    const hasCloud = row.topLines.some((line) => line.lane === cloudLane) ||
      row.bottomLines.some((line) => line.lane === cloudLane) ||
      row.curves.some((curve) => curve.fromLane === cloudLane || curve.toLane === cloudLane);
    assert.ok(hasCloud, `${hash} 行应有 cloud_web sub-branch 的竖线穿过（lane=${cloudLane}）`);
  }
});

test('multi-lane merge (octopus-like): three parents converge into one node', () => {
  // 一个三父合并 commit 同时收三个分支
  const commits = [
    commit('OCT', ['P1', 'P2', 'P3']),
    commit('P3', ['ROOT']),
    commit('P2', ['ROOT']),
    commit('P1', ['ROOT']),
    commit('ROOT', [])
  ];

  const { graphRows } = useCommitGraph({ value: commits });
  const { laneOf, rowOf } = helpers(graphRows.value);

  assert.equal(laneOf('OCT'), 0, '合并节点在 mainline');
  assert.equal(laneOf('ROOT'), 0, '汇合根回到 mainline');
  // 三个父在三个不同 lane
  const laneP1 = laneOf('P1');
  const laneP2 = laneOf('P2');
  const laneP3 = laneOf('P3');
  assert.notEqual(laneP1, laneP2);
  assert.notEqual(laneP2, laneP3);
  assert.notEqual(laneP1, laneP3);
  // OCT 行应有两条 out 曲线（次父 P2、P3 分出）
  const octRow = rowOf('OCT');
  const outCurves = octRow.curves.filter((curve) => curve.type === 'out');
  assert.equal(outCurves.length, 2, 'OCT 行应分出两条 sub-branch（次父 P2、P3）');
});

test('sub-branch inside sub-branch (nested branching) keeps lanes distinct', () => {
  // 模拟「sub-branch 内又有 sub-branch」场景：
  //   M1 (parents [A, B])  -- mainline merge
  //   B  (parents [C, D])  -- sub-branch B 又是一个 merge
  //   D  (parent A)        -- B 的次父，回到 mainline A
  //   C  (parent A)        -- B 的首父，回到 mainline A
  //   A  (无父或继续)
  const commits = [
    commit('M1', ['A', 'B']),
    commit('B', ['C', 'D']),
    commit('D', ['A']),
    commit('C', ['A']),
    commit('A', [])
  ];

  const { graphRows } = useCommitGraph({ value: commits });
  const { laneOf } = helpers(graphRows.value);

  assert.equal(laneOf('M1'), 0, 'M1 在 mainline');
  assert.equal(laneOf('A'), 0, '尾节点 A 回到 mainline');
  assert.ok(laneOf('B') > 0, 'B 在 sub-branch');
  assert.ok(laneOf('C') > 0, 'C 在 sub-branch');
  assert.ok(laneOf('D') > 0, 'D 在 sub-sub-branch');
  // C 和 D 应不同 lane
  assert.notEqual(laneOf('C'), laneOf('D'), 'C 和 D 在不同 sub-branch lane');
});

test('migrate curve appears when first-parent lives on a right-side lane', () => {
  // 经典场景：6f6a (parents [2a7d, 06ad]) 后跟着 06ad 然后 2a7d。
  // 06ad 行让 lane 1 等 a1cb；2a7d 行 first-parent 是 a1cb（在 lane 1，nodeLane=0 右侧）
  // → 必须出现 migrate 曲线把 a1cb 拉回 lane 0
  const commits = [
    commit('6f6a', ['2a7d', '06ad']),
    commit('06ad', ['a1cb']),
    commit('2a7d', ['a1cb', 'f609']),
    commit('a1cb', []),
    commit('f609', [])
  ];

  const { graphRows } = useCommitGraph({ value: commits });
  const { rowOf, laneOf } = helpers(graphRows.value);
  const row2a7d = rowOf('2a7d');
  const migrateCurve = row2a7d.curves.find((curve) => curve.type === 'migrate');
  assert.ok(migrateCurve, '2a7d 行应该有 migrate 曲线');
  assert.equal(migrateCurve.toLane, 0, 'migrate 应该汇入 lane 0 (mainline)');
  assert.equal(migrateCurve.fromLane, 1, 'migrate 起点是 sub-branch lane 1（06ad 的延续）');
  // 同时 a1cb 应回到 lane 0
  assert.equal(laneOf('a1cb'), 0);
});
