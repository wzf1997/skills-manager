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

fn add_source_fn(
    path: PathBuf,
    label_override: Option<String>,
    known: &HashMap<&str, ToolInfo>,
    config: &crate::types::AppConfig,
    seen: &mut HashSet<PathBuf>,
    sources: &mut Vec<SkillSource>,
) {
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

    for p in found {
        add_source_fn(p, None, &known, &config, &mut seen, &mut sources);
    }

    for custom in &config.custom_sources {
        let expanded = custom.path.replacen("~", &home_str, 1);
        let p = PathBuf::from(expanded);
        add_source_fn(p, None, &known, &config, &mut seen, &mut sources);
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
