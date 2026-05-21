import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/composables/useCommitGraph.ts', import.meta.url), 'utf8');
const stripped = source.replace(/^import[^;]+from\s+'vue';?$/m, "const computed = (fn) => ({ value: fn() });");
const { outputText } = ts.transpileModule(stripped, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
});
const { useCommitGraph } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const c = (h, p) => ({ hash: h, shortHash: h, parents: p, refs: '', author: 't', relativeTime: '', subject: h });

const commits = [
  c('6f6a', ['2a7d', '06ad']),
  c('06ad', ['a1cb']),
  c('2a7d', ['a1cb', 'f609']),
  c('a1cb', ['f455']),
  c('f609', ['f455']),
  c('f455', ['eb28']),
  c('eb28', [])
];

// 把 assignLanes 暴露出来做对照（需要 hack）
const mod = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
console.log('--- assignLanes 直接调用 ---');
// 没有直接导出，只能通过 useCommitGraph 输出反推

const { graphRows } = useCommitGraph({ value: commits });
for (const row of graphRows.value) {
  const curves = row.curves.map((cu) => `${cu.fromLane}->${cu.toLane}(${cu.type})`).join(',');
  console.log(
    row.commit.hash.padEnd(8),
    `parents=${row.commit.parents.join(',')}`.padEnd(20),
    `lane=${row.nodeLane}`,
    `top=[${row.topLines.map((l) => l.lane).join(',')}]`,
    `bot=[${row.bottomLines.map((l) => l.lane).join(',')}]`,
    `curves=[${curves}]`
  );
}
