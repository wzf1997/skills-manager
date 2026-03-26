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
    if lines.first().map(|l| l.trim()) != Some("---") {
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
