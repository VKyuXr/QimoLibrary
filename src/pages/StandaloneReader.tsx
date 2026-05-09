import { useEffect, useRef, useState } from 'react';
import { Box, Button, Group, Text } from '@mantine/core';
import ePub from 'epubjs';
import { readFile } from '@tauri-apps/plugin-fs';

const StandaloneReader: React.FC = () => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [book, setBook] = useState<any>(null);
  const [rendition, setRendition] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 从 URL 获取文件路径
  const searchParams = new URLSearchParams(window.location.search);
  const filePath = searchParams.get('filePath');

  useEffect(() => {
    console.log('=== StandaloneReader 组件已挂载 ===');
    console.log('当前 URL:', window.location.href);
    console.log('URL Search:', window.location.search);
    console.log('解析的文件路径:', filePath);

    if (!filePath) {
      console.error('❌ 未提供文件路径');
      setError('未提供文件路径');
      setLoading(false);
      return;
    }

    // 等待下一帧，确保 DOM 已经完全渲染
    const timer = setTimeout(() => {
      const initEpub = async () => {
        try {
          setLoading(true);
          console.log('Starting EPUB initialization...');
          
          // 检查容器尺寸
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
          
          // 使用 @tauri-apps/plugin-fs 读取文件
          console.log('Reading file...');
          const fileData = await readFile(filePath);
          console.log('File size:', fileData.length, 'bytes');
          
          // 将 Uint8Array 转换为 ArrayBuffer
          const arrayBuffer = fileData.buffer as ArrayBuffer;
          console.log('ArrayBuffer size:', arrayBuffer.byteLength);
          
          // 使用 epub.js 加载 EPUB
          console.log('Creating book...');
          const newBook = ePub(arrayBuffer);
          console.log('Book created:', newBook);
          
          console.log('Viewer element:', viewerRef.current);
          console.log('Rendering to viewer...');
          
          // 获取容器的实际尺寸
          const containerRect = viewerRef.current.getBoundingClientRect();
          console.log('Container size:', containerRect.width, 'x', containerRect.height);
          
          const newRendition = newBook.renderTo(viewerRef.current!, {
            // 使用像素值而不是百分比，确保有明确的尺寸
            width: containerRect.width || 800,
            height: containerRect.height || 600,
            // 允许 EPUB 内容中的脚本执行（用于交互式 EPUB）
            // 注意：仅对可信的 EPUB 文件启用此选项
            allowScriptedContent: true
          } as any);
          console.log('Rendition created:', newRendition);
          
          console.log('Displaying...');
          await newRendition.display();
          console.log('Displayed successfully');
          
          setBook(newBook);
          setRendition(newRendition);
          setLoading(false);
        } catch (err) {
          console.error('Failed to load EPUB:', err);
          setError(err instanceof Error ? err.message : 'Failed to load EPUB');
          setLoading(false);
        }
      };

      initEpub();
    }, 100); // 延迟 100ms 确保布局完成

    // 清理函数
    return () => {
      clearTimeout(timer);
      if (book) {
        book.destroy();
      }
    };
  }, []);

  // 翻页处理函数
  const handlePrev = () => {
    if (rendition) {
      rendition.prev();
    }
  };

  const handleNext = () => {
    if (rendition) {
      rendition.next();
    }
  };

  return (
    <Box style={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: '#f0f0f0'
    }}>
      {/* 调试信息 */}
      <Box style={{ 
        padding: '20px', 
        backgroundColor: '#ffeb3b',
        borderBottom: '2px solid #f57c00'
      }}>
        <Text fw={700} size="lg">🔧 调试模式</Text>
        <Text size="sm">URL: {window.location.href}</Text>
        <Text size="sm">文件路径: {filePath || '未提供'}</Text>
        <Text size="sm">加载状态: {loading ? '加载中...' : '完成'}</Text>
        {error && <Text size="sm" c="red">错误: {error}</Text>}
      </Box>

      {/* 导航控制栏 */}
      <Group justify="space-between" p="md" style={{ 
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #ddd',
        flexShrink: 0
      }}>
        <Button onClick={handlePrev} disabled={!rendition} variant="light">
          上一页
        </Button>
        <Text fw={500}>EPUB Reader</Text>
        <Button onClick={handleNext} disabled={!rendition} variant="light">
          下一页
        </Button>
      </Group>

      {/* 阅读区域 */}
      <Box style={{ position: 'relative', flex: 1, overflow: 'hidden', backgroundColor: 'white' }}>
        <div ref={viewerRef} style={{ 
          width: '100%', 
          height: '100%',
          overflow: 'hidden'
        }} />
        
        {loading && (
          <Box style={{ 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            backgroundColor: 'rgba(255,255,255,0.9)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px'
          }}>
            加载中...
          </Box>
        )}
        
        {error && (
          <Box style={{
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            backgroundColor: 'rgba(255,255,255,0.9)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            color: 'red',
            padding: '20px',
            textAlign: 'center'
          }}>
            错误: {error}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default StandaloneReader;
