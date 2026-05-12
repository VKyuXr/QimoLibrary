import { useState, useCallback, useContext, createContext, ReactNode } from 'react';
import { DatabaseService, Book, Tag, Annotation, ReadingHistory } from '../services/database';
import { cache } from '../services/cache';

interface DatabaseContextType {
  initialized: boolean;
  books: Book[];
  tags: Tag[];
  loading: boolean;
  error: string | null;
  initDatabase: () => Promise<void>;
  loadBooks: (libraryPath: string) => Promise<void>;
  searchBooks: (query: string, libraryPath?: string) => Promise<Book[]>;
  updateProgress: (bookId: string, progress: number) => Promise<void>;
  addTag: (bookId: string, tagName: string) => Promise<void>;
  removeTag: (bookId: string, tagName: string) => Promise<void>;
  loadTags: () => Promise<void>;
  getBookAnnotations: (bookId: string) => Promise<Annotation[]>;
  createAnnotation: (bookId: string, cfi: string, text: string, note?: string, color?: string) => Promise<Annotation>;
  deleteAnnotation: (annotationId: string) => Promise<void>;
  getRecentReading: (limit?: number) => Promise<ReadingHistory[]>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [initialized, setInitialized] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initDatabase = useCallback(async () => {
    if (initialized) return;
    try {
      setLoading(true);
      await DatabaseService.init();
      setInitialized(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化数据库失败');
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  const loadBooks = useCallback(async (libraryPath: string) => {
    const cacheKey = `books_${libraryPath}`;
    const cached = cache.get<Book[]>(cacheKey);
    
    if (cached) {
      setBooks(cached);
      return;
    }

    try {
      setLoading(true);
      const result = await DatabaseService.getBooks(libraryPath);
      setBooks(result);
      cache.set(cacheKey, result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载书籍失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const searchBooks = useCallback(async (query: string, libraryPath?: string): Promise<Book[]> => {
    if (!query.trim()) return [];
    
    try {
      return await DatabaseService.searchBooks(query, libraryPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索书籍失败');
      return [];
    }
  }, []);

  const updateProgress = useCallback(async (bookId: string, progress: number) => {
    try {
      await DatabaseService.updateProgress(bookId, progress);
      
      // 更新本地缓存
      setBooks(prev => prev.map(book => 
        book.id === bookId 
          ? { ...book, progress, last_read_time: new Date().toISOString() }
          : book
      ));
      
      // 清除相关缓存
      cache.clearPattern('books_');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新进度失败');
    }
  }, []);

  const addTag = useCallback(async (bookId: string, tagName: string) => {
    try {
      await DatabaseService.addTag(bookId, tagName);
      
      // 更新本地缓存
      setBooks(prev => prev.map(book => 
        book.id === bookId 
          ? { ...book, tags: [...book.tags, tagName] }
          : book
      ));
      
      // 清除相关缓存
      cache.clearPattern('books_');
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加标签失败');
    }
  }, []);

  const removeTag = useCallback(async (bookId: string, tagName: string) => {
    try {
      await DatabaseService.removeTag(bookId, tagName);
      
      // 更新本地缓存
      setBooks(prev => prev.map(book => 
        book.id === bookId 
          ? { ...book, tags: book.tags.filter(t => t !== tagName) }
          : book
      ));
      
      // 清除相关缓存
      cache.clearPattern('books_');
    } catch (err) {
      setError(err instanceof Error ? err.message : '移除标签失败');
    }
  }, []);

  const loadTags = useCallback(async () => {
    const cacheKey = 'all_tags';
    const cached = cache.get<Tag[]>(cacheKey);
    
    if (cached && cached.length > 0) {
      setTags(cached);
      return;
    }

    try {
      const result = await DatabaseService.getAllTags();
      setTags(result);
      if (result.length > 0) {
        cache.set(cacheKey, result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载标签失败');
    }
  }, []);

  const getBookAnnotations = useCallback(async (bookId: string): Promise<Annotation[]> => {
    try {
      return await DatabaseService.getAnnotations(bookId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取标注失败');
      return [];
    }
  }, []);

  const createAnnotation = useCallback(async (
    bookId: string,
    cfi: string,
    text: string,
    note?: string,
    color?: string
  ): Promise<Annotation> => {
    try {
      return await DatabaseService.createAnnotation(bookId, cfi, text, note, color);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建标注失败');
      throw err;
    }
  }, []);

  const deleteAnnotation = useCallback(async (annotationId: string) => {
    try {
      await DatabaseService.deleteAnnotation(annotationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除标注失败');
    }
  }, []);

  const getRecentReading = useCallback(async (limit: number = 10): Promise<ReadingHistory[]> => {
    try {
      return await DatabaseService.getRecentReading(limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取阅读历史失败');
      return [];
    }
  }, []);

  const value = {
    initialized,
    books,
    tags,
    loading,
    error,
    initDatabase,
    loadBooks,
    searchBooks,
    updateProgress,
    addTag,
    removeTag,
    loadTags,
    getBookAnnotations,
    createAnnotation,
    deleteAnnotation,
    getRecentReading
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
