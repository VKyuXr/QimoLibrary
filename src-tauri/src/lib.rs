use tauri_plugin_dialog;
use tauri_plugin_fs;
use tauri_plugin_store::StoreBuilder;
use tauri::Manager;

mod models;
mod services;

use models::library::BookMetadata;
use services::library_service;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn initialize_library(path: String) -> Result<(), String> {
    library_service::initialize_library(path)
}

#[tauri::command]
async fn add_book_to_library(file_path: String, library_path: String) -> Result<BookMetadata, String> {
    library_service::add_book_to_library(file_path, library_path)
}

#[tauri::command]
async fn get_library_books(library_path: String) -> Result<Vec<BookMetadata>, String> {
    library_service::get_library_books(library_path)
}

#[tauri::command]
async fn set_library_path(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let store = StoreBuilder::new(&app_handle, "settings.json")
        .build()
        .map_err(|e| format!("创建store失败: {}", e))?;
    
    // 兼容旧版本：同时保存 library_path
    store.set("library_path", serde_json::json!(path));
    store.save().map_err(|e| format!("保存设置失败: {}", e))
}

#[tauri::command]
async fn save_libraries_config(app_handle: tauri::AppHandle, libraries: serde_json::Value, active_library_id: Option<String>) -> Result<(), String> {
    let store = StoreBuilder::new(&app_handle, "settings.json")
        .build()
        .map_err(|e| format!("创建store失败: {}", e))?;
    
    store.set("libraries", libraries);
    if let Some(id) = active_library_id {
        store.set("active_library_id", serde_json::json!(id));
    }
    
    store.save().map_err(|e| format!("保存设置失败: {}", e))
}

#[tauri::command]
async fn load_libraries_config(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let store = StoreBuilder::new(&app_handle, "settings.json")
        .build()
        .map_err(|e| format!("创建store失败: {}", e))?;
    
    let libraries = store.get("libraries").unwrap_or(serde_json::json!([]));
    let active_library_id = store.get("active_library_id");
    
    Ok(serde_json::json!({
        "libraries": libraries,
        "active_library_id": active_library_id
    }))
}

#[tauri::command]
async fn check_library_folder_status(library_path: String) -> Result<serde_json::Value, String> {
    use std::fs;
    use std::path::PathBuf;
    
    let path = PathBuf::from(&library_path);
    
    // 检查路径是否存在
    if !path.exists() {
        return Err("路径不存在".to_string());
    }
    
    // 检查是否是目录
    if !path.is_dir() {
        return Err("路径不是目录".to_string());
    }
    
    // 读取目录内容
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("读取目录失败: {}", e))?;
    
    let mut file_count = 0;
    let mut has_library_json = false;
    
    for entry in entries {
        if let Ok(entry) = entry {
            file_count += 1;
            let file_name = entry.file_name();
            let file_name_str = file_name.to_string_lossy();
            
            // 检查是否有 library.json 文件
            if file_name_str == "library.json" {
                has_library_json = true;
            }
        }
    }
    
    // 返回状态
    Ok(serde_json::json!({
        "is_empty": file_count == 0,
        "file_count": file_count,
        "has_library_json": has_library_json,
        "is_qimo_library": has_library_json
    }))
}

#[tauri::command]
async fn clear_folder(library_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::PathBuf;
    
    let path = PathBuf::from(&library_path);
    
    // 检查路径是否存在
    if !path.exists() {
        return Err("路径不存在".to_string());
    }
    
    // 检查是否是目录
    if !path.is_dir() {
        return Err("路径不是目录".to_string());
    }
    
    // 读取目录内容
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("读取目录失败: {}", e))?;
    
    // 删除所有文件和子目录
    for entry in entries {
        if let Ok(entry) = entry {
            let entry_path = entry.path();
            
            if entry_path.is_dir() {
                // 递归删除子目录
                fs::remove_dir_all(&entry_path)
                    .map_err(|e| format!("删除子目录失败 {}: {}", entry_path.display(), e))?;
            } else {
                // 删除文件
                fs::remove_file(&entry_path)
                    .map_err(|e| format!("删除文件失败 {}: {}", entry_path.display(), e))?;
            }
        }
    }
    
    println!("已清空文件夹: {}", library_path);
    Ok(())
}

#[tauri::command]
async fn get_library_path(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = StoreBuilder::new(&app_handle, "settings.json")
        .build()
        .map_err(|e| format!("创建store失败: {}", e))?;
    
    match store.get("library_path") {
        Some(serde_json::Value::String(path)) => Ok(Some(path.clone())),
        _ => Ok(None),
    }
}

#[tauri::command]
async fn delete_books_from_library(book_ids: Vec<String>, library_path: String) -> Result<(), String> {
    library_service::delete_books(book_ids, library_path)
}

#[tauri::command]
async fn update_book_metadata_command(
    book_id: String,
    library_path: String,
    title: String,
    author: String,
    publisher: Option<String>,
    description: Option<String>
) -> Result<models::library::BookMetadata, String> {
    library_service::update_book_metadata(book_id, library_path, title, author, publisher, description)
}

#[tauri::command]
async fn check_library_path_exists(library_path: String) -> Result<bool, String> {
    library_service::check_library_path_exists(library_path)
}

#[tauri::command]
async fn is_first_launch(app_handle: tauri::AppHandle) -> Result<bool, String> {
    use std::path::PathBuf;
    
    // 获取应用数据目录
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    
    // 检查配置文件是否存在
    let config_path = PathBuf::from(&app_data_dir).join("settings.json");
    
    if !config_path.exists() {
        // 配置文件不存在，说明是首次启动
        println!("首次启动：配置文件不存在");
        Ok(true)
    } else {
        // 配置文件存在，说明不是首次启动
        println!("非首次启动：配置文件已存在");
        Ok(false)
    }
}

#[tauri::command]
async fn reset_first_launch(app_handle: tauri::AppHandle) -> Result<(), String> {
    use std::path::PathBuf;
    use std::fs;
    
    // 获取应用数据目录
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    
    // 删除配置文件
    let config_path = PathBuf::from(&app_data_dir).join("settings.json");
    
    if config_path.exists() {
        fs::remove_file(&config_path)
            .map_err(|e| format!("删除配置文件失败: {}", e))?;
        println!("已删除配置文件: {:?}", config_path);
    } else {
        println!("配置文件不存在，无需删除");
    }
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            initialize_library,
            add_book_to_library,
            get_library_books,
            set_library_path,
            get_library_path,
            delete_books_from_library,
            update_book_metadata_command,
            check_library_path_exists,
            is_first_launch,
            reset_first_launch,
            save_libraries_config,
            load_libraries_config,
            check_library_folder_status,
            clear_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
