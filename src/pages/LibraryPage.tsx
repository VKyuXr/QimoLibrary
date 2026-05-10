import { Box, Title, Group, Stack, Card, Text, Button, ScrollArea, ActionIcon, Tooltip, Checkbox, Modal, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useBook } from '../context/BookContext';
import { useNavigate } from 'react-router-dom';
import { IconDownload, IconTrash, IconEdit, IconNote } from '@tabler/icons-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useLibrary } from '../hooks/useLibrary';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../hooks/useTranslation';
import SignatureButton from '../components/decorative/SignatureButton';

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
            onClick={(e) => e.stopPropagation()}
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
  const { books, selectedBook, selectBook, libraryPath, refreshBooks, removeBook } = useBook();
  const { addBookToLibrary } = useLibrary();
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
      // 打开文件选择对话框，只允许选择 .epub 文件
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'EPUB Files',
          extensions: ['epub']
        }]
      });

      console.log('选择的文件:', selected);

      if (selected) {
        const pathStr = selected.toString();
        console.log('添加书籍到库:', pathStr, '库路径:', libraryPath);
        
        // 调用Rust命令添加书籍
        const newBook = await addBookToLibrary(pathStr, libraryPath);
        console.log('书籍添加成功:', newBook);
        
        // 重新加载书籍列表
        await reloadBooks();
        
        notifications.show({
          title: '成功',
          message: `《${newBook.title}》已添加到书库`,
          color: 'green',
        });
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

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(books.map(book => book.id)));
    } else {
      setSelectedIds(new Set());
    }
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
    
    // 填充当前值
    setEditTitle(selectedBook.title);
    setEditAuthor(selectedBook.author);
    setEditPublisher(selectedBook.publisher || '');
    setEditDescription(selectedBook.description || '');
    setEditModalOpened(true);
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
            <Group justify="space-between">
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
          {books.length > 0 ? (
            <Box className="py-4">
              {/* 全选复选框 */}
              <Box className="mb-2 px-2" style={{ borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px' }}>
                <Checkbox
                  checked={selectedIds.size === books.length && books.length > 0}
                  indeterminate={selectedIds.size > 0 && selectedIds.size < books.length}
                  onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                  label={`全选 (${selectedIds.size}/${books.length})`}
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
              </Box>
              
              {books.map((book) => (
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
              <Text size="sm" style={{ color: 'var(--text-secondary)' }}>暂无书籍</Text>
              <Text size="xs" mt={4} style={{ color: 'var(--text-secondary)' }}>点击下方按钮导入 EPUB 文件</Text>
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
          <Group justify="flex-end" mt="md" gap="xl" style={{ paddingRight: '20px' }}>
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
          
          <Group justify="flex-end" mt="md" gap="xl">
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
        
        <Group justify="flex-end" mt="md" gap="xl">
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
    </Box>
  );
};

export default LibraryPage;
