// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod config;
mod fetch;
pub mod fs_helper;
mod tool;
mod wallpaper_animation;
mod wallpaper_html;
mod wallpaper_shader;
mod wallpaper_static;

use config::{read_config, set_config};
use fetch::{fetch_json, fetch_request};
use fs_helper::{open_folder, read_file};
use tool::{get_system_stats, open_executable};

use wallpaper_animation::{create_animation_wallpaper, destroy_animation_wallpaper};
use wallpaper_html::{
    delete_wallpaper_html, read_wallpaper_html, read_wallpaper_html_file, save_wallpaper_html,
    write_wallpaper_html_file,
};
use wallpaper_shader::{delete_wallpaper_shader, read_wallpaper_shader, save_wallpaper_shader};
use wallpaper_static::{
    copy_wallpaper_to_wallpaper_static, delete_wallpaper_static, read_wallpaper_static,
    set_static_wallpaper_from_path, set_static_wallpaper_from_url,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            // 自动创建动态壁纸窗口
            // match create_animation_window(&app.handle()) {
            //     Ok(_) => println!("Animation wallpaper window created on startup"),
            //     Err(e) => eprintln!("Failed to create animation wallpaper window: {}", e),
            // }

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            //fetch
            fetch_request,
            fetch_json,
            //file
            open_folder,
            read_file,
            //config
            read_config,
            set_config,
            // wallpaper_static
            set_static_wallpaper_from_url,
            set_static_wallpaper_from_path,
            copy_wallpaper_to_wallpaper_static,
            read_wallpaper_static,
            delete_wallpaper_static,
            // wallpaper_shader
            read_wallpaper_shader,
            delete_wallpaper_shader,
            save_wallpaper_shader,
            // wallpaper_html
            read_wallpaper_html,
            delete_wallpaper_html,
            save_wallpaper_html,
            read_wallpaper_html_file,
            write_wallpaper_html_file,
            // wallpaper_animation:shader
            create_animation_wallpaper,
            destroy_animation_wallpaper,
            // tool
            get_system_stats,
            open_executable
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
