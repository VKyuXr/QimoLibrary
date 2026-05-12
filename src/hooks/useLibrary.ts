import { invoke } from '@tauri-apps/api/core';

export interface BookMetadata {
  id: string;
  title: string;
  author: string;
  cover_path?: string;
  progress: number;
  last_read_time?: string;
  description?: string;
  publisher?: string;
  added_time: string;
  file_path?: string; // 存储 EPUB 文件的绝对路径
  is_notebook: boolean; // 是否为笔记（与Rust保持一致，非可选）
  tags?: string[]; // 书籍标签
}

export const useLibrary = () => {
  const initializeLibrary = async (path: string) => {
    return await invoke('initialize_library', { path });
  };

  const addBookToLibrary = async (filePath: string, libraryPath: string): Promise<BookMetadata> => {
    return await invoke('add_book_to_library', { filePath, libraryPath });
  };

  const getLibraryBooks = async (libraryPath: string): Promise<BookMetadata[]> => {
    return await invoke('get_library_books', { libraryPath });
  };

  const setLibraryPath = async (path: string) => {
    return await invoke('set_library_path', { path });
  };

  const getLibraryPath = async (): Promise<string | null> => {
    return await invoke('get_library_path');
  };

  return {
    initializeLibrary,
    addBookToLibrary,
    getLibraryBooks,
    setLibraryPath,
    getLibraryPath,
  };
};
