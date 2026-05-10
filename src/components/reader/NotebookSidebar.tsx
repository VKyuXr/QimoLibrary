import { Box, Stack, Text, Button, Group, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNotebook } from '../../hooks/useNotebook';
import SignatureButton from '../decorative/SignatureButton';
import { useTranslation } from '../../hooks/useTranslation';
import { useState, useEffect } from 'react';

interface NotebookSidebarProps {
  epubPath: string;
}

const NotebookSidebar: React.FC<NotebookSidebarProps> = ({ epubPath }) => {
  const {
    markdownContent,
    setMarkdownContent,
    renderedHtml,
    isEditMode,
    headings,
    saveContent,
    toggleEditMode
  } = useNotebook(epubPath);

  const { t } = useTranslation();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  // 保存处理
  const handleSave = async () => {
    try {
      setSaveStatus('saving');
      await saveContent(markdownContent);
      setSaveStatus('success');
      
      // 2秒后重置状态
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('idle');
      notifications.show({
        title: '保存失败',
        message: String(error),
        color: 'red',
      });
    }
  };

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S: 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Ctrl/Cmd + E: 切换编辑/预览模式
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        toggleEditMode();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, toggleEditMode]);

  // 自动保存：检测到停止输入后3秒自动保存
  useEffect(() => {
    if (!isEditMode || !markdownContent) return;
    
    const timer = setTimeout(() => {
      saveContent(markdownContent).catch((error) => {
        console.error('自动保存失败:', error);
      });
    }, 3000); // 3秒
    
    return () => clearTimeout(timer);
  }, [markdownContent, isEditMode, saveContent]);

  return (
    <Box 
      className="w-80 flex flex-col"
      style={{ 
        borderRight: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-primary)'
      }}
    >
      {/* 顶部工具栏 */}
      <Box className="p-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={500} style={{ color: 'var(--text-primary)' }}>
              {t('notebookEditor')}
            </Text>
            <Group>
              <Button size="xs" onClick={toggleEditMode}>
                {isEditMode ? t('preview') : t('edit')}
              </Button>
              <SignatureButton
                text={saveStatus === 'saving' ? '保存中...' : (saveStatus === 'success' ? '已保存!' : t('save'))}
                onClick={handleSave}
                color="var(--accent-secondary)"
              />
            </Group>
          </Group>
        </Stack>
      </Box>

      {/* 中间: 编辑/预览区 */}
      <Box className="flex-1 overflow-y-auto p-4">
        {isEditMode ? (
          <Textarea
            value={markdownContent}
            onChange={(e) => setMarkdownContent(e.target.value)}
            placeholder="在此输入 Markdown 内容..."
            autosize
            minRows={20}
            styles={{
              input: {
                borderRadius: 0,
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
                fontFamily: 'Courier Prime',
              }
            }}
          />
        ) : (
          <Box
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}
      </Box>

      {/* 底部: 标题目录 */}
      <Box 
        className="h-48 overflow-y-auto p-4"
        style={{ borderTop: '1px solid var(--border-color)' }}
      >
        <Text fw={500} mb="sm" style={{ color: 'var(--text-primary)' }}>
          {t('toc')}
        </Text>
        
        {headings.length === 0 ? (
          <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
            {t('noHeadings')}
          </Text>
        ) : (
          <Stack gap="xs">
            {headings.map((heading, index) => {
              // 生成与useNotebook中相同的id
              const headingId = heading.text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
              
              return (
                <Text
                  key={index}
                  size="sm"
                  style={{
                    paddingLeft: `${(heading.level - 1) * 12}px`,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    // 滚动到对应标题
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
      </Box>
    </Box>
  );
};

export default NotebookSidebar;
