import { useSettings } from '../context/SettingsContext';

/**
 * 获取EPUB阅读器样式配置
 * 与主应用主题独立,由用户自定义
 */
export const useReaderStyles = () => {
  const { settings } = useSettings();
  
  // EPUB阅读器的默认样式(不受主应用明暗模式影响)
  const defaultReaderTheme = {
    backgroundColor: '#FFFFFF',
    textColor: '#000000',
    linkColor: '#0066CC',
    fontFamily: 'serif',
    fontSize: 16,
    lineHeight: 1.6,
  };
  
  // 可以根据settings.readerTheme扩展更多主题
  const readerThemes = {
    light: defaultReaderTheme,
    sepia: {
      backgroundColor: '#F4ECD8',
      textColor: '#5B4636',
      linkColor: '#8B4513',
      fontFamily: 'serif',
      fontSize: settings.fontSize || 16,
      lineHeight: 1.6,
    },
    dark: {
      backgroundColor: '#1A1A1A',
      textColor: '#D0D0D0',
      linkColor: '#6699CC',
      fontFamily: 'sans-serif',
      fontSize: settings.fontSize || 16,
      lineHeight: 1.6,
    },
  };
  
  return {
    readerTheme: readerThemes.light, // 默认使用浅色主题
    setReaderTheme: (theme: keyof typeof readerThemes) => {
      // 未来可以保存到settings
      console.log('Set reader theme:', theme);
    },
  };
};
