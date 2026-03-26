use crate::commands::discovery::discover_sources_internal;
use crate::types::CopyResult;
use std::path::Path;
use tauri::{AppHandle, Emitter};

fn is_writable(path: &Path) -> bool {
    // Try opening a temp file in the directory
    let test = path.join(".tauri_write_test");
    match std::fs::File::create(&test) {
        Ok(_) => {
            let _ = std::fs::remove_file(&test);
            true
        }
        Err(_) => false,
    }
}

#[cfg(target_os = "macos")]
fn request_write_permission(path: &str) -> Result<(), String> {
    let user = std::env::var("USER").unwrap_or_else(|_| "root".to_string());
    let script = format!(
        "do shell script \"chown -R {}:staff '{}' \" with administrator privileges",
        user, path
    );
    let output = std::process::Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("授权失败: {}", stderr.trim()))
    }
}

#[cfg(target_os = "linux")]
fn request_write_permission(path: &str) -> Result<(), String> {
    let user = std::env::var("USER").unwrap_or_else(|_| "root".to_string());
    let output = std::process::Command::new("pkexec")
        .args(["chown", "-R", &format!("{}:{}", user, user), path])
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(())
    } else {
        Err("pkexec authorization failed".to_string())
    }
}

#[cfg(target_os = "windows")]
fn request_write_permission(_path: &str) -> Result<(), String> {
    // On Windows, symlinks need Developer Mode; just return an error
    // to fall through to the copy path
    Err("Windows: use copy mode instead".to_string())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let dst_path = dst.join(entry.file_name());
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            copy_dir_recursive(&entry.path(), &dst_path)?;
        } else {
            std::fs::copy(&entry.path(), &dst_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn create_symlink(src: &Path, dst: &Path) -> Result<(), std::io::Error> {
    #[cfg(unix)]
    return std::os::unix::fs::symlink(src, dst);

    #[cfg(windows)]
    return std::os::windows::fs::symlink_dir(src, dst);

    #[cfg(not(any(unix, windows)))]
    Err(std::io::Error::new(std::io::ErrorKind::Other, "symlinks not supported"))
}

pub fn copy_skill_internal(
    source_dir_path: &str,
    target_source_path: &str,
    slug: &str,
) -> CopyResult {
    let src = Path::new(source_dir_path);
    let dest = Path::new(target_source_path).join(slug);
    let already_exists = dest.exists();

    // Check if existing symlink already points to same target
    if already_exists {
        if let Ok(true) = dest.symlink_metadata().map(|m| m.file_type().is_symlink()) {
            if let (Ok(a), Ok(b)) = (std::fs::canonicalize(&dest), std::fs::canonicalize(src)) {
                if a == b {
                    return CopyResult {
                        success: true,
                        error: None,
                        already_exists: true,
                        mode: "symlink".to_string(),
                    };
                }
            }
        }
        let _ = std::fs::remove_dir_all(&dest);
    }

    // Try symlink first
    match create_symlink(src, &dest) {
        Ok(_) => CopyResult {
            success: true,
            error: None,
            already_exists,
            mode: "symlink".to_string(),
        },
        Err(_) => {
            // Fallback: physical copy
            match copy_dir_recursive(src, &dest) {
                Ok(_) => CopyResult {
                    success: true,
                    error: None,
                    already_exists,
                    mode: "copy".to_string(),
                },
                Err(e) => CopyResult {
                    success: false,
                    error: Some(e),
                    already_exists,
                    mode: "copy".to_string(),
                },
            }
        }
    }
}

#[tauri::command]
pub async fn copy_skill(
    app: AppHandle,
    slug: String,
    source_dir_path: String,
    target_source_id: String,
) -> CopyResult {
    let sources = discover_sources_internal(&app);
    let target = match sources.iter().find(|s| s.id == target_source_id) {
        Some(t) => t.clone(),
        None => {
            return CopyResult {
                success: false,
                error: Some("目标来源不存在".to_string()),
                already_exists: false,
                mode: "copy".to_string(),
            }
        }
    };

    if !is_writable(Path::new(&target.path)) {
        if let Err(e) = request_write_permission(&target.path) {
            return CopyResult {
                success: false,
                error: Some(format!("权限申请失败: {}", e)),
                already_exists: false,
                mode: "copy".to_string(),
            };
        }
    }

    let result = copy_skill_internal(&source_dir_path, &target.path, &slug);
    if result.success {
        let updated = discover_sources_internal(&app);
        let _ = app.emit("sources:updated", &updated);
    }
    result
}
