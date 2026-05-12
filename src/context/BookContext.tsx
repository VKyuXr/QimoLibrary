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
  setSelectedBook: (book: Book | null) => void;
  setBooks: React.Dispatch<React.SetStateAction<Book[]>>;
  addBook: (book: Book) => Promise<void>;
  removeBook: (id: string) => void;
  libraries: LibraryConfig[];
  activeLibraryId: string | null;
  setActiveLibrary: (id: string) => void;
  addLibrary: (name: string, path: string, autoActivate?: boolean) => Promise<void>;
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
        // 首先尝试加载多书库配置
        const configResult = await invoke<any>('load_libraries_config', { appHandle: null });
        console.log('加载的书库配置:', configResult);
        
        if (configResult && configResult.libraries && configResult.libraries.length > 0) {
          // 有多书库配置，使用它
          const loadedLibraries: LibraryConfig[] = JSON.parse(configResult.libraries);
          setLibraries(loadedLibraries);
          
          // 设置活动书库
          const activeId = configResult.active_library_id || 'default';
          setActiveLibraryId(activeId);
          
          // 找到活动书库并加载其书籍
          const activeLibrary = loadedLibraries.find(lib => lib.id === activeId);
          if (activeLibrary) {
            const exists = await invoke<boolean>('check_library_path_exists', { libraryPath: activeLibrary.path });
            if (exists) {
              setLibraryPathState(activeLibrary.path);
              const loadedBooks = await getLibraryBooks(activeLibrary.path);
              setBooks(loadedBooks as Book[]);
            }
          }
        } else {
          // 没有多书库配置，使用旧的单书库逻辑（兼容）
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
            // 使用文件夹名作为书库名称
            const folderName = path.split(/[\\/]/).pop() || '默认书库';
            const defaultLibrary: LibraryConfig = {
              id: 'default',
              name: folderName,
              path: path,
              active: true
            };
            setLibraries([defaultLibrary]);
            setActiveLibraryId('default');
            
            const loadedBooks = await getLibraryBooks(path);
            setBooks(loadedBooks as Book[]);
          }
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
    
    // 保存到后端
    try {
      await invoke('save_libraries_config', {
        appHandle: null,
        libraries: JSON.stringify(updatedLibraries),
        activeLibraryId: id
      });
      console.log('活动书库已保存');
    } catch (error) {
      console.error('保存活动书库失败:', error);
    }

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
  const addLibrary = async (name: string, path: string, autoActivate: boolean = false) => {
    const newLibrary: LibraryConfig = {
      id: Date.now().toString(),
      name,
      path,
      active: false
    };
    
    const updatedLibraries = [...libraries, newLibrary];
    setLibraries(updatedLibraries);
    console.log('添加新书库:', newLibrary);
    
    // 保存到后端
    try {
      await invoke('save_libraries_config', {
        appHandle: null,
        libraries: JSON.stringify(updatedLibraries),
        activeLibraryId: activeLibraryId
      });
      console.log('书库配置已保存');
      
      // 如果需要自动激活，立即切换到新书库并加载书籍
      if (autoActivate) {
        console.log('自动激活新书库并加载书籍');
        
        // 直接设置活动书库ID
        setActiveLibraryId(newLibrary.id);
        setLibraryPathState(newLibrary.path);
        
        // 更新所有书库的active状态
        const activatedLibraries = updatedLibraries.map(lib => ({
          ...lib,
          active: lib.id === newLibrary.id
        }));
        setLibraries(activatedLibraries);
        
        // 保存激活状态
        await invoke('save_libraries_config', {
          appHandle: null,
          libraries: JSON.stringify(activatedLibraries),
          activeLibraryId: newLibrary.id
        });
        
        // 加载书籍
        const exists = await invoke<boolean>('check_library_path_exists', { libraryPath: newLibrary.path });
        if (exists) {
          const loadedBooks = await getLibraryBooks(newLibrary.path);
          setBooks(loadedBooks as Book[]);
          setSelectedBook(null);
          console.log('书籍已加载:', loadedBooks.length, '本');
        }
      }
    } catch (error) {
      console.error('保存书库配置失败:', error);
    }
  };

  // 删除书库
  const removeLibrary = async (id: string) => {
    if (id === 'default') {
      console.warn('不能删除默认书库');
      return;
    }
    
    const updatedLibraries = libraries.filter(lib => lib.id !== id);
    setLibraries(updatedLibraries);
    
    if (activeLibraryId === id) {
      // 如果删除的是活动书库，切换到默认书库
      await setActiveLibrary('default');
    }
    
    // 保存到后端
    try {
      await invoke('save_libraries_config', {
        appHandle: null,
        libraries: JSON.stringify(updatedLibraries),
        activeLibraryId: activeLibraryId === id ? 'default' : activeLibraryId
      });
      console.log('书库配置已保存');
    } catch (error) {
      console.error('保存书库配置失败:', error);
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
      setSelectedBook,
      setBooks,
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
