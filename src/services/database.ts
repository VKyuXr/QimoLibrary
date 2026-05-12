import { invoke } from '@tauri-apps/api/core';

export interface Book {
  id: string;
  title: string;
  author: string;
  cover_path: string | null;
  progress: number;
  last_read_time: string | null;
  description: string | null;
  publisher: string | null;
  added_time: string;
  file_path: string | null;
  is_notebook: boolean;
  library_path: string;
  folder_name: string;
  tags: string[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Annotation {
  id: string;
  book_id: string;
  cfi: string;
  text: string;
  note: string | null;
  color: string;
  created_at: string;
}

export interface ReadingHistory {
  id: string;
  book_id: string;
  progress: number;
  read_at: string;
}

export const DatabaseService = {
  init: async () => {
    await invoke('init_db');
  },

  syncBook: async (bookMetadata: any, libraryPath: string, folderName: string) => {
    await invoke('sync_book_to_db', {
      bookMetadata,
      libraryPath,
      folderName
    });
  },

  getBooks: async (libraryPath: string): Promise<Book[]> => {
    return await invoke('get_books_from_db', { libraryPath });
  },

  searchBooks: async (query: string, libraryPath?: string): Promise<Book[]> => {
    return await invoke('search_books', { query, libraryPath });
  },

  updateProgress: async (bookId: string, progress: number) => {
    await invoke('update_book_progress', { bookId, progress });
  },

  addTag: async (bookId: string, tagName: string) => {
    await invoke('add_tag_to_book', { bookId, tagName });
  },

  removeTag: async (bookId: string, tagName: string) => {
    await invoke('remove_tag_from_book', { bookId, tagName });
  },

  getAllTags: async (): Promise<Tag[]> => {
    return await invoke('get_all_tags');
  },

  createAnnotation: async (
    bookId: string,
    cfi: string,
    text: string,
    note?: string,
    color?: string
  ): Promise<Annotation> => {
    return await invoke('create_annotation', {
      bookId,
      cfi,
      text,
      note,
      color
    });
  },

  getAnnotations: async (bookId: string): Promise<Annotation[]> => {
    return await invoke('get_book_annotations', { bookId });
  },

  deleteAnnotation: async (annotationId: string) => {
    await invoke('delete_annotation', { annotationId });
  },

  getRecentReading: async (limit: number = 10): Promise<ReadingHistory[]> => {
    return await invoke('get_recent_reading', { limit });
  }
};
