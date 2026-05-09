import { Box } from '@mantine/core';

/**
 * 复古风格分隔线组件
 * 渐变效果,中间实两边虚
 */
const VintageDivider = () => (
  <Box style={{
    height: '1px',
    background: 'linear-gradient(90deg, transparent 0%, var(--border-color) 50%, transparent 100%)',
    margin: '24px 0'
  }} />
);

export default VintageDivider;
