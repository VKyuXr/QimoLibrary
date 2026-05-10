// 中英文翻译配置
export const translations = {
  zh: {
    // 通用
    confirm: '确认',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    
    // 侧边栏
    home: '主页',
    library: '书库',
    reader: '阅读器',
    settings: '设置',
    close: '关闭',
    
    // 主页
    localBooks: '本地书籍',
    storageUsed: '占用空间',
    booksCount: '{count} 本',
    
    // 书库页
    importBook: '导入书籍',
    deleteSelected: '删除选中',
    selectAll: '全选',
    noBooks: '暂无书籍',
    importHint: '点击下方按钮导入 EPUB 文件',
    configureLibraryFirst: '请先在设置中配置书库位置',
    selectBookDetail: '请选择一本书查看详情',
    author: '作者',
    publisher: '出版社',
    description: '简介',
    editMetadata: '编辑元数据',
    startReading: '开始阅读',
    openNotebook: '打开笔记',
    bookTitle: '书名',
    enterTitle: '请输入书名',
    enterAuthor: '请输入作者',
    enterPublisher: '请输入出版社(可选)',
    enterDescription: '请输入书籍简介(可选)',
    confirmDelete: '确认删除',
    confirmDeleteMessage: '确定要删除选中的 {count} 本书籍吗?此操作不可恢复。',
    editMetadataTitle: '编辑元数据',
    
    // 阅读器
    openExternalBook: '打开外部书籍',
    closeBook: '关闭书籍',
    toc: '目录',
    prevPage: '上一页',
    nextPage: '下一页',
    contents: 'Contents',
    noToc: '暂无目录信息',
    noBookOpened: '目前还没有打开书籍,请点击左上角按钮选择书籍',
    loading: '加载中...',
    error: '错误',
    
    // 笔记功能
    notebooks: '笔记',
    notebookEditor: '笔记编辑器',
    preview: '预览',
    noHeadings: '暂无标题',
    
    // 设置页
    theme: '主题',
    themeSettings: '主题设置',
    librarySettings: '书库',
    darkMode: '深色模式',
    darkModeDesc: '切换软件的白天/黑夜主题',
    libraryLocation: '书库位置',
    libraryLocationDesc: '选择用于存储所有书籍副本的文件夹位置',
    notSet: '未设置',
    selectLocation: '选择位置',
    changeLocation: '更改位置',
    selectLibraryLocation: '选择书库位置',
    selectLibraryHint: '请选择一个文件夹作为书库,所有导入的书籍将存储在此处。',
    clickToSelect: '点击按钮选择文件夹',
    browse: '浏览',
    confirmSelection: '确认选择',

    
    // 语言
    language: '语言',
    languageDesc: '选择界面显示语言',
    chinese: '中文',
    english: 'English',
  },
  en: {
    // Common
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    
    // Sidebar
    home: 'Home',
    library: 'Library',
    reader: 'Reader',
    settings: 'Settings',
    close: 'Close',
    
    // Home Page
    localBooks: 'Local Books',
    storageUsed: 'Storage Used',
    booksCount: '{count} Books',
    
    // Library Page
    importBook: 'Import Book',
    deleteSelected: 'Delete Selected',
    selectAll: 'Select All',
    noBooks: 'No Books',
    importHint: 'Click button below to import EPUB files',
    configureLibraryFirst: 'Please configure library location in settings first',
    selectBookDetail: 'Please select a book to view details',
    author: 'Author',
    publisher: 'Publisher',
    description: 'Description',
    editMetadata: 'Edit Metadata',
    startReading: 'Start Reading',
    openNotebook: 'Open Notebook',
    bookTitle: 'Title',
    enterTitle: 'Enter book title',
    enterAuthor: 'Enter author name',
    enterPublisher: 'Enter publisher (optional)',
    enterDescription: 'Enter book description (optional)',
    confirmDelete: 'Confirm Delete',
    confirmDeleteMessage: 'Are you sure to delete {count} selected books? This action cannot be undone.',
    editMetadataTitle: 'Edit Metadata',
    
    // Reader
    openExternalBook: 'Open External Book',
    closeBook: 'Close Book',
    toc: 'Table of Contents',
    prevPage: 'Previous',
    nextPage: 'Next',
    contents: 'Contents',
    noToc: 'No table of contents',
    noBookOpened: 'No book opened. Click the button at top-left to select a book',
    loading: 'Loading...',
    error: 'Error',
    
    // Notebook
    notebooks: 'Notebooks',
    notebookEditor: 'Notebook Editor',
    preview: 'Preview',
    noHeadings: 'No headings',
    
    // Settings
    theme: 'Theme',
    themeSettings: 'Theme Settings',
    librarySettings: 'Library',
    darkMode: 'Dark Mode',
    darkModeDesc: 'Toggle between light and dark theme',
    libraryLocation: 'Library Location',
    libraryLocationDesc: 'Choose folder to store all book copies',
    notSet: 'Not Set',
    selectLocation: 'Select Location',
    changeLocation: 'Change Location',
    selectLibraryLocation: 'Select Library Location',
    selectLibraryHint: 'Please select a folder as library. All imported books will be stored here.',
    clickToSelect: 'Click to select folder',
    browse: 'Browse',
    confirmSelection: 'Confirm Selection',

    
    // Language
    language: 'Language',
    languageDesc: 'Choose interface display language',
    chinese: '中文',
    english: 'English',
  },
};

export type Language = 'zh' | 'en';
export type TranslationKey = keyof typeof translations.zh;
