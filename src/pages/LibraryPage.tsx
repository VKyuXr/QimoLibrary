import { Box, Title, Group, Stack, Card, Text, Button, ScrollArea, ActionIcon, Tooltip, Checkbox, Modal, TextInput, Textarea, Badge } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useBook } from '../context/BookContext';
import { useNavigate } from 'react-router-dom';
import { IconDownload, IconTrash, IconEdit, IconNote, IconX, IconPlus } from '@tabler/icons-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useLibrary } from '../hooks/useLibrary';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../hooks/useTranslation';
import SignatureButton from '../components/decorative/SignatureButton';
import { useDatabase } from '../hooks/useDatabase';

// 书籍列表项组件 - 用于避免在map中使用Hooks
interface BookItemProps {
  book: any;
  isActive: boolean;
  isSelected: boolean;
  onSelect: (book: any) => void;
  onCheckboxChange: (id: string, checked: boolean) => void;
}

const BookItem: React.FC<BookItemProps> = ({ 
  book, 
  isActive, 
  isSelected,
  onSelect,
  onCheckboxChange 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Box
      className="cursor-pointer px-4 py-3"
      style={{
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: isActive ? 'var(--highlight)' : (isHovered ? 'var(--bg-secondary)' : 'transparent'),
        transition: 'all 0.2s ease'
      }}
      onClick={() => onSelect(book)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" className="flex-1">
          <Checkbox
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onCheckboxChange(book.id, e.currentTarget.checked);
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            styles={{
              input: { 
                borderRadius: 0,
                borderColor: 'var(--border-color)',
                '&:checked': {
                  backgroundColor: 'var(--accent-secondary)',
                  borderColor: 'var(--accent-secondary)'
                }
              },
              label: {
                color: 'var(--text-primary)'
              }
            }}
          />
          {book.is_notebook && (
            <IconNote size={16} style={{ color: 'var(--accent-secondary)' }} />
          )}
          <Text 
            lineClamp={1} 
            className="flex-1 mr-4" 
            style={{ 
              color: 'var(--text-primary)',
              fontFamily: isActive ? '"Source Han Serif SC", serif' : 'inherit',
              fontSize: (isActive || isHovered) ? 'calc(1rem * 1.414)' : 'inherit',
              fontWeight: 500,
              transition: 'font-size 0.2s ease'
            }}
          >
            {book.title}
          </Text>
        </Group>
        <Text size="sm" lineClamp={1} className="text-right" style={{ color: 'var(--text-secondary)' }}>{book.author}</Text>
      </Group>
    </Box>
  );
};

const LibraryPage: React.FC = () => {
  const { books, selectedBook, selectBook, setSelectedBook, setBooks, libraryPath, refreshBooks, removeBook } = useBook();
  const { addBookToLibrary } = useLibrary();
  const { addTag, removeTag, loadTags, tags } = useDatabase();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [libraryName, setLibraryName] = useState<string>('');
  
  // 多选和删除相关状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  
  // 编辑元数据相关状态
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editPublisher, setEditPublisher] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  // 标签管理相关状态
  const [tagModalOpened, setTagModalOpened] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [bookTags, setBookTags] = useState<string[]>([]);
  
  // 搜索相关状态
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredBooks, setFilteredBooks] = useState<typeof books>([]);
  
  // 新建笔记Modal状态
  const [createNotebookModalOpened, setCreateNotebookModalOpened] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');

  // 更新书库名称显示
  useEffect(() => {
    if (libraryPath) {
      const parts = libraryPath.replace(/\\/g, '/').split('/');
      setLibraryName(parts[parts.length - 1] || '未命名书库');
    } else {
      setLibraryName('未设置书库');
    }
  }, [libraryPath]);

  // 重新加载书籍列表
  const reloadBooks = async () => {
    await refreshBooks();
  };

  const handleReadBook = () => {
    console.log('[Frontend Debug] Selected Book Object:', selectedBook);
    // 后端已清理路径，直接使用
    if (selectedBook && selectedBook.file_path) {
      const cleanPath = selectedBook.file_path;
      
      // 根据是否为笔记决定跳转目标
      if (selectedBook.is_notebook) {
        console.log('[Frontend Debug] Navigating to notebook editor with path:', cleanPath);
        navigate(`/notebook-editor?filePath=${encodeURIComponent(cleanPath)}`);
        // 保存上次打开的笔记路径
        localStorage.setItem('last-opened-notebook', cleanPath);
      } else {
        console.log('[Frontend Debug] Navigating to reader with path:', cleanPath);
        navigate(`/reader?filePath=${encodeURIComponent(cleanPath)}`);
        // 保存上次打开的书籍路径
        localStorage.setItem('last-opened-book', cleanPath);
      }
    } else {
      console.error('[Frontend Error] No file_path info in selected book. Keys:', Object.keys(selectedBook || {}));
    }
  };

  const handleImportBook = async () => {
    console.log('开始导入书籍...');
    
    if (!libraryPath) {
      notifications.show({
        title: '提示',
        message: '请先在设置中配置书库位置',
        color: 'yellow',
      });
      navigate('/settings');
      return;
    }
    
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'EPUB Files',
          extensions: ['epub']
        }]
      });

      if (selected) {
        const files = Array.isArray(selected) ? selected : [selected];
        let successCount = 0;
        let failCount = 0;
        const failedFiles: string[] = [];

        for (const file of files) {
          try {
            const pathStr = file.toString();
            console.log('添加书籍到库:', pathStr, '库路径:', libraryPath);
            
            const newBook = await addBookToLibrary(pathStr, libraryPath);
            console.log('书籍添加成功:', newBook);
            successCount++;
          } catch (error) {
            failCount++;
            failedFiles.push(file.toString().split(/[/\\]/).pop() || '未知文件');
            console.error('导入失败:', file, error);
          }
        }
        
        await reloadBooks();
        
        if (failCount === 0) {
          notifications.show({
            title: '成功',
            message: `已成功导入 ${successCount} 本书籍`,
            color: 'green',
          });
        } else if (successCount === 0) {
          notifications.show({
            title: '导入失败',
            message: `所有书籍导入失败`,
            color: 'red',
          });
        } else {
          notifications.show({
            title: '部分成功',
            message: `成功导入 ${successCount} 本，失败 ${failCount} 本`,
            color: 'yellow',
          });
        }
      } else {
        console.log('用户取消了选择');
      }
    } catch (error) {
      console.error('导入书籍失败:', error);
      notifications.show({
        title: '导入失败',
        message: String(error),
        color: 'red',
      });
    }
  };

  // 新建笔记
  const handleCreateNotebook = async () => {
    if (!libraryPath) {
      notifications.show({
        title: '提示',
        message: '请先在设置中配置书库位置',
        color: 'yellow',
      });
      navigate('/settings');
      return;
    }
    
    if (!newNotebookName.trim()) {
      notifications.show({
        title: '提示',
        message: '请输入笔记名称',
        color: 'yellow',
      });
      return;
    }
    
    try {
      const epubPath = await invoke<string>('create_notebook', {
        libraryPath,
        name: newNotebookName
      });
      
      // 立即关闭Modal并清空输入
      setCreateNotebookModalOpened(false);
      setNewNotebookName('');
      
      // 直接刷新，无需延迟
      await reloadBooks();
      
      console.log('笔记创建成功:', epubPath);
      
      // 跳转到笔记编辑器
      navigate(`/notebook-editor?filePath=${encodeURIComponent(epubPath)}`);
    } catch (error) {
      console.error('创建笔记失败:', error);
      notifications.show({
        title: '创建失败',
        message: String(error),
        color: 'red',
      });
    }
  };

  // 处理复选框变化
  const handleCheckboxChange = (bookId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(bookId);
    } else {
      newSelected.delete(bookId);
    }
    setSelectedIds(newSelected);
  };

  // 打开删除确认对话框
  const handleOpenDeleteModal = () => {
    if (selectedIds.size === 0) {
      return;
    }
    setDeleteModalOpened(true);
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!libraryPath || selectedIds.size === 0) {
      return;
    }
    
    try {
      const idsToDelete = Array.from(selectedIds);
      console.log('删除书籍:', idsToDelete);
      
      // 调用后端删除
      await invoke('delete_books_from_library', {
        bookIds: idsToDelete,
        libraryPath: libraryPath
      });
      
      // 更新前端状态
      idsToDelete.forEach(id => removeBook(id));
      
      // 清空选择
      setSelectedIds(new Set());
      setDeleteModalOpened(false);
      
      // 刷新书籍列表
      await reloadBooks();
      
      notifications.show({
        title: '成功',
        message: `已删除 ${idsToDelete.length} 本书籍`,
        color: 'green',
      });
    } catch (error) {
      console.error('删除书籍失败:', error);
      notifications.show({
        title: '删除失败',
        message: String(error),
        color: 'red',
      });
    }
  };

  // 打开编辑Modal
  const handleOpenEditModal = () => {
    if (!selectedBook) {
      return;
    }
    
    setEditTitle(selectedBook.title);
    setEditAuthor(selectedBook.author);
    setEditPublisher(selectedBook.publisher || '');
    setEditDescription(selectedBook.description || '');
    setEditModalOpened(true);
  };

  // 打开标签管理Modal
  const handleOpenTagModal = async () => {
    if (!selectedBook) {
      return;
    }
    
    await loadTags();
    // 确保读取正确的 tags（从 selectedBook 或 books 列表）
    const currentBook = books.find(b => b.id === selectedBook.id);
    const currentTags = (currentBook as any)?.tags || (selectedBook as any).tags || [];
    setBookTags(currentTags);
    setTagModalOpened(true);
  };

  // 直接添加标签（用于标签库点击添加，不清空输入框）
  const handleAddTagDirectly = async (tagName: string) => {
    if (!selectedBook) {
      return;
    }
    
    if (!tagName) {
      return;
    }
    
    try {
      await addTag(selectedBook.id, tagName);
      
      // 直接更新 books 列表中的对应书籍
      setBooks(prevBooks => 
        prevBooks.map(book => 
          book.id === selectedBook.id 
            ? { ...book, tags: [...((book as any).tags || []), tagName] }
            : book
        )
      );
      
      // 更新 selectedBook
      const updatedTags = [...((selectedBook as any).tags || []), tagName];
      const updatedBook = { ...selectedBook, tags: updatedTags };
      setSelectedBook(updatedBook as any);
      
      // 同时更新 bookTags 状态
      setBookTags(updatedTags);
      
      // 刷新标签库
      await loadTags();
      
      notifications.show({
        title: '成功',
        message: `已添加标签: ${tagName}`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: '添加失败',
        message: String(error),
        color: 'red',
      });
    }
  };
  
  // 添加标签
  const handleAddTag = async (tagName?: string) => {
    if (!selectedBook) {
      return;
    }
    
    const nameToAdd = tagName || newTag.trim();
    if (!nameToAdd) {
      return;
    }
    
    try {
      await addTag(selectedBook.id, nameToAdd);
      
      // 直接更新 books 列表中的对应书籍
      setBooks(prevBooks => 
        prevBooks.map(book => 
          book.id === selectedBook.id 
            ? { ...book, tags: [...((book as any).tags || []), nameToAdd] }
            : book
        )
      );
      
      // 更新 selectedBook
      const updatedTags = [...((selectedBook as any).tags || []), nameToAdd];
      const updatedBook = { ...selectedBook, tags: updatedTags };
      setSelectedBook(updatedBook as any);
      
      // 同时更新 bookTags 状态
      setBookTags(updatedTags);
      
      // 清空输入框（仅当使用输入框添加时）
      if (!tagName) {
        setNewTag('');
      }
      
      // 刷新标签库
      await loadTags();
      
      notifications.show({
        title: '成功',
        message: `已添加标签: ${nameToAdd}`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: '添加失败',
        message: String(error),
        color: 'red',
      });
    }
  };

  // 删除标签
  const handleRemoveTag = async (tagName: string) => {
    if (!selectedBook) {
      return;
    }
    
    try {
      await removeTag(selectedBook.id, tagName);
      
      // 直接更新 books 列表中的对应书籍
      setBooks(prevBooks => 
        prevBooks.map(book => 
          book.id === selectedBook.id 
            ? { ...book, tags: ((book as any).tags || []).filter((t: string) => t !== tagName) }
            : book
        )
      );
      
      // 更新 selectedBook
      const updatedTags = ((selectedBook as any).tags || []).filter((t: string) => t !== tagName);
      const updatedBook = { ...selectedBook, tags: updatedTags };
      setSelectedBook(updatedBook as any);
      
      // 同时更新 bookTags 状态
      setBookTags(updatedTags);
      
      // 刷新标签库
      await loadTags();
      
      notifications.show({
        title: '成功',
        message: `已移除标签: ${tagName}`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: '移除失败',
        message: String(error),
        color: 'red',
      });
    }
  };

  // 高级搜索函数
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setFilteredBooks([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    let results = books;

    // 解析搜索查询
    const nameMatch = lowerQuery.match(/name:(\S+)/);
    const authorMatch = lowerQuery.match(/author:(\S+)/);
    const tagMatch = lowerQuery.match(/tag:(\S+)/);

    if (nameMatch) {
      const name = nameMatch[1];
      results = results.filter(book => 
        book.title.toLowerCase().includes(name)
      );
    }

    if (authorMatch) {
      const author = authorMatch[1];
      results = results.filter(book => 
        book.author.toLowerCase().includes(author)
      );
    }

    if (tagMatch) {
      const tag = tagMatch[1];
      results = results.filter(book => 
        (book as any).tags?.some((t: string) => t.toLowerCase().includes(tag))
      );
    }

    // 如果没有前缀匹配，执行普通搜索
    if (!nameMatch && !authorMatch && !tagMatch) {
      results = results.filter(book => 
        book.title.toLowerCase().includes(lowerQuery) ||
        book.author.toLowerCase().includes(lowerQuery) ||
        (book as any).tags?.some((t: string) => t.toLowerCase().includes(lowerQuery))
      );
    }

    setFilteredBooks(results);
  };

  // 保存元数据
  const handleSaveMetadata = async () => {
    if (!selectedBook || !libraryPath) {
      return;
    }
    
    try {
      console.log('保存元数据:', { title: editTitle, author: editAuthor });
      
      // 调用后端更新
      const updatedBook = await invoke('update_book_metadata_command', {
        bookId: selectedBook.id,
        libraryPath: libraryPath,
        title: editTitle,
        author: editAuthor,
        publisher: editPublisher || null,
        description: editDescription || null
      });
      
      // 更新前端选中书籍
      selectBook(updatedBook as any);
      
      // 关闭Modal
      setEditModalOpened(false);
      
      // 刷新列表
      await reloadBooks();
      
      notifications.show({
        title: '成功',
        message: '元数据已更新',
        color: 'green',
      });
    } catch (error) {
      console.error('保存元数据失败:', error);
      notifications.show({
        title: '保存失败',
        message: String(error),
        color: 'red',
      });
    }
  };

  return (
    <Box className="flex h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* 左侧书籍列表 */}
      <Box className="flex-1 flex flex-col p-[15px]" style={{ borderRight: '1px solid var(--border-color)' }}>
        {/* 顶部工具栏 */}
        <Box className="mb-[15px]">
          <Card withBorder style={{ 
            borderColor: 'var(--border-color)',
            borderWidth: '1px',
            padding: '16px'
          }}>
            <Group justify="space-between" align="flex-start">
              <Title order={3} style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>{libraryName}</Title>
              <Group gap="xs">
                {selectedIds.size > 0 && (
                  <Tooltip label="删除选中">
                    <ActionIcon
                      size="lg"
                      variant="outline"
                      onClick={handleOpenDeleteModal}
                      style={{
                        borderRadius: 0,
                        borderColor: 'var(--accent-secondary)',
                        color: 'var(--accent-secondary)'
                      }}
                    >
                      <IconTrash size={20} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <Tooltip label="导入书籍">
                  <ActionIcon
                    size="lg"
                    variant="outline"
                    onClick={handleImportBook}
                    style={{
                      borderRadius: 0,
                      borderColor: 'var(--accent-secondary)',
                      color: 'var(--accent-secondary)'
                    }}
                  >
                    <IconDownload size={20} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="新建笔记">
                  <ActionIcon
                    size="lg"
                    variant="outline"
                    onClick={() => setCreateNotebookModalOpened(true)}
                    style={{
                      borderRadius: 0,
                      borderColor: 'var(--accent-secondary)',
                      color: 'var(--accent-secondary)'
                    }}
                  >
                    <IconNote size={20} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Card>
        </Box>
        
        <ScrollArea className="flex-1">
          {/* 搜索框和全选 - 始终显示 */}
          <Box className="px-2 py-2" style={{ borderBottom: '1px dashed var(--border-color)' }}>
            <Group justify="space-between" wrap="nowrap">
{(() => {
                const currentBooks = filteredBooks.length > 0 ? filteredBooks : books;
                const allSelected = currentBooks.length > 0 && currentBooks.every(book => selectedIds.has(book.id));
                const selectedCount = currentBooks.filter(book => selectedIds.has(book.id)).length;
                const isIndeterminate = selectedCount > 0 && selectedCount < currentBooks.length;
                return (
                  <Checkbox
                    checked={allSelected}
                    indeterminate={isIndeterminate}
                    onChange={(e) => {
                      if (e.currentTarget.checked) {
                        // 选择当前显示的所有书籍
                        const newSelected = new Set(selectedIds);
                        currentBooks.forEach(book => newSelected.add(book.id));
                        setSelectedIds(newSelected);
                      } else {
                        // 取消选择当前显示的所有书籍
                        const newSelected = new Set(selectedIds);
                        currentBooks.forEach(book => newSelected.delete(book.id));
                        setSelectedIds(newSelected);
                      }
                    }}
                    label={`全选 (${selectedIds.size}/${currentBooks.length})`}
                    styles={{
                      input: {
                        borderRadius: 0,
                        borderColor: 'var(--border-color)',
                        '&:checked': {
                          backgroundColor: 'var(--accent-secondary)',
                          borderColor: 'var(--accent-secondary)'
                        }
                      },
                      label: {
                        color: 'var(--text-primary)'
                      }
                    }}
                  />
                );
              })()}
              <TextInput
                placeholder="搜索 (name:/author:/tag:)"
                value={searchQuery}
                onChange={(e) => handleSearch(e.currentTarget.value)}
                size="xs"
                style={{ width: 200 }}
                rightSection={
                  searchQuery ? (
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      onClick={() => handleSearch('')}
                    >
                      <IconX size={12} />
                    </ActionIcon>
                  ) : null
                }
                styles={{
                  input: {
                    borderRadius: 0,
                    borderColor: 'var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                  }
                }}
              />
            </Group>
            {searchQuery && (
              <Text size="xs" mt="xs" style={{ color: 'var(--text-secondary)' }}>
                {filteredBooks.length > 0 
                  ? `找到 ${filteredBooks.length} 本匹配的书籍`
                  : '未找到匹配的书籍'}
              </Text>
            )}
          </Box>
          
          {/* 书籍列表 */}
          {(searchQuery ? filteredBooks : books).length > 0 ? (
            <Box className="py-4">
              {(searchQuery ? filteredBooks : books).map((book) => (
                <BookItem
                  key={book.id}
                  book={book}
                  isActive={selectedBook?.id === book.id}
                  isSelected={selectedIds.has(book.id)}
                  onSelect={selectBook}
                  onCheckboxChange={handleCheckboxChange}
                />
              ))}
            </Box>
          ) : (
            <Box className="text-center py-8">
              <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
                {searchQuery ? '未找到匹配的书籍' : '暂无书籍'}
              </Text>
              {!searchQuery && (
                <>
                  <Text size="xs" mt={4} style={{ color: 'var(--text-secondary)' }}>点击下方按钮导入 EPUB 文件</Text>
                </>
              )}
            </Box>
          )}
        </ScrollArea>
        
        {/* 底部提示 - 仅在未设置书库时显示 */}
        {!libraryPath && (
          <Box className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
            <Text size="sm" ta="center" style={{ color: 'var(--text-secondary)' }}>
              请先在设置中配置书库位置
            </Text>
          </Box>
        )}
      </Box>

      {/* 右侧书籍详情 */}
      <Box className="w-[400px] p-[15px]">
        {selectedBook ? (
          <Card withBorder className="h-full w-full max-w-sm ml-auto" style={{
            borderColor: 'var(--border-color)',
            borderWidth: '1px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <Stack gap="lg" className="flex-1" style={{ minHeight: 0 }}>
              {/* 书名 - 拱门形标题 */}
              <Box style={{
                borderRadius: '50% 50% 0 0 / 20px 20px 0 0',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '12px',
                marginBottom: '12px'
              }}>
                <Title order={2} style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>{selectedBook.title}</Title>
              </Box>
              
              {/* 可滚动内容区域 */}
              <ScrollArea className="flex-1" style={{ paddingRight: '8px' }}>
                <Stack gap="xs">
                  <Box>
                    <Text size="sm" style={{ color: 'var(--text-secondary)' }}>{t('author')}</Text>
                    <Text fw={500} style={{ color: 'var(--text-primary)' }}>{selectedBook.author}</Text>
                  </Box>
                  
                  {selectedBook.publisher && (
                    <Box>
                      <Text size="sm" style={{ color: 'var(--text-secondary)' }}>{t('publisher')}</Text>
                      <Text fw={500} style={{ color: 'var(--text-primary)' }}>{selectedBook.publisher}</Text>
                    </Box>
                  )}

                  {/* 标签显示 */}
                  <Box>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" style={{ color: 'var(--text-secondary)' }}>标签</Text>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={handleOpenTagModal}
                        style={{
                          color: 'var(--text-secondary)',
                          transition: 'all 0.2s ease',
                        }}
                        className="hover-opacity"
                      >
                        <IconPlus size={14} />
                      </ActionIcon>
                    </Group>
                    {(selectedBook as any).tags && (selectedBook as any).tags.length > 0 ? (
                      <Group gap="xs">
                        {(selectedBook as any).tags.map((tag: string) => (
                          <Badge
                            key={tag}
                            size="sm"
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--accent-color)',
                              borderRadius: 0,
                              cursor: 'pointer'
                            }}
                            onClick={() => handleRemoveTag(tag)}
                          >
                            #{tag}
                          </Badge>
                        ))}
                      </Group>
                    ) : (
                      <Text size="xs" style={{ color: 'var(--text-secondary)' }}>暂无标签</Text>
                    )}
                  </Box>

                  {/* 简介 */}
                  {selectedBook.description && (
                    <Box>
                      <Text size="sm" mb="xs" style={{ color: 'var(--text-secondary)' }}>{t('description')}</Text>
                      <Text style={{ color: 'var(--text-primary)' }}>{selectedBook.description}</Text>
                    </Box>
                  )}
                </Stack>
              </ScrollArea>
              
              {/* 按钮 - 固定在底部 */}
              <Box className="mt-auto pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                <Stack gap="xs">
                  <Button 
                    onClick={handleOpenEditModal} 
                    variant="outline" 
                    fullWidth 
                    leftSection={<IconEdit size={16} />}
                    style={{
                      borderRadius: 0,
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                      borderStyle: 'dashed',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--highlight)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {t('editMetadata')}
                  </Button>
                  <Button 
                    onClick={handleReadBook} 
                    fullWidth
                    style={{
                      borderRadius: 0,
                      backgroundColor: 'transparent',
                      borderColor: 'var(--accent-secondary)',
                      borderWidth: '1px',
                      color: 'var(--text-primary)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--accent-secondary)';
                      e.currentTarget.style.color = 'var(--bg-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                  >
                    {selectedBook?.is_notebook ? t('openNotebook') : t('startReading')}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Card>
        ) : (
          <Box className="h-full flex items-center justify-center">
            <Text size="lg" style={{ color: 'var(--text-secondary)' }}>请选择一本书查看详情</Text>
          </Box>
        )}
      </Box>

      {/* 删除确认Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title={<Text style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>确认删除 / Confirm Delete</Text>}
        centered
        size="md"
        styles={{
          content: { borderRadius: 0, backgroundColor: 'var(--bg-primary)' },
          header: { borderBottom: '1px solid var(--border-color)' }
        }}
      >
        <Stack gap="md">
          <Text style={{ color: 'var(--text-primary)' }}>
            确定要删除选中的 {selectedIds.size} 本书籍吗？此操作不可恢复。
            <br />
            <span style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
              Are you sure you want to delete {selectedIds.size} selected book(s)? This action cannot be undone.
            </span>
          </Text>
          <Group justify="flex-end" mt="md" gap="md" style={{ paddingRight: '20px' }}>
            <SignatureButton 
              text="取消 / Cancel"
              onClick={() => setDeleteModalOpened(false)}
              color="var(--text-secondary)"
            />
            <SignatureButton 
              text="确认 / Confirm"
              onClick={handleConfirmDelete}
              color="var(--accent-secondary)"
            />
          </Group>
        </Stack>
      </Modal>

      {/* 编辑元数据Modal */}
      <Modal
        opened={editModalOpened}
        onClose={() => setEditModalOpened(false)}
        title={<Text style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>编辑元数据 / Edit Metadata</Text>}
        centered
        size="md"
        styles={{
          content: { borderRadius: 0, backgroundColor: 'var(--bg-primary)' },
          header: { borderBottom: '1px solid var(--border-color)' }
        }}
      >
        <Stack gap="md">
          <TextInput
            label="书名 / Title"
            placeholder="请输入书名"
            value={editTitle}
            onChange={(e) => setEditTitle(e.currentTarget.value)}
            required
            styles={{
              input: { borderRadius: 0, borderColor: 'var(--border-color)' },
              label: { color: 'var(--text-primary)' }
            }}
          />
          
          <TextInput
            label="作者 / Author"
            placeholder="请输入作者"
            value={editAuthor}
            onChange={(e) => setEditAuthor(e.currentTarget.value)}
            required
            styles={{
              input: { borderRadius: 0, borderColor: 'var(--border-color)' },
              label: { color: 'var(--text-primary)' }
            }}
          />
          
          <TextInput
            label="出版社 / Publisher"
            placeholder="请输入出版社（可选）"
            value={editPublisher}
            onChange={(e) => setEditPublisher(e.currentTarget.value)}
            styles={{
              input: { borderRadius: 0, borderColor: 'var(--border-color)' },
              label: { color: 'var(--text-primary)' }
            }}
          />
          
          <Textarea
            label="简介 / Description"
            placeholder="请输入书籍简介（可选）"
            value={editDescription}
            onChange={(e) => setEditDescription(e.currentTarget.value)}
            minRows={3}
            maxRows={6}
            autosize
            styles={{
              input: { borderRadius: 0, borderColor: 'var(--border-color)' },
              label: { color: 'var(--text-primary)' }
            }}
          />
          
          <Group justify="flex-end" mt="md" gap="md" style={{ paddingRight: '20px' }}>
            <SignatureButton 
              text="取消 / Cancel"
              onClick={() => setEditModalOpened(false)}
              color="var(--text-secondary)"
            />
            <SignatureButton 
              text="保存 / Save"
              onClick={handleSaveMetadata}
              color="var(--accent-secondary)"
            />
          </Group>
        </Stack>
      </Modal>
      
      {/* 新建笔记Modal */}
      <Modal
        opened={createNotebookModalOpened}
        onClose={() => {
          setCreateNotebookModalOpened(false);
          setNewNotebookName('');
        }}
        title={<Text style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>新建笔记 / New Notebook</Text>}
        centered
        size="md"
        styles={{
          content: { borderRadius: 0, backgroundColor: 'var(--bg-primary)' },
          header: { borderBottom: '1px solid var(--border-color)' }
        }}
      >
        <TextInput
          label="笔记名称 / Notebook Name"
          placeholder="请输入笔记名称"
          value={newNotebookName}
          onChange={(e) => setNewNotebookName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCreateNotebook();
            }
          }}
          autoFocus
          styles={{
            input: { borderRadius: 0, borderColor: 'var(--border-color)' },
            label: { color: 'var(--text-primary)' }
          }}
        />
        
        <Group justify="flex-end" mt="md" gap="md" style={{ paddingRight: '20px' }}>
          <SignatureButton 
            text="取消 / Cancel"
            onClick={() => {
              setCreateNotebookModalOpened(false);
              setNewNotebookName('');
            }}
            color="var(--text-secondary)"
          />
          <SignatureButton 
            text="创建 / Create"
            onClick={handleCreateNotebook}
            color="var(--accent-secondary)"
          />
        </Group>
      </Modal>

      {/* 标签管理Modal */}
      <Modal
        opened={tagModalOpened}
        onClose={() => setTagModalOpened(false)}
        title={<Text style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>管理标签 / Manage Tags</Text>}
        centered
        size="md"
        styles={{
          content: { borderRadius: 0, backgroundColor: 'var(--bg-primary)' },
          header: { borderBottom: '1px solid var(--border-color)' }
        }}
      >
        <Stack gap="lg">
          {/* 当前标签 */}
          <Box>
            <Text size="sm" mb="xs" style={{ color: 'var(--text-secondary)' }}>
              当前标签 ({bookTags.length})
            </Text>
            {bookTags.length > 0 ? (
              <Group gap="xs">
                {bookTags.map((tag) => (
                  <Badge
                    key={tag}
                    size="lg"
                    style={{
                      backgroundColor: 'var(--accent-secondary)',
                      color: 'var(--bg-primary)',
                      borderRadius: 0,
                      cursor: 'pointer',
                    }}
                    onClick={() => handleRemoveTag(tag)}
                  >
                    #{tag}
                  </Badge>
                ))}
              </Group>
            ) : (
              <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
                暂无标签
              </Text>
            )}
          </Box>
          
          {/* 添加新标签 */}
          <Group gap="xs" align="flex-end">
            <TextInput
              label="添加新标签 / Add New Tag"
              placeholder="输入新标签名称"
              value={newTag}
              onChange={(e) => setNewTag(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              style={{ flex: 1 }}
              styles={{
                input: { borderRadius: 0, borderColor: 'var(--border-color)' },
                label: { color: 'var(--text-primary)' }
              }}
            />
            <Button
              onClick={() => handleAddTag()}
              size="md"
              styles={{
                root: {
                  backgroundColor: 'var(--accent-secondary)',
                  color: 'var(--text-primary)',
                  borderRadius: 0,
                  height: 36,
                  '&:hover': {
                    backgroundColor: 'var(--accent-secondary)',
                    opacity: 0.8,
                  },
                },
              }}
            >
              <IconPlus size={20} />
            </Button>
          </Group>
          
          {/* 标签库 */}
          <Box>
            <Text size="sm" mb="xs" style={{ color: 'var(--text-secondary)' }}>
              选择其他书籍使用的标签
            </Text>
            {tags.length > 0 ? (
              <Group gap="xs">
                {tags.map((tag) => {
                  const isSelected = bookTags.includes(tag.name);
                  return (
                    <Badge
                      key={tag.id}
                      size="lg"
                      style={{
                        backgroundColor: isSelected ? 'var(--accent-secondary)' : 'transparent',
                        color: isSelected ? 'var(--bg-primary)' : 'var(--text-primary)',
                        borderColor: 'var(--accent-secondary)',
                        borderWidth: '1px',
                        borderRadius: 0,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onClick={() => {
                        if (isSelected) {
                          handleRemoveTag(tag.name);
                        } else {
                          handleAddTagDirectly(tag.name);
                        }
                      }}
                    >
                      #{tag.name}
                    </Badge>
                  );
                })}
              </Group>
            ) : (
              <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
                暂无标签，请输入创建
              </Text>
            )}
          </Box>
          
          <Group justify="flex-end" mt="md" gap="md" style={{ paddingRight: '20px' }}>
            <SignatureButton 
              text="取消 / Cancel"
              onClick={() => setTagModalOpened(false)}
              color="var(--text-secondary)"
            />
            <SignatureButton 
              text="确认 / Confirm"
              onClick={() => setTagModalOpened(false)}
              color="var(--accent-secondary)"
            />
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
};

export default LibraryPage;
