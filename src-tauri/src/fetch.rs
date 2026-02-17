use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct FetchResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FetchOptions {
    pub method: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
}

#[tauri::command]
pub async fn fetch_request(url: String, options: Option<FetchOptions>) -> Result<FetchResponse, String> {
    let client = reqwest::Client::new();
    
    // 设置默认选项
    let opts = options.unwrap_or(FetchOptions {
        method: Some("GET".to_string()),
        headers: None,
        body: None,
    });
    
    // 构建请求
    let method = opts.method.unwrap_or("GET".to_string());
    let mut request_builder = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        _ => return Err("Unsupported HTTP method".to_string()),
    };
    
    // 添加请求头
    if let Some(headers) = opts.headers {
        for (key, value) in headers {
            request_builder = request_builder.header(&key, &value);
        }
    }
    
    // 添加请求体
    if let Some(body) = opts.body {
        request_builder = request_builder.body(body);
    }
    
    // 发送请求
    match request_builder.send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            
            // 获取响应头
            let mut headers = HashMap::new();
            for (key, value) in response.headers() {
                if let Ok(value_str) = value.to_str() {
                    headers.insert(key.to_string(), value_str.to_string());
                }
            }
            
            // 获取响应体
            match response.text().await {
                Ok(body) => Ok(FetchResponse {
                    status,
                    headers,
                    body,
                }),
                Err(e) => Err(format!("Failed to read response body: {}", e)),
            }
        }
        Err(e) => Err(format!("Request failed: {}", e)),
    }
}

#[tauri::command]
pub async fn fetch_json(url: String, options: Option<FetchOptions>) -> Result<serde_json::Value, String> {
    let response = fetch_request(url, options).await?;
    
    match serde_json::from_str(&response.body) {
        Ok(json) => Ok(json),
        Err(e) => Err(format!("Failed to parse JSON: {}", e)),
    }
}
