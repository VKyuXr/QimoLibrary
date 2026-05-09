import React, { useState } from 'react';
import { Box } from '@mantine/core';

interface SignatureButtonProps {
  text: string;
  onClick: () => void;
  color?: string;
}

const SignatureButton: React.FC<SignatureButtonProps> = ({ 
  text, 
  onClick, 
  color = 'var(--text-primary)' 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Box
      component="span"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        fontFamily: 'Pinyon Script',
        fontSize: isHovered ? 'calc(24px * 1.2)' : '24px',
        lineHeight: 'calc(24px * 1.2)',  // 固定行高,预留最大字体空间
        color: color,
        cursor: 'pointer',
        display: 'inline-block',
        padding: '8px 16px',
        minHeight: 'calc(24px * 1.2 + 16px)',  // 最小高度 = 最大字体 + 上下padding
        transition: 'font-size 0.2s ease',  // 保留悬停过渡动画
      }}
    >
      {text}
    </Box>
  );
};

export default SignatureButton;
