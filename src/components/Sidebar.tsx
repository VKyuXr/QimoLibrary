import { useNavigate, useLocation } from 'react-router-dom';
import { ActionIcon, Tooltip, Stack, Box } from '@mantine/core';
import { IconHome, IconBooks, IconBook, IconSettings, IconX } from '@tabler/icons-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from '../hooks/useTranslation';
import { useState } from 'react';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const menuItems = [
    { id: 'home', icon: IconHome, labelZh: '主页', labelEn: 'Home', path: '/' },
    { id: 'library', icon: IconBooks, labelZh: '书库', labelEn: 'Library', path: '/library' },
    { id: 'reader', icon: IconBook, labelZh: '阅读器', labelEn: 'Reader', path: '/reader' },
    { id: 'settings', icon: IconSettings, labelZh: '设置', labelEn: 'Settings', path: '/settings' },
  ];

  const handleClose = async () => {
    try {
      const window = getCurrentWindow();
      await window.close();
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  };

  return (
    <Box 
      className="w-20 h-screen flex flex-col select-none"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-color)'
      }}
      data-tauri-drag-region
    >
      {/* 顶部 Logo - 拱门形装饰框 */}
      <Box 
        className="p-4 flex justify-center items-center" 
        data-tauri-drag-region
        style={{
          borderRadius: '50% 50% 0 0 / 20px 20px 0 0'
        }}
      >
        <img 
          src="/Qimo.svg" 
          alt="Logo"
          className="logo-svg"
          style={{ 
            width: '48px',
            height: '48px'
          }}
        />
      </Box>

      {/* 中间菜单 - 可拖动区域 */}
      <Box className="flex-1 flex flex-col items-center justify-center px-2 py-4" data-tauri-drag-region>
        <Stack gap="md" className="w-full">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const [isHovered, setIsHovered] = useState(false);
            
            return (
              <Tooltip key={item.id} label={<span>{item.labelZh}<br/>{item.labelEn}</span>} position="right">
                <Box className="w-full flex justify-center">
                  <ActionIcon
                    size="xl"
                    variant="subtle"
                    onClick={() => navigate(item.path)}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    style={{ 
                      pointerEvents: 'auto',
                      borderRadius: 0,
                      color: 'var(--text-primary)',
                      fontFamily: '"Source Han Serif SC", serif',
                      fontSize: (isActive || isHovered) ? 'calc(1rem * 1.414)' : 'inherit',
                      transition: 'all 0.2s ease',
                      backgroundColor: (isActive || isHovered) ? 'var(--highlight)' : 'transparent'
                    }}
                  >
                    <Icon size={24} />
                  </ActionIcon>
                </Box>
              </Tooltip>
            );
          })}
        </Stack>
      </Box>

      {/* 底部关闭按钮 */}
      <Box className="p-4 flex justify-center items-center" data-tauri-drag-region>
        <Tooltip label={t('close')} position="right">
          <ActionIcon
            size="xl"
            variant="subtle"
            onClick={handleClose}
            style={{ 
              pointerEvents: 'auto',
              borderRadius: 0,
              color: 'var(--accent-secondary)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(139, 58, 58, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <IconX size={24} />
          </ActionIcon>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default Sidebar;
