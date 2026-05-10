import { useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';
import { readFile } from '@tauri-apps/plugin-fs';
import { Box } from '@mantine/core';
import { useReaderStyles } from '../../hooks/useReaderStyles';

interface EpubReaderProps {
  filePath?: string;
}

const EpubReader: React.FC<EpubReaderProps> = ({ filePath }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [book, setBook] = useState<any>(null);
  const [rendition, setRendition] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { readerTheme } = useReaderStyles();

  useEffect(() => {
    const timer = setTimeout(() => {
      const initEpub = async () => {
        try {
          setLoading(true);
          console.log('Starting EPUB initialization...');
          
          if (!viewerRef.current) {
            console.error('Viewer element not found');
            setError('Viewer element not found');
            setLoading(false);
            return;
          }
          
          const rect = viewerRef.current.getBoundingClientRect();
          console.log('Viewer dimensions:', rect.width, 'x', rect.height);
          
          if (rect.height === 0) {
            console.warn('Viewer has zero height, waiting...');
          }
          
          let targetFilePath = filePath;
          
          if (!targetFilePath) {
            const urlParams = new URLSearchParams(window.location.search);
            targetFilePath = urlParams.get('filePath') || undefined;
          }
          
          console.log('[EpubReader Debug] Received filePath prop:', filePath);
          console.log('[EpubReader Debug] Final targetFilePath:', targetFilePath);
          
          if (!targetFilePath) {
            console.log('No file path provided, showing empty state.');
            setLoading(false);
            return;
          }
          
          console.log('Loading EPUB from:', targetFilePath);
          
          const fileData = await readFile(targetFilePath);
          console.log('File loaded, size:', fileData.length);
          
          const arrayBuffer = fileData.buffer;
          console.log('ArrayBuffer size:', arrayBuffer.byteLength);
          
          console.log('Creating book...');
          const newBook = ePub(arrayBuffer);
          console.log('Book created:', newBook);
          
          console.log('Viewer element:', viewerRef.current);
          console.log('Rendering to viewer...');
          
          const containerRect = viewerRef.current.getBoundingClientRect();
          console.log('Container size:', containerRect.width, 'x', containerRect.height);
          
          const newRendition = newBook.renderTo(viewerRef.current!, {
            width: containerRect.width,
            height: containerRect.height,
            allowScriptedContent: true,
            flow: 'paginated',
            spread: 'auto'
          } as any);
          console.log('Rendition created:', newRendition);
          
          // 应用独立的阅读器样式(不受主应用主题影响)
          newRendition.themes.default({
            'body': {
              'background-color': readerTheme.backgroundColor,
              'color': readerTheme.textColor,
              'font-family': readerTheme.fontFamily,
              'font-size': `${readerTheme.fontSize}px`,
              'line-height': readerTheme.lineHeight
            },
            'a': {
              'color': readerTheme.linkColor
            }
          });
          
          console.log('Displaying...');
          await newRendition.display();
          console.log('Displayed successfully');
          
          setBook(newBook);
          setRendition(newRendition);
          setLoading(false);
          
          try {
            const toc = await newBook.loaded.navigation.then((nav: any) => {
              return nav.toc || [];
            });
            window.dispatchEvent(new CustomEvent('toc-update', { detail: toc }));
          } catch (error) {
            console.warn('无法加载目录:', error);
          }
          
          // 监听位置变化，保存阅读进度
          newRendition.on('relocated', (location: any) => {
            console.log('位置变化:', location.start.cfi);
            const cfi = location.start.cfi;
            
            // 保存到 localStorage
            if (targetFilePath) {
              const storageKey = `epub-progress-${targetFilePath}`;
              localStorage.setItem(storageKey, JSON.stringify({
                cfi,
                timestamp: Date.now()
              }));
              console.log('已保存阅读进度:', cfi);
            }
          });

          // 监听全局翻页事件
          window.addEventListener('epub-prev', () => newRendition.prev());
          window.addEventListener('epub-next', () => newRendition.next());
          
          // 恢复上次阅读位置
          if (targetFilePath) {
            const storageKey = `epub-progress-${targetFilePath}`;
            const savedProgress = localStorage.getItem(storageKey);
            
            if (savedProgress) {
              try {
                const progress = JSON.parse(savedProgress);
                console.log('找到保存的进度:', progress.cfi);
                
                // 延迟一下再跳转，确保渲染完成
                setTimeout(() => {
                  newRendition.display(progress.cfi)
                    .then(() => {
                      console.log('✅ 已恢复到上次阅读位置');
                    })
                    .catch((err: any) => {
                      console.warn('恢复进度失败:', err);
                    });
                }, 500);
              } catch (err) {
                console.warn('解析保存的进度失败:', err);
              }
            }
          }
        } catch (err) {
          console.error('Failed to load EPUB:', err);
          setError(err instanceof Error ? err.message : 'Failed to load EPUB');
          setLoading(false);
          
          // 如果加载失败，清除 localStorage 中的记录
          if (filePath) {
            console.warn('EPUB加载失败，清除记录:', filePath);
            localStorage.removeItem('last-opened-book');
          }
        }
      };

      initEpub();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (book) {
        book.destroy();
      }
    };
  }, [filePath]);

  useEffect(() => {
    const handleNavigate = async (event: CustomEvent<string>) => {
      console.log('收到目录导航事件:', event.detail);
      if (rendition && book) {
        try {
          console.log('尝试跳转到:', event.detail);
          
          await rendition.display(event.detail);
          console.log('✅ 直接跳转成功');
        } catch (err) {
          console.warn('❌ 直接跳转失败，尝试使用 CFI:', err);
          
          try {
            let targetSection: any = null;
            
            book.spine.each((section: any) => {
              console.log('检查章节:', section.href, 'vs', event.detail);
              if (section.href === event.detail || 
                  section.href.endsWith('/' + event.detail) ||
                  section.href.includes(event.detail)) {
                targetSection = section;
              }
            });
            
            if (targetSection) {
              console.log('找到目标章节:', targetSection.href);
              await rendition.display(targetSection.index);
              console.log('✅ 通过 index 跳转成功');
            } else {
              console.error('❌ 未找到对应的章节:', event.detail);
              console.log('可用的章节列表:');
              book.spine.each((section: any) => {
                console.log('  -', section.href, '(index:', section.index + ')');
              });
            }
          } catch (err2) {
            console.error('❌ CFI 跳转也失败:', err2);
          }
        }
      } else {
        console.warn('⚠️ rendition 或 book 未初始化');
      }
    };

    window.addEventListener('toc-navigate', handleNavigate as any);
    return () => {
      window.removeEventListener('toc-navigate', handleNavigate as any);
    };
  }, [rendition, book]);

  useEffect(() => {
    if (!rendition || !viewerRef.current) return;

    const handleResize = () => {
      const containerRect = viewerRef.current!.getBoundingClientRect();
      console.log('Window resized, new size:', containerRect.width, 'x', containerRect.height);
      
      rendition.resize(containerRect.width, containerRect.height);
    };

    let resizeTimer: ReturnType<typeof setTimeout>;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 200);
    };

    window.addEventListener('resize', debouncedResize);
    
    // 强制限制 iframe 不溢出
    const enforceIframeBounds = () => {
      const iframe = viewerRef.current?.querySelector('iframe');
      if (iframe) {
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.maxWidth = '100%';
        iframe.style.maxHeight = '100%';
        iframe.style.position = 'absolute';
        iframe.style.top = '0';
        iframe.style.left = '0';
      }
    };
    
    // 延迟执行以确保 iframe 已渲染
    setTimeout(enforceIframeBounds, 500);
    
    // 使用 MutationObserver 持续监控 iframe 样式变化
    const observer = new MutationObserver(() => {
      enforceIframeBounds();
    });
    
    if (viewerRef.current) {
      observer.observe(viewerRef.current, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['style']
      });
    }
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, [rendition]);

  return (
    <Box className="relative w-full h-full" style={{ backgroundColor: readerTheme.backgroundColor }}>
      {!loading && !error && !filePath && (
        <div className="flex items-center justify-center h-full text-lg" style={{ 
          color: '#999',
          backgroundColor: readerTheme.backgroundColor
        }}>
          <p>目前还没有打开书籍,请点击左上角按钮选择书籍</p>
        </div>
      )}
        
      {/* 确保 viewerRef 容器占满空间,但不溢出 */}
      <div 
        ref={viewerRef} 
        className="w-full h-full" 
        style={{ 
          overflow: 'hidden',
          position: 'relative'
        }} 
      />
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10" style={{
          backgroundColor: 'var(--bg-primary)'
        }}>
          <div className="loading-spinner" style={{ color: 'var(--text-primary)' }}>加载中...</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10" style={{
          backgroundColor: 'var(--bg-primary)'
        }}>
          <div className="error-message" style={{ color: 'var(--accent-secondary)' }}>错误: {error}</div>
        </div>
      )}

      {!loading && !error && rendition && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-5 z-20">
          {/* 翻页按钮已移至 ReaderPage，此处保留占位或移除 */}
        </div>
      )}
    </Box>
  );
};

export default EpubReader;
