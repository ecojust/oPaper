// 动态壁纸窗口管理模块

use tauri::Manager;

/// 读取配置文件获取mode参数
fn get_config_mode() -> String {
    // 尝试读取配置文件
    let config = std::fs::read_to_string("config.json");
    match config {
        Ok(content) => {
            // 尝试解析JSON获取mode字段
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(mode) = json.get("mode").and_then(|v| v.as_str()) {
                    return mode.to_string();
                }
            }
            "static".to_string()
        }
        Err(_) => "static".to_string(),
    }
}

#[cfg(target_os = "windows")]
pub fn set_window_to_desktop(
    window: &tauri::WebviewWindow,
) -> Result<(), Box<dyn std::error::Error>> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use winapi::shared::minwindef::LPARAM;
    use winapi::um::winuser::{FindWindowW, SendMessageW, SetParent};

    let mode = get_config_mode();
    println!("Windows: Config mode = {}", mode);

    let hwnd = window.hwnd()?;
    let hwnd = hwnd.0 as winapi::shared::windef::HWND;

    unsafe {
        // 查找 Progman 窗口
        let progman: Vec<u16> = OsStr::new("Progman")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let progman_hwnd = FindWindowW(progman.as_ptr(), std::ptr::null());

        if !progman_hwnd.is_null() {
            // 发送消息激活 WorkerW 窗口（桌面图标的父窗口）
            SendMessageW(
                progman_hwnd,
                0x052C, // WM_SPAWN_WORKER
                0,
                0 as LPARAM,
            );

            // 查找 WorkerW 窗口（在桌面图标下方）
            let mut workerw_hwnd: winapi::shared::windef::HWND = std::ptr::null_mut();
            winapi::um::winuser::EnumWindows(
                Some(enum_windows_callback),
                &mut workerw_hwnd as *mut _ as isize,
            );

            // 如果找到 WorkerW，将窗口设置为其子窗口，否则使用 Progman
            let parent = if !workerw_hwnd.is_null() {
                workerw_hwnd
            } else {
                progman_hwnd
            };

            SetParent(hwnd, parent);
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn enum_windows_callback(
    hwnd: winapi::shared::windef::HWND,
    lparam: isize,
) -> i32 {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use winapi::um::winuser::{FindWindowExW, GetWindow};

    let shelldll: Vec<u16> = OsStr::new("SHELLDLL_DefView")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let shelldll_hwnd = FindWindowExW(
        hwnd,
        std::ptr::null_mut(),
        shelldll.as_ptr(),
        std::ptr::null(),
    );

    if !shelldll_hwnd.is_null() {
        // 找到包含 SHELLDLL_DefView 的 WorkerW
        let workerw = GetWindow(hwnd, 3); // GW_HWNDNEXT
        if !workerw.is_null() {
            *(lparam as *mut winapi::shared::windef::HWND) = workerw;
            return 0; // 停止枚举
        }
    }

    1 // 继续枚举
}

#[cfg(target_os = "macos")]
pub fn set_window_to_desktop(
    window: &tauri::WebviewWindow,
) -> Result<(), Box<dyn std::error::Error>> {
    use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
    use cocoa::base::{id, NO, YES};
    use cocoa::foundation::NSInteger;

    let mode = get_config_mode();
    println!("macOS: Config mode = {}", mode);

    let ns_window = window.ns_window()? as id;

    unsafe {
        if mode == "html" {
            // HTML 模式：置顶，不忽略鼠标事件
            let desktop_top_level: NSInteger = -2147483648 + 30 + 100;
            ns_window.setLevel_(desktop_top_level);

            println!(
                "macOS: HTML mode - Set window level to {}",
                desktop_top_level
            );

            // 设置窗口行为（不过滤鼠标事件）
            let collection_behavior =
                NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
                    | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
                    | NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle;
            ns_window.setCollectionBehavior_(collection_behavior);

            // 禁用窗口阴影
            ns_window.setHasShadow_(NO);

            // 不忽略鼠标事件（允许交互）
            ns_window.setIgnoresMouseEvents_(NO);

            // 设置窗口透明度
            ns_window.setOpaque_(YES);
            ns_window.setAlphaValue_(1.0);
        } else {
            // Shader 或其他模式：置底，忽略鼠标事件
            // 设置窗口层级到桌面级别
            let desktop_level: NSInteger = -2147483648 + 30;
            ns_window.setLevel_(desktop_level);

            println!("macOS: Shader mode - Set window level to {}", desktop_level);

            // 设置窗口行为
            let collection_behavior =
                NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
                    | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
                    | NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle;
            ns_window.setCollectionBehavior_(collection_behavior);

            // 禁用窗口阴影
            ns_window.setHasShadow_(NO);

            // 忽略鼠标事件
            ns_window.setIgnoresMouseEvents_(YES);

            // 设置窗口透明度
            ns_window.setOpaque_(YES);
            ns_window.setAlphaValue_(1.0);
        }
    }

    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn set_window_to_desktop(
    _window: &tauri::WebviewWindow,
) -> Result<(), Box<dyn std::error::Error>> {
    Err("Platform not supported".into())
}

/// 创建动态壁纸窗口
pub fn create_animation_window(
    app: &tauri::AppHandle,
) -> Result<tauri::WebviewWindow, Box<dyn std::error::Error>> {
    // 获取主显示器尺寸
    let monitor = app.primary_monitor()?.ok_or("No primary monitor found")?;
    let screen_size = monitor.size();
    let scale_factor = monitor.scale_factor();

    // 物理像素尺寸
    let physical_width = screen_size.width as f64;
    let physical_height = screen_size.height as f64;

    // 逻辑像素尺寸（除以缩放因子）
    let logical_width = physical_width / scale_factor;
    let logical_height = physical_height / scale_factor;

    println!("Physical size: {}x{}", physical_width, physical_height);
    println!("Scale factor: {}", scale_factor);
    println!("Logical size: {}x{}", logical_width, logical_height);

    // 创建 background 窗口，使用逻辑尺寸
    let url = format!("index.html/#/background");
    let background_window =
        tauri::WebviewWindowBuilder::new(app, "background", tauri::WebviewUrl::App(url.into()))
            .title("background")
            .position(0.0, 0.0)
            .inner_size(logical_width, logical_height)
            .decorations(false)
            .skip_taskbar(true)
            .focused(false)
            .visible(true)
            .build()?;

    println!("Background window created successfully");

    // 将 background 窗口挂载到桌面
    match set_window_to_desktop(&background_window) {
        Ok(_) => println!("Window set to desktop successfully"),
        Err(e) => eprintln!("Failed to set window to desktop: {}", e),
    }

    println!("Background window setup completed");

    Ok(background_window)
}

/// Tauri 命令：初始化动态壁纸
#[tauri::command]
pub async fn create_animation_wallpaper(app: tauri::AppHandle) -> Result<String, String> {
    // 如果已存在 background 窗口，先关闭它
    if let Some(window) = app.get_webview_window("background") {
        // window
        //     .close()
        //     .map_err(|e| format!("Failed to close window: {}", e))?;
        window
            .reload()
            .map_err(|e| format!("Failed to reload window: {}", e))?;
        Ok("The background window reloaded successfully".to_string())
    } else {
        println!("No existing background window found, creating a new one");
        // 创建新窗口
        match create_animation_window(&app) {
            Ok(_) => Ok("Animation wallpaper initialized successfully".to_string()),
            Err(e) => Err(format!("Failed to initialize animation wallpaper: {}", e)),
        }
    }
}

/// Tauri 命令：销毁动态壁纸窗口
#[tauri::command]
pub fn destroy_animation_wallpaper(app: tauri::AppHandle) -> Result<String, String> {
    if let Some(window) = app.get_webview_window("background") {
        window
            .close()
            .map_err(|e| format!("Failed to close window: {}", e))?;
        Ok("Animation wallpaper destroyed successfully".to_string())
    } else {
        Err("Background window not found".to_string())
    }
}

// #[cfg(target_os = "macos")]
// #[tauri::command]
// pub fn set_window_level(window: tauri::Window, level: i64) -> Result<String, String> {
//     use cocoa::appkit::NSWindow;
//     use cocoa::base::id;

//     let ns_window = window.ns_window().map_err(|e| e.to_string())? as id;

//     unsafe {
//         ns_window.setLevel_(level);
//     }

//     Ok(format!("Window level set to {}", level))
// }

// #[cfg(not(target_os = "macos"))]
// #[tauri::command]
// pub fn set_window_level(_window: tauri::Window, _level: i64) -> Result<String, String> {
//     Ok("Not supported on this platform".to_string())
// }
