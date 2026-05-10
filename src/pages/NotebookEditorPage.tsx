import { Box, Group, Text, ScrollArea, ActionIcon, Modal, TextInput, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSearchParams } from 'react-router-dom';
import { IconTrash, IconFileText, IconPlus } from '@tabler/icons-react';
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../hooks/useTranslation';
import SignatureButton from '../components/decorative/SignatureButton';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface NotebookPage {
  id: string;
  title: string;
  href: string;
  order: number;
}

const NotebookEditorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  
  // 优先使用 URL 参数，如果没有则从 localStorage 恢复
  const urlEpubPath = searchParams.get('filePath');
  const epubPath = urlEpubPath || localStorage.getItem('last-opened-notebook') || '';
  
  // 从EPUB路径提取笔记本名称
  const getNotebookName = (path: string): string => {
    if (!path) return '笔记编辑器';
    const parts = path.replace(/\\/g, '/').split('/');
    const fileName = parts[parts.length - 1]; // 获取文件名
    if (fileName && fileName.endsWith('.epub')) {
      return fileName.slice(0, -5); // 移除.epub后缀
    }
    return fileName || '笔记编辑器';
  };
  
  const notebookName = getNotebookName(epubPath);
  
  const [pages, setPages] = useState<NotebookPage[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string>('');
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [isPreview, setIsPreview] = useState<boolean>(false);
  const [headings, setHeadings] = useState<Array<{level: number, text: string}>>([]);
  const [addPageModalOpened, setAddPageModalOpened] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [isValidating, setIsValidating] = useState(true); // 验证文件存在性的状态

  // 在渲染前检查文件是否存在
  useEffect(() => {
    const checkAndReset = async () => {
      if (epubPath) {
        try {
          const exists = await invoke<boolean>('check_file_exists', { path: epubPath });
          
          if (!exists) {
            console.warn('笔记文件不存在，恢复默认页面:', epubPath);
            localStorage.removeItem('last-opened-notebook');
            // 如果有 URL 参数，也清除它
            if (urlEpubPath) {
              window.history.replaceState(null, '', '/notebook-editor');
            }
            // 重新加载页面以显示空状态
            window.location.reload();
            return;
          }
        } catch (error) {
          console.error('检查文件存在性失败，恢复默认页面:', error);
          // 任何错误都清除记录并恢复默认
          localStorage.removeItem('last-opened-notebook');
          if (urlEpubPath) {
            window.history.replaceState(null, '', '/notebook-editor');
          }
          window.location.reload();
          return;
        }
      }
      
      // 检查完成，允许渲染UI
      setIsValidating(false);
    };
    
    checkAndReset();
  }, [epubPath, urlEpubPath]);

  // 加载页面列表
  useEffect(() => {
    if (epubPath) {
      loadPages();
    }
    // 不显示notification，只在页面上显示空状态文字
  }, [epubPath]);

  const loadPages = async () => {
    if (!epubPath) {
      console.warn('epubPath为空，跳过加载');
      return;
    }
    
    try {
      const pageList = await invoke<NotebookPage[]>('get_notebook_pages', { epubPath });
      setPages(pageList);
      
      // 如果有页面，选中第一个
      if (pageList.length > 0 && !currentPageId) {
        setCurrentPageId(pageList[0].id);
        loadPageContent(pageList[0].id);
      }
    } catch (error) {
      console.error('[NotebookEditor] 加载页面列表失败:', error);
      // 只在错误不是"文件不存在"时显示通知
      const errorMsg = String(error);
      if (!errorMsg.includes('系统找不到指定的路径') && !errorMsg.includes('specified file not found')) {
        notifications.show({
          title: '加载失败',
          message: errorMsg,
          color: 'red',
        });
      }
    }
  };

  const loadPageContent = async (pageId: string) => {
    try {
      // 调用后端API获取指定页面的内容
      const content = await invoke<string>('get_page_content_by_id', { 
        epubPath,
        pageId 
      });
      setMarkdownContent(content);
      extractHeadings(content);
      await renderMarkdown(content);
    } catch (error) {
      console.error('加载页面内容失败:', error);
      notifications.show({
        title: '加载失败',
        message: String(error),
        color: 'red',
      });
    }
  };

  // 渲染Markdown
  const renderMarkdown = useCallback(async (markdown: string) => {
    try {
      let html = await marked(markdown);
      
      // 为标题添加id，支持目录导航
      html = html.replace(
        /<h([1-6])>(.*?)<\/h\1>/g,
        (_match, level, content) => {
          const id = content.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
          return `<h${level} id="heading-${id}">${content}</h${level}>`;
        }
      );
      
      // 使用DOMPurify清理HTML，防止XSS攻击
      const cleanHtml = DOMPurify.sanitize(html);
      setRenderedHtml(cleanHtml);
    } catch (error) {
      console.error('Markdown渲染失败:', error);
    }
  }, []);

  // 提取标题生成目录
  const extractHeadings = useCallback((markdown: string) => {
    const headings: Array<{level: number, text: string}> = [];
    const lines = markdown.split('\n');
    
    lines.forEach(line => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2]
        });
      }
    });
    
    setHeadings(headings);
  }, []);

  // 保存当前页面
  const handleSave = async () => {
    if (!currentPageId) {
      notifications.show({
        title: '提示',
        message: '请先选择一个页面',
        color: 'yellow',
      });
      return;
    }

    try {
      // 调用新的API，按页面ID保存
      await invoke('save_page_content_by_id', { 
        epubPath,
        pageId: currentPageId,
        markdown: markdownContent 
      });
      
      // 刷新页面列表以更新标题
      await loadPages();
      
      notifications.show({
        title: '成功',
        message: '已保存',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: '保存失败',
        message: String(error),
        color: 'red',
      });
    }
  };

  // 添加新页面
  const handleAddPage = async () => {
    if (!newPageTitle.trim()) {
      notifications.show({
        title: '提示',
        message: '请输入页面标题',
        color: 'yellow',
      });
      return;
    }

    try {
      const newPage = await invoke<NotebookPage>('add_notebook_page', {
        epubPath,
        title: newPageTitle,
      });

      // 刷新页面列表
      await loadPages();
      
      // 关闭Modal
      setAddPageModalOpened(false);
      setNewPageTitle('');
      
      // 选中新页面并加载内容
      setCurrentPageId(newPage.id);
      setMarkdownContent('');
      setRenderedHtml('');
      setHeadings([]);
      
      notifications.show({
        title: '成功',
        message: '页面已添加',
        color: 'green',
      });
    } catch (error) {
      console.error('添加页面失败:', error);
      notifications.show({
        title: '添加失败',
        message: String(error),
        color: 'red',
      });
    }
  };

  // 删除页面
  const handleDeletePage = async (pageId: string) => {
    if (!epubPath) return;
    
    try {
      await invoke('delete_notebook_page_command', {
        epubPath,
        pageId
      });
      
      // 如果删除的是当前页面，切换到第一个页面
      if (currentPageId === pageId) {
        const remainingPages = pages.filter(p => p.id !== pageId);
        if (remainingPages.length > 0) {
          setCurrentPageId(remainingPages[0].id);
          loadPageContent(remainingPages[0].id);
        } else {
          setCurrentPageId('');
          setMarkdownContent('');
          setRenderedHtml('');
          setHeadings([]);
        }
      }
      
      // 刷新页面列表
      await loadPages();
      
      notifications.show({
        title: '成功',
        message: '页面已删除',
        color: 'green',
      });
    } catch (error) {
      console.error('删除页面失败:', error);
      notifications.show({
        title: '删除失败',
        message: String(error),
        color: 'red',
      });
    }
  };

  // 切换预览模式
  const togglePreview = async () => {
    if (!isPreview) {
      await renderMarkdown(markdownContent);
    }
    setIsPreview(!isPreview);
  };

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // 自动保存
  const autoSave = async () => {
    if (!markdownContent || !currentPageId) return;
    
    try {
      await invoke('save_page_content_by_id', { 
        epubPath, 
        pageId: currentPageId,
        markdown: markdownContent 
      });
    } catch (error) {
      console.error('自动保存失败:', error);
      notifications.show({
        title: '自动保存失败',
        message: '请手动保存以确保内容不丢失',
        color: 'red',
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(autoSave, 3000);
    return () => clearTimeout(timer);
  }, [markdownContent, epubPath, currentPageId]);

  // 如果正在验证或没有epubPath，显示加载/空状态
  if (isValidating || !epubPath) {
    return (
      <Box className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Stack align="center" gap="md">
          {isValidating ? (
            <Text size="lg" style={{ color: 'var(--text-secondary)' }}>加载中...</Text>
          ) : (
            <>
              <Text size="lg" style={{ color: 'var(--text-secondary)' }}>
                未指定笔记文件
              </Text>
              <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
                请从书架页面打开或创建笔记
              </Text>
            </>
          )}
        </Stack>
      </Box>
    );
  }

  return (
    <Box className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* 顶部工具栏 */}
      <Box
        className="h-[60px] px-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <Group gap="md">
          <Text fw={600} size="lg" style={{ color: 'var(--text-primary)' }}>
            {notebookName}
          </Text>
        </Group>
        
        <Group gap="md">
          <SignatureButton
            text={isPreview ? '编辑' : '预览'}
            onClick={togglePreview}
            color="var(--text-secondary)"
          />
          <SignatureButton
            text="保存"
            onClick={handleSave}
            color="var(--accent-secondary)"
          />
        </Group>
      </Box>

      {/* 三栏主体 */}
      <Box className="flex flex-1 overflow-hidden">
        {/* 左侧: 页面列表 */}
        <Box
          className="w-[200px] flex flex-col"
          style={{ borderRight: '1px solid var(--border-color)' }}
        >
          <Box className="p-3 flex items-center justify-between" style={{ borderBottom: '1px dashed var(--border-color)' }}>
            <Text fw={500} size="sm" style={{ color: 'var(--text-primary)' }}>
              页面列表
            </Text>
            <ActionIcon
              variant="subtle"
              size="sm"
              style={{ color: 'var(--accent-secondary)' }}
              onClick={() => setAddPageModalOpened(true)}
            >
              <IconPlus size={18} />
            </ActionIcon>
          </Box>
          
          <ScrollArea className="flex-1">
            <Stack gap={0}>
              {pages.map((page) => (
                <Box
                  key={page.id}
                  className="px-3 py-2 cursor-pointer"
                  style={{
                    backgroundColor: currentPageId === page.id ? 'var(--highlight)' : 'transparent',
                  }}
                  onClick={() => {
                    setCurrentPageId(page.id);
                    loadPageContent(page.id);
                  }}
                  onMouseEnter={(e) => {
                    if (currentPageId !== page.id) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPageId !== page.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <IconFileText size={16} style={{ color: 'var(--text-secondary)' }} />
                      <Text size="sm" style={{ color: 'var(--text-primary)' }} lineClamp={1}>
                        {page.title}
                      </Text>
                    </Group>
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      style={{ color: 'var(--text-secondary)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePage(page.id);
                      }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Box>
              ))}
            </Stack>
          </ScrollArea>
        </Box>

        {/* 中间: 编辑器 */}
        <Box className="flex-1 flex flex-col">
          {isPreview ? (
            <ScrollArea className="flex-1 p-4">
              <Box
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            </ScrollArea>
          ) : (
            <textarea
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              placeholder={!currentPageId ? "请先选择一个页面" : "在此输入 Markdown 内容..."}
              disabled={!currentPageId}
              style={{
                width: '100%',
                height: '100%',
                marginBottom: '10px',
                padding: '12px',
                border: 'none',
                backgroundColor: !currentPageId ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                color: !currentPageId ? 'var(--text-secondary)' : 'var(--text-primary)',
                fontFamily: 'Courier Prime, monospace',
                fontSize: '14px',
                lineHeight: '1.6',
                resize: 'none',
                outline: 'none',
                cursor: !currentPageId ? 'not-allowed' : 'text',
              }}
            />
          )}
        </Box>

        {/* 右侧: 目录 */}
        <Box
          className="w-[250px] flex flex-col"
          style={{ borderLeft: '1px solid var(--border-color)' }}
        >
          <Box className="p-3" style={{ borderBottom: '1px dashed var(--border-color)' }}>
            <Text fw={500} size="sm" style={{ color: 'var(--text-primary)' }}>
              {t('toc')}
            </Text>
          </Box>
          
          <ScrollArea className="flex-1 p-3">
            {headings.length === 0 ? (
              <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
                {t('noHeadings')}
              </Text>
            ) : (
              <Stack gap="xs">
                {headings.map((heading, index) => {
                  const headingId = heading.text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
                  
                  return (
                    <Text
                      key={index}
                      size="sm"
                      style={{
                        paddingLeft: `${(heading.level - 1) * 12}px`,
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        const element = document.getElementById(`heading-${headingId}`);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      {heading.text}
                    </Text>
                  );
                })}
              </Stack>
            )}
          </ScrollArea>
        </Box>
      </Box>

      {/* 添加页面Modal */}
      <Modal
        opened={addPageModalOpened}
        onClose={() => {
          setAddPageModalOpened(false);
          setNewPageTitle('');
        }}
        title={<Text style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>添加新页面 / Add New Page</Text>}
        centered
        size="md"
        styles={{
          content: { borderRadius: 0, backgroundColor: 'var(--bg-primary)' },
          header: { borderBottom: '1px solid var(--border-color)' }
        }}
      >
        <TextInput
          label="页面标题"
          placeholder="例如: 第一章"
          value={newPageTitle}
          onChange={(e) => setNewPageTitle(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAddPage();
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
            text="取消"
            onClick={() => {
              setAddPageModalOpened(false);
              setNewPageTitle('');
            }}
            color="var(--text-secondary)"
          />
          <SignatureButton text="添加" onClick={handleAddPage} color="var(--accent-secondary)" />
        </Group>
      </Modal>
    </Box>
  );
};

export default NotebookEditorPage;
