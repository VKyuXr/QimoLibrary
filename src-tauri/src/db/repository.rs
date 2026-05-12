use crate::db::models::*;
use crate::db::connection::{Database, DatabaseError};
use rusqlite::{params, OptionalExtension};
use chrono::Utc;

type Result<T> = std::result::Result<T, DatabaseError>;

pub struct BookRepository;

impl BookRepository {
    pub fn create(db: &Database, book: &Book) -> Result<()> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        
        conn.execute(
            "INSERT INTO books (
                id, title, author, cover_path, progress, last_read_time,
                description, publisher, added_time, file_path, is_notebook,
                library_path, folder_name, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                book.id,
                book.title,
                book.author,
                book.cover_path,
                book.progress as i32,
                book.last_read_time,
                book.description,
                book.publisher,
                book.added_time,
                book.file_path,
                book.is_notebook as i32,
                book.library_path,
                book.folder_name,
                now,
                now,
            ],
        )?;
        
        drop(conn);

        for tag in &book.tags {
            Self::add_tag(db, &book.id, tag)?;
        }

        Ok(())
    }

    pub fn update(db: &Database, book: &Book) -> Result<()> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        
        conn.execute(
            "UPDATE books SET
                title = ?2,
                author = ?3,
                cover_path = ?4,
                progress = ?5,
                last_read_time = ?6,
                description = ?7,
                publisher = ?8,
                file_path = ?9,
                is_notebook = ?10,
                updated_at = ?11
            WHERE id = ?1",
            params![
                book.id,
                book.title,
                book.author,
                book.cover_path,
                book.progress as i32,
                book.last_read_time,
                book.description,
                book.publisher,
                book.file_path,
                book.is_notebook as i32,
                now,
            ],
        )?;

        Ok(())
    }

    pub fn find_by_id(db: &Database, id: &str) -> Result<Option<Book>> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT id, title, author, cover_path, progress, last_read_time,
                    description, publisher, added_time, file_path, is_notebook,
                    library_path, folder_name
             FROM books WHERE id = ?1"
        )?;

        let book_result = stmt.query_row(params![id], |row| {
            let is_notebook: i32 = row.get(10)?;
            let progress: i32 = row.get(4)?;
            
            Ok(Book {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                cover_path: row.get(3)?,
                progress: progress as u32,
                last_read_time: row.get(5)?,
                description: row.get(6)?,
                publisher: row.get(7)?,
                added_time: row.get(8)?,
                file_path: row.get(9)?,
                is_notebook: is_notebook != 0,
                library_path: row.get(11)?,
                folder_name: row.get(12)?,
                tags: Vec::new(),
            })
        }).optional()?;

        drop(stmt);
        drop(conn);

        if let Some(mut book) = book_result {
            book.tags = Self::get_tags(db, id)?;
            Ok(Some(book))
        } else {
            Ok(None)
        }
    }

    pub fn find_by_library(db: &Database, library_path: &str) -> Result<Vec<Book>> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT id, title, author, cover_path, progress, last_read_time,
                    description, publisher, added_time, file_path, is_notebook,
                    library_path, folder_name
             FROM books WHERE library_path = ?1 ORDER BY added_time DESC"
        )?;

        let book_ids: Vec<String> = stmt.query_map(params![library_path], |row| {
            Ok(row.get::<_, String>(0)?)
        })?.filter_map(|r| r.ok()).collect();
        
        drop(stmt);
        drop(conn);

        let mut result = Vec::new();
        for book_id in book_ids {
            if let Some(book) = Self::find_by_id(db, &book_id)? {
                result.push(book);
            }
        }

        Ok(result)
    }

    pub fn search(db: &Database, query: &str, library_path: Option<&str>) -> Result<Vec<Book>> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        let search_pattern = format!("%{}%", query);
        
        let book_ids: Vec<String> = if let Some(library) = library_path {
            let mut stmt = conn.prepare(
                "SELECT id FROM books
                 WHERE library_path = ?2 AND (title LIKE ?1 OR author LIKE ?1 OR description LIKE ?1)
                 ORDER BY added_time DESC"
            )?;
            
            let ids: Vec<String> = stmt.query_map(params![search_pattern, library], |row| {
                row.get(0)
            })?.filter_map(|r| r.ok()).collect();
            
            drop(stmt);
            ids
        } else {
            let mut stmt = conn.prepare(
                "SELECT id FROM books
                 WHERE title LIKE ?1 OR author LIKE ?1 OR description LIKE ?1
                 ORDER BY added_time DESC"
            )?;
            
            let ids: Vec<String> = stmt.query_map(params![search_pattern], |row| {
                row.get(0)
            })?.filter_map(|r| r.ok()).collect();
            
            drop(stmt);
            ids
        };
        
        drop(conn);

        let mut result = Vec::new();
        for book_id in book_ids {
            if let Some(book) = Self::find_by_id(db, &book_id)? {
                result.push(book);
            }
        }

        Ok(result)
    }

    pub fn delete(db: &Database, id: &str) -> Result<()> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        conn.execute("DELETE FROM books WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn add_tag(db: &Database, book_id: &str, tag_name: &str) -> Result<()> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        
        println!("[DEBUG] Adding tag: book_id={}, tag_name={}", book_id, tag_name);
        
        // 检查书籍是否存在
        let book_exists: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM books WHERE id = ?1)",
            params![book_id],
            |row| row.get(0),
        )?;
        
        if !book_exists {
            println!("[WARN] Book {} not found in database", book_id);
            return Err(DatabaseError::Init(format!("Book {} not synced to database", book_id)));
        }
        
        let tag_id: Option<String> = conn.query_row(
            "SELECT id FROM tags WHERE name = ?1",
            params![tag_name],
            |row| row.get(0),
        ).optional()?;

        let tag_id = if let Some(id) = tag_id {
            println!("[DEBUG] Using existing tag: tag_id={}", id);
            id
        } else {
            let new_tag = Tag::new(tag_name.into(), None);
            conn.execute(
                "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
                params![new_tag.id, new_tag.name, new_tag.color, new_tag.created_at],
            )?;
            println!("[DEBUG] Created new tag: tag_id={}", new_tag.id);
            new_tag.id
        };

        let affected = conn.execute(
            "INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?1, ?2)",
            params![book_id, tag_id],
        )?;
        
        println!("[DEBUG] Tag association completed: affected={}", affected);

        Ok(())
    }

    pub fn remove_tag(db: &Database, book_id: &str, tag_name: &str) -> Result<()> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        
        conn.execute(
            "DELETE FROM book_tags
             WHERE book_id = ?1 AND tag_id IN (SELECT id FROM tags WHERE name = ?2)",
            params![book_id, tag_name],
        )?;

        Ok(())
    }

    pub fn get_tags(db: &Database, book_id: &str) -> Result<Vec<String>> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT t.name FROM tags t
             JOIN book_tags bt ON t.id = bt.tag_id
             WHERE bt.book_id = ?1"
        )?;

        let tags = stmt.query_map(params![book_id], |row| row.get(0))?;
        
        let mut result = Vec::new();
        for tag in tags {
            result.push(tag?);
        }

        Ok(result)
    }
}

pub struct TagRepository;

impl TagRepository {
    pub fn create(db: &Database, tag: &Tag) -> Result<()> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        
        conn.execute(
            "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![tag.id, tag.name, tag.color, tag.created_at],
        )?;

        Ok(())
    }

    pub fn find_all(db: &Database) -> Result<Vec<Tag>> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        
        let mut stmt = conn.prepare("SELECT id, name, color, created_at FROM tags ORDER BY name")?;

        let tags = stmt.query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?;

        let mut result = Vec::new();
        for tag in tags {
            result.push(tag?);
        }

        Ok(result)
    }

    pub fn delete(db: &Database, id: &str) -> Result<()> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        conn.execute("DELETE FROM tags WHERE id = ?1", params![id])?;
        Ok(())
    }
}

pub struct AnnotationRepository;

impl AnnotationRepository {
    pub fn create(db: &Database, annotation: &Annotation) -> Result<()> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        
        conn.execute(
            "INSERT INTO annotations (id, book_id, cfi, text, note, color, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                annotation.id,
                annotation.book_id,
                annotation.cfi,
                annotation.text,
                annotation.note,
                annotation.color,
                annotation.created_at,
            ],
        )?;

        Ok(())
    }

    pub fn find_by_book(db: &Database, book_id: &str) -> Result<Vec<Annotation>> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT id, book_id, cfi, text, note, color, created_at
             FROM annotations WHERE book_id = ?1 ORDER BY created_at DESC"
        )?;

        let annotations = stmt.query_map(params![book_id], |row| {
            Ok(Annotation {
                id: row.get(0)?,
                book_id: row.get(1)?,
                cfi: row.get(2)?,
                text: row.get(3)?,
                note: row.get(4)?,
                color: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut result = Vec::new();
        for annotation in annotations {
            result.push(annotation?);
        }

        Ok(result)
    }

    pub fn delete(db: &Database, id: &str) -> Result<()> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        conn.execute("DELETE FROM annotations WHERE id = ?1", params![id])?;
        Ok(())
    }
}

pub struct ReadingHistoryRepository;

impl ReadingHistoryRepository {
    pub fn create(db: &Database, history: &ReadingHistory) -> Result<()> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        
        conn.execute(
            "INSERT INTO reading_history (id, book_id, progress, read_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![history.id, history.book_id, history.progress as i32, history.read_at],
        )?;

        Ok(())
    }

    pub fn find_recent(db: &Database, limit: i32) -> Result<Vec<ReadingHistory>> {
        let conn_ref = db.connection();
        let conn = conn_ref.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT id, book_id, progress, read_at
             FROM reading_history
             ORDER BY read_at DESC
             LIMIT ?1"
        )?;

        let histories = stmt.query_map(params![limit], |row| {
            let progress: i32 = row.get(2)?;
            Ok(ReadingHistory {
                id: row.get(0)?,
                book_id: row.get(1)?,
                progress: progress as u32,
                read_at: row.get(3)?,
            })
        })?;

        let mut result = Vec::new();
        for history in histories {
            result.push(history?);
        }

        Ok(result)
    }
}
