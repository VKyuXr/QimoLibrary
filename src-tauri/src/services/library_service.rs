use std::fs;
use std::path::PathBuf;
use crate::models::library::{BookMetadata, LibraryConfig, BookEntry};
use crate::services::epub_parser;
use crate::db::{BookRepository, get_database};
use crate::db::models::Book;

/// 检查书库路径是否存在
pub fn check_library_path_exists(library_path: String) -> Result<bool, String> {
    let path = PathBuf::from(&library_path);
    Ok(path.exists())
}

pub fn initialize_library(library_path: String) -> Result<(), String> {
    let path = PathBuf::from(&library_path);
    
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    
    let config_path = path.join("library.json");
    if !config_path.exists() {
        let config = LibraryConfig {
            library_path: library_path.clone(),
            books: Vec::new(),
        };
        
        let json = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("序列化配置失败: {}", e))?;
        
        fs::write(&config_path, json)
            .map_err(|e| format!("写入配置文件失败: {}", e))?;
    }
    
    Ok(())
}

pub fn add_book_to_library(file_path: String, library_path: String) -> Result<BookMetadata, String> {
    let source_path = PathBuf::from(&file_path);
    
    if !source_path.exists() {
        return Err(format!("源文件不存在: {}", file_path));
    }
    
    let file_name = source_path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("无法获取文件名")?
        .to_string();
    
    let library_dir = PathBuf::from(&library_path);
    let book_folder = library_dir.join(&file_name);
    
    if book_folder.exists() {
        return Err(format!("书籍文件夹已存在: {}", file_name));
    }
    
    fs::create_dir_all(&book_folder)
        .map_err(|e| format!("创建书籍文件夹失败: {}", e))?;
    
    let dest_epub = book_folder.join(format!("{}.epub", file_name));
    fs::copy(&source_path, &dest_epub)
        .map_err(|e| format!("复制EPUB文件失败: {}", e))?;
    
    // 获取绝对路径用于前端读取
    let absolute_path = dest_epub.canonicalize()
        .map_err(|e| format!("获取绝对路径失败: {}", e))?
        .to_string_lossy()
        .to_string();
    
    println!("[INFO] New book raw path: {}", absolute_path);
    // 使用统一的路径规范化工具
    let clean_path = crate::utils::path_utils::normalize_windows_path(&absolute_path);
    println!("[INFO] New book cleaned path: {}", clean_path);
    
    // 提取EPUB元数据
    let epub_metadata = epub_parser::extract_epub_metadata(&source_path)
        .unwrap_or_else(|e| {
            println!("[WARN] Failed to extract EPUB metadata: {}", e);
            epub_parser::EpubMetadata {
                title: file_name.clone(),
                author: "未知作者".to_string(),
                publisher: None,
                description: None,
                cover_data: None,
                is_notebook: false,
            }
        });
    
    // 保存封面图片（如果有）
    let mut cover_path: Option<String> = None;
    if let Some(cover_data) = &epub_metadata.cover_data {
        let cover_filename = format!("{}.jpg", file_name);
        let cover_file_path = book_folder.join(&cover_filename);
        
        if fs::write(&cover_file_path, cover_data).is_ok() {
            cover_path = Some(cover_filename);
            println!("[INFO] Cover image saved: {:?}", cover_file_path);
        }
    }
    
    let now = chrono::Utc::now().to_rfc3339();
    let metadata = BookMetadata {
        id: uuid::Uuid::new_v4().to_string(),
        title: epub_metadata.title,
        author: epub_metadata.author,
        cover_path,
        progress: 0,
        last_read_time: None,
        description: epub_metadata.description,
        publisher: epub_metadata.publisher,
        added_time: now.clone(),
        file_path: Some(clean_path),
        is_notebook: epub_metadata.is_notebook,
        tags: Vec::new(),
    };
    
    let metadata_json = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("序列化元数据失败: {}", e))?;
    
    let metadata_path = book_folder.join("metadata.json");
    fs::write(&metadata_path, metadata_json)
        .map_err(|e| format!("写入元数据文件失败: {}", e))?;
    
    update_library_config(&library_path, &metadata.id, &file_name)?;
    
    // 同步到数据库（如果可用）
    if let Ok(db) = get_database() {
        let mut book: Book = metadata.clone().into();
        book.library_path = library_path.clone();
        book.folder_name = file_name.clone();
        if BookRepository::create(db, &book).is_ok() {
            println!("[INFO] Book synced to database: {}", metadata.id);
        }
    }
    
    Ok(metadata)
}

fn update_library_config(library_path: &str, book_id: &str, folder_name: &str) -> Result<(), String> {
    let config_path = PathBuf::from(library_path).join("library.json");
    
    let config_json = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    
    let mut config: LibraryConfig = serde_json::from_str(&config_json)
        .map_err(|e| format!("解析配置文件失败: {}", e))?;
    
    config.books.push(BookEntry {
        id: book_id.to_string(),
        book_folder_name: folder_name.to_string(),
    });
    
    let new_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化配置文件失败: {}", e))?;
    
    fs::write(&config_path, new_json)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    
    Ok(())
}

pub fn get_library_books(library_path: String) -> Result<Vec<BookMetadata>, String> {
    let config_path = PathBuf::from(&library_path).join("library.json");
    
    if !config_path.exists() {
        return Ok(Vec::new());
    }
    
    let config_json = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    
    let config: LibraryConfig = serde_json::from_str(&config_json)
        .map_err(|e| format!("解析配置文件失败: {}", e))?;
    
    // 尝试从数据库获取标签
    let db_tags = if let Ok(db) = get_database() {
        println!("[INFO] Database available, querying tags...");
        BookRepository::find_by_library(db, &library_path)
            .map(|books| {
                let tags_map: std::collections::HashMap<_, _> = books.into_iter()
                    .map(|b| {
                        println!("[DEBUG] Loaded book from DB: id={}, tags={:?}", b.id, b.tags);
                        (b.id.clone(), b.tags)
                    })
                    .collect();
                println!("[INFO] Total tags loaded from DB: {}", tags_map.len());
                tags_map
            })
            .unwrap_or_else(|e| {
                println!("[WARN] Failed to query tags from DB: {}", e);
                std::collections::HashMap::new()
            })
    } else {
        println!("[INFO] Database not available, skipping tag query");
        std::collections::HashMap::new()
    };
    
    let mut books = Vec::new();
    
    for entry in &config.books {
        let book_folder = PathBuf::from(&library_path).join(&entry.book_folder_name);
        let metadata_path = book_folder.join("metadata.json");
        
        if metadata_path.exists() {
            let metadata_json = fs::read_to_string(&metadata_path)
                .map_err(|e| format!("读取元数据文件失败: {}", e))?;
            
            let mut metadata: BookMetadata = serde_json::from_str(&metadata_json)
                .map_err(|e| format!("解析元数据失败: {}", e))?;
            
            // 自动修复：如果 file_path 为空，尝试根据文件名重建路径
            if metadata.file_path.is_none() || metadata.file_path.as_ref().unwrap().is_empty() {
                let epub_file = book_folder.join(format!("{}.epub", entry.book_folder_name));
                println!("[INFO] Reconstructing path for: {}", entry.book_folder_name);
                if epub_file.exists() {
                    if let Ok(absolute_path) = epub_file.canonicalize() {
                        let mut path_str = absolute_path.to_string_lossy().to_string();
                        println!("[DEBUG] Raw canonical path: {}", path_str);
                        // 使用统一的路径规范化工具
                        path_str = crate::utils::path_utils::normalize_windows_path(&path_str);
                        println!("[DEBUG] Cleaned path: {}", path_str);
                        metadata.file_path = Some(path_str);
                        
                        // 保存更新后的元数据
                        let updated_json = serde_json::to_string_pretty(&metadata)
                            .map_err(|e| format!("序列化元数据失败: {}", e))?;
                        fs::write(&metadata_path, updated_json)
                            .map_err(|e| format!("写入元数据文件失败: {}", e))?;
                    }
                } else {
                    println!("[WARN] EPUB file not found at: {:?}", epub_file);
                }
            } else {
                println!("[DEBUG] Existing path for {}: {}", entry.book_folder_name, metadata.file_path.as_ref().unwrap());
            }
            
            // 同步书籍到数据库（如果尚未存在）
            if let Ok(db) = get_database() {
                if BookRepository::find_by_id(db, &metadata.id).map_or(false, |opt| opt.is_none()) {
                    let mut book: Book = metadata.clone().into();
                    book.library_path = library_path.clone();
                    book.folder_name = entry.book_folder_name.clone();
                    if BookRepository::create(db, &book).is_ok() {
                        println!("[INFO] Book synced to database: {}", metadata.id);
                    }
                }
            }
            
            // 从数据库获取标签
            if let Some(tags) = db_tags.get(&metadata.id) {
                metadata.tags = tags.clone();
            }
            
            books.push(metadata);
        }
    }
    
    Ok(books)
}

pub fn delete_books(book_ids: Vec<String>, library_path: String) -> Result<(), String> {
    let config_path = PathBuf::from(&library_path).join("library.json");
    
    if !config_path.exists() {
        return Err("配置文件不存在".to_string());
    }
    
    let config_json = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    
    let mut config: LibraryConfig = serde_json::from_str(&config_json)
        .map_err(|e| format!("解析配置文件失败: {}", e))?;
    
    // 找到需要删除的书籍条目，克隆数据避免借用问题
    let books_to_delete: Vec<BookEntry> = config.books.iter()
        .filter(|entry| book_ids.contains(&entry.id))
        .cloned()
        .collect();
    
    let deleted_count = books_to_delete.len();
    
    // 删除书籍文件夹
    for entry in &books_to_delete {
        let book_folder = PathBuf::from(&library_path).join(&entry.book_folder_name);
        if book_folder.exists() {
            fs::remove_dir_all(&book_folder)
                .map_err(|e| format!("删除书籍文件夹失败 {}: {}", entry.book_folder_name, e))?;
            println!("[INFO] Deleted book folder: {:?}", book_folder);
        }
    }
    
    // 从数据库删除书籍记录
    if let Ok(db) = get_database() {
        for book_id in &book_ids {
            if BookRepository::delete(db, book_id).is_ok() {
                println!("[INFO] Deleted book from database: {}", book_id);
            }
        }
    }
    
    // 从配置中移除这些书籍
    config.books.retain(|entry| !book_ids.contains(&entry.id));
    
    // 保存更新后的配置
    let new_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    
    fs::write(&config_path, new_json)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    
    println!("[INFO] Deleted {} books", deleted_count);
    
    Ok(())
}

pub fn update_book_metadata(book_id: String, library_path: String, title: String, author: String, publisher: Option<String>, description: Option<String>) -> Result<BookMetadata, String> {
    let config_path = PathBuf::from(&library_path).join("library.json");
    
    if !config_path.exists() {
        return Err("配置文件不存在".to_string());
    }
    
    let config_json = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    
    let config: LibraryConfig = serde_json::from_str(&config_json)
        .map_err(|e| format!("解析配置文件失败: {}", e))?;
    
    // 找到对应的书籍条目
    let book_entry = config.books.iter()
        .find(|entry| entry.id == book_id)
        .ok_or("未找到书籍")?;
    
    let book_folder = PathBuf::from(&library_path).join(&book_entry.book_folder_name);
    let metadata_path = book_folder.join("metadata.json");
    
    if !metadata_path.exists() {
        return Err("元数据文件不存在".to_string());
    }
    
    // 读取现有元数据
    let metadata_json = fs::read_to_string(&metadata_path)
        .map_err(|e| format!("读取元数据文件失败: {}", e))?;
    
    let mut metadata: BookMetadata = serde_json::from_str(&metadata_json)
        .map_err(|e| format!("解析元数据失败: {}", e))?;
    
    // 保存参数值用于后续数据库同步
    let title_value = title.clone();
    let author_value = author.clone();
    let publisher_value = publisher.clone();
    let description_value = description.clone();
    
    // 更新字段
    metadata.title = title;
    metadata.author = author;
    metadata.publisher = publisher;
    metadata.description = description;
    
    // 保存更新后的元数据
    let updated_json = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("序列化元数据失败: {}", e))?;
    
    fs::write(&metadata_path, updated_json)
        .map_err(|e| format!("写入元数据文件失败: {}", e))?;
    
    println!("[INFO] Updated metadata for book: {}", book_id);
    
    // 同步更新到数据库
    if let Ok(db) = get_database() {
        if let Some(mut book) = BookRepository::find_by_id(db, &book_id).ok().flatten() {
            book.title = title_value;
            book.author = author_value;
            book.publisher = publisher_value;
            book.description = description_value;
            if BookRepository::update(db, &book).is_ok() {
                println!("[INFO] Synced metadata to database for book: {}", book_id);
            }
        }
    }
    
    Ok(metadata)
}
