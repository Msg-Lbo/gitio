# Changelog

本项目遵循标准化更新日志格式，版本号遵循 SemVer。

## [Unreleased]

### Changed

- 发布流程暂时收敛为 Windows 安装包，避免 Linux/macOS 未完成平台配置时阻断首版发布。
- 补齐 Tauri 桌面端标准图标资源，包含 PNG 和 ICNS 图标。

## [1.0.0] - 2026-05-19

### Added

- 新增 Gitio 三栏桌面工作台：仓库收藏、分支选择、提交图谱和右侧 Inspector。
- 新增本地 Git CLI 执行通道，支持 fetch、pull、push、status、stage、commit、amend、show、log 等命令入口。
- 新增命令执行确认弹窗，执行前展示完整 Git 命令。
- 新增自定义命令保存能力，支持常用 Git、GitLab、Gerrit 指令模板。
- 新增仓库级 push 指令保存能力，用于不同仓库的 Gerrit/GitLab 推送规则。
- 新增按选中分支加载的提交图谱，支持作者颜色、lane 颜色和 merge 曲线绘制。
- 新增 `.git` 文件浏览、文本文件读取和保存。
- 新增仓库 `.git/config` 与全局 `.gitconfig` 读取和保存。
- 新增亮色/暗色主题切换，使用太阳和月亮图标显示当前切换入口。
- 新增 README 顶部 SVG banner、项目 logo 和技术栈徽章。
- 新增 Tauri 在线更新能力，应用启动时自动检查 GitHub Release 新版本。
- 新增标题栏版本号入口和在线更新弹窗，支持更新日志、下载进度、安装后重启。
- 新增 GitHub Actions 多平台发布流程，自动上传安装包和 updater JSON。

### Changed

- 将原本堆在 `App.vue` 的界面拆分为 Header、Sidebar、CommitGraph、Inspector、CommandConfirmModal 等组件。
- 将工作台逻辑按领域拆分到 `src/composables/workbench/`，降低组件和业务逻辑耦合。
- 调整 UI 视觉风格：缩小圆角，改为更清爽的 sky/teal 配色和更轻的面板阴影。
- 右侧 Inspector 的 `.git` 文件列表改用 Naive UI `n-scrollbar`。
- 移除右侧 `变更` 面板中的工作区状态列表，仅保留操作入口和提交输入。
- 将 README logo 和 hero 图统一到 `docs/assets/gitio-logo.svg`，并优化透明圆角与留白显示。

### Fixed

- 修复 Windows Git 分支解析中 `%x1f` 分隔符被原样输出导致分支列表异常的问题。
- 修复切换到无分支或无提交仓库时，右侧提交详情残留上一个仓库提交的问题。
- 修复 Tauri Windows 构建缺少 `icon.ico` 导致配置报错的问题。

## [0.1.0] - 2026-05-18

### Added

- 创建项目初始版本规划。
- 初始化 Tauri 2 + Vue 3 + TypeScript 项目骨架。
- 接入 TailwindCSS、SCSS、Naive UI 和 Axios。
