use std::fs;
use std::path::PathBuf;

use base64::Engine;

use crate::fs_helper::read_folder_folders;

/// 删除 HTML 壁纸文件夹
#[tauri::command]
pub fn delete_wallpaper_html(folder: String) -> Result<(), String> {
    // 获取 appdata 目录下的 oPaper 路径
    let base_dir = dirs::data_dir()
        .ok_or("Failed to get data directory")?
        .join("oPaper");

    // 构建 wallpaper_html 目录路径
    let wallpaper_dir = base_dir.join("wallpaper_html").join(&folder);

    if !wallpaper_dir.exists() {
        return Err(format!("Folder not found: {}", folder));
    }

    fs::remove_dir_all(&wallpaper_dir).map_err(|e| format!("Failed to delete folder: {}", e))?;

    Ok(())
}

/// 读取本地 HTML 壁纸文件夹列表
#[tauri::command]
pub fn read_wallpaper_html() -> Result<Vec<String>, String> {
    // 获取 appdata 目录下的 oPaper 路径
    let base_dir = dirs::data_dir()
        .ok_or("Failed to get data directory")?
        .join("oPaper");

    // 构建 wallpaper_html 目录路径
    let wallpaper_dir = base_dir.join("wallpaper_html");

    // 确保目录存在
    if !wallpaper_dir.exists() {
        fs::create_dir_all(&wallpaper_dir)
            .map_err(|e| format!("Failed to create wallpaper_html directory: {}", e))?;
        return Ok(vec![]);
    }

    // 使用 fs_helper 中的函数读取文件夹列表
    let folders = read_folder_folders(wallpaper_dir.to_string_lossy().to_string())?;

    Ok(folders)
}

/// 读取 HTML 文件内容
#[tauri::command]
pub fn read_wallpaper_html_file(folder_path: String) -> Result<String, String> {
    // 获取 appdata 目录下的 oPaper 路径
    let base_dir = dirs::data_dir()
        .ok_or("Failed to get data directory")?
        .join("oPaper");

    // 构建完整的文件路径
    let file_path = base_dir.join(&folder_path).join("index.html");

    // 读取文件内容
    let content =
        fs::read_to_string(&file_path).map_err(|e| format!("Failed to read HTML file: {}", e))?;

    Ok(content)
}

/// 写入 HTML 文件内容
#[tauri::command]
pub fn write_wallpaper_html_file(folder_path: String, html: String) -> Result<(), String> {
    // 获取 appdata 目录下的 oPaper 路径
    let base_dir = dirs::data_dir()
        .ok_or("Failed to get data directory")?
        .join("oPaper");

    // 构建完整的文件路径
    let file_path = base_dir.join(&folder_path).join("index.html");

    // 写入文件内容
    fs::write(&file_path, html).map_err(|e| format!("Failed to write HTML file: {}", e))?;

    Ok(())
}

/// 保存 HTML 壁纸
#[tauri::command]
pub fn save_wallpaper_html(
    folder_name: String,
    html: String,
    thumbnail: Option<String>,
) -> Result<String, String> {
    // 获取 appdata 目录下的 oPaper 路径
    let base_dir = dirs::data_dir()
        .ok_or("Failed to get data directory")?
        .join("oPaper");

    // 创建 wallpaper_html 目录
    let path = base_dir.join("wallpaper_html").join(&folder_name);

    // 如果目录已存在，先删除旧的文件，确保覆盖
    if path.exists() {
        fs::remove_dir_all(&path)
            .map_err(|e| format!("Failed to remove existing directory: {}", e))?;
    }

    fs::create_dir_all(&path).map_err(|e| format!("Failed to create directory: {}", e))?;

    // 写入 index.html 文件
    let html_path = path.join("index.html");
    fs::write(&html_path, html).map_err(|e| format!("Failed to write HTML file: {}", e))?;

    // 保存缩略图
    let thumbnail_path = path.join("thumbnail.png");
    match thumbnail {
        Some(thumb) if !thumb.is_empty() => {
            // 解码 base64 并保存为 PNG 文件
            let thumbnail_bytes = base64::engine::general_purpose::STANDARD
                .decode(&thumb)
                .map_err(|e| format!("Failed to decode base64: {}", e))?;
            fs::write(&thumbnail_path, thumbnail_bytes)
                .map_err(|e| format!("Failed to write thumbnail: {}", e))?;
        }
        _ => {
            // 使用默认缩略图
            let default_thumbnail = create_default_thumbnail();
            fs::write(&thumbnail_path, default_thumbnail)
                .map_err(|e| format!("Failed to write thumbnail: {}", e))?;
        }
    }

    Ok(path.to_string_lossy().to_string())
}

/// 创建默认缩略图 (1x1 像素的 PNG，紫色背景)
fn create_default_thumbnail() -> Vec<u8> {
    // 这是一个最小的 1x1 紫色 PNG 图片
    // PNG 文件头 + IHDR + IDAT + IEND
    let png_data: Vec<u8> = vec![
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, // IHDR length
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x01, // width: 1
        0x00, 0x00, 0x00, 0x01, // height: 1
        0x08, 0x02, // bit depth: 8, color type: 2 (RGB)
        0x00, 0x00, 0x00, // compression, filter, interlace
        0x90, 0x77, 0x53, 0xDE, // CRC
        0x00, 0x00, 0x00, 0x0C, // IDAT length
        0x49, 0x44, 0x41, 0x54, // IDAT
        0x08, 0xD7, 0x63, 0xA8, 0x64, 0x5C, 0x00, 0x00, 0x00, 0x83, 0x00,
        0x81, // compressed data
        0x25, 0xA4, 0xBE, 0x4B, // CRC
        0x00, 0x00, 0x00, 0x00, // IEND length
        0x49, 0x45, 0x4E, 0x44, // IEND
        0xAE, 0x42, 0x60, 0x82, // CRC
    ];
    png_data
}
