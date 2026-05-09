import { useSettings } from '../context/SettingsContext';
import { translations, TranslationKey, Language } from '../i18n';

/**
 * 国际化Hook - 提供翻译函数和当前语言
 */
export const useTranslation = () => {
  const { settings, updateSettings } = useSettings();
  
  const t = (key: TranslationKey, params?: Record<string, string | number>) => {
    let text = translations[settings.language][key] || key;
    
    // 替换参数
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        text = text.replace(`{${paramKey}}`, String(paramValue));
      });
    }
    
    return text;
  };
  
  const changeLanguage = (lang: Language) => {
    updateSettings({ language: lang });
  };
  
  return {
    t,
    language: settings.language,
    changeLanguage,
  };
};
