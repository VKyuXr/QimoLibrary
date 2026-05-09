import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLibrary, BookMetadata } from '../hooks/useLibrary';
import { invoke } from '@tauri-apps/api/core';

export interface LibraryConfig {
  id: string;
  name: string;
  path: string;
  active: boolean;
}

export interface Book extends BookMetadata {
  // 保持与后端一致的蛇形命名
}

interface BookContextType {
  books: Book[];
  selectedBook: Book | null;
  selectBook: (book: Book | null) => void;
  addBook: (book: Book) => Promise<void>;
  removeBook: (id: string) => void;
  libraries: LibraryConfig[];
  activeLibraryId: string | null;
  setActiveLibrary: (id: string) => void;
  addLibrary: (name: string, path: string) => Promise<void>;
  removeLibrary: (id: string) => void;
  toggleLibraryActive: (id: string) => void;
  libraryPath: string | null;
  updateLibraryPath: (path: string) => void;
  refreshBooks: () => Promise<void>;
}

const BookContext = createContext<BookContextType | undefined>(undefined);

export const BookProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [libraries, setLibraries] = useState<LibraryConfig[]>([]);
  const [activeLibraryId, setActiveLibraryId] = useState<string | null>(null);
  const [libraryPath, setLibraryPathState] = useState<string | null>(null);
  const { getLibraryPath, getLibraryBooks } = useLibrary();

  // 加载书库配置和书籍列表
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const path = await getLibraryPath();
        if (path) {
          // 检查书库路径是否存在
          const exists = await invoke<boolean>('check_library_path_exists', { libraryPath: path });
          
          if (!exists) {
            console.warn('书库路径不存在，清空配置:', path);
            // 路径不存在，清空状态
            setLibraryPathState(null);
            setBooks([]);
            setSelectedBook(null);
            return;
          }
          
          // 路径存在，正常加载
          setLibraryPathState(path);
          
          // 初始化默认书库配置（兼容旧数据）
          const defaultLibrary: LibraryConfig = {
            id: 'default',
            name: '默认书库',
            path: path,
            active: true
          };
          setLibraries([defaultLibrary]);
          setActiveLibraryId('default');
          
          const loadedBooks = await getLibraryBooks(path);
          setBooks(loadedBooks as Book[]);
        }
      } catch (error) {
        console.error('加载书库失败:', error);
      }
    };
    
    loadLibrary();
  }, []);

  const selectBook = (book: Book | null) => {
    setSelectedBook(book);
  };

  const addBook = async (book: Book) => {
    setBooks([...books, book]);
  };

  const removeBook = (id: string) => {
    setBooks(books.filter(book => book.id !== id));
    if (selectedBook?.id === id) {
      setSelectedBook(null);
    }
  };

  const updateLibraryPath = (path: string) => {
    setLibraryPathState(path);
  };

  const refreshBooks = async () => {
    if (libraryPath) {
      try {
        const loadedBooks = await getLibraryBooks(libraryPath);
        setBooks(loadedBooks as Book[]);
      } catch (error) {
        console.error('刷新书籍列表失败:', error);
      }
    }
  };

  // 设置活动书库
  const setActiveLibrary = async (id: string) => {
    const library = libraries.find(lib => lib.id === id);
    if (!library) return;

    // 更新所有书库的active状态
    const updatedLibraries = libraries.map(lib => ({
      ...lib,
      active: lib.id === id
    }));
    setLibraries(updatedLibraries);
    setActiveLibraryId(id);

    // 加载新书库的书籍
    try {
      const exists = await invoke<boolean>('check_library_path_exists', { libraryPath: library.path });
      if (exists) {
        setLibraryPathState(library.path);
        const loadedBooks = await getLibraryBooks(library.path);
        setBooks(loadedBooks as Book[]);
        setSelectedBook(null); // 清空选中的书籍
      }
    } catch (error) {
      console.error('切换书库失败:', error);
    }
  };

  // 添加新书库
  const addLibrary = async (name: string, path: string) => {
    const newLibrary: LibraryConfig = {
      id: Date.now().toString(),
      name,
      path,
      active: false
    };
    
    setLibraries([...libraries, newLibrary]);
    console.log('添加新书库:', newLibrary);
  };

  // 删除书库
  const removeLibrary = (id: string) => {
    if (id === 'default') {
      console.warn('不能删除默认书库');
      return;
    }
    
    setLibraries(libraries.filter(lib => lib.id !== id));
    if (activeLibraryId === id) {
      // 如果删除的是活动书库，切换到默认书库
      setActiveLibrary('default');
    }
  };

  // 切换书库激活状态
  const toggleLibraryActive = (id: string) => {
    setActiveLibrary(id);
  };

  return (
    <BookContext.Provider value={{ 
      books, 
      selectedBook, 
      selectBook, 
      addBook, 
      removeBook,
      libraries,
      activeLibraryId,
      setActiveLibrary,
      addLibrary,
      removeLibrary,
      toggleLibraryActive,
      libraryPath,
      updateLibraryPath,
      refreshBooks
    }}>
      {children}
    </BookContext.Provider>
  );
};

export const useBook = () => {
  const context = useContext(BookContext);
  if (context === undefined) {
    throw new Error('useBook must be used within a BookProvider');
  }
  return context;
};
