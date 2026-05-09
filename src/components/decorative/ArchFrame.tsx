import { Box } from '@mantine/core';
import React from 'react';

interface ArchFrameProps {
  children: React.ReactNode;
}

/**
 * 拱门形装饰框组件
 * 用于标题、Logo等需要复古拱门效果的区域
 */
const ArchFrame: React.FC<ArchFrameProps> = ({ children }) => {
  return (
    <Box style={{
      borderRadius: '50% 50% 0 0 / 20px 20px 0 0',
      border: '1px solid var(--border-color)',
      borderBottom: 'none',
      padding: '16px 24px',
      textAlign: 'center',
      backgroundColor: 'var(--bg-primary)'
    }}>
      {children}
    </Box>
  );
};

export default ArchFrame;
