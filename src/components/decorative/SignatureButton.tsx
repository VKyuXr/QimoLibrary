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

  // 将文本分割为中英文片段，分别应用不同字体
  const renderText = () => {
    const segments: Array<{text: string, isChinese: boolean}> = [];
    let currentSegment = '';
    let currentIsChinese = false;
    
    for (const char of text) {
      const isChinese = /[\u4e00-\u9fff]/.test(char);
      
      if (currentSegment === '') {
        currentSegment = char;
        currentIsChinese = isChinese;
      } else if (isChinese === currentIsChinese) {
        currentSegment += char;
      } else {
        segments.push({ text: currentSegment, isChinese: currentIsChinese });
        currentSegment = char;
        currentIsChinese = isChinese;
      }
    }
    
    if (currentSegment) {
      segments.push({ text: currentSegment, isChinese: currentIsChinese });
    }
    
    return segments.map((segment, index) => (
      <span
        key={index}
        style={{
          fontFamily: segment.isChinese ? 'Zhimang Xing' : 'Pinyon Script',
        }}
      >
        {segment.text}
      </span>
    ));
  };

  return (
    <Box
      component="span"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        fontSize: '24px',
        lineHeight: '1.2',
        color: color,
        cursor: 'pointer',
        display: 'inline-block',
        padding: '8px 16px',
        transform: isHovered ? 'scale(1.2)' : 'scale(1)',
        transition: 'transform 0.2s ease',
        transformOrigin: 'center center',  // 从中心缩放，保持位置稳定
      }}
    >
      {renderText()}
    </Box>
  );
};

export default SignatureButton;
