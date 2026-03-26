mod commands;
pub mod types;

use commands::{
    copier::copy_skill,
    discovery::discover_sources,
    install::install_skill,
    scanner::scan_all_skills,
    store::{get_config, rename_source, set_config},
    utils::{delete_skill, open_in_finder, read_skill_md},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            discover_sources,
            scan_all_skills,
            copy_skill,
            delete_skill,
            read_skill_md,
            open_in_finder,
            get_config,
            set_config,
            rename_source,
            install_skill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
