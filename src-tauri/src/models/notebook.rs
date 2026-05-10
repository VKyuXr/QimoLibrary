use serde::{Deserialize, Serialize};

/// 笔记页面结构
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NotebookPage {
    pub id: String,           // UUID
    pub title: String,        // 页面标题
    pub href: String,         // XHTML文件路径 (如 OEBPS/page_001.xhtml)
    pub order: u32,           // 排序号
}
