use upmemo::memo_store::{AtomicFileCommit, CommitAdapter, MemoStoreV2, MEMO_STORE_VERSION};
use upmemo::models::MemoEntry;
use upmemo::models::FontConfig;
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde::{Deserialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const LEGACY_FILES: [(&str, LegacyFile); 4] = [
    ("note.txt", LegacyFile::CurrentContent),
    ("history.json", LegacyFile::History),
    ("archive.json", LegacyFile::Archive),
    ("trash.json", LegacyFile::Trash),
];

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub enum LegacyFile {
    CurrentContent,
    History,
    Archive,
    Trash,
}

impl LegacyFile {
    fn filename(&self) -> &'static str {
        match self {
            Self::CurrentContent => "note.txt",
            Self::History => "history.json",
            Self::Archive => "archive.json",
            Self::Trash => "trash.json",
        }
    }
}

#[derive(Debug, Eq, PartialEq)]
pub enum MigrationOutcome {
    AlreadyMigrated,
    NoLegacyFound,
    Migrated { backup_path: PathBuf },
}

impl std::fmt::Display for LegacyFile {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.filename())
    }
}

#[derive(Debug)]
pub struct MigrationFailure {
    pub file: LegacyFile,
    pub source: String,
    pub source_path: PathBuf,
    pub backup_path: PathBuf,
}

impl std::fmt::Display for MigrationFailure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{} | {} | source_path={} | backup_path={}",
            self.file,
            self.source,
            self.source_path.display(),
            self.backup_path.display()
        )
    }
}

#[derive(Debug)]
pub enum MigrationResult {
    MalformedJson(MigrationFailure),
    IoFailure(MigrationFailure),
    SerializationFailure(String),
}

impl std::fmt::Display for MigrationResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MalformedJson(failure) => write!(f, "legacy migration JSON malformed: {failure}"),
            Self::IoFailure(failure) => write!(f, "legacy migration I/O failure: {failure}"),
            Self::SerializationFailure(error) => write!(f, "legacy migration serialization failure: {error}"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct FileManifest {
    filename: String,
    bytes: usize,
    sha256: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct MigrationManifest {
    migrated_at_unix: u64,
    files: Vec<FileManifest>,
}

#[allow(dead_code)]
pub fn read_note(app: &tauri::AppHandle) -> Result<String, String> {
    let path = data_path(app, "note.txt")?;
    if path.exists() {
        fs::read_to_string(&path).map_err(|error| format!("無法讀取筆記: {}", error))
    } else {
        Ok(String::new())
    }
}

#[allow(dead_code)]
pub fn write_note(app: &tauri::AppHandle, content: &str) -> Result<(), String> {
    let path = data_path(app, "note.txt")?;
    fs::write(&path, content).map_err(|error| format!("無法儲存筆記: {}", error))
}

#[allow(dead_code)]
pub fn read_history(app: &tauri::AppHandle) -> Result<Vec<MemoEntry>, String> {
    read_json_or_default(app, "history.json", "無法讀取歷史記錄")
}

#[allow(dead_code)]
pub fn write_history(app: &tauri::AppHandle, entries: &[MemoEntry]) -> Result<(), String> {
    write_json(
        app,
        "history.json",
        entries,
        "無法序列化歷史記錄",
        "無法寫入歷史記錄",
    )
}

#[allow(dead_code)]
pub fn read_trash(app: &tauri::AppHandle) -> Result<Vec<MemoEntry>, String> {
    read_json_or_default(app, "trash.json", "無法讀取垃圾桶")
}

#[allow(dead_code)]
pub fn write_trash(app: &tauri::AppHandle, entries: &[MemoEntry]) -> Result<(), String> {
    write_json(
        app,
        "trash.json",
        entries,
        "無法序列化垃圾桶",
        "無法寫入垃圾桶",
    )
}

#[allow(dead_code)]
pub fn read_archive(app: &tauri::AppHandle) -> Result<Vec<MemoEntry>, String> {
    read_json_or_default(app, "archive.json", "無法讀取封存")
}

#[allow(dead_code)]
pub fn write_archive(app: &tauri::AppHandle, entries: &[MemoEntry]) -> Result<(), String> {
    write_json(
        app,
        "archive.json",
        entries,
        "無法序列化封存",
        "無法寫入封存",
    )
}

pub fn default_font_config() -> FontConfig {
    FontConfig {
        chinese_font: "Microsoft JhengHei".to_string(),
        english_font: "Segoe UI".to_string(),
    }
}

pub fn read_font_config(app: &tauri::AppHandle) -> Result<FontConfig, String> {
    let path = data_path(app, "font_config.json")?;
    if !path.exists() {
        return Ok(default_font_config());
    }

    let content =
        fs::read_to_string(&path).map_err(|error| format!("無法讀取字體設定: {}", error))?;
    serde_json::from_str(&content).map_err(|error| format!("無法解析字體設定: {}", error))
}

pub fn migrate_legacy_store(app: &tauri::AppHandle) -> Result<MigrationOutcome, MigrationResult> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| MigrationResult::IoFailure(MigrationFailure {
            file: LegacyFile::CurrentContent,
            source: format!("無法取得應用程式資料目錄: {}", error),
            source_path: PathBuf::from("app_data_dir"),
            backup_path: PathBuf::from(""),
        }))?;

    migrate_legacy_store_in_dir(&data_dir)
}

pub fn migrate_legacy_store_in_dir(data_dir: &Path) -> Result<MigrationOutcome, MigrationResult> {
    let memo_store_path = data_dir.join("memo_store.json");
    if memo_store_path.exists() {
        return Ok(MigrationOutcome::AlreadyMigrated);
    }

    let legacy_entries = discover_legacy_entries(data_dir);
    if legacy_entries.is_empty() {
        return Ok(MigrationOutcome::NoLegacyFound);
    }

    let backup_root = data_dir.join("backups").join("v1");
    let backup_path = backup_root.join(format!(
        "v1-migration-{}",
        now_unix_timestamp()
    ));

    fs::create_dir_all(&backup_path)
        .map_err(|error| migration_io_failure(LegacyFile::CurrentContent, data_dir, &backup_path, error))?;

    let mut manifest: Vec<FileManifest> = Vec::new();
    for (filename, legacy_file) in LEGACY_FILES {
        let source_path = data_dir.join(filename);
        if !source_path.exists() {
            continue;
        }

        let content = read_file_bytes(&source_path).map_err(|error| {
            MigrationResult::IoFailure(MigrationFailure {
                file: legacy_file,
                source: error,
                source_path: source_path.clone(),
                backup_path: backup_path.clone(),
            })
        })?;

        let manifest_entry = FileManifest {
            filename: filename.to_string(),
            bytes: content.len(),
            sha256: sha256_hex(&content),
        };
        manifest.push(manifest_entry);

        let backup_file = backup_path.join(filename);
        fs::write(&backup_file, &content)
            .map_err(|error| migration_io_failure(legacy_file, &source_path, &backup_path, error))?;
    }

    let entries = read_note_json_with_backup(data_dir, &backup_path)?;
    let store = MemoStoreV2 {
        version: MEMO_STORE_VERSION,
        current_memo_id: entries.current_memo_id,
        current_content: entries.current_content,
        history: entries.history,
        archive: entries.archive,
        trash: entries.trash,
    };

    let bytes = serde_json::to_vec_pretty(&store).map_err(|error| {
        MigrationResult::SerializationFailure(format!("memo_store 序列化失敗: {}", error))
    })?;
    AtomicFileCommit
        .commit(&memo_store_path, &bytes)
        .map_err(|error| MigrationResult::IoFailure(MigrationFailure {
            file: LegacyFile::CurrentContent,
            source: format!("無法寫入 memo_store.json: {}", error),
            source_path: memo_store_path.clone(),
            backup_path: backup_path.clone(),
        }))?;

    let manifest = MigrationManifest {
        migrated_at_unix: now_unix_timestamp(),
        files: manifest,
    };
    let manifest_json = serde_json::to_vec_pretty(&manifest)
        .map_err(|error| MigrationResult::SerializationFailure(format!("manifest 序列化失敗: {}", error)))?;
    fs::write(backup_path.join("manifest.json"), manifest_json).map_err(|error| {
        MigrationResult::IoFailure(MigrationFailure {
            file: LegacyFile::CurrentContent,
            source: format!("無法寫入 migration manifest: {}", error),
            source_path: backup_path.join("manifest.json"),
            backup_path: backup_path.clone(),
        })
    })?;

    Ok(MigrationOutcome::Migrated { backup_path })
}

struct LegacyStoreContents {
    current_memo_id: Option<String>,
    current_content: String,
    history: Vec<MemoEntry>,
    archive: Vec<MemoEntry>,
    trash: Vec<MemoEntry>,
}

fn read_note_json_with_backup(
    data_dir: &Path,
    backup_path: &Path,
) -> Result<LegacyStoreContents, MigrationResult> {
    let current_content = data_dir
        .join(LegacyFile::CurrentContent.filename())
        .exists()
        .then(|| {
            fs::read_to_string(data_dir.join(LegacyFile::CurrentContent.filename())).map_err(|error| {
                MigrationResult::IoFailure(MigrationFailure {
                    file: LegacyFile::CurrentContent,
                    source: format!("無法讀取 note.txt: {}", error),
                    source_path: data_dir.join(LegacyFile::CurrentContent.filename()),
                    backup_path: backup_path.to_path_buf(),
                })
            })
        })
        .transpose()?;

    let history = read_json_collection_with_backup(
        data_dir.join(LegacyFile::History.filename()),
        LegacyFile::History,
        backup_path,
    )?;
    let archive = read_json_collection_with_backup(
        data_dir.join(LegacyFile::Archive.filename()),
        LegacyFile::Archive,
        backup_path,
    )?;
    let trash = read_json_collection_with_backup(
        data_dir.join(LegacyFile::Trash.filename()),
        LegacyFile::Trash,
        backup_path,
    )?;

    let current_memo_id = history
        .first()
        .map(|entry| entry.id.clone())
        .or_else(|| archive.first().map(|entry| entry.id.clone()))
        .or_else(|| trash.first().map(|entry| entry.id.clone()));

    Ok(LegacyStoreContents {
        current_memo_id,
        current_content: current_content.unwrap_or_default(),
        history,
        archive,
        trash,
    })
}

fn discover_legacy_entries(data_dir: &Path) -> Vec<String> {
    LEGACY_FILES
        .iter()
        .map(|(filename, _)| filename)
        .filter_map(|filename| {
            let path = data_dir.join(filename);
            path.exists().then_some(filename.to_string())
        })
        .collect()
}

fn read_file_bytes(path: &Path) -> Result<Vec<u8>, String> {
    let mut file = File::open(path).map_err(|error| format!("無法開啟檔案: {}", error))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|error| format!("無法讀取檔案: {}", error))?;
    Ok(bytes)
}

fn read_json_collection_with_backup(
    path: PathBuf,
    file: LegacyFile,
    backup_path: &Path,
) -> Result<Vec<MemoEntry>, MigrationResult> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(&path).map_err(|error| MigrationResult::IoFailure(MigrationFailure {
        file,
        source: format!("無法讀取 JSON 檔: {}", error),
        source_path: path.clone(),
        backup_path: backup_path.to_path_buf(),
    }))?;

    serde_json::from_str(&raw).map_err(|error| MigrationResult::MalformedJson(MigrationFailure {
        file,
        source: format!("JSON 解析失敗: {}", error),
        source_path: path,
        backup_path: backup_path.to_path_buf(),
    }))
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn now_unix_timestamp() -> u64 {
    let elapsed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_else(|_| std::time::Duration::from_secs(0));
    elapsed.as_secs()
}

fn migration_io_failure(
    file: LegacyFile,
    source_path: &Path,
    backup_path: &Path,
    error: std::io::Error,
) -> MigrationResult {
    MigrationResult::IoFailure(MigrationFailure {
        file,
        source: format!("I/O 操作失敗: {}", error),
        source_path: source_path.to_path_buf(),
        backup_path: backup_path.to_path_buf(),
    })
}

pub fn write_font_config(app: &tauri::AppHandle, config: &FontConfig) -> Result<(), String> {
    write_json(
        app,
        "font_config.json",
        config,
        "無法序列化字體設定",
        "無法寫入字體設定",
    )
}

fn data_path(app: &tauri::AppHandle, file_name: &str) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("無法取得應用程式資料目錄: {}", error))?;

    fs::create_dir_all(&app_data_dir).map_err(|error| format!("無法建立資料目錄: {}", error))?;

    Ok(app_data_dir.join(file_name))
}

#[allow(dead_code)]
fn read_json_or_default<T>(
    app: &tauri::AppHandle,
    file_name: &str,
    read_error: &str,
) -> Result<T, String>
where
    T: DeserializeOwned + Default,
{
    let path = data_path(app, file_name)?;
    if !path.exists() {
        return Ok(T::default());
    }

    let content =
        fs::read_to_string(&path).map_err(|error| format!("{}: {}", read_error, error))?;
    Ok(serde_json::from_str(&content).unwrap_or_default())
}

fn write_json<T>(
    app: &tauri::AppHandle,
    file_name: &str,
    value: &T,
    serialize_error: &str,
    write_error: &str,
) -> Result<(), String>
where
    T: Serialize + ?Sized,
{
    let path = data_path(app, file_name)?;
    let json = serde_json::to_string_pretty(value)
        .map_err(|error| format!("{}: {}", serialize_error, error))?;

    fs::write(&path, json).map_err(|error| format!("{}: {}", write_error, error))
}
