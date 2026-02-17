


use crate::fs_helper::{read_file,write_file};

#[tauri::command]
pub fn read_config() -> Result<String, String> {
    let config = read_file("config.json".to_string());
    match config {
        Ok(content) => Ok(content),
        Err(_) => {
            let _result = write_file("config.json".to_string(), "{}".to_string());
            Ok("{}".to_string())
        }
    }
}

#[tauri::command]
pub fn set_config(content: String) -> Result<String, String> {
    let config = write_file("config.json".to_string(),content);
    match config {
        Ok(content) => Ok(content),
        Err(_) => {
            let _result =  write_file("config.json".to_string(), "{}".to_string());
            Ok("{}".to_string())
        }
    }
}

