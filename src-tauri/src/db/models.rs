use serde::{Deserialize, Serialize};
use chrono::Utc;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Book {
    pub id: String,
    pub title: String,
    pub author: String,
    pub cover_path: Option<String>,
    pub progress: u32,
    pub last_read_time: Option<String>,
    pub description: Option<String>,
    pub publisher: Option<String>,
    pub added_time: String,
    pub file_path: Option<String>,
    pub is_notebook: bool,
    pub library_path: String,
    pub folder_name: String,
    pub tags: Vec<String>,
}

impl From<crate::models::library::BookMetadata> for Book {
    fn from(metadata: crate::models::library::BookMetadata) -> Self {
        Book {
            id: metadata.id,
            title: metadata.title,
            author: metadata.author,
            cover_path: metadata.cover_path,
            progress: metadata.progress,
            last_read_time: metadata.last_read_time,
            description: metadata.description,
            publisher: metadata.publisher,
            added_time: metadata.added_time,
            file_path: metadata.file_path,
            is_notebook: metadata.is_notebook,
            library_path: String::new(),
            folder_name: String::new(),
            tags: Vec::new(),
        }
    }
}

impl Book {
    pub fn new(
        title: String,
        author: String,
        library_path: String,
        folder_name: String,
    ) -> Self {
        let now = Utc::now().to_rfc3339();
        Book {
            id: Uuid::new_v4().to_string(),
            title,
            author,
            cover_path: None,
            progress: 0,
            last_read_time: None,
            description: None,
            publisher: None,
            added_time: now.clone(),
            file_path: None,
            is_notebook: false,
            library_path,
            folder_name,
            tags: Vec::new(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: String,
}

impl Tag {
    pub fn new(name: String, color: Option<String>) -> Self {
        Tag {
            id: Uuid::new_v4().to_string(),
            name,
            color: color.unwrap_or_else(|| "#667eea".into()),
            created_at: Utc::now().to_rfc3339(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Annotation {
    pub id: String,
    pub book_id: String,
    pub cfi: String,
    pub text: String,
    pub note: Option<String>,
    pub color: String,
    pub created_at: String,
}

impl Annotation {
    pub fn new(book_id: String, cfi: String, text: String) -> Self {
        Annotation {
            id: Uuid::new_v4().to_string(),
            book_id,
            cfi,
            text,
            note: None,
            color: "#ffeb3b".into(),
            created_at: Utc::now().to_rfc3339(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ReadingHistory {
    pub id: String,
    pub book_id: String,
    pub progress: u32,
    pub read_at: String,
}

impl ReadingHistory {
    pub fn new(book_id: String, progress: u32) -> Self {
        ReadingHistory {
            id: Uuid::new_v4().to_string(),
            book_id,
            progress,
            read_at: Utc::now().to_rfc3339(),
        }
    }
}
