use base64::Engine;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

use crate::fs_helper::{read_folder_files, read_folder_folders};

#[tauri::command]
pub fn delete_wallpaper_shader(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Err(format!("File not found: {}", path));
    }

    fs::remove_file(&path_buf).map_err(|e| format!("Failed to delete file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn read_wallpaper_shader() -> Result<Vec<String>, String> {
    // 获取可执行文件所在目录
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .parent()
        .ok_or_else(|| "Failed to get parent directory".to_string())?
        .to_path_buf();

    // 构建 wallpaper_static 目录路径
    let wallpaper_dir = exe_dir.join("wallpaper_shader");

    // 使用 fs_helper 中的函数读取文件夹列表（
    let folders = read_folder_folders(wallpaper_dir.to_string_lossy().to_string())?;

    Ok(folders)
}

#[tauri::command]
pub fn save_wallpaper_shader(
    folder_name: String,
    glsl: String,
    thumbnail: String,
) -> Result<String, String> {
    // 获取当前可执行文件所在目录
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .parent()
        .ok_or_else(|| "Failed to get parent directory".to_string())?
        .to_path_buf();

    // 创建 wallpaper_shader 目录
    let base_dir = exe_dir.join("wallpaper_shader").join(folder_name);

    // 如果目录已存在，先删除旧的文件，确保覆盖
    if base_dir.exists() {
        fs::remove_dir_all(&base_dir)
            .map_err(|e| format!("Failed to remove existing directory: {}", e))?;
    }

    fs::create_dir_all(&base_dir).map_err(|e| format!("Failed to create base directory: {}", e))?;

    let glsl_path = base_dir.join("shader.glsl");
    fs::write(&glsl_path, glsl).map_err(|e| format!("Failed to save glsl: {}", e))?;

    let base64 = base_dir.join("base64.txt");
    fs::write(&base64, &thumbnail).map_err(|e| format!("Failed to save base64: {}", e))?;

    // 解码 base64 并保存为 PNG 文件
    let thumbnail_path = base_dir.join("thumbnail.png");
    let thumbnail_bytes = base64::engine::general_purpose::STANDARD
        .decode(&thumbnail)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    fs::write(&thumbnail_path, thumbnail_bytes)
        .map_err(|e| format!("Failed to save thumbnail: {}", e))?;

    glsl_path
        .to_str()
        .ok_or_else(|| "Invalid path".to_string())
        .map(|s| s.to_string())
}
