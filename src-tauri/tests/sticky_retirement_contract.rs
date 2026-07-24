use std::path::Path;
use std::process::Command;

#[test]
fn main_tray_toggle_retains_main_window_visibility_controls() {
    // Given
    let tray_source = include_str!("../src/tray.rs");

    // When
    let controls_main_window = tray_source.contains("get_webview_window(\"main\")");

    // Then
    assert!(controls_main_window);
    assert!(tray_source.contains("main_window.hide()"));
    assert!(tray_source.contains("main_window.show()"));
    assert!(tray_source.contains("main_window.set_focus()"));
    assert!(tray_source.contains(".menu(&menu)"));
    assert!(tray_source.contains(".show_menu_on_left_click(false)"));
}

#[test]
fn sticky_runtime_surface_is_absent() {
    // Given
    let manifest_directory = Path::new(env!("CARGO_MANIFEST_DIR"));
    let repository_root = manifest_directory
        .parent()
        .expect("src-tauri must have the repository root as its parent");

    // When
    let runtime_sources = [
        ("main.rs", include_str!("../src/main.rs")),
        ("models.rs", include_str!("../src/models.rs")),
        ("storage.rs", include_str!("../src/storage.rs")),
        ("tray.rs", include_str!("../src/tray.rs")),
        (
            "shortcut_commands.rs",
            include_str!("../src/shortcut_commands.rs"),
        ),
        ("tauri.conf.json", include_str!("../tauri.conf.json")),
    ];
    let forbidden_runtime_surface = runtime_sources
        .iter()
        .find_map(|(file_name, source)| source.contains("sticky").then_some(*file_name));

    // Then
    assert_eq!(
        forbidden_runtime_surface, None,
        "{forbidden_runtime_surface:?} still registers or persists the retired Sticky runtime"
    );
    let tauri_config: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json"))
        .expect("tauri.conf.json must remain valid JSON");
    let capabilities = tauri_config["app"]["security"]["capabilities"]
        .as_array()
        .expect("Tauri capabilities must be an array");
    assert!(capabilities.iter().all(|capability| {
        capability["identifier"]
            .as_str()
            .is_none_or(|identifier| !identifier.contains("sticky"))
    }));
    let frontend_sticky_api = repository_root.join("src/stickyNotes.ts");
    assert!(
        !frontend_sticky_api.exists(),
        "retired frontend Sticky API still exists at {}",
        frontend_sticky_api.display()
    );
    let backend_sticky_commands = manifest_directory.join("src/sticky_commands.rs");
    assert!(
        !backend_sticky_commands.exists(),
        "retired backend Sticky commands still exist at {}",
        backend_sticky_commands.display()
    );
}

#[test]
fn sticky_notes_json_is_never_modified() {
    // Given
    let manifest_directory = Path::new(env!("CARGO_MANIFEST_DIR"));
    let repository_root = manifest_directory
        .parent()
        .expect("src-tauri must have the repository root as its parent");
    let harness = repository_root
        .join(".omo/evidence/task-2-upmemo-reliability-migration/manual-data-surface-qa.ps1");

    // When
    let output = Command::new("pwsh.exe")
        .args(["-NoProfile", "-File"])
        .arg(&harness)
        .current_dir(repository_root)
        .output()
        .expect("PowerShell must launch the isolated Tauri tray QA harness");

    // Then
    assert!(
        output.status.success(),
        "Tauri tray QA failed. stdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}
