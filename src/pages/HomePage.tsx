import { Box, Grid, Card, Text, Group } from '@mantine/core';
import { IconBook, IconDatabase } from '@tabler/icons-react';
import { useBook } from '../context/BookContext';
import { useTranslation } from '../hooks/useTranslation';
import { invoke } from '@tauri-apps/api/core';
import { useState, useEffect } from 'react';

const HomePage: React.FC = () => {
  const { books } = useBook();
  const { t } = useTranslation();
  const [totalStorage, setTotalStorage] = useState<string>('0 MB');

  // 计算真实文件大小
  useEffect(() => {
    const calculateStorage = async () => {
      if (books.length === 0) {
        setTotalStorage('0 MB');
        return;
      }

      try {
        let totalBytes = 0;
        
        // 遍历所有书籍，获取文件大小
        for (const book of books) {
          if (book.file_path) {
            try {
              const size = await invoke<number>('get_file_size', { path: book.file_path });
              totalBytes += size;
            } catch (error) {
              console.warn(`获取文件大小失败: ${book.file_path}`, error);
            }
          }
        }
        
        // 转换为合适的单位
        let displaySize: string;
        if (totalBytes < 1024 * 1024) {
          // 小于1MB，显示KB
          displaySize = `${(totalBytes / 1024).toFixed(1)} KB`;
        } else if (totalBytes < 1024 * 1024 * 1024) {
          // 小于1GB，显示MB
          displaySize = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
        } else {
          // 大于1GB，显示GB
          displaySize = `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
        }
        
        setTotalStorage(displaySize);
      } catch (error) {
        console.error('计算存储空间失败:', error);
        setTotalStorage('未知');
      }
    };

    calculateStorage();
  }, [books]);

  const totalBooks = books.length;

  return (
    <Box className="p-[15px]" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Grid>
        {/* 书籍数量 */}
        <Grid.Col span={6}>
          <Card withBorder padding="lg" style={{
            borderColor: 'var(--border-color)',
            borderWidth: '1px',
            position: 'relative'
          }}>
            {/* 顶部装饰线 */}
            <Box style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              height: '2px', 
              background: 'linear-gradient(90deg, var(--accent-secondary) 0%, transparent 100%)'
            }} />
            <Group justify="space-between" mb="xs">
              <Text size="sm" style={{ color: 'var(--text-secondary)' }}>{t('localBooks')}</Text>
              <IconBook size={24} color="var(--accent-secondary)" />
            </Group>
            <Text size="xl" fw={700} style={{ fontFamily: 'Playfair Display', fontSize: '48px', color: 'var(--text-primary)' }}>
              {t('booksCount', { count: totalBooks })}
            </Text>
          </Card>
        </Grid.Col>

        {/* 占用空间 */}
        <Grid.Col span={6}>
          <Card withBorder padding="lg" style={{
            borderColor: 'var(--border-color)',
            borderWidth: '1px',
            position: 'relative'
          }}>
            {/* 顶部装饰线 */}
            <Box style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              height: '2px', 
              background: 'linear-gradient(90deg, var(--accent-primary) 0%, transparent 100%)'
            }} />
            <Group justify="space-between" mb="xs">
              <Text size="sm" style={{ color: 'var(--text-secondary)' }}>{t('storageUsed')}</Text>
              <IconDatabase size={24} color="var(--accent-primary)" />
            </Group>
            <Text size="xl" fw={700} style={{ fontFamily: 'Playfair Display', fontSize: '48px', color: 'var(--text-primary)' }}>{totalStorage}</Text>
          </Card>
        </Grid.Col>
      </Grid>
    </Box>
  );
};

export default HomePage;
