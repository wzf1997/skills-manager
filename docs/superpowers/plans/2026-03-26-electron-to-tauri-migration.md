# Electron → Tauri v2 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Skills Manager from Electron 31 to Tauri v2, keeping all features identical, supporting macOS / Windows / Linux.

**Architecture:** A new `src-tauri/` directory holds all Rust backend commands (discovery, scanner, copier, install, utils, store). The React frontend moves from `src/renderer/` to `src/` with `window.electronAPI` replaced by a thin `src/api.ts` wrapper around `@tauri-apps/api`. Config persistence migrates to `tauri-plugin-store`, npx spawning to `tauri-plugin-shell`.

**Tech Stack:** Tauri v2, Rust 2021 edition, tauri-plugin-store v2, tauri-plugin-shell v2, serde/serde_json/serde_yaml 0.9, sha2 0.10, dirs 5, React 18, TypeScript 5, Tailwind CSS 3, Vite 5.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src-tauri/build.rs` | Tauri build script |
| Create | `src-tauri/Cargo.toml` | Rust deps |
| Create | `src-tauri/tauri.conf.json` | App config, window, bundle targets |
| Create | `src-tauri/capabilities/default.json` | IPC permission declarations |
| Create | `src-tauri/src/main.rs` | Rust entry point |
| Create | `src-tauri/src/lib.rs` | Register all Tauri commands |
| Create | `src-tauri/src/types.rs` | Shared Rust structs (SkillSource, SkillMeta, AppConfig…) |
| Create | `src-tauri/src/commands/mod.rs` | Declare submodules |
| Create | `src-tauri/src/commands/store.rs` | get_config / set_config / rename_source |
| Create | `src-tauri/src/commands/discovery.rs` | discover_sources |
| Create | `src-tauri/src/commands/scanner.rs` | scan_all_skills |
| Create | `src-tauri/src/commands/copier.rs` | copy_skill + permission elevation |
| Create | `src-tauri/src/commands/install.rs` | install_skill (npx + streaming events) |
| Create | `src-tauri/src/commands/utils.rs` | delete_skill / read_skill_md / open_in_finder |
| Create | `src/api.ts` | Thin invoke/listen wrapper replacing preload |
| Move | `src/renderer/*` → `src/*` | Frontend (React components unchanged) |
| Modify | `index.html` | Update script src |
| Modify | `vite.config.ts` | Remove electron plugin |
| Modify | `package.json` | Update scripts |
| Modify | `src/context/AppContext.tsx` | window.electronAPI → api |
| Modify | `src/App.tsx` | Remove theme IPC, use matchMedia |
| Modify | `src/components/HubPanel.tsx` | fetchFeaturedSkills → fetch() |
| Modify | `src/components/InstallModal.tsx` | window.electronAPI → api |
| Modify | `src/components/SkillDetailPanel.tsx` | window.electronAPI → api |
| Modify | `src/components/Sidebar.tsx` | window.electronAPI → api |
| Modify | `src/components/SettingsDrawer.tsx` | window.electronAPI → api |
| Modify | `src/components/SkillCard.tsx` | window.electronAPI → api |
| Delete | `src/main/` | Electron main process (replaced by Rust) |
| Delete | `src/renderer/` | Moved to src/ |
| Create | `.github/workflows/release.yml` | CI matrix build (macOS/Windows/Linux) |

---

## Task 1: Install deps & create src-tauri scaffold

**Files:**
- Create: `src-tauri/build.rs`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/commands/mod.rs`
- Modify: `package.json`

- [ ] **Step 1: Install Tauri CLI and API**

```bash
npm install --save-dev @tauri-apps/cli@^2
npm install @tauri-apps/api@^2
```

Expected: Both packages appear in `package.json`.

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p src-tauri/src/commands
mkdir -p src-tauri/capabilities
mkdir -p src-tauri/icons
```

- [ ] **Step 3: Copy app icons**

```bash
cp build/icon.icns src-tauri/icons/icon.icns 2>/dev/null || true
cp build/icon.ico  src-tauri/icons/icon.ico  2>/dev/null || true
cp build/icon.png  src-tauri/icons/128x128.png
cp build/icon.png  src-tauri/icons/128x128@2x.png
cp build/icon.png  src-tauri/icons/32x32.png
```

- [ ] **Step 4: Create `src-tauri/build.rs`**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 5: Create `src-tauri/Cargo.toml`**

```toml
[package]
name = "skills-manager"
version = "1.0.0"
edition = "2021"

[lib]
name = "skills_manager_lib"
crate-type = ["cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri             = { version = "2", features = ["macos-private-api"] }
tauri-plugin-store = "2"
tauri-plugin-shell = "2"
serde             = { version = "1", features = ["derive"] }
serde_json        = "1"
serde_yaml        = "0.9"
sha2              = "0.10"
dirs              = "5"

[profile.release]
codegen-units = 1
lto           = true
opt-level     = "s"
panic         = "abort"
strip         = true
```

- [ ] **Step 6: Create `src-tauri/tauri.conf.json`**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Skills Manager",
  "version": "1.0.0",
  "identifier": "com.fly.skills-manager",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Skills Manager",
        "width": 1200,
        "height": 780,
        "minWidth": 900,
        "minHeight": 600,
        "titleBarStyle": "overlay",
        "hiddenTitle": true
      }
    ],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": { "minimumSystemVersion": "12.0" }
  }
}
```

- [ ] **Step 7: Create `src-tauri/capabilities/default.json`**

```json
{
  "identifier": "default",
  "description": "Default capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-execute",
    "shell:allow-spawn",
    "store:allow-get",
    "store:allow-set",
    "store:allow-save",
    "store:allow-load"
  ]
}
```

- [ ] **Step 8: Create `src-tauri/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    skills_manager_lib::run()
}
```

- [ ] **Step 9: Create minimal `src-tauri/src/lib.rs`** (will be expanded in Task 10)

```rust
mod commands;
pub mod types;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 10: Create `src-tauri/src/commands/mod.rs`**

```rust
pub mod copier;
pub mod discovery;
pub mod install;
pub mod scanner;
pub mod store;
pub mod utils;
```

- [ ] **Step 11: Update `package.json` scripts**

Replace the `scripts` section with:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build"
}
```

- [ ] **Step 12: Verify Cargo.toml compiles (empty commands)**

Create placeholder empty files so `cargo check` won't fail on missing modules:

```bash
touch src-tauri/src/commands/store.rs
touch src-tauri/src/commands/discovery.rs
touch src-tauri/src/commands/scanner.rs
touch src-tauri/src/commands/copier.rs
touch src-tauri/src/commands/install.rs
touch src-tauri/src/commands/utils.rs
touch src-tauri/src/types.rs
```

```bash
cd src-tauri && cargo check 2>&1 | tail -5
```

Expected: `Finished` or only warnings, no errors.

- [ ] **Step 13: Commit scaffold**

```bash
git add src-tauri/ package.json package-lock.json
git commit -m "chore: add Tauri v2 scaffold and deps"
```

---

## Task 2: Rust shared types

**Files:**
- Create: `src-tauri/src/types.rs`

- [ ] **Step 1: Write `src-tauri/src/types.rs`**

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSource {
    pub id: String,
    pub label: String,
    pub path: String,
    pub color: String,
    pub skill_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillMeta {
    pub slug: String,
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub source: SkillSource,
    pub dir_path: String,
    pub exists_in_sources: Vec<String>,
    pub file_size_kb: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default)]
    pub custom_sources: Vec<CustomSource>,
    #[serde(default)]
    pub source_labels: HashMap<String, String>,
    #[serde(default)]
    pub recent_installs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomSource {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyResult {
    pub success: bool,
    pub error: Option<String>,
    pub already_exists: bool,
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallResult {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteResult {
    pub success: bool,
    pub error: Option<String>,
}
```

- [ ] **Step 2: Run `cargo check`**

```bash
cd src-tauri && cargo check 2>&1 | tail -5
```

Expected: `Finished` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/types.rs
git commit -m "feat(rust): add shared types"
```

---

## Task 3: Store commands

**Files:**
- Create: `src-tauri/src/commands/store.rs`

- [ ] **Step 1: Write `src-tauri/src/commands/store.rs`**

```rust
use crate::types::{AppConfig, CustomSource};
use std::collections::HashMap;
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
```

- [ ] **Step 2: Run `cargo check`**

```bash
cd src-tauri && cargo check 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/store.rs
git commit -m "feat(rust): store commands (get_config, set_config, rename_source)"
```

---

## Task 4: Discovery command

**Files:**
- Create: `src-tauri/src/commands/discovery.rs`

- [ ] **Step 1: Write `src-tauri/src/commands/discovery.rs`**

```rust
use crate::commands::store::load_config;
use crate::types::SkillSource;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use tauri::AppHandle;

struct ToolInfo {
    label: &'static str,
    color: &'static str,
}

fn known_tools() -> HashMap<&'static str, ToolInfo> {
    let mut m = HashMap::new();
    m.insert(".claude",      ToolInfo { label: "Claude Code",    color: "#f97316" });
    m.insert(".flyclaw",     ToolInfo { label: "FlyClaw",        color: "#ec4899" });
    m.insert(".openclaw",    ToolInfo { label: "OpenClaw",       color: "#8b5cf6" });
    m.insert(".cursor",      ToolInfo { label: "Cursor",         color: "#00b4d8" });
    m.insert(".augment",     ToolInfo { label: "Augment",        color: "#4ade80" });
    m.insert(".cline",       ToolInfo { label: "Cline",          color: "#ef4444" });
    m.insert(".copilot",     ToolInfo { label: "GitHub Copilot", color: "#24292f" });
    m.insert(".gemini",      ToolInfo { label: "Gemini CLI",     color: "#4285f4" });
    m.insert(".roo",         ToolInfo { label: "Roo Code",       color: "#fbbf24" });
    m.insert(".windsurf",    ToolInfo { label: "Windsurf",       color: "#38bdf8" });
    m.insert(".aider",       ToolInfo { label: "Aider",          color: "#a855f7" });
    m.insert(".continue",    ToolInfo { label: "Continue",       color: "#14b8a6" });
    m.insert(".codex",       ToolInfo { label: "Codex",          color: "#6366f1" });
    m.insert(".codeium",     ToolInfo { label: "Codeium",        color: "#0ea5e9" });
    m.insert(".agents",      ToolInfo { label: "Agents",         color: "#10b981" });
    m.insert(".comate",      ToolInfo { label: "Comate",         color: "#3b82f6" });
    m.insert(".codebuddy",   ToolInfo { label: "CodeBuddy",      color: "#fb7185" });
    m.insert(".commandcode", ToolInfo { label: "Command Code",   color: "#c084fc" });
    m.insert(".clawdbot",    ToolInfo { label: "Clawdbot",       color: "#06b6d4" });
    m.insert(".factory",     ToolInfo { label: "Droid",          color: "#d1d5db" });
    m.insert(".junie",       ToolInfo { label: "Junie",          color: "#fcd34d" });
    m.insert(".kilocode",    ToolInfo { label: "Kilo Code",      color: "#34d399" });
    m.insert(".kiro",        ToolInfo { label: "Kiro CLI",       color: "#5eead4" });
    m.insert(".kode",        ToolInfo { label: "Kode",           color: "#a3e635" });
    m.insert(".mcpjam",      ToolInfo { label: "MCPJam",         color: "#fb923c" });
    m.insert(".mux",         ToolInfo { label: "Mux",            color: "#2dd4bf" });
    m.insert(".openhands",   ToolInfo { label: "OpenHands",      color: "#7c3aed" });
    m.insert(".qoder",       ToolInfo { label: "Qoder",          color: "#38bdf8" });
    m.insert(".qwen",        ToolInfo { label: "Qwen Code",      color: "#86efac" });
    m.insert(".trae",        ToolInfo { label: "Trae",           color: "#e879f9" });
    m.insert(".trae-cn",     ToolInfo { label: "Trae CN",        color: "#f0abfc" });
    m.insert(".vibe",        ToolInfo { label: "Mistral Vibe",   color: "#818cf8" });
    m.insert(".zencoder",    ToolInfo { label: "Zencoder",       color: "#60a5fa" });
    m.insert(".adal",        ToolInfo { label: "AdaL",           color: "#c4b5fd" });
    m.insert(".neovate",     ToolInfo { label: "Neovate",        color: "#e2e8f0" });
    m.insert(".pochi",       ToolInfo { label: "Pochi",          color: "#fda4af" });
    m.insert(".pi",          ToolInfo { label: "Pi",             color: "#f472b6" });
    m.insert(".openclaude",  ToolInfo { label: "OpenClaude",     color: "#f59e0b" });
    m.insert("opencode",     ToolInfo { label: "OpenCode",       color: "#a78bfa" });
    m.insert("windsurf",     ToolInfo { label: "Windsurf",       color: "#38bdf8" });
    m.insert("goose",        ToolInfo { label: "Goose",          color: "#86efac" });
    m.insert("crush",        ToolInfo { label: "Crush",          color: "#fb923c" });
    m
}

const SKILLS_KEYWORDS: &[&str] = &["skills", "skill", "Skills", "Skill", "global_skills", "rules"];

const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", ".svn", ".hg",
    "Library", "Applications", "System", "Volumes",
    "dist", "build", "out", ".cache", ".npm", ".yarn",
    "__pycache__", ".venv", "venv", ".tox",
    "Pictures", "Movies", "Music", "Downloads",
];

fn path_to_id(p: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(p.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)[..32].to_string()
}

fn count_skills(dir: &Path) -> u32 {
    std::fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    e.file_type().map(|t| t.is_dir()).unwrap_or(false)
                        && e.path().join("SKILL.md").exists()
                })
                .count() as u32
        })
        .unwrap_or(0)
}

fn is_valid_skills_dir(dir: &Path) -> bool {
    count_skills(dir) > 0
}

fn infer_label(skills_dir: &Path, known: &HashMap<&str, ToolInfo>) -> String {
    let parts: Vec<&str> = skills_dir
        .components()
        .filter_map(|c| c.as_os_str().to_str())
        .collect();

    let skills_idx = parts
        .iter()
        .rposition(|p| SKILLS_KEYWORDS.iter().any(|k| p.eq_ignore_ascii_case(k)));

    let parent_name = match skills_idx {
        Some(i) if i > 0 => parts[i - 1],
        _ => parts.get(parts.len().saturating_sub(2)).copied().unwrap_or(""),
    };

    let grand_parent = skills_idx
        .filter(|&i| i > 1)
        .map(|i| parts[i - 2]);

    if let Some(info) = known.get(parent_name) {
        return info.label.to_string();
    }

    let clean = |s: &str| -> String {
        let s = s.trim_start_matches('.');
        let s = s.replace(['-', '_'], " ");
        s.split_whitespace()
            .map(|w| {
                let mut c = w.chars();
                match c.next() {
                    None => String::new(),
                    Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    };

    match grand_parent {
        Some(g) if g != "extensions" && g != "." => {
            format!("{} · {}", clean(g), clean(parent_name))
        }
        _ => clean(parent_name),
    }
}

const PALETTE: &[&str] = &[
    "#f97316","#ec4899","#8b5cf6","#10b981",
    "#3b82f6","#f59e0b","#06b6d4","#a855f7",
    "#14b8a6","#6366f1","#84cc16","#e11d48",
];

fn infer_color(skills_dir: &Path, known: &HashMap<&str, ToolInfo>) -> &'static str {
    let path_str = skills_dir.to_string_lossy();
    for (dir_name, info) in known.iter() {
        let needle = format!("/{}/", dir_name);
        if path_str.contains(&needle) {
            return info.color;
        }
    }
    let h = path_str.bytes().fold(0u32, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u32));
    PALETTE[(h as usize) % PALETTE.len()]
}

fn find_skills_dirs(root: &Path, max_depth: u32, found: &mut HashSet<PathBuf>, depth: u32) {
    if depth > max_depth {
        return;
    }
    let entries = match std::fs::read_dir(root) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let file_type = match entry.file_type() {
            Ok(t) => t,
            Err(_) => continue,
        };
        if !file_type.is_dir() {
            continue;
        }
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if SKIP_DIRS.contains(&name_str.as_ref()) {
            continue;
        }
        let full_path = entry.path();
        let is_skills_named = SKILLS_KEYWORDS
            .iter()
            .any(|k| name_str.eq_ignore_ascii_case(k));

        if is_skills_named {
            if is_valid_skills_dir(&full_path) {
                found.insert(full_path);
            }
        } else {
            find_skills_dirs(&full_path, max_depth, found, depth + 1);
        }
    }
}

pub fn discover_sources_internal(app: &AppHandle) -> Vec<SkillSource> {
    let config = load_config(app);
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return vec![],
    };
    let home_str = home.to_string_lossy().to_string();

    let mut found: HashSet<PathBuf> = HashSet::new();
    find_skills_dirs(&home, 4, &mut found, 0);

    if found.len() < 2 {
        for extra in &["Documents", "Projects", "Workspace", "workspace", "dev", "code", "repos"] {
            let p = home.join(extra);
            if p.exists() {
                find_skills_dirs(&p, 4, &mut found, 0);
            }
        }
    }

    let known = known_tools();
    let mut sources: Vec<SkillSource> = Vec::new();
    let mut seen: HashSet<PathBuf> = HashSet::new();

    let add_source = |path: PathBuf,
                      label_override: Option<String>,
                      known: &HashMap<&str, ToolInfo>,
                      config: &crate::types::AppConfig,
                      seen: &mut HashSet<PathBuf>,
                      sources: &mut Vec<SkillSource>| {
        let resolved = std::fs::canonicalize(&path).unwrap_or_else(|_| path.clone());
        if seen.contains(&resolved) || !is_valid_skills_dir(&resolved) {
            return;
        }
        seen.insert(resolved.clone());
        let resolved_str = resolved.to_string_lossy().to_string();
        let id = path_to_id(&resolved_str);
        let label = config
            .source_labels
            .get(&id)
            .cloned()
            .or(label_override)
            .unwrap_or_else(|| infer_label(&resolved, known));
        let color = infer_color(&resolved, known);
        sources.push(SkillSource {
            id,
            label,
            path: resolved_str,
            color: color.to_string(),
            skill_count: count_skills(&resolved),
        });
    };

    for p in found {
        add_source(p, None, &known, &config, &mut seen, &mut sources);
    }

    for custom in &config.custom_sources {
        let expanded = custom.path.replacen("~", &home_str, 1);
        let p = PathBuf::from(expanded);
        add_source(p, None, &known, &config, &mut seen, &mut sources);
    }

    // Disambiguate duplicate labels
    let mut label_groups: HashMap<String, Vec<usize>> = HashMap::new();
    for (i, s) in sources.iter().enumerate() {
        label_groups.entry(s.label.clone()).or_default().push(i);
    }
    let home_dir_name = home
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    for (_label, indices) in &label_groups {
        if indices.len() <= 1 {
            continue;
        }
        for &i in indices {
            let parts: Vec<&str> = sources[i].path.split('/').collect();
            let context = if parts.len() >= 3 {
                parts[parts.len() - 3]
            } else {
                ""
            };
            let suffix = if !context.is_empty() && context != home_dir_name {
                context.to_string()
            } else {
                "~".to_string()
            };
            sources[i].label = format!("{} · {}", sources[i].label, suffix);
        }
    }

    // Sort: known tools first, then by skill_count desc
    let known_labels: Vec<String> = known.values().map(|t| t.label.to_string()).collect();
    sources.sort_by(|a, b| {
        let a_known = known_labels.iter().any(|l| a.label.starts_with(l.as_str())) as u8;
        let b_known = known_labels.iter().any(|l| b.label.starts_with(l.as_str())) as u8;
        b_known.cmp(&a_known).then(b.skill_count.cmp(&a.skill_count))
    });

    sources
}

#[tauri::command]
pub fn discover_sources(app: AppHandle) -> Vec<SkillSource> {
    discover_sources_internal(&app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_to_id_is_deterministic() {
        let id1 = path_to_id("/home/user/.claude/skills");
        let id2 = path_to_id("/home/user/.claude/skills");
        assert_eq!(id1, id2);
        assert_eq!(id1.len(), 32);
    }

    #[test]
    fn test_path_to_id_differs_for_different_paths() {
        let id1 = path_to_id("/home/user/.claude/skills");
        let id2 = path_to_id("/home/user/.cursor/skills");
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_count_skills_empty_dir() {
        let tmp = std::env::temp_dir().join("test_count_skills_empty");
        let _ = std::fs::create_dir_all(&tmp);
        assert_eq!(count_skills(&tmp), 0);
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_count_skills_with_skill_md() {
        let tmp = std::env::temp_dir().join("test_count_skills_with_md");
        let skill_dir = tmp.join("my-skill");
        let _ = std::fs::create_dir_all(&skill_dir);
        let _ = std::fs::write(skill_dir.join("SKILL.md"), "---\nname: test\n---\n");
        assert_eq!(count_skills(&tmp), 1);
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
```

- [ ] **Step 2: Run unit tests**

```bash
cd src-tauri && cargo test commands::discovery::tests 2>&1 | tail -15
```

Expected:
```
test commands::discovery::tests::test_path_to_id_is_deterministic ... ok
test commands::discovery::tests::test_path_to_id_differs_for_different_paths ... ok
test commands::discovery::tests::test_count_skills_empty_dir ... ok
test commands::discovery::tests::test_count_skills_with_skill_md ... ok
test result: ok. 4 passed
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/discovery.rs
git commit -m "feat(rust): discover_sources command"
```

---

## Task 5: Scanner command

**Files:**
- Create: `src-tauri/src/commands/scanner.rs`

- [ ] **Step 1: Write `src-tauri/src/commands/scanner.rs`**

```rust
use crate::commands::discovery::discover_sources_internal;
use crate::types::{SkillMeta, SkillSource};
use std::path::Path;
use tauri::AppHandle;

fn get_dir_size_kb(dir: &Path) -> u32 {
    let mut total: u64 = 0;
    let Ok(entries) = std::fs::read_dir(dir) else {
        return 0;
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_dir() {
            total += get_dir_size_kb(&path) as u64 * 1024;
        } else if let Ok(meta) = std::fs::metadata(&path) {
            total += meta.len();
        }
    }
    (total / 1024) as u32
}

#[derive(serde::Deserialize, Default)]
struct SkillFrontmatter {
    name: Option<String>,
    description: Option<String>,
    tags: Option<serde_yaml::Value>,
}

fn parse_tags(val: Option<serde_yaml::Value>) -> Vec<String> {
    match val {
        Some(serde_yaml::Value::Sequence(seq)) => seq
            .iter()
            .filter_map(|v| v.as_str().map(str::to_string))
            .collect(),
        Some(serde_yaml::Value::String(s)) => s
            .replace(['[', ']'], "")
            .split(',')
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .collect(),
        _ => vec![],
    }
}

fn parse_frontmatter(content: &str) -> (String, String, Vec<String>) {
    let lines: Vec<&str> = content.lines().collect();
    if lines.first().map(str::trim) != Some("---") {
        return (String::new(), String::new(), vec![]);
    }
    let end_idx = match lines[1..].iter().position(|l| l.trim() == "---") {
        Some(i) => i + 1,
        None => return (String::new(), String::new(), vec![]),
    };
    let yaml_str = lines[1..end_idx].join("\n");
    match serde_yaml::from_str::<SkillFrontmatter>(&yaml_str) {
        Ok(fm) => {
            let name = fm.name.unwrap_or_default();
            let desc = fm.description.unwrap_or_default();
            let tags = parse_tags(fm.tags);
            (name, desc, tags)
        }
        Err(_) => (String::new(), String::new(), vec![]),
    }
}

pub fn scan_source(source: &SkillSource, all_sources: &[SkillSource]) -> Vec<SkillMeta> {
    let mut skills: Vec<SkillMeta> = Vec::new();
    let Ok(entries) = std::fs::read_dir(&source.path) else {
        return skills;
    };

    for entry in entries.filter_map(|e| e.ok()) {
        let file_type = match entry.file_type() {
            Ok(t) => t,
            Err(_) => continue,
        };
        if !file_type.is_dir() && !file_type.is_symlink() {
            continue;
        }
        let slug = entry.file_name().to_string_lossy().to_string();
        let dir_path = entry.path();
        let skill_md = dir_path.join("SKILL.md");

        // Follow symlinks for existence check
        if !skill_md.exists() {
            continue;
        }

        let (name, description, tags) = match std::fs::read_to_string(&skill_md) {
            Ok(content) => parse_frontmatter(&content),
            Err(_) => (String::new(), String::new(), vec![]),
        };

        let name = if name.is_empty() { slug.clone() } else { name };
        let description = description.chars().take(300).collect::<String>();
        let dir_path_str = dir_path.to_string_lossy().to_string();

        let exists_in_sources: Vec<String> = all_sources
            .iter()
            .filter(|s| s.id != source.id)
            .filter(|s| {
                std::path::Path::new(&s.path)
                    .join(&slug)
                    .join("SKILL.md")
                    .exists()
            })
            .map(|s| s.id.clone())
            .collect();

        skills.push(SkillMeta {
            slug,
            name,
            description,
            tags,
            source: source.clone(),
            dir_path: dir_path_str,
            exists_in_sources,
            file_size_kb: get_dir_size_kb(&dir_path),
        });
    }

    skills.sort_by(|a, b| a.slug.cmp(&b.slug));
    skills
}

#[tauri::command]
pub fn scan_all_skills(app: AppHandle) -> Vec<SkillMeta> {
    let sources = discover_sources_internal(&app);
    sources
        .iter()
        .flat_map(|s| scan_source(s, &sources))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_frontmatter_basic() {
        let content = "---\nname: My Skill\ndescription: Does things\ntags: [rust, cli]\n---\n\n# Body";
        let (name, desc, tags) = parse_frontmatter(content);
        assert_eq!(name, "My Skill");
        assert_eq!(desc, "Does things");
        assert_eq!(tags, vec!["rust", "cli"]);
    }

    #[test]
    fn test_parse_frontmatter_no_markers() {
        let content = "# Just markdown\nNo frontmatter here";
        let (name, desc, tags) = parse_frontmatter(content);
        assert_eq!(name, "");
        assert_eq!(desc, "");
        assert!(tags.is_empty());
    }

    #[test]
    fn test_parse_tags_comma_string() {
        let val = Some(serde_yaml::Value::String("tag1, tag2, tag3".to_string()));
        let tags = parse_tags(val);
        assert_eq!(tags, vec!["tag1", "tag2", "tag3"]);
    }

    #[test]
    fn test_parse_tags_sequence() {
        let val = Some(serde_yaml::Value::Sequence(vec![
            serde_yaml::Value::String("rust".to_string()),
            serde_yaml::Value::String("tauri".to_string()),
        ]));
        let tags = parse_tags(val);
        assert_eq!(tags, vec!["rust", "tauri"]);
    }

    #[test]
    fn test_get_dir_size_kb_empty() {
        let tmp = std::env::temp_dir().join("test_dir_size_empty");
        let _ = std::fs::create_dir_all(&tmp);
        assert_eq!(get_dir_size_kb(&tmp), 0);
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
```

- [ ] **Step 2: Run unit tests**

```bash
cd src-tauri && cargo test commands::scanner::tests 2>&1 | tail -15
```

Expected:
```
test result: ok. 5 passed
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/scanner.rs
git commit -m "feat(rust): scan_all_skills command"
```

---

## Task 6: Copier command (symlink + permission elevation)

**Files:**
- Create: `src-tauri/src/commands/copier.rs`

- [ ] **Step 1: Write `src-tauri/src/commands/copier.rs`**

```rust
use crate::commands::discovery::discover_sources_internal;
use crate::types::CopyResult;
use std::path::Path;
use tauri::AppHandle;

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
```

- [ ] **Step 2: Run `cargo check`**

```bash
cd src-tauri && cargo check 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/copier.rs
git commit -m "feat(rust): copy_skill command with symlink + permission elevation"
```

---

## Task 7: Install command (npx + streaming)

**Files:**
- Create: `src-tauri/src/commands/install.rs`

- [ ] **Step 1: Write `src-tauri/src/commands/install.rs`**

```rust
use crate::commands::discovery::discover_sources_internal;
use crate::commands::scanner::scan_source;
use crate::commands::store::{load_config, save_config};
use crate::types::InstallResult;
use std::collections::HashSet;
use tauri::AppHandle;
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
    crate::commands::copier::copy_skill_internal("", "", ""); // just to import
    // Reuse the permission fn
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
        let existing = &config.recent_installs;
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
```

- [ ] **Step 2: Run `cargo check`**

```bash
cd src-tauri && cargo check 2>&1 | tail -5
```

Expected: no errors. If you see errors about `CommandEvent` or Shell API, verify `tauri-plugin-shell` is in `Cargo.toml`.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/install.rs
git commit -m "feat(rust): install_skill command with npx streaming + auto-elevate"
```

---

## Task 8: Utility commands

**Files:**
- Create: `src-tauri/src/commands/utils.rs`

- [ ] **Step 1: Write `src-tauri/src/commands/utils.rs`**

```rust
use crate::commands::discovery::discover_sources_internal;
use crate::commands::store::{is_writable_pub, request_write_permission_pub};
use crate::types::DeleteResult;
use tauri::AppHandle;

// Re-export helpers needed by install.rs
pub fn is_writable(path: &std::path::Path) -> bool {
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
        return DeleteResult { success: false, error: Some("目录不可写".to_string()) };
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
```

- [ ] **Step 2: Run `cargo check`**

```bash
cd src-tauri && cargo check 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/utils.rs
git commit -m "feat(rust): delete_skill, read_skill_md, open_in_finder commands"
```

---

## Task 9: Wire up all commands in lib.rs

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Rewrite `src-tauri/src/lib.rs` with all commands registered**

```rust
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
```

- [ ] **Step 2: Run `cargo check` — must pass clean**

```bash
cd src-tauri && cargo check 2>&1
```

Expected: `Finished` with no errors. Fix any compile errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(rust): register all Tauri commands in lib.rs"
```

---

## Task 10: Move frontend & update Vite config

**Files:**
- Move: `src/renderer/*` → `src/*`
- Modify: `index.html`
- Modify: `vite.config.ts`

- [ ] **Step 1: Move renderer files into src/**

```bash
# Move components, context, css
cp -r src/renderer/components src/components
cp -r src/renderer/context    src/context
cp    src/renderer/index.css  src/index.css
cp    src/renderer/main.tsx   src/main.tsx
cp    src/renderer/App.tsx    src/App.tsx
cp    src/renderer/env.d.ts   src/env.d.ts 2>/dev/null || true
```

- [ ] **Step 2: Update import paths in moved files**

All components in `src/renderer/components/` imported from `../../types`. After moving to `src/components/`, they must import from `../types`.

Run this find-and-replace across all moved files:

```bash
# Fix import paths: ../../types -> ../types
find src/components src/context -name "*.tsx" -o -name "*.ts" | \
  xargs sed -i '' "s|from '../../types'|from '../types'|g"

# Fix import paths within components: ../context -> ./context -> ../context (already correct)
# context/AppContext imports ../../types -> should be ../types
sed -i '' "s|from '../../types'|from '../types'|g" src/context/AppContext.tsx
```

- [ ] **Step 3: Update `index.html` script src**

Change:
```html
<script type="module" src="/src/renderer/main.tsx"></script>
```
To:
```html
<script type="module" src="/src/main.tsx"></script>
```

- [ ] **Step 4: Rewrite `vite.config.ts`** (remove electron plugin, keep React + Tailwind)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
```

- [ ] **Step 5: Run Vite build to check no frontend errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds (TypeScript errors about `window.electronAPI` are expected at this point).

- [ ] **Step 6: Commit**

```bash
git add src/ index.html vite.config.ts
git commit -m "chore: move frontend from src/renderer/ to src/"
```

---

## Task 11: Create `src/api.ts`

**Files:**
- Create: `src/api.ts`
- Modify: `src/env.d.ts` (remove ElectronAPI declaration)

- [ ] **Step 1: Create `src/api.ts`**

```typescript
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { SkillSource, SkillMeta, AppConfig } from './types'

export interface CopyResult {
  success: boolean
  error?: string
  alreadyExists: boolean
  mode: 'symlink' | 'copy'
}

export const api = {
  discoverSources: (): Promise<SkillSource[]> =>
    invoke('discover_sources'),

  scanAllSkills: (): Promise<SkillMeta[]> =>
    invoke('scan_all_skills'),

  copySkill: (slug: string, sourceDirPath: string, targetSourceId: string): Promise<CopyResult> =>
    invoke('copy_skill', { slug, sourceDirPath, targetSourceId }),

  deleteSkill: (dirPath: string, sourceId: string): Promise<{ success: boolean; error?: string }> =>
    invoke('delete_skill', { dirPath, sourceId }),

  readSkillMd: (dirPath: string): Promise<string | null> =>
    invoke('read_skill_md', { dirPath }),

  openInFinder: (dirPath: string): void => {
    invoke('open_in_finder', { dirPath })
  },

  getConfig: (): Promise<AppConfig> =>
    invoke('get_config'),

  setConfig: (patch: Partial<AppConfig>): Promise<void> =>
    invoke('set_config', { patch }),

  renameSource: (sourceId: string, newLabel: string): Promise<void> =>
    invoke('rename_source', { sourceId, newLabel }),

  installSkill: (sourceUrl: string, skillSlug?: string): Promise<{ success: boolean; error?: string }> =>
    invoke('install_skill', { sourceUrl, skillSlug }),

  onSourcesUpdated: (cb: (sources: SkillSource[]) => void) =>
    listen<SkillSource[]>('sources:updated', e => cb(e.payload)),

  onInstallProgress: (cb: (line: string) => void) =>
    listen<string>('install:progress', e => cb(e.payload)),
}
```

- [ ] **Step 2: Remove `ElectronAPI` from `src/env.d.ts`**

Open `src/env.d.ts` (or `src/renderer/env.d.ts` if still present) and delete the `Window` interface declaration that references `electronAPI`. The file should be empty or only contain `/// <reference types="vite/client" />`.

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 3: Commit**

```bash
git add src/api.ts src/env.d.ts
git commit -m "feat(frontend): add api.ts replacing preload/window.electronAPI"
```

---

## Task 12: Update `AppContext.tsx` and `App.tsx`

**Files:**
- Modify: `src/context/AppContext.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update `src/context/AppContext.tsx`**

Replace the `refresh` function and its `window.electronAPI` calls:

```typescript
// At top of file, add:
import { api } from '../api'

// Replace the refresh callback:
const refresh = useCallback(async () => {
  dispatch({ type: 'SET_LOADING', loading: true })
  try {
    const [config, sources, skills] = await Promise.all([
      api.getConfig(),
      api.discoverSources(),
      api.scanAllSkills(),
    ])
    dispatch({ type: 'SET_SOURCES', sources })
    dispatch({ type: 'SET_SKILLS', skills })
    dispatch({ type: 'SET_CONFIG', config })
  } finally {
    dispatch({ type: 'SET_LOADING', loading: false })
  }
}, [])
```

- [ ] **Step 2: Update `src/App.tsx`**

Replace the entire `useEffect` in `AppContent` with:

```typescript
import { api } from './api'

// Replace useEffect in AppContent:
useEffect(() => {
  // Theme: use matchMedia instead of IPC
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  dispatch({ type: 'SET_THEME', theme: dark ? 'dark' : 'light' })
  document.documentElement.classList.toggle('dark', dark)

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleThemeChange = (e: MediaQueryListEvent) => {
    dispatch({ type: 'SET_THEME', theme: e.matches ? 'dark' : 'light' })
    document.documentElement.classList.toggle('dark', e.matches)
  }
  mediaQuery.addEventListener('change', handleThemeChange)

  refresh()

  // Sources updated event
  let offSources: (() => void) | undefined
  api.onSourcesUpdated((sources) => {
    dispatch({ type: 'SET_SOURCES', sources })
  }).then(fn => { offSources = fn })

  return () => {
    mediaQuery.removeEventListener('change', handleThemeChange)
    offSources?.()
  }
}, [refresh, dispatch])
```

- [ ] **Step 3: Run TypeScript check**

```bash
npm run build 2>&1 | grep -E "error TS|App\.tsx|AppContext"
```

Expected: no errors related to these two files.

- [ ] **Step 4: Commit**

```bash
git add src/context/AppContext.tsx src/App.tsx
git commit -m "feat(frontend): migrate AppContext and App.tsx to Tauri api"
```

---

## Task 13: Update `HubPanel.tsx` and `InstallModal.tsx`

**Files:**
- Modify: `src/components/HubPanel.tsx`
- Modify: `src/components/InstallModal.tsx`

- [ ] **Step 1: Update `src/components/HubPanel.tsx`**

Replace the `useEffect` that calls `window.electronAPI.fetchFeaturedSkills()`:

```typescript
// Remove the window.electronAPI call; replace with:
useEffect(() => {
  setLoading(true)
  setError(null)
  fetch('https://raw.githubusercontent.com/qufei1993/skills-hub/main/featured-skills.json')
    .then(r => r.json())
    .then(data => {
      setSkills(data.skills ?? [])
      setLoading(false)
    })
    .catch(() => {
      setError('加载失败，请检查网络连接')
      setLoading(false)
    })
}, [])
```

- [ ] **Step 2: Update `src/components/InstallModal.tsx`**

Replace all `window.electronAPI.*` calls with `api.*`. The key changes:

```typescript
import { api } from '../api'

// Replace onInstallProgress listener in useEffect:
useEffect(() => {
  let unlisten: (() => void) | undefined
  api.onInstallProgress((line) => {
    setLogs(prev => [...prev, line])
  }).then(fn => { unlisten = fn })
  return () => { unlisten?.() }
}, [])

// Replace handleInstall:
const handleInstall = async () => {
  if (!sourceUrl.trim()) return
  setInstalling(true)
  setDone(false)
  setError(null)
  setLogs([`> npx skills add ${sourceUrl}${skillSlug ? ` --skill ${skillSlug}` : ''} -g -y\n`])

  const slug = skillSlug.trim()
  const result = await api.installSkill(sourceUrl.trim(), slug || undefined)
  setInstalling(false)
  setDone(true)
  if (!result.success) {
    setError(result.error ?? '安装失败')
  } else {
    const [sources, newSkills, config] = await Promise.all([
      api.discoverSources(),
      api.scanAllSkills(),
      api.getConfig(),
    ])
    dispatch({ type: 'SET_SOURCES', sources })
    dispatch({ type: 'SET_SKILLS', skills: newSkills })
    dispatch({ type: 'SET_CONFIG', config })
    dispatch({ type: 'SET_TAB', tab: 'local' })
    const hasRecent = (config.recentInstalls ?? []).length > 0
    dispatch({ type: 'SET_ACTIVE_SOURCE', id: hasRecent ? 'recent' : null })
    onClose()
  }
}
```

> Note: The `recentInstalls` update logic is now handled on the Rust side in `install_skill`. The renderer only needs to refresh state after success.

- [ ] **Step 3: Run TypeScript check**

```bash
npm run build 2>&1 | grep -E "error TS|HubPanel|InstallModal"
```

Expected: no errors in these files.

- [ ] **Step 4: Commit**

```bash
git add src/components/HubPanel.tsx src/components/InstallModal.tsx
git commit -m "feat(frontend): migrate HubPanel and InstallModal to Tauri api"
```

---

## Task 14: Update remaining components

**Files:**
- Modify: `src/components/SkillDetailPanel.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/SettingsDrawer.tsx`
- Modify: `src/components/SkillCard.tsx`

- [ ] **Step 1: Update `src/components/SkillDetailPanel.tsx`**

Replace all `window.electronAPI.*` with `api.*`:

```typescript
import { api } from '../api'

// readSkillMd:
window.electronAPI.readSkillMd(skill.dirPath)
→ api.readSkillMd(skill.dirPath)

// copySkill:
window.electronAPI.copySkill(skill.slug, skill.dirPath, targetSourceId)
→ api.copySkill(skill.slug, skill.dirPath, targetSourceId)

// openInFinder:
window.electronAPI.openInFinder(skill.dirPath)
→ api.openInFinder(skill.dirPath)
```

- [ ] **Step 2: Update `src/components/Sidebar.tsx`**

```typescript
import { api } from '../api'

// renameSource:
window.electronAPI.renameSource(sourceId, newLabel)
→ api.renameSource(sourceId, newLabel)
```

- [ ] **Step 3: Update `src/components/SettingsDrawer.tsx`**

```typescript
import { api } from '../api'

// setConfig:
window.electronAPI.setConfig({ customSources: next })
→ api.setConfig({ customSources: next })
```

- [ ] **Step 4: Update `src/components/SkillCard.tsx`**

```typescript
import { api } from '../api'

// copySkill:
window.electronAPI.copySkill(skill.slug, skill.dirPath, targetSourceId)
→ api.copySkill(skill.slug, skill.dirPath, targetSourceId)

// deleteSkill:
window.electronAPI.deleteSkill(skill.dirPath, skill.source.id)
→ api.deleteSkill(skill.dirPath, skill.source.id)

// openInFinder:
window.electronAPI.openInFinder(skill.dirPath)
→ api.openInFinder(skill.dirPath)
```

- [ ] **Step 5: Run full TypeScript build — must pass clean**

```bash
npm run build 2>&1
```

Expected: `✓ built in` with no TypeScript errors. If any `window.electronAPI` references remain, fix them.

```bash
# Verify no remaining window.electronAPI references
grep -r "window\.electronAPI" src/ && echo "FOUND - fix these" || echo "Clean!"
```

Expected: `Clean!`

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "feat(frontend): migrate all remaining components to Tauri api"
```

---

## Task 15: First dev run verification

- [ ] **Step 1: Start Tauri dev mode**

```bash
npm run tauri:dev
```

Expected: Rust compiles (first time ~2-4 min), then app window opens.

- [ ] **Step 2: Verify discover_sources works**

In the running app, the sidebar should show skill sources discovered from `$HOME`. If the sidebar is empty, open DevTools (`Cmd+Option+I` on macOS) and check console for errors.

- [ ] **Step 3: Verify scan_all_skills works**

Skills should appear in the grid. Click a skill card to verify the detail panel loads `SKILL.md` content.

- [ ] **Step 4: Verify copy_skill works**

Right-click a skill → copy to another source. Verify the symlink is created in the target directory.

- [ ] **Step 5: Verify install_skill works**

Click Install → enter `vercel-labs/agent-skills --skill frontend-design` → verify log output streams in real time.

- [ ] **Step 6: Fix any issues found, then commit**

```bash
git add -A
git commit -m "fix: address issues found in first dev run"
```

---

## Task 16: Delete old Electron files

- [ ] **Step 1: Remove Electron main process directory**

```bash
rm -rf src/main
```

- [ ] **Step 2: Remove old renderer directory**

```bash
rm -rf src/renderer
```

- [ ] **Step 3: Remove Electron npm packages**

```bash
npm uninstall electron electron-builder vite-plugin-electron vite-plugin-electron-renderer electron-store archiver gray-matter
```

- [ ] **Step 4: Verify build still passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: succeeds.

- [ ] **Step 5: Remove old build scripts from package.json**

Remove `pack` and `dist` scripts (they referenced electron-builder). The `build.electron` section can also be removed.

- [ ] **Step 6: Commit cleanup**

```bash
git add -A
git commit -m "chore: remove Electron files and dependencies"
```

---

## Task 17: GitHub Actions CI (3-platform build)

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-latest
            args: '--target aarch64-apple-darwin'
          - os: macos-latest
            args: '--target x86_64-apple-darwin'
          - os: windows-latest
            args: ''
          - os: ubuntu-22.04
            args: ''

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.os == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Install Linux deps
        if: matrix.os == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Install frontend deps
        run: npm ci

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          args: ${{ matrix.args }}
          tagName: ${{ github.ref_name }}
          releaseName: 'Skills Manager ${{ github.ref_name }}'
          releaseBody: 'See changelog for details.'
          releaseDraft: true
          prerelease: false
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add GitHub Actions 3-platform release workflow"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Tauri v2 scaffold with tauri.conf.json, Cargo.toml, capabilities
- ✅ discover_sources command (discovery.rs)
- ✅ scan_all_skills command (scanner.rs)
- ✅ copy_skill command with symlink + fallback + permission elevation (copier.rs)
- ✅ install_skill command with npx streaming (install.rs)
- ✅ delete_skill, read_skill_md, open_in_finder (utils.rs)
- ✅ get_config, set_config, rename_source (store.rs)
- ✅ lib.rs registers all commands
- ✅ src/api.ts replaces window.electronAPI
- ✅ AppContext, App.tsx migrated (theme via matchMedia)
- ✅ HubPanel migrated to direct fetch()
- ✅ All 6 components updated
- ✅ Electron files deleted
- ✅ GitHub Actions CI (macOS arm64/x64, Windows, Linux)
- ✅ Three-platform packaging in tauri.conf.json

**Notes for the implementer:**
1. On first `cargo check`, compile errors in `install.rs` around `CommandEvent` variants are likely — check the actual tauri-plugin-shell v2 API with `cargo doc --open`.
2. The `tauri-plugin-store` `StoreExt` trait must be imported with `use tauri_plugin_store::StoreExt;` wherever `app.store()` is called.
3. Windows symlinks require Developer Mode enabled. The fallback copy path handles this transparently.
4. The `listen()` function returns `Promise<UnlistenFn>` — always store the unlisten function and call it in the cleanup of `useEffect`.
