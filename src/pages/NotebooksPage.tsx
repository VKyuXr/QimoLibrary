import { Box, Title, Group, Stack, Card, Text, ScrollArea, ActionIcon, Modal, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { IconNote } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../hooks/useTranslation';
import SignatureButton from '../components/decorative/SignatureButton';

interface NotebookItem {
  id: string;
  title: string;
  file_path: string;
  is_notebook: boolean;
}

const NotebooksPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [notebooks, setNotebooks] = useState<NotebookItem[]>([]);
  const [libraryPath, setLibraryPath] = useState<string>('');
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');

  // 加载书库路径和笔记列表
  useEffect(() => {
    loadLibraryPath();
  }, []);

  const loadLibraryPath = async () => {
    try {
      const path = await invoke<string>('get_library_path');
      setLibraryPath(path);
      if (path) {
        loadNotebooks(path);
      }
    } catch (error) {
      console.error('获取书库路径失败:', error);
    }
  };

  const loadNotebooks = async (path: string) => {
    try {
      const books = await invoke<any[]>('get_library_books', { libraryPath: path });
      // 过滤出笔记类型的书籍
      const notebookList = books.filter((book: any) => book.is_notebook);
      setNotebooks(notebookList);
    } catch (error) {
      console.error('加载笔记列表失败:', error);
      notifications.show({
        title: '加载失败',
        message: String(error),
        color: 'red',
      });
    }
  };

  // 创建新笔记
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
        name: newNotebookName,
      });

      // 刷新笔记列表
      await loadNotebooks(libraryPath);

      // 关闭Modal并清空输入
      setCreateModalOpened(false);
      setNewNotebookName('');

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

  // 打开笔记
  const handleOpenNotebook = (notebook: NotebookItem) => {
    navigate(`/notebook-editor?filePath=${encodeURIComponent(notebook.file_path)}`);
  };

  return (
    <Box className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* 顶部标题栏 */}
      <Box
        className="px-8 py-6"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <Group justify="space-between">
          <Title order={2} style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>
            {t('notebooks') || '笔记'}
          </Title>
          <SignatureButton
            text="新建笔记"
            onClick={() => setCreateModalOpened(true)}
            color="var(--accent-secondary)"
          />
        </Group>
      </Box>

      {/* 笔记列表 */}
      <ScrollArea className="flex-1 p-8">
        {notebooks.length === 0 ? (
          <Box className="flex flex-col items-center justify-center h-full" style={{ minHeight: '400px' }}>
            <IconNote size={64} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
            <Text size="lg" style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
              暂无笔记
            </Text>
            <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
              点击右上角"新建笔记"开始创作
            </Text>
          </Box>
        ) : (
          <Stack gap="md">
            {notebooks.map((notebook) => (
              <Card
                key={notebook.id}
                padding="lg"
                radius={0}
                style={{
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--highlight)';
                  e.currentTarget.style.borderColor = 'var(--accent-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
                onClick={() => handleOpenNotebook(notebook)}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="md" wrap="nowrap">
                    <IconNote size={24} style={{ color: 'var(--accent-secondary)' }} />
                    <Stack gap={2}>
                      <Text fw={500} size="lg" style={{ color: 'var(--text-primary)' }}>
                        {notebook.title}
                      </Text>
                      <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
                        点击打开编辑
                      </Text>
                    </Stack>
                  </Group>
                  <ActionIcon
                    variant="subtle"
                    size="lg"
                    style={{
                      borderRadius: 0,
                      color: 'var(--accent-secondary)',
                    }}
                  >
                    →
                  </ActionIcon>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </ScrollArea>

      {/* 新建笔记Modal */}
      <Modal
        opened={createModalOpened}
        onClose={() => {
          setCreateModalOpened(false);
          setNewNotebookName('');
        }}
        title="新建笔记 / New Notebook"
        centered
        size="md"
        styles={{
          content: { borderRadius: 0, backgroundColor: 'var(--bg-primary)' },
          header: { borderBottom: '1px solid var(--border-color)' },
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
            label: { color: 'var(--text-primary)' },
          }}
        />

        <Group justify="flex-end" mt="md" gap="xl">
          <SignatureButton
            text="取消 / Cancel"
            onClick={() => {
              setCreateModalOpened(false);
              setNewNotebookName('');
            }}
            color="var(--text-secondary)"
          />
          <SignatureButton text="创建 / Create" onClick={handleCreateNotebook} color="var(--accent-secondary)" />
        </Group>
      </Modal>
    </Box>
  );
};

export default NotebooksPage;
