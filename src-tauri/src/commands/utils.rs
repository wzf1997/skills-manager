use crate::commands::discovery::discover_sources_internal;
use crate::types::DeleteResult;
use tauri::{AppHandle, Emitter};

fn is_writable(path: &std::path::Path) -> bool {
    let test = path.join(".tauri_write_test");
    match std::fs::File::create(&test) {
        Ok(_) => { let _ = std::fs::remove_file(&test); true }
        Err(_) => false,
    }
}

#[tauri::command]
pub async fn delete_skill(
    app: AppHandle,
    dir_path: String,
    source_id: String,
) -> DeleteResult {
    let sources = discover_sources_internal(&app);
    let source = match sources.iter().find(|s| s.id == source_id) {
        Some(s) => s.clone(),
        None => return DeleteResult { success: false, error: Some("来源不存在".to_string()) },
    };

    let source_path = std::path::Path::new(&source.path);
    if !is_writable(source_path) {
        #[cfg(target_os = "macos")]
        {
            let user = std::env::var("USER").unwrap_or_else(|_| "root".to_string());
            let script = format!(
                "do shell script \"chown -R {}:staff '{}' \" with administrator privileges",
                user, source.path
            );
            let out = std::process::Command::new("osascript")
                .args(["-e", &script])
                .output();
            if out.map(|o| !o.status.success()).unwrap_or(true) {
                return DeleteResult { success: false, error: Some("权限申请失败".to_string()) };
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            return DeleteResult { success: false, error: Some("目录不可写".to_string()) };
        }
    }

    match std::fs::remove_dir_all(&dir_path) {
        Ok(_) => {
            let updated = discover_sources_internal(&app);
            let _ = app.emit("sources:updated", &updated);
            DeleteResult { success: true, error: None }
        }
        Err(e) => DeleteResult { success: false, error: Some(e.to_string()) },
    }
}

#[tauri::command]
pub fn read_skill_md(dir_path: String) -> Option<String> {
    let path = std::path::Path::new(&dir_path).join("SKILL.md");
    std::fs::read_to_string(path).ok()
}

#[tauri::command]
pub fn open_in_finder(dir_path: String) {
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open")
        .args(["-R", &dir_path])
        .spawn();

    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("explorer")
        .arg(format!("/select,{}", dir_path))
        .spawn();

    #[cfg(target_os = "linux")]
    {
        // Open the parent directory
        let parent = std::path::Path::new(&dir_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or(dir_path);
        let _ = std::process::Command::new("xdg-open").arg(&parent).spawn();
    }
}
