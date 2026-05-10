import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// 配置 marked 选项
marked.setOptions({
  breaks: true,        // 支持 GitHub 风格的换行
  gfm: true,          // 启用 GitHub Flavored Markdown
});

export interface NotebookPage {
  id: string;
  title: string;
  href: string;
  order: number;
}

export const useNotebook = (epubPath: string | undefined) => {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [headings, setHeadings] = useState<Array<{level: number, text: string}>>([]);

  // 加载笔记内容
  const loadContent = useCallback(async () => {
    if (!epubPath) return;
    
    try {
      const content = await invoke<string>('get_page_content', { epubPath });
      setMarkdownContent(content);
      extractHeadings(content);
      await renderMarkdown(content);
    } catch (error) {
      console.error('加载笔记内容失败:', error);
    }
  }, [epubPath]);

  // 保存笔记内容
  const saveContent = useCallback(async (markdown: string) => {
    if (!epubPath) return;
    
    try {
      await invoke('save_page_content', { 
        epubPath, 
        markdown 
      });
      await renderMarkdown(markdown);
    } catch (error) {
      console.error('保存笔记内容失败:', error);
      throw error;
    }
  }, [epubPath]);

  // 渲染Markdown
  const renderMarkdown = useCallback(async (markdown: string) => {
    try {
      let html = await marked(markdown);
      
      // 为标题添加id，支持目录导航
      html = html.replace(
        /<h([1-6])>(.*?)<\/h\1>/g,
        (_match, level, content) => {
          const id = content.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
          return `<h${level} id="heading-${id}">${content}</h${level}>`;
        }
      );
      
      // 使用DOMPurify清理HTML，防止XSS攻击
      const cleanHtml = DOMPurify.sanitize(html);
      setRenderedHtml(cleanHtml);
    } catch (error) {
      console.error('Markdown渲染失败:', error);
    }
  }, []);

  // 提取标题生成目录
  const extractHeadings = useCallback((markdown: string) => {
    const headings: Array<{level: number, text: string}> = [];
    const lines = markdown.split('\n');
    
    lines.forEach(line => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2]
        });
      }
    });
    
    setHeadings(headings);
  }, []);

  // 切换编辑/预览模式
  const toggleEditMode = useCallback(async () => {
    if (isEditMode) {
      await renderMarkdown(markdownContent);
    }
    setIsEditMode(!isEditMode);
  }, [isEditMode, markdownContent, renderMarkdown]);

  // 组件挂载时加载内容
  useEffect(() => {
    if (epubPath) {
      loadContent();
    }
  }, [loadContent, epubPath]);

  return {
    markdownContent,
    setMarkdownContent,
    renderedHtml,
    isEditMode,
    headings,
    loadContent,
    saveContent,
    toggleEditMode
  };
};
