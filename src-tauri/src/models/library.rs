use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BookMetadata {
    pub id: String,
    pub title: String,
    pub author: String,
    pub cover_path: Option<String>,
    pub progress: u32,
    pub last_read_time: Option<String>,
    pub description: Option<String>,
    pub publisher: Option<String>,
    pub added_time: String,
    pub file_path: Option<String>, // 存储 EPUB 文件的相对或绝对路径
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LibraryConfig {
    pub library_path: String,
    pub books: Vec<BookEntry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BookEntry {
    pub id: String,
    pub book_folder_name: String,
}
