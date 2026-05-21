import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/utils/command.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
});
const commandModule = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const { commandLabel, detectGitCommandRisk, parseGitCommand } = commandModule;

test('parseGitCommand strips optional git prefix', () => {
  assert.deepEqual(parseGitCommand('git status --short'), ['status', '--short']);
  assert.deepEqual(parseGitCommand('status --short'), ['status', '--short']);
});

test('parseGitCommand preserves quoted messages', () => {
  assert.deepEqual(parseGitCommand('git commit -m "fix: keep spaces"'), ['commit', '-m', 'fix: keep spaces']);
  assert.deepEqual(parseGitCommand("git commit -m 'feat: add float output'"), ['commit', '-m', 'feat: add float output']);
});

test('parseGitCommand supports escaped spaces and quotes', () => {
  assert.deepEqual(parseGitCommand('git add docs/path\\ with\\ spaces.md'), ['add', 'docs/path with spaces.md']);
  assert.deepEqual(parseGitCommand('git commit -m "say \\"hi\\""'), ['commit', '-m', 'say "hi"']);
});

test('commandLabel removes git prefix for display', () => {
  assert.equal(commandLabel('git pull --rebase --autostash'), 'pull --rebase --autostash');
});

test('detectGitCommandRisk flags destructive commands', () => {
  assert.equal(detectGitCommandRisk(parseGitCommand('git reset --hard')).level, 'danger');
  assert.equal(detectGitCommandRisk(parseGitCommand('git clean -fd')).level, 'danger');
  assert.equal(detectGitCommandRisk(parseGitCommand('git push --force-with-lease')).level, 'danger');
  assert.equal(detectGitCommandRisk(parseGitCommand('git push origin +main')).level, 'danger');
  assert.equal(detectGitCommandRisk(parseGitCommand('git push origin --delete feature')).level, 'danger');
  assert.equal(detectGitCommandRisk(parseGitCommand('git push origin :feature')).level, 'danger');
  assert.equal(detectGitCommandRisk(parseGitCommand('git branch -D old-topic')).level, 'danger');
  assert.equal(detectGitCommandRisk(parseGitCommand('git filter-branch --tree-filter "rm secret"')).level, 'danger');
  assert.equal(detectGitCommandRisk(parseGitCommand('git reflog expire --expire=now --all')).level, 'danger');
});

test('detectGitCommandRisk keeps dry-run clean below danger', () => {
  assert.equal(detectGitCommandRisk(parseGitCommand('git clean -nfd')).level, 'warning');
});

test('detectGitCommandRisk warns on rebase', () => {
  assert.equal(detectGitCommandRisk(parseGitCommand('git rebase main')).level, 'warning');
});

test('detectGitCommandRisk warns on history or branch mutations', () => {
  assert.equal(detectGitCommandRisk(parseGitCommand('git commit --amend --no-edit')).level, 'warning');
  assert.equal(detectGitCommandRisk(parseGitCommand('git branch -d merged-topic')).level, 'warning');
  assert.equal(detectGitCommandRisk(parseGitCommand('git checkout -B topic origin/topic')).level, 'warning');
  assert.equal(detectGitCommandRisk(parseGitCommand('git tag -f v1.0.0')).level, 'warning');
});
