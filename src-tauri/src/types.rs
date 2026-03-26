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
