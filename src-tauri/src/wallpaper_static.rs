use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

use crate::fs_helper::read_folder_files;

#[tauri::command]
pub fn delete_wallpaper_static(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Err(format!("File not found: {}", path));
    }

    fs::remove_file(&path_buf).map_err(|e| format!("Failed to delete file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn read_wallpaper_static() -> Result<Vec<String>, String> {
    // 获取可执行文件所在目录
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .parent()
        .ok_or_else(|| "Failed to get parent directory".to_string())?
        .to_path_buf();

    // 构建 wallpaper_static 目录路径
    let wallpaper_dir = exe_dir.join("wallpaper_static");

    // 使用 fs_helper 中的函数读取文件列表（已包含图片过滤和排序）
    let files = read_folder_files(wallpaper_dir.to_string_lossy().to_string())?;

    let mut images = Vec::new();

    for file in &files {
        let ext = PathBuf::from(file)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_lowercase();
        if ext != "jpg" && ext != "jpeg" && ext != "png" && ext != "gif" {
            println!("Skipping non-image file: {}", file);
            continue; // 跳过非图片文件
        }

        images.push(file.clone());
    }

    Ok(images)
}

#[tauri::command]
pub fn copy_wallpaper_to_wallpaper_static(path: String) -> Result<String, String> {
    // 获取当前可执行文件所在目录
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .parent()
        .ok_or_else(|| "Failed to get parent directory".to_string())?
        .to_path_buf();

    // 创建 wallpaper_static 目录
    let resource_dir = exe_dir.join("wallpaper_static");
    fs::create_dir_all(&resource_dir)
        .map_err(|e| format!("Failed to create resource directory: {}", e))?;

    let pa = PathBuf::from(&path);
    let file_name = pa
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid file name".to_string())?;

    let dest_path = resource_dir.join(file_name);

    fs::copy(&path, &dest_path).map_err(|e| format!("Failed to copy image: {}", e))?;

    Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn set_static_wallpaper_from_url(
    app: tauri::AppHandle,
    url: String,
) -> Result<String, String> {
    // 检查并关闭 background 窗口
    if let Some(window) = app.get_webview_window("background") {
        println!("Closing background window before setting static wallpaper");
        window
            .close()
            .map_err(|e| format!("Failed to close background window: {}", e))?;
    }

    // 下载图片
    let image_data = download_image(&url).await?;

    // 保存到应用 resource 文件夹
    let file_name = format!("wallpaper_{}.jpg", chrono::Utc::now().timestamp());
    // let file_name = "wallpaper_temp.jpg".to_string();
    let temp_path = save_temp_image(&image_data, file_name)?;

    // 设置壁纸
    set_wallpaper(&temp_path)?;

    Ok(temp_path)
}

#[tauri::command]
pub fn set_static_wallpaper_from_path(
    app: tauri::AppHandle,
    path: String,
) -> Result<String, String> {
    // 检查并关闭 background 窗口
    if let Some(window) = app.get_webview_window("background") {
        println!("Closing background window before setting static wallpaper");
        window
            .close()
            .map_err(|e| format!("Failed to close background window: {}", e))?;
    }

    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Err(format!("File not found: {}", path));
    }

    set_wallpaper(&path)?;

    Ok(format!("Wallpaper set successfully from: {}", path))
}

async fn download_image(url: &str) -> Result<Vec<u8>, String> {
    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Failed to download image: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download image: HTTP {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image data: {}", e))?;

    Ok(bytes.to_vec())
}

fn save_temp_image(data: &[u8], file_name: String) -> Result<String, String> {
    // 获取当前可执行文件所在目录
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .parent()
        .ok_or_else(|| "Failed to get parent directory".to_string())?
        .to_path_buf();

    // 创建 wallpaper_static 目录
    let resource_dir = exe_dir.join("temp");
    fs::create_dir_all(&resource_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    let image_path = resource_dir.join(file_name);

    fs::write(&image_path, data).map_err(|e| format!("Failed to save image: {}", e))?;

    image_path
        .to_str()
        .ok_or_else(|| "Invalid path".to_string())
        .map(|s| s.to_string())
}

fn set_wallpaper(path: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        set_wallpaper_macos(path)
    }

    #[cfg(target_os = "windows")]
    {
        set_wallpaper_windows(path)
    }

    #[cfg(target_os = "linux")]
    {
        set_wallpaper_linux(path)
    }
}

#[cfg(target_os = "macos")]
fn set_wallpaper_macos(path: &str) -> Result<(), String> {
    let script = format!(
        r#"tell application "System Events" to tell every desktop to set picture to "{}""#,
        path
    );

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to execute osascript: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to set wallpaper: {}", error));
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn set_wallpaper_windows(path: &str) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    let wide_path: Vec<u16> = OsStr::new(path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let result = winapi::um::winuser::SystemParametersInfoW(
            winapi::um::winuser::SPI_SETDESKWALLPAPER,
            0,
            wide_path.as_ptr() as *mut _,
            winapi::um::winuser::SPIF_UPDATEINIFILE | winapi::um::winuser::SPIF_SENDCHANGE,
        );

        if result == 0 {
            return Err("Failed to set wallpaper on Windows".to_string());
        }
    }

    Ok(())
}

#[cfg(target_os = "linux")]
fn set_wallpaper_linux(path: &str) -> Result<(), String> {
    // 尝试使用 gsettings (GNOME)
    let output = Command::new("gsettings")
        .args(&[
            "set",
            "org.gnome.desktop.background",
            "picture-uri",
            &format!("file://{}", path),
        ])
        .output();

    if let Ok(output) = output {
        if output.status.success() {
            return Ok(());
        }
    }

    // 尝试使用 feh (通用)
    let output = Command::new("feh").args(&["--bg-scale", path]).output();

    if let Ok(output) = output {
        if output.status.success() {
            return Ok(());
        }
    }

    Err("Failed to set wallpaper on Linux. Please install gsettings or feh.".to_string())
}
