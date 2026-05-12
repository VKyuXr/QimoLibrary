use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use once_cell::sync::OnceCell;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DatabaseError {
    #[error("数据库连接错误: {0}")]
    Connection(#[from] rusqlite::Error),
    #[error("路径错误: {0}")]
    Path(String),
    #[error("初始化错误: {0}")]
    Init(String),
}

type Result<T> = std::result::Result<T, DatabaseError>;

pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        let db = Database {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.initialize_tables()?;
        Ok(db)
    }

    fn initialize_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute(
            "CREATE TABLE IF NOT EXISTS books (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                cover_path TEXT,
                progress INTEGER DEFAULT 0,
                last_read_time TEXT,
                description TEXT,
                publisher TEXT,
                added_time TEXT NOT NULL,
                file_path TEXT,
                is_notebook INTEGER DEFAULT 0,
                library_path TEXT NOT NULL,
                folder_name TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                color TEXT DEFAULT '#667eea',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS book_tags (
                book_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY (book_id, tag_id),
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS reading_history (
                id TEXT PRIMARY KEY,
                book_id TEXT NOT NULL,
                progress INTEGER NOT NULL,
                read_at TEXT NOT NULL,
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS annotations (
                id TEXT PRIMARY KEY,
                book_id TEXT NOT NULL,
                cfi TEXT NOT NULL,
                text TEXT NOT NULL,
                note TEXT,
                color TEXT DEFAULT '#ffeb3b',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
            )",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_books_library ON books(library_path)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_books_title ON books(title)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_books_author ON books(author)",
            [],
        )?;

        Ok(())
    }

    pub fn connection(&self) -> Arc<Mutex<Connection>> {
        Arc::clone(&self.conn)
    }
}

static DB_INSTANCE: OnceCell<Database> = OnceCell::new();

pub fn init_database(app_handle: &tauri::AppHandle) -> Result<()> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| DatabaseError::Path(format!("获取应用数据目录失败: {}", e)))?;

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| DatabaseError::Path(format!("创建目录失败: {}", e)))?;

    let db_path = app_data_dir.join("qimo_library.db");
    let db = Database::new(db_path)?;

    DB_INSTANCE
        .set(db)
        .map_err(|_| DatabaseError::Init("数据库已初始化".into()))?;

    Ok(())
}

pub fn get_database() -> Result<&'static Database> {
    DB_INSTANCE
        .get()
        .ok_or_else(|| DatabaseError::Init("数据库未初始化".into()))
}
