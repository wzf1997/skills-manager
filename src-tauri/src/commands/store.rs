use crate::types::AppConfig;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "skills-manager-config.json";
const CONFIG_KEY: &str = "config";

pub fn load_config(app: &AppHandle) -> AppConfig {
    app.store(STORE_FILE)
        .ok()
        .and_then(|store| store.get(CONFIG_KEY))
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let value = serde_json::to_value(config).map_err(|e| e.to_string())?;
    store.set(CONFIG_KEY, value);
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_config(app: AppHandle) -> AppConfig {
    load_config(&app)
}

#[tauri::command]
pub fn set_config(app: AppHandle, patch: serde_json::Value) -> Result<(), String> {
    let mut config = load_config(&app);

    if let Some(v) = patch.get("customSources") {
        config.custom_sources = serde_json::from_value(v.clone()).unwrap_or_default();
    }
    if let Some(v) = patch.get("sourceLabels") {
        config.source_labels = serde_json::from_value(v.clone()).unwrap_or_default();
    }
    if let Some(v) = patch.get("recentInstalls") {
        config.recent_installs = serde_json::from_value(v.clone()).unwrap_or_default();
    }

    save_config(&app, &config)
}

#[tauri::command]
pub fn rename_source(
    app: AppHandle,
    source_id: String,
    new_label: String,
) -> Result<(), String> {
    let mut config = load_config(&app);
    config.source_labels.insert(source_id, new_label);
    save_config(&app, &config)
}
