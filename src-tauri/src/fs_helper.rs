use std::fs;
use std::process::Command;

#[tauri::command]
pub fn open_folder(path: String) -> Result<String, String> {
    // 获取 resource 目录路径
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .parent()
        .ok_or_else(|| "Failed to get parent directory".to_string())?
        .to_path_buf();

    let resource_dir = exe_dir.join(path);

    // 确保目录存在
    fs::create_dir_all(&resource_dir)
        .map_err(|e| format!("Failed to create resource directory: {}", e))?;

    // 根据不同平台打开文件夹
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&resource_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&resource_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&resource_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(format!("Opened folder: {}", resource_dir.display()))
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<String, String> {
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .parent()
        .ok_or_else(|| "Failed to get parent directory".to_string())?
        .to_path_buf();

    let target_path = exe_dir.join(path);

    std::fs::write(&target_path, &content).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok("File written successfully".to_string())
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .parent()
        .ok_or_else(|| "Failed to get parent directory".to_string())?
        .to_path_buf();

    let target_path = exe_dir.join(path);

    let content =
        std::fs::read_to_string(&target_path).map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(content)
}

#[tauri::command]
pub fn read_folder_files(path: String) -> Result<Vec<String>, String> {
    // 确保目录存在
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create wallpaper_static directory: {}", e))?;

    // 读取目录中的文件
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read wallpaper_static directory: {}", e))?;

    let mut files = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        // let file_name = entry.file_name();

        // 只处理文件，跳过目录
        if path.is_file() {
            if let Some(path_str) = path.to_str() {
                files.push(path_str.to_string());
            }
        }
    }

    // 按文件名排序
    files.sort();

    Ok(files)
}
