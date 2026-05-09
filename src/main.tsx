import 'virtual:uno.css'
import '@mantine/core/styles.css';
import './App.css';
import ReactDOM from "react-dom/client";
import { MantineProvider, ColorSchemeScript } from '@mantine/core';
import App from "./App";
import { theme } from './theme';
import { BookProvider } from './context/BookContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import WelcomeModal from './components/WelcomeModal';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

// 包装组件以使用settings context
const ThemedApp = () => {
  const { settings } = useSettings();
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);

  useEffect(() => {
    // 检查是否首次启动
    const checkFirstLaunch = async () => {
      try {
        const isFirst = await invoke<boolean>('is_first_launch');
        setShowWelcome(isFirst);
      } catch (error) {
        console.error('检查首次启动失败:', error);
        setShowWelcome(false);
      }
    };
    
    checkFirstLaunch();
  }, []);

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
  };

  // 开发模式：在控制台提供重置首次启动的函数
  if (import.meta.env.DEV) {
    (window as any).resetFirstLaunch = async () => {
      try {
        console.log('🔄 开始重置...');
        
        // 1. 删除配置文件
        await invoke('reset_first_launch');
        console.log('✅ 已删除配置文件');
        
        // 2. 清除 localStorage 中的所有数据
        localStorage.clear();
        console.log('✅ 已清除 localStorage');
        
        console.log('✅ 重置完成！');
        alert(
          '✅ 已重置首次启动状态\n\n' +
          '包括：\n' +
          '• 删除配置文件 (settings.json)\n' +
          '• 清除本地存储 (localStorage)\n' +
          '• 清除书库配置\n' +
          '• 清除阅读进度\n\n' +
          '请刷新页面以重新显示欢迎向导'
        );
      } catch (error) {
        console.error('❌ 重置失败:', error);
        alert('重置失败: ' + error);
      }
    };
    console.log('🔧 开发模式：在控制台运行 resetFirstLaunch() 可重置首次启动状态');
  }
  
  return (
    <MantineProvider theme={theme} forceColorScheme={settings.theme}>
      <BookProvider>
        <App />
        {showWelcome === true && <WelcomeModal onComplete={handleWelcomeComplete} />}
      </BookProvider>
    </MantineProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <>
    <ColorSchemeScript defaultColorScheme="light" />
    <SettingsProvider>
      <ThemedApp />
    </SettingsProvider>
  </>,
);
