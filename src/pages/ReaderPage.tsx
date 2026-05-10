import { useSearchParams } from 'react-router-dom';
import EpubReader from '../components/reader/EpubReader';
import { ActionIcon, Box, Button, Stack, Text, Tooltip } from '@mantine/core';
import { IconList, IconChevronLeft, IconChevronRight, IconBook, IconX } from '@tabler/icons-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useState, useEffect } from 'react';

// 目录项组件 - 用于避免在map中使用Hooks
const TocItem: React.FC<{
  item: any;
  onClick: () => void;
}> = ({ item, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Button
      variant="subtle"
      justify="start"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="truncate"
      style={{
        borderRadius: 0,
        color: 'var(--text-primary)',
        backgroundColor: isHovered ? 'var(--highlight)' : 'transparent',
        fontSize: isHovered ? 'calc(1rem * 1.414)' : 'inherit',
        transition: 'all 0.2s ease',
        fontFamily: '"Source Han Serif SC", serif'
      }}
    >
      {item.label}
    </Button>
  );
};

const ReaderPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  // 优先使用 URL 参数，如果没有则从 localStorage 恢复
  const urlFilePath = searchParams.get('filePath');
  const [filePath, setFilePath] = useState<string | undefined>(() => {
    if (urlFilePath) {
      return urlFilePath;
    }
    // 从 localStorage 恢复上次打开的书籍
    const savedPath = localStorage.getItem('last-opened-book');
    return savedPath || undefined;
  });
  
  const [toc, setToc] = useState<any[]>([]);
  const [opened, setOpened] = useState(false);
  const [isValidating, setIsValidating] = useState(true); // 验证文件存在性的状态

  // 在渲染前检查文件是否存在
  useEffect(() => {
    console.log('[ReaderPage Debug] filePath:', filePath, 'isValidating:', isValidating);
    
    const checkAndReset = async () => {
      if (filePath) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const exists = await invoke<boolean>('check_file_exists', { path: filePath });
          
          if (!exists) {
            console.warn('书籍文件不存在，恢复默认页面:', filePath);
            localStorage.removeItem('last-opened-book');
            setFilePath(undefined);
            // 如果有 URL 参数，也清除它
            if (urlFilePath) {
              window.history.replaceState(null, '', '/reader');
            }
            setIsValidating(false);
            return;
          }
        } catch (error) {
          console.error('检查文件存在性失败，恢复默认页面:', error);
          // 任何错误都清除记录并恢复默认
          localStorage.removeItem('last-opened-book');
          setFilePath(undefined);
          if (urlFilePath) {
            window.history.replaceState(null, '', '/reader');
          }
          setIsValidating(false);
          return;
        }
      }
      
      // 检查完成，允许渲染UI
      setIsValidating(false);
    };
    
    checkAndReset();
  }, [filePath, urlFilePath]);

  useEffect(() => {
    const handleTocUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<any[]>;
      setToc(customEvent.detail);
    };

    window.addEventListener('toc-update', handleTocUpdate);
    return () => window.removeEventListener('toc-update', handleTocUpdate);
  }, []);

  const handlePrev = () => {
    window.dispatchEvent(new CustomEvent('epub-prev'));
  };

  const handleNext = () => {
    window.dispatchEvent(new CustomEvent('epub-next'));
  };

  const handleChapterClick = (href: string) => {
    window.dispatchEvent(new CustomEvent('toc-navigate', { detail: href }));
    setOpened(false);
  };

  const handleOpenExternalBook = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'EPUB Files',
          extensions: ['epub']
        }]
      });

      if (selected) {
        const path = selected.toString();
        // 更新状态和 URL
        setFilePath(path);
        window.history.replaceState(null, '', `/reader?filePath=${encodeURIComponent(path)}`);
        // 保存到 localStorage
        localStorage.setItem('last-opened-book', path);
      }
    } catch (error) {
      console.error('打开外部书籍失败:', error);
    }
  };

  const handleCloseBook = () => {
    // 清除阅读进度
    if (filePath) {
      localStorage.removeItem(`epub-progress-${filePath}`);
      // 清除上次打开的书籍记录
      localStorage.removeItem('last-opened-book');
    }
    // 清空当前状态
    setFilePath(undefined);
    // 清空目录
    setToc([]);
    // 关闭目录面板
    setOpened(false);
    // 清空 URL 参数
    window.history.replaceState(null, '', '/reader');
  };

  // 如果正在验证或没有filePath，显示加载/空状态
  if (isValidating || !filePath) {
    return (
      <Box className="relative flex w-full h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* 空状态内容 */}
        <Box className="flex items-center justify-center flex-1">
          <Stack align="center" gap="md">
            {isValidating ? (
              <Text size="lg" style={{ color: 'var(--text-secondary)' }}>加载中...</Text>
            ) : (
              <>
                <Text size="lg" style={{ color: 'var(--text-secondary)' }}>
                  未打开书籍
                </Text>
                <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
                  请从书架选择一本书开始阅读
                </Text>
              </>
            )}
          </Stack>
        </Box>

        {/* 左侧按钮列 - 从上到下的长条容器 */}
        <Box className="absolute left-[15px] top-[15px] bottom-[15px] z-50 flex flex-col gap-2">
          <Tooltip label="打开外部书籍" position="right">
            <ActionIcon 
              variant="outline"
              size="xl" 
              className="w-12 h-12"
              onClick={handleOpenExternalBook}
              style={{
                borderRadius: 0,
                borderColor: 'var(--accent-secondary)',
                color: 'var(--accent-secondary)'
              }}
            >
              <IconBook size={24} />
            </ActionIcon>
          </Tooltip>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="relative flex w-full h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* 阅读器主体 */}
      <Box className="relative flex-1 h-full px-[70px] py-[15px]">
        <EpubReader filePath={filePath} />
      </Box>

      {/* 左侧按钮列 - 从上到下的长条容器 */}
      <Box className="absolute left-[15px] top-[15px] bottom-[15px] z-50 flex flex-col gap-2">
        <Tooltip label="打开外部书籍" position="right">
          <ActionIcon 
            variant="outline"
            size="xl" 
            className="w-12 h-12"
            onClick={handleOpenExternalBook}
            style={{
              borderRadius: 0,
              borderColor: 'var(--accent-secondary)',
              color: 'var(--accent-secondary)'
            }}
          >
            <IconBook size={24} />
          </ActionIcon>
        </Tooltip>
        {filePath && (
          <Tooltip label="关闭书籍" position="right">
            <ActionIcon 
              variant="outline"
              size="xl" 
              className="w-12 h-12"
              onClick={handleCloseBook} 
              style={{
                borderRadius: 0,
                borderColor: 'var(--accent-secondary)',
                color: 'var(--accent-secondary)'
              }}
            >
              <IconX size={24} />
            </ActionIcon>
          </Tooltip>
        )}
      </Box>

      {/* 右侧按钮列 - 从上到下的长条容器 */}
      <Box className="absolute right-[15px] top-[15px] bottom-[15px] z-50 flex flex-col gap-2">
        <Tooltip label="目录" position="left">
          <ActionIcon 
            variant="outline"
            size="xl" 
            className="w-12 h-12"
            onClick={() => setOpened(!opened)}
            style={{
              borderRadius: 0,
              borderColor: 'var(--accent-secondary)',
              color: 'var(--accent-secondary)'
            }}
          >
            <IconList size={24} />
          </ActionIcon>
        </Tooltip>
        
        {/* 翻页按钮组 - 垂直居中 */}
        <Box className="flex-1 flex flex-col justify-center gap-2">
          <Tooltip label="上一页" position="left">
            <ActionIcon 
              variant="outline"
              size="xl" 
              className="w-12 h-12"
              onClick={handlePrev}
              style={{
                borderRadius: 0,
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)'
              }}
            >
              <IconChevronLeft size={24} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="下一页" position="left">
            <ActionIcon 
              variant="outline"
              size="xl" 
              className="w-12 h-12"
              onClick={handleNext}
              style={{
                borderRadius: 0,
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)'
              }}
            >
              <IconChevronRight size={24} />
            </ActionIcon>
          </Tooltip>
        </Box>
      </Box>

      {/* 目录卡片 - 矩形顶部 */}
      {opened && (
        <Box
          className="absolute right-[15px] top-[15px] z-50 w-[500px] max-h-[calc(100vh-30px)] overflow-auto"
          style={{
            borderRadius: 0,
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-primary)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 标题区 */}
          <Box style={{
            borderBottom: '1px solid var(--border-color)',
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Text fw={600} size="lg" style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>Contents</Text>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => setOpened(false)}
              style={{
                borderRadius: 0,
                color: 'var(--text-secondary)'
              }}
            >
              <IconX size={18} />
            </ActionIcon>
          </Box>
          
          <div className="flex flex-col gap-2 p-4">
            {toc.length === 0 ? (
              <Text ta="center" style={{ color: 'var(--text-secondary)' }}>暂无目录信息</Text>
            ) : (
              toc.map((item, index) => (
                <TocItem
                  key={index}
                  item={item}
                  onClick={() => {
                    handleChapterClick(item.href);
                    setOpened(false);
                  }}
                />
              ))
            )}
          </div>
        </Box>
      )}
    </Box>
  );
};

export default ReaderPage;
