use crate::commands::discovery::discover_sources_internal;
use crate::commands::scanner::scan_source;
use crate::commands::store::{load_config, save_config};
use crate::types::InstallResult;
use std::collections::HashSet;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

async fn get_user_path(app: &AppHandle) -> String {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
    match app
        .shell()
        .command(&shell)
        .args(["-l", "-c", "echo $PATH"])
        .output()
        .await
    {
        Ok(out) => String::from_utf8_lossy(&out.stdout).trim().to_string(),
        Err(_) => std::env::var("PATH").unwrap_or_default(),
    }
}

async fn run_install(
    app: &AppHandle,
    args: &[String],
    resolved_path: &str,
) -> (String, i32) {
    let mut env = std::collections::HashMap::new();
    env.insert("PATH".to_string(), resolved_path.to_string());
    env.insert("FORCE_COLOR".to_string(), "0".to_string());

    let cmd = match app
        .shell()
        .command("npx")
        .args(args)
        .envs(env)
        .spawn()
    {
        Ok(c) => c,
        Err(e) => return (e.to_string(), 1),
    };

    let (mut rx, _child) = cmd;
    let mut combined = String::new();
    let mut exit_code = 0i32;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => {
                let text = String::from_utf8_lossy(&bytes).to_string();
                combined.push_str(&text);
                let _ = app.emit("install:progress", &text);
            }
            CommandEvent::Stderr(bytes) => {
                let text = String::from_utf8_lossy(&bytes).to_string();
                combined.push_str(&text);
                let _ = app.emit("install:progress", &text);
            }
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code.unwrap_or(1);
            }
            _ => {}
        }
    }

    (combined, exit_code)
}

fn has_perm_error(output: &str) -> bool {
    output.to_ascii_lowercase().contains("eacces")
        || output.to_ascii_lowercase().contains("eperm")
        || output.to_ascii_lowercase().contains("permission denied")
}

fn extract_perm_dir(output: &str) -> Option<String> {
    // Match: EACCES: permission denied, mkdir '/path/to/dir'
    let re = output
        .find("EACCES")
        .or_else(|| output.find("eacces"))?;
    let after = &output[re..];
    let quote_start = after.find('\'')?;
    let inner = &after[quote_start + 1..];
    let quote_end = inner.find('\'')?;
    let full_path = &inner[..quote_end];
    // Return parent (mkdir failed, so parent needs chown)
    let parent = std::path::Path::new(full_path).parent()?;
    Some(parent.to_string_lossy().to_string())
}

#[cfg(target_os = "macos")]
fn elevate(path: &str) -> Result<(), String> {
    use std::process::Command;
    let user = std::env::var("USER").unwrap_or_else(|_| "root".to_string());
    let script = format!(
        "do shell script \"chown -R {}:staff '{}' \" with administrator privileges",
        user, path
    );
    let out = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

#[cfg(not(target_os = "macos"))]
fn elevate(_path: &str) -> Result<(), String> {
    Err("elevation not supported on this platform".to_string())
}

#[tauri::command]
pub async fn install_skill(
    app: AppHandle,
    source_url: String,
    skill_slug: Option<String>,
) -> InstallResult {
    let mut args: Vec<String> = vec![
        "skills".into(), "add".into(), source_url.clone(),
        "-g".into(), "-y".into(),
    ];
    if let Some(ref slug) = skill_slug {
        args.push("--skill".into());
        args.push(slug.clone());
    }

    // Snapshot before install for diff
    let sources_before = discover_sources_internal(&app);
    let before_paths: HashSet<String> = sources_before
        .iter()
        .flat_map(|s| scan_source(s, &sources_before).into_iter().map(|m| m.dir_path))
        .collect();

    let resolved_path = get_user_path(&app).await;
    let (mut output, mut code) = run_install(&app, &args, &resolved_path).await;

    // Retry on permission error
    if has_perm_error(&output) {
        if let Some(perm_dir) = extract_perm_dir(&output) {
            let msg = format!("\n⚠️  需要授权访问 {}，请在弹窗中输入密码...\n", perm_dir);
            let _ = app.emit("install:progress", &msg);
            match elevate(&perm_dir) {
                Ok(_) => {
                    let _ = app.emit("install:progress", "✅  授权成功，正在重新安装...\n");
                    let (o2, c2) = run_install(&app, &args, &resolved_path).await;
                    output = o2;
                    code = c2;
                }
                Err(e) => {
                    return InstallResult {
                        success: false,
                        error: Some(format!("授权失败：{}", e)),
                    };
                }
            }
        } else {
            return InstallResult {
                success: false,
                error: Some("安装失败（权限不足）".to_string()),
            };
        }
    }

    if has_perm_error(&output) {
        return InstallResult {
            success: false,
            error: Some("安装失败（权限不足）".to_string()),
        };
    }

    // Check "No matching skills found"
    if code == 0 && output.to_ascii_lowercase().contains("no matching skills found") {
        return InstallResult {
            success: false,
            error: Some("Skill 名称不存在".to_string()),
        };
    }

    if code != 0 {
        return InstallResult {
            success: false,
            error: Some(format!("进程退出码: {}", code)),
        };
    }

    // Refresh and record recentInstalls
    let sources_after = discover_sources_internal(&app);
    let install_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    let all_after: Vec<_> = sources_after
        .iter()
        .flat_map(|s| scan_source(s, &sources_after))
        .collect();

    let new_paths: Vec<String> = if let Some(ref slug) = skill_slug {
        all_after
            .iter()
            .filter(|m| m.slug == *slug)
            .map(|m| m.dir_path.clone())
            .collect()
    } else {
        let mut paths: Vec<String> = all_after
            .iter()
            .filter(|m| !before_paths.contains(&m.dir_path))
            .map(|m| m.dir_path.clone())
            .collect();
        if paths.is_empty() {
            // Fallback: mtime-based (files modified within 60s)
            paths = all_after
                .iter()
                .filter(|m| {
                    std::fs::metadata(&m.dir_path)
                        .and_then(|meta| meta.modified())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e)))
                        .map(|d| install_time.saturating_sub(d.as_millis()) < 60_000)
                        .unwrap_or(false)
                })
                .map(|m| m.dir_path.clone())
                .collect();
        }
        paths
    };

    if !new_paths.is_empty() {
        let mut config = load_config(&app);
        let existing = &config.recent_installs.clone();
        let mut merged = new_paths.clone();
        for p in existing {
            if !new_paths.contains(p) {
                merged.push(p.clone());
            }
        }
        merged.truncate(10);
        config.recent_installs = merged;
        let _ = save_config(&app, &config);
    }

    let _ = app.emit("sources:updated", &sources_after);

    InstallResult { success: true, error: None }
}
