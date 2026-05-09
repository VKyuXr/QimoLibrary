import { Box, Grid, Card, Text, Group } from '@mantine/core';
import { IconBook, IconDatabase } from '@tabler/icons-react';
import { useBook } from '../context/BookContext';
import { useTranslation } from '../hooks/useTranslation';

const HomePage: React.FC = () => {
  const { books } = useBook();
  const { t } = useTranslation();

  // 计算真实数据
  const totalBooks = books.length;
  const totalStorage = books.length > 0 
    ? `${(books.length * 2.5).toFixed(1)} MB` // 假设每本书平均 2.5MB，实际应从文件系统获取
    : '0 MB';

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
