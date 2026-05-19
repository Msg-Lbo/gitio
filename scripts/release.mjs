#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const rawVersion = args.find((arg) => !arg.startsWith('--'));

if (!rawVersion) {
  exitWithUsage('缺少版本号。');
}

const version = rawVersion.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  exitWithUsage(`版本号不符合 SemVer: ${rawVersion}`);
}

const today = new Date().toISOString().slice(0, 10);

updatePackageJson(version);
updatePackageLock(version);
updateCargoToml(version);
updateTauriConfig(version);
updateChangelog(version, today);

console.log(`已准备发布版本 v${version}`);
console.log('已更新 package.json、package-lock.json、src-tauri/Cargo.toml、src-tauri/tauri.conf.json、CHANGELOG.md');
console.log(`确认无误后执行: git add . && git commit -m "chore: release v${version}" && git tag v${version}`);

/**
 * 输出脚本使用方式并退出。
 *
 * @param reason 失败原因。
 * @return 永不返回。
 */
function exitWithUsage(reason) {
  console.error(reason);
  console.error('用法: npm run release:tag -- 0.2.0');
  process.exit(1);
}

/**
 * 读取 UTF-8 文本文件。
 *
 * @param path 相对项目根目录的文件路径。
 * @return 文件文本内容。
 */
function readProjectFile(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

/**
 * 写入 UTF-8 文本文件。
 *
 * @param path 相对项目根目录的文件路径。
 * @param content 文件文本内容。
 * @return 无返回值。
 */
function writeProjectFile(path, content) {
  writeFileSync(resolve(root, path), content, 'utf8');
}

/**
 * 更新 package.json 版本号。
 *
 * @param version 目标版本号。
 * @return 无返回值。
 */
function updatePackageJson(version) {
  const pkg = JSON.parse(readProjectFile('package.json'));
  pkg.version = version;
  writeProjectFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
}

/**
 * 更新 package-lock.json 根包版本号，保持 npm 锁文件与 package.json 一致。
 *
 * @param version 目标版本号。
 * @return 无返回值。
 */
function updatePackageLock(version) {
  const lock = JSON.parse(readProjectFile('package-lock.json'));
  lock.version = version;
  if (lock.packages?.['']) {
    lock.packages[''].version = version;
  }
  writeProjectFile('package-lock.json', `${JSON.stringify(lock, null, 2)}\n`);
}

/**
 * 更新 Cargo.toml 版本号。
 *
 * @param version 目标版本号。
 * @return 无返回值。
 */
function updateCargoToml(version) {
  const content = readProjectFile('src-tauri/Cargo.toml');
  writeProjectFile('src-tauri/Cargo.toml', content.replace(/^version = ".*"$/m, `version = "${version}"`));
}

/**
 * 更新 Tauri 配置版本号。
 *
 * @param version 目标版本号。
 * @return 无返回值。
 */
function updateTauriConfig(version) {
  const config = JSON.parse(readProjectFile('src-tauri/tauri.conf.json'));
  config.version = version;
  writeProjectFile('src-tauri/tauri.conf.json', `${JSON.stringify(config, null, 2)}\n`);
}

/**
 * 把 Unreleased 内容归档到指定版本，并重新创建空的 Unreleased 段落。
 *
 * @param version 目标版本号。
 * @param date 发布日期。
 * @return 无返回值。
 */
function updateChangelog(version, date) {
  const content = readProjectFile('CHANGELOG.md');
  const marker = '## [Unreleased]';
  const markerIndex = content.indexOf(marker);

  if (markerIndex === -1) {
    const insertion = `\n## [Unreleased]\n\n_暂无未发布变更。_\n\n## [${version}] - ${date}\n\n### Changed\n\n- 发布版本 v${version}。\n`;
    writeProjectFile('CHANGELOG.md', `${content.trim()}\n${insertion}`);
    return;
  }

  const before = content.slice(0, markerIndex);
  const afterMarker = content.slice(markerIndex + marker.length);
  const nextMatch = afterMarker.match(/\n## \[/);
  const unreleasedBody = nextMatch ? afterMarker.slice(0, nextMatch.index) : afterMarker;
  const rest = nextMatch ? afterMarker.slice(nextMatch.index) : '';
  const releaseBody = normalizeReleaseBody(unreleasedBody, version);
  const nextUnreleased = `${marker}\n\n_暂无未发布变更。_\n\n## [${version}] - ${date}\n\n${releaseBody}\n\n`;

  writeProjectFile('CHANGELOG.md', `${before}${nextUnreleased}${rest.trimStart()}`);
}

/**
 * 清理 Unreleased 占位内容，生成可归档的版本内容。
 *
 * @param body Unreleased 段落内容。
 * @param version 目标版本号。
 * @return 归档到新版本的 changelog 内容。
 */
function normalizeReleaseBody(body, version) {
  const normalized = body.replace(/_暂无未发布变更。_/g, '').trim();
  if (normalized) {
    return normalized;
  }

  return `### Changed\n\n- 发布版本 v${version}。`;
}
