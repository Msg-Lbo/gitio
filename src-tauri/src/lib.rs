use serde::{Deserialize, Serialize};
use std::{
    env,
    fs,
    path::{Component, Path, PathBuf},
    process::Command,
};
use tauri::{
    menu::MenuBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, Runtime, Window, WindowEvent,
};
use thiserror::Error;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const DEFAULT_COMMIT_LINE_LIMIT: usize = 120;
const MAX_COMMIT_LINE_LIMIT: usize = 5000;

#[derive(Debug, Error)]
enum GitioError {
    #[error("仓库路径不存在")]
    RepositoryMissing,
    #[error("当前路径不是有效 Git 仓库")]
    NotGitRepository,
    #[error("路径越界，拒绝访问仓库外文件")]
    PathEscaped,
    #[error("文件不存在: {0}")]
    FileMissing(String),
    #[error("系统错误: {0}")]
    Io(String),
}

impl From<std::io::Error> for GitioError {
    fn from(value: std::io::Error) -> Self {
        GitioError::Io(value.to_string())
    }
}

impl serde::Serialize for GitioError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitRequest {
    repo_path: String,
    args: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommandResult {
    code: i32,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RepoOverview {
    root: String,
    git_dir: String,
    branch: String,
    status: String,
    remotes: String,
    latest_commits: String,
    graph: String,
    commit_line: Vec<CommitNode>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommitNode {
    hash: String,
    short_hash: String,
    parents: Vec<String>,
    refs: String,
    author: String,
    relative_time: String,
    subject: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BranchItem {
    name: String,
    display_name: String,
    is_current: bool,
    is_remote: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitFileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigView {
    repository_config: String,
    global_config: String,
    global_config_path: String,
}

/**
 * 解析仓库根目录并校验 `.git` 目录，确保后续命令只在有效 Git 仓库中执行。
 *
 * @param repo_path 用户选择或输入的仓库路径。
 * @return 规范化后的仓库路径。
 */
fn repo_root(repo_path: &str) -> Result<PathBuf, GitioError> {
    let path = PathBuf::from(repo_path);
    if !path.exists() {
        return Err(GitioError::RepositoryMissing);
    }

    let selected = fs::canonicalize(path)?;
    let output = git_command()
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(&selected)
        .output()?;

    if !output.status.success() {
        return Err(GitioError::NotGitRepository);
    }

    let root = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let root = fs::canonicalize(PathBuf::from(root))?;

    Ok(root)
}

/**
 * 获取仓库 `.git` 的真实路径，兼容普通仓库和 worktree/submodule 中的 gitfile。
 *
 * @param root 仓库根目录。
 * @return `.git` 目录路径。
 */
fn git_dir(root: &Path) -> Result<PathBuf, GitioError> {
    let dot_git = root.join(".git");
    if dot_git.is_dir() {
        return Ok(dot_git);
    }

    let content = fs::read_to_string(&dot_git)?;
    let target = content
        .strip_prefix("gitdir:")
        .map(str::trim)
        .ok_or(GitioError::NotGitRepository)?;
    let path = PathBuf::from(target);
    if path.is_absolute() {
        Ok(path)
    } else {
        Ok(root.join(path))
    }
}

/**
 * 执行 Git 命令并返回标准输出、错误输出和退出码。
 *
 * @param root 仓库根目录。
 * @param args Git 参数列表，不包含 `git` 本身。
 * @return 命令执行结果。
 */
fn run_git(root: &Path, args: &[String]) -> Result<CommandResult, GitioError> {
    let output = git_command().args(args).current_dir(root).output()?;

    Ok(CommandResult {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

/**
 * 创建一个在 Windows 上不弹出控制台窗口的 `git` 命令实例。
 *
 * @return 配置好的 `git` 命令对象。
 */
fn git_command() -> Command {
    let mut command = Command::new("git");

    #[cfg(windows)]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
}

/**
 * 执行常用 Git 命令，失败时保留输出而不是中断界面渲染。
 *
 * @param root 仓库根目录。
 * @param args Git 参数列表。
 * @return 标准输出和错误输出的合并文本。
 */
fn run_git_text(root: &Path, args: &[&str]) -> String {
    let args = args.iter().map(|item| item.to_string()).collect::<Vec<_>>();
    match run_git(root, &args) {
        Ok(result) if result.stderr.trim().is_empty() => result.stdout,
        Ok(result) => format!("{}{}", result.stdout, result.stderr),
        Err(error) => error.to_string(),
    }
}

/**
 * 读取结构化提交历史，用于前端绘制图形化 commit line。
 *
 * @param root 仓库根目录。
 * @param target_ref 可选分支、tag 或提交引用，为空时使用当前 HEAD。
 * @return 结构化提交节点列表。
 */
fn read_commit_line(root: &Path, target_ref: Option<&str>, max_count: usize) -> Vec<CommitNode> {
    let max_count_arg = format!("--max-count={}", max_count.clamp(1, MAX_COMMIT_LINE_LIMIT));
    let mut args = vec![
        "log",
        "--topo-order",
        "--date=relative",
        "--pretty=format:%H%x1f%h%x1f%P%x1f%D%x1f%an%x1f%ar%x1f%s%x1e",
    ]
    .iter()
    .map(|item| item.to_string())
    .collect::<Vec<_>>();
    args.insert(3, max_count_arg);

    if let Some(target_ref) = target_ref.filter(|value| !value.trim().is_empty()) {
        args.push(target_ref.to_string());
    }

    let Ok(result) = run_git(root, &args) else {
        return Vec::new();
    };

    result
        .stdout
        .split('\u{001e}')
        .filter_map(|record| {
            let fields = record
                .trim_matches(|value| value == '\n' || value == '\r')
                .split('\u{001f}')
                .collect::<Vec<_>>();

            if fields.len() < 7 || fields[0].is_empty() {
                return None;
            }

            Some(CommitNode {
                hash: fields[0].to_string(),
                short_hash: fields[1].to_string(),
                parents: fields[2]
                    .split_whitespace()
                    .map(ToString::to_string)
                    .collect::<Vec<_>>(),
                refs: fields[3].to_string(),
                author: fields[4].to_string(),
                relative_time: fields[5].to_string(),
                subject: fields[6..].join(" "),
            })
        })
        .collect::<Vec<_>>()
}

/**
 * 读取本地和远端分支列表，用于提交线按分支切换。
 *
 * @param root 仓库根目录。
 * @return 分支列表。
 */
fn read_branches(root: &Path) -> Vec<BranchItem> {
    let args = [
        "branch",
        "--all",
        "--format=%(HEAD)|%(refname:short)|%(refname)",
    ]
    .iter()
    .map(|item| item.to_string())
    .collect::<Vec<_>>();

    let Ok(result) = run_git(root, &args) else {
        return Vec::new();
    };

    result
        .stdout
        .lines()
        .filter_map(|line| {
            let fields = line.split('|').collect::<Vec<_>>();
            if fields.len() < 3 || fields[1].contains("HEAD ->") || fields[2].ends_with("/HEAD") {
                return None;
            }

            let is_remote = fields[2].starts_with("refs/remotes/");
            Some(BranchItem {
                name: fields[1].trim().to_string(),
                display_name: fields[1].trim().to_string(),
                is_current: fields[0].trim() == "*",
                is_remote,
            })
        })
        .collect::<Vec<_>>()
}

/**
 * 拼接 `.git` 内相对路径并拒绝 `..` 等越界片段。
 *
 * @param base `.git` 目录路径。
 * @param relative_path 前端传入的 `.git` 内相对路径。
 * @return 安全的目标文件路径。
 */
fn safe_git_path(base: &Path, relative_path: &str) -> Result<PathBuf, GitioError> {
    let mut target = base.to_path_buf();
    let relative = Path::new(relative_path);

    if relative.is_absolute() {
        return Err(GitioError::PathEscaped);
    }

    for component in relative.components() {
        match component {
            Component::Normal(part) => target.push(part),
            Component::CurDir => {}
            _ => return Err(GitioError::PathEscaped),
        }
    }

    Ok(target)
}

/**
 * 返回用户全局 Git 配置路径，优先使用用户目录下的 `.gitconfig`。
 *
 * @return 全局 Git 配置文件路径。
 */
fn global_git_config_path() -> PathBuf {
    if let Some(home) = env::var_os("HOME") {
        return PathBuf::from(home).join(".gitconfig");
    }
    if let Some(profile) = env::var_os("USERPROFILE") {
        return PathBuf::from(profile).join(".gitconfig");
    }
    PathBuf::from(".gitconfig")
}

#[tauri::command]
fn execute_git(request: GitRequest) -> Result<CommandResult, GitioError> {
    let root = repo_root(&request.repo_path)?;
    run_git(&root, &request.args)
}

#[tauri::command]
fn get_repo_overview(repo_path: String) -> Result<RepoOverview, GitioError> {
    let root = repo_root(&repo_path)?;
    let git_dir = git_dir(&root)?;
    let branch = run_git_text(&root, &["branch", "--show-current"]);
    let status = run_git_text(&root, &["status", "--short", "--branch"]);
    let remotes = run_git_text(&root, &["remote", "-v"]);
    let latest_commits = run_git_text(&root, &["log", "--oneline", "--decorate", "-20"]);
    let branch_ref = branch.trim();
    let commit_line = read_commit_line(&root, (!branch_ref.is_empty()).then_some(branch_ref), DEFAULT_COMMIT_LINE_LIMIT);
    let graph = run_git_text(
        &root,
        &[
            "log",
            "--graph",
            "--decorate",
            "--oneline",
            "--all",
            "--max-count=80",
        ],
    );

    Ok(RepoOverview {
        root: root.to_string_lossy().to_string(),
        git_dir: git_dir.to_string_lossy().to_string(),
        branch: branch.trim().to_string(),
        status,
        remotes,
        latest_commits,
        graph,
        commit_line,
    })
}

#[tauri::command]
fn list_branches(repo_path: String) -> Result<Vec<BranchItem>, GitioError> {
    let root = repo_root(&repo_path)?;
    Ok(read_branches(&root))
}

#[tauri::command]
fn get_commit_line(repo_path: String, target_ref: String, max_count: Option<usize>) -> Result<Vec<CommitNode>, GitioError> {
    let root = repo_root(&repo_path)?;
    Ok(read_commit_line(&root, Some(&target_ref), max_count.unwrap_or(DEFAULT_COMMIT_LINE_LIMIT)))
}

#[tauri::command]
fn list_git_directory(repo_path: String, relative_path: String) -> Result<Vec<GitFileEntry>, GitioError> {
    let root = repo_root(&repo_path)?;
    let base = git_dir(&root)?;
    let target = safe_git_path(&base, &relative_path)?;
    let mut entries = Vec::new();

    if !target.exists() {
        return Err(GitioError::FileMissing(relative_path));
    }

    for entry in fs::read_dir(target)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        let path = entry.path();
        let relative = path
            .strip_prefix(&base)
            .map(|item| item.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| entry.file_name().to_string_lossy().to_string());

        entries.push(GitFileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: relative,
            is_dir: metadata.is_dir(),
            size: metadata.len(),
        });
    }

    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    Ok(entries)
}

#[tauri::command]
fn read_git_file(repo_path: String, relative_path: String) -> Result<String, GitioError> {
    let root = repo_root(&repo_path)?;
    let base = git_dir(&root)?;
    let target = safe_git_path(&base, &relative_path)?;

    if !target.is_file() {
        return Err(GitioError::FileMissing(relative_path));
    }

    Ok(fs::read_to_string(target)?)
}

#[tauri::command]
fn write_git_file(repo_path: String, relative_path: String, content: String) -> Result<(), GitioError> {
    let root = repo_root(&repo_path)?;
    let base = git_dir(&root)?;
    let target = safe_git_path(&base, &relative_path)?;

    if !target.is_file() {
        return Err(GitioError::FileMissing(relative_path));
    }

    fs::write(target, content)?;
    Ok(())
}

#[tauri::command]
fn read_configs(repo_path: String) -> Result<ConfigView, GitioError> {
    let root = repo_root(&repo_path)?;
    let repository_config_path = git_dir(&root)?.join("config");
    let global_config_path = global_git_config_path();

    Ok(ConfigView {
        repository_config: fs::read_to_string(repository_config_path).unwrap_or_default(),
        global_config: fs::read_to_string(&global_config_path).unwrap_or_default(),
        global_config_path: global_config_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn write_repo_config(repo_path: String, content: String) -> Result<(), GitioError> {
    let root = repo_root(&repo_path)?;
    let repository_config_path = git_dir(&root)?.join("config");
    fs::write(repository_config_path, content)?;
    Ok(())
}

#[tauri::command]
fn write_global_config(content: String) -> Result<(), GitioError> {
    let path = global_git_config_path();
    fs::write(path, content)?;
    Ok(())
}

/**
 * 创建系统托盘。左键恢复窗口，右键菜单提供彻底退出。
 *
 * @param app Tauri 应用实例。
 * @return 初始化结果。
 */
fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let tray_menu = MenuBuilder::new(app).text("quit", "退出 Gitio").build()?;
    let mut tray = TrayIconBuilder::with_id("gitio-tray")
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .tooltip("Gitio")
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "quit" {
                app.exit(0);
            }
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                show_app_windows(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        tray = tray.icon(icon);
    }

    tray.build(app)?;
    Ok(())
}

/**
 * 仅隐藏主窗口，让应用退到系统托盘，同时保留悬浮窗常驻桌面。
 *
 * @param app Tauri 应用句柄。
 * @return 无返回值。
 */
fn hide_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

/**
 * 从系统托盘恢复主窗口和悬浮窗，并聚焦主窗口。
 *
 * @param app Tauri 应用句柄。
 * @return 无返回值。
 */
fn show_app_windows<R: Runtime>(app: &AppHandle<R>) {
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.show();
        let _ = main_window.unminimize();
        let _ = main_window.set_focus();
    }

    if let Some(float_window) = app.get_webview_window("quick-float") {
        let _ = float_window.show();
        let _ = float_window.set_always_on_top(true);
    }
}

/**
 * 拦截主窗口关闭事件，改为隐藏到系统托盘。
 *
 * @param window 触发事件的窗口。
 * @param event 窗口事件。
 * @return 无返回值。
 */
fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if window.label() != "main" {
        return;
    }

    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        hide_main_window(window.app_handle());
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            setup_tray(app)?;
            Ok(())
        })
        .on_window_event(handle_window_event)
        .invoke_handler(tauri::generate_handler![
            execute_git,
            get_repo_overview,
            list_branches,
            get_commit_line,
            list_git_directory,
            read_git_file,
            write_git_file,
            read_configs,
            write_repo_config,
            write_global_config
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Gitio");
}
