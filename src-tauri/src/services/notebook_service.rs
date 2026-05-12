use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use zip::{ZipWriter, CompressionMethod, ZipArchive};
use quick_xml::events::Event;
use quick_xml::reader::Reader;

/// 从EPUB中读取OPF内容（公共方法，消除代码重复）
fn read_opf_content(epub_path: &str) -> Result<(String, String), String> {
    let file = fs::File::open(epub_path)
        .map_err(|e| format!("无法打开EPUB文件: {}", e))?;
    
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("无法读取EPUB文件: {}", e))?;
    
    // 读取 container.xml 找到 content.opf 的位置
    let opf_path = {
        let mut container_file = archive.by_name("META-INF/container.xml")
            .map_err(|e| format!("找不到container.xml: {}", e))?;
        
        let mut content = String::new();
        container_file.read_to_string(&mut content)
            .map_err(|e| format!("读取container.xml失败: {}", e))?;
        
        let mut reader = Reader::from_str(&content);
        reader.config_mut().trim_text(true);
        
        let mut buf = Vec::new();
        let mut path = String::new();
        
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Empty(ref e)) | Ok(Event::Start(ref e)) => {
                    if e.name().as_ref() == b"rootfile" {
                        if let Some(path_attr) = e.attributes().find_map(|a| {
                            a.ok().and_then(|attr| {
                                if attr.key.as_ref() == b"full-path" {
                                    String::from_utf8(attr.value.to_vec()).ok()
                                } else {
                                    None
                                }
                            })
                        }) {
                            path = path_attr;
                            break;
                        }
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(format!("解析XML失败: {}", e)),
                _ => {}
            }
            buf.clear();
        }
        
        path
    };
    
    // 读取opf内容
    let opf_content = {
        let mut opf_file = archive.by_name(&opf_path)
            .map_err(|e| format!("找不到{}: {}", opf_path, e))?;
        
        let mut content = String::new();
        opf_file.read_to_string(&mut content)
            .map_err(|e| format!("读取{}失败: {}", opf_path, e))?;
        content
    };
    
    Ok((opf_path, opf_content))
}

/// 创建新笔记（在书库路径下）
pub fn create_notebook(library_path: String, name: String) -> Result<String, String> {
    // 验证输入
    if name.trim().is_empty() {
        return Err("笔记名称不能为空".to_string());
    }
    
    let library_dir = PathBuf::from(&library_path);
    
    if !library_dir.exists() {
        return Err(format!("书库路径不存在: {}", library_path));
    }
    
    // 清理名称，确保可以作为文件名使用
    let safe_name = sanitize_filename(&name);
    
    // 使用用户输入的名称作为文件夹名和EPUB文件名
    let mut folder_name = safe_name.clone();
    let mut notebook_folder = library_dir.join(&folder_name);
    
    // 如果文件夹已存在，添加时间戳避免冲突
    if notebook_folder.exists() {
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        folder_name = format!("{}_{}", safe_name, timestamp);
        notebook_folder = library_dir.join(&folder_name);
    }
    
    // 创建笔记文件夹
    fs::create_dir_all(&notebook_folder)
        .map_err(|e| format!("创建笔记文件夹失败: {}", e))?;
    
    // 生成标准EPUB，在content.opf中添加 qimo-notebook meta
    generate_epub_with_meta(&notebook_folder, &safe_name)?;
    
    // 保存空的 content.md
    let md_path = notebook_folder.join("content.md");
    fs::write(&md_path, "# ".to_string() + &safe_name)
        .map_err(|e| format!("创建Markdown文件失败: {}", e))?;
    
    // 返回EPUB文件绝对路径
    let epub_path = notebook_folder.join(format!("{}.epub", folder_name));
    
    // 确保文件存在后再获取绝对路径
    if !epub_path.exists() {
        return Err(format!("EPUB文件创建失败: {}", epub_path.display()));
    }
    
    let absolute_path = epub_path.canonicalize()
        .map_err(|e| format!("获取绝对路径失败: {}", e))?
        .to_string_lossy()
        .to_string();
    
    // 移除 Windows 长路径前缀 \\?\
    let clean_path = crate::utils::path_utils::normalize_windows_path(&absolute_path);
    
    // 将笔记注册到书库配置中（不复制文件，因为已经在正确位置）
    register_notebook_to_library(&clean_path, &library_path, &safe_name)?;
    
    Ok(clean_path)
}

/// 保存页面内容
pub fn save_page_content(epub_path: String, markdown: String) -> Result<(), String> {
    let epub_file = PathBuf::from(&epub_path);
    
    if !epub_file.exists() {
        return Err(format!("EPUB文件不存在: {}", epub_path));
    }
    
    // 找到笔记文件夹（EPUB文件的父目录）
    let notebook_folder = epub_file.parent()
        .ok_or("无法获取笔记文件夹路径")?;
    
    // 更新 content.md
    let md_path = notebook_folder.join("content.md");
    fs::write(&md_path, &markdown)
        .map_err(|e| format!("写入Markdown文件失败: {}", e))?;
    
    // 重新生成EPUB
    let title = extract_title_from_epub(&epub_path)?;
    generate_epub_with_meta(&notebook_folder.to_path_buf(), &title)?;
    
    Ok(())
}

/// 获取页面内容
pub fn get_page_content(epub_path: String) -> Result<String, String> {
    let epub_file = PathBuf::from(&epub_path);
    
    if !epub_file.exists() {
        return Err(format!("EPUB文件不存在: {}", epub_path));
    }
    
    // 找到笔记文件夹（EPUB文件的父目录）
    let notebook_folder = epub_file.parent()
        .ok_or("无法获取笔记文件夹路径")?;
    
    // 优先读取 content.md
    let md_path = notebook_folder.join("content.md");
    
    if md_path.exists() {
        let content = fs::read_to_string(&md_path)
            .map_err(|e| format!("读取Markdown文件失败: {}", e))?;
        return Ok(content);
    }
    
    // 如果 content.md 不存在，从 EPUB 中提取
    extract_content_from_epub(&epub_path)
}

/// 从EPUB中提取标题
fn extract_title_from_epub(epub_path: &str) -> Result<String, String> {
    let (_, opf_content) = read_opf_content(epub_path)?;
    
    let mut reader = Reader::from_str(&opf_content);
    reader.config_mut().trim_text(true);
    
    let mut buf = Vec::new();
    let mut title = String::new();
    let mut in_metadata = false;
    let mut current_element = String::new();
    
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                current_element = tag_name.clone();
                
                if tag_name == "metadata" {
                    in_metadata = true;
                }
            }
            Ok(Event::Text(ref e)) => {
                let text = String::from_utf8_lossy(e.as_ref()).trim().to_string();
                
                if in_metadata && (current_element == "dc:title" || current_element == "title") {
                    if title.is_empty() {
                        title = text;
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag_name == "metadata" {
                    in_metadata = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("解析OPF文件失败: {}", e)),
            _ => {}
        }
        buf.clear();
    }
    
    if title.is_empty() {
        Ok("未命名笔记".to_string())
    } else {
        Ok(title)
    }
}

/// 从EPUB中提取内容
fn extract_content_from_epub(epub_path: &str) -> Result<String, String> {
    let (opf_path, opf_content) = read_opf_content(epub_path)?;
    
    let content_xhtml_path = find_content_xhtml_path(&opf_content, &opf_path)?;
    
    // 重新打开archive读取content.xhtml
    let file = fs::File::open(epub_path)
        .map_err(|e| format!("无法打开EPUB文件: {}", e))?;
    
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("无法读取EPUB文件: {}", e))?;
    
    // 读取 content.xhtml
    let xhtml_content = {
        let mut xhtml_file = archive.by_name(&content_xhtml_path)
            .map_err(|e| format!("找不到{}: {}", content_xhtml_path, e))?;
        
        let mut content = String::new();
        xhtml_file.read_to_string(&mut content)
            .map_err(|e| format!("读取{}失败: {}", content_xhtml_path, e))?;
        content
    };
    
    // 简单提取 body 内容（实际应该转换为Markdown，这里先返回HTML）
    // TODO: 未来可以添加HTML到Markdown的转换
    Ok(format!("<!-- HTML内容，待转换为Markdown -->\n{}", xhtml_content))
}

/// 查找content.xhtml的路径
fn find_content_xhtml_path(opf_content: &str, opf_path: &str) -> Result<String, String> {
    let mut reader = Reader::from_str(opf_content);
    
    let mut buf = Vec::new();
    let mut content_href = String::new();
    let mut in_manifest = false;
    
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                
                if tag_name == "manifest" {
                    in_manifest = true;
                }
                
                if in_manifest && tag_name == "item" {
                    let mut id = String::new();
                    let mut href = String::new();
                    
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                        let value = String::from_utf8_lossy(&attr.value).to_string();
                        
                        match key.as_str() {
                            "id" => id = value,
                            "href" => href = value,
                            _ => {}
                        }
                    }
                    
                    if id == "content" {
                        content_href = href;
                        break;
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag_name == "manifest" {
                    in_manifest = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("解析OPF文件失败: {}", e)),
            _ => {}
        }
        buf.clear();
    }
    
    if content_href.is_empty() {
        return Err("未找到content.xhtml".to_string());
    }
    
    // 计算完整路径
    let opf_dir = std::path::Path::new(opf_path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    
    let full_path = if opf_dir.is_empty() {
        content_href
    } else {
        format!("{}/{}", opf_dir, content_href)
    };
    
    Ok(full_path)
}

/// 生成带 qimo-notebook meta 的EPUB
fn generate_epub_with_meta(notebook_folder: &PathBuf, title: &str) -> Result<(), String> {
    // 使用文件夹名称作为EPUB文件名（保持一致性）
    let folder_name = notebook_folder.file_name()
        .ok_or("无法获取文件夹名称")?
        .to_string_lossy()
        .to_string();
    
    let epub_path = notebook_folder.join(format!("{}.epub", folder_name));
    let file = fs::File::create(&epub_path)
        .map_err(|e| format!("创建EPUB文件失败: {}", e))?;
    
    let mut zip = ZipWriter::new(file);
    let options = zip::write::FileOptions::default()
        .compression_method(CompressionMethod::Deflated);
    
    // 1. mimetype (必须是第一个文件,且不压缩)
    zip.start_file("mimetype", 
        zip::write::FileOptions::default().compression_method(CompressionMethod::Stored))
        .map_err(|e| format!("写入mimetype失败: {}", e))?;
    zip.write_all(b"application/epub+zip")
        .map_err(|e| format!("写入mimetype内容失败: {}", e))?;
    
    // 2. META-INF/container.xml
    let container_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#;
    
    zip.start_file("META-INF/container.xml", options)
        .map_err(|e| format!("写入container.xml失败: {}", e))?;
    zip.write_all(container_xml.as_bytes())
        .map_err(|e| format!("写入container.xml内容失败: {}", e))?;
    
    // 3. content.opf (包含 qimo-notebook meta)
    let content_opf = format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookID">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>{title}</dc:title>
    <dc:creator>奇墨笔记</dc:creator>
    <dc:identifier id="BookID">urn:uuid:{uuid}</dc:identifier>
    <dc:language>zh-CN</dc:language>
    <meta name="qimo-notebook" content="true"/>
    <meta property="dcterms:modified">{modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="OEBPS/nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="content" href="OEBPS/content.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="OEBPS/styles.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="content"/>
  </spine>
</package>"#, 
        title = escape_xml(title),
        uuid = uuid::Uuid::new_v4(),
        modified = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ")
    );
    
    zip.start_file("content.opf", options)
        .map_err(|e| format!("写入content.opf失败: {}", e))?;
    zip.write_all(content_opf.as_bytes())
        .map_err(|e| format!("写入content.opf内容失败: {}", e))?;
    
    // 同时将content.opf保存到文件夹中（供后续repackage使用）
    let opf_folder_path = notebook_folder.join("content.opf");
    fs::write(&opf_folder_path, &content_opf)
        .map_err(|e| format!("保存content.opf到文件夹失败: {}", e))?;
    
    // 4. OEBPS/styles.css
    let styles_css = r#"body {
  font-family: "Source Han Serif SC", serif;
  line-height: 1.6;
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}
h1, h2, h3, h4, h5, h6 {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}
p {
  margin: 0.5em 0;
}"#;
    
    zip.start_file("OEBPS/styles.css", options)
        .map_err(|e| format!("写入styles.css失败: {}", e))?;
    zip.write_all(styles_css.as_bytes())
        .map_err(|e| format!("写入styles.css内容失败: {}", e))?;
    
    // 同时将styles.css保存到文件夹中（供后续repackage使用）
    let css_folder_path = notebook_folder.join("OEBPS/styles.css");
    if let Some(parent) = css_folder_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建OEBPS目录失败: {}", e))?;
    }
    fs::write(&css_folder_path, &styles_css)
        .map_err(|e| format!("保存styles.css到文件夹失败: {}", e))?;
    
    // 5. OEBPS/nav.xhtml
    let nav_xhtml = format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Navigation</title>
</head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
      <li><a href="content.xhtml">{}</a></li>
    </ol>
  </nav>
</body>
</html>"#, escape_xml(title));
    
    zip.start_file("OEBPS/nav.xhtml", options)
        .map_err(|e| format!("写入nav.xhtml失败: {}", e))?;
    zip.write_all(nav_xhtml.as_bytes())
        .map_err(|e| format!("写入nav.xhtml内容失败: {}", e))?;
    
    // 同时将nav.xhtml保存到文件夹中（供后续update_nav_xhtml使用）
    let nav_folder_path = notebook_folder.join("OEBPS/nav.xhtml");
    if let Some(parent) = nav_folder_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建OEBPS目录失败: {}", e))?;
    }
    fs::write(&nav_folder_path, &nav_xhtml)
        .map_err(|e| format!("保存nav.xhtml到文件夹失败: {}", e))?;
    
    // 6. OEBPS/content.xhtml
    let content_xhtml = format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <title>{title}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
<h1>{title}</h1>
<p>开始编写你的笔记...</p>
</body>
</html>"#, 
        title = escape_xml(title)
    );
    
    zip.start_file("OEBPS/content.xhtml", options)
        .map_err(|e| format!("写入content.xhtml失败: {}", e))?;
    zip.write_all(content_xhtml.as_bytes())
        .map_err(|e| format!("写入content.xhtml内容失败: {}", e))?;
    
    zip.finish().map_err(|e| format!("完成EPUB写入失败: {}", e))?;
    
    Ok(())
}

/// XML转义
fn escape_xml(s: &str) -> String {
    s.replace("&", "&amp;")
     .replace("<", "&lt;")
     .replace(">", "&gt;")
     .replace("\"", "&quot;")
     .replace("'", "&apos;")
}

/// 清理文件名，移除非法字符
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
        .collect::<String>()
        .trim()
        .to_string()
}

/// 获取笔记的所有页面列表
pub fn get_notebook_pages(epub_path: String) -> Result<Vec<crate::models::notebook::NotebookPage>, String> {
    use crate::models::notebook::NotebookPage;
    
    let epub_file = PathBuf::from(&epub_path);
    
    // 验证EPUB文件存在
    if !epub_file.exists() {
        return Err(format!("EPUB文件不存在: {}", epub_path));
    }
    
    // 读取OPF内容
    match read_opf_content(&epub_path) {
        Ok((_opf_path, opf_content)) => {
            
            // 解析spine中的itemref顺序
            let spine_items = parse_spine_items(&opf_content)?;
            
            // 解析manifest获取所有item
            let manifest_items = parse_manifest_items(&opf_content)?;
    
            let mut pages: Vec<NotebookPage> = Vec::new();
            
            // 按照spine顺序构建页面列表
            for (order, idref) in spine_items.iter().enumerate() {
        if let Some(item) = manifest_items.get(idref) {
            // 跳过nav.xhtml（导航文件）
            if item.href.contains("nav.xhtml") {
                continue;
            }
            
            // 只处理xhtml文件
            if !item.href.ends_with(".xhtml") {
                continue;
            }
            
            // 提取page ID（从href中提取文件名，不含扩展名）
            let page_id = PathBuf::from(&item.href)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or(&idref)
                .to_string();
            
            // 尝试从XHTML文件中读取标题
            let title = read_title_from_epub_xhtml(&epub_path, &item.href)
                .unwrap_or_else(|| {
                    if page_id.starts_with("page_") {
                        format!("页面 {}", order + 1)
                    } else {
                        page_id.clone()
                    }
                });
            
            pages.push(NotebookPage {
                id: page_id,
                title,
                href: item.href.clone(),
                order: order as u32,
            });
        }
    }
    
    Ok(pages)
        }
        Err(e) => {
            println!("[ERROR] Failed to get notebook pages: failed to read OPF: {}", e);
            Err(format!("读取OPF失败: {}", e))
        }
    }
}

/// 带重试机制的获取页面列表
fn get_notebook_pages_with_retry(epub_path: String, max_retries: u32) -> Result<Vec<crate::models::notebook::NotebookPage>, String> {
    let mut last_error = String::new();
    
    for attempt in 1..=max_retries {
        match get_notebook_pages(epub_path.clone()) {
            Ok(pages) => return Ok(pages),
            Err(e) => {
                last_error = e;
                if attempt < max_retries {
                    // 等待一小段时间后重试
                    std::thread::sleep(std::time::Duration::from_millis(100 * attempt as u64));
                }
            }
        }
    }
    
    Err(format!("获取页面列表失败（已重试{}次）: {}", max_retries, last_error))
}

/// 添加新页面到笔记
pub fn add_notebook_page(epub_path: String, title: String) -> Result<crate::models::notebook::NotebookPage, String> {
    use crate::models::notebook::NotebookPage;
    
    let epub_file = PathBuf::from(&epub_path);
    
    // 验证EPUB文件存在
    if !epub_file.exists() {
        return Err(format!("EPUB文件不存在: {}", epub_path));
    }
    
    let notebook_folder = epub_file.parent()
        .ok_or("无法获取笔记文件夹路径")?
        .to_path_buf();
    
    // 获取当前最大order（带重试机制）
    let pages = get_notebook_pages_with_retry(epub_path.clone(), 3)?;
    let max_order = pages.iter().map(|p| p.order).max().unwrap_or(0);
    let new_order = max_order + 1;
    
    let page_id = format!("page_{:03}", new_order);
    let page_href = format!("OEBPS/{}.xhtml", page_id);
    
    // 生成XHTML内容
    let xhtml_content = generate_page_xhtml(&title);
    
    // 写入XHTML文件到文件夹
    let xhtml_path = notebook_folder.join(&page_href);
    if let Some(parent) = xhtml_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    fs::write(&xhtml_path, &xhtml_content)
        .map_err(|e| format!("写入XHTML文件失败: {}", e))?;
    
    // 同时创建对应的Markdown文件，以页面标题作为一级标题
    let md_path = notebook_folder.join(format!("{}.md", page_id));
    let md_content = format!("# {}\n\n", title);
    fs::write(&md_path, &md_content)
        .map_err(|e| format!("创建Markdown文件失败: {}", e))?;
    
    // 更新OPF的manifest和spine，重新打包EPUB
    update_epub_manifest_and_spine(&epub_path, &page_id, &page_href, new_order, &title)?;
    
    Ok(NotebookPage {
        id: page_id,
        title,
        href: page_href,
        order: new_order,
    })
}

/// 生成页面XHTML内容
fn generate_page_xhtml(title: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>{title}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>{title}</h1>
</body>
</html>"#,
        title = escape_xml(title)
    )
}

/// 更新nav.xhtml以包含所有页面
fn update_nav_xhtml(
    notebook_folder: &PathBuf,
    _page_id: &str,  // 保留参数以备将来使用
    page_href: &str,
    title: &str,  // 添加title参数
) -> Result<(), String> {
    let nav_path = notebook_folder.join("OEBPS/nav.xhtml");
    
    // 将完整路径转换为相对于nav.xhtml的路径
    // page_href格式: "OEBPS/page_001.xhtml"
    // nav.xhtml在OEBPS目录下，所以相对路径应该是 "page_001.xhtml"
    let relative_href = if page_href.starts_with("OEBPS/") {
        &page_href[6..] // 去掉"OEBPS/"前缀
    } else {
        page_href
    };
    
    // 如果nav.xhtml不存在，创建一个新的
    if !nav_path.exists() {
        let nav_content = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Navigation</title>
</head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
      <li><a href="{}">{}</a></li>
    </ol>
  </nav>
</body>
</html>"#,
            relative_href, escape_xml(title)  // 使用title而不是page_id
        );
        
        fs::write(&nav_path, &nav_content)
            .map_err(|e| format!("写入nav.xhtml失败: {}", e))?;
        return Ok(());
    }
    
    // 读取现有的nav.xhtml
    let mut nav_content = fs::read_to_string(&nav_path)
        .map_err(|e| format!("读取nav.xhtml失败: {}", e))?;
    
    // 检查是否已经存在该页面（使用完整路径检查）
    if nav_content.contains(page_href) || nav_content.contains(relative_href) {
        return Ok(()); // 已存在，无需更新
    }
    
    // 在</ol>前插入新的列表项
    let new_item = format!("      <li><a href=\"{}\">{}</a></li>\n    ", relative_href, escape_xml(title));
    
    if let Some(ol_end) = nav_content.find("</ol>") {
        nav_content.insert_str(ol_end, &new_item);
    } else {
        return Err("找不到</ol>标签".to_string());
    }
    
    // 写回文件
    fs::write(&nav_path, &nav_content)
        .map_err(|e| format!("写入nav.xhtml失败: {}", e))?;
    
    Ok(())
}

/// 从EPUB中提取指定页面的XHTML内容并转换为Markdown
pub fn get_page_content_by_id(epub_path: String, page_id: String) -> Result<String, String> {
    let epub_file = PathBuf::from(&epub_path);
    let notebook_folder = epub_file.parent()
        .ok_or("无法获取笔记文件夹路径")?
        .to_path_buf();
    
    // 首先尝试从文件夹中读取对应的Markdown文件
    let md_path = notebook_folder.join(format!("{}.md", page_id));
    if md_path.exists() {
        return fs::read_to_string(&md_path)
            .map_err(|e| format!("读取Markdown文件失败: {}", e));
    }
    
    // 如果Markdown文件不存在，从EPUB中读取XHTML
    let (_, opf_content) = read_opf_content(&epub_path)?;
    
    // 查找页面对应的XHTML文件路径
    let xhtml_path = find_xhtml_path_by_id(&opf_content, &page_id)?;
    
    // 重新打开archive读取xhtml
    let file = fs::File::open(&epub_path)
        .map_err(|e| format!("无法打开EPUB文件: {}", e))?;
    
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("无法读取EPUB文件: {}", e))?;
    
    let xhtml_content = {
        let mut xhtml_file = archive.by_name(&xhtml_path)
            .map_err(|e| format!("找不到{}: {}", xhtml_path, e))?;
        
        let mut content = String::new();
        xhtml_file.read_to_string(&mut content)
            .map_err(|e| format!("读取{}失败: {}", xhtml_path, e))?;
        content
    };
    
    // 提取body内容（简化版，实际应该用HTML to Markdown转换器）
    Ok(extract_body_from_xhtml(&xhtml_content))
}

/// 根据page_id查找XHTML文件路径
fn find_xhtml_path_by_id(opf_content: &str, page_id: &str) -> Result<String, String> {
    let mut reader = Reader::from_str(opf_content);
    
    let mut buf = Vec::new();
    let mut in_manifest = false;
    
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                // 使用local_name()忽略命名空间
                let local_name = e.name().local_name();
                
                if local_name.as_ref() == b"manifest" {
                    in_manifest = true;
                } else if in_manifest && local_name.as_ref() == b"item" {
                    // 检查id是否匹配
                    let mut item_id = String::new();
                    let mut href = String::new();
                    
                    for attr in e.attributes() {
                        if let Ok(a) = attr {
                            let key = a.key.local_name();
                            let value = String::from_utf8_lossy(&a.value).to_string();
                            
                            if key.as_ref() == b"id" {
                                item_id = value.clone();
                            } else if key.as_ref() == b"href" {
                                href = value.clone();
                            }
                        }
                    }
                    
                    if item_id == page_id {
                        return Ok(href);
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let local_name = e.name().local_name();
                if local_name.as_ref() == b"manifest" {
                    in_manifest = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("解析OPF失败: {}", e)),
            _ => {}
        }
        buf.clear();
    }
    
    Err(format!("找不到页面ID: {}", page_id))
}

/// 从XHTML中提取body内容
fn extract_body_from_xhtml(xhtml: &str) -> String {
    // 简化实现：提取<h1>标题和<p>段落
    let mut result = String::new();
    
    // 提取标题
    if let Some(start) = xhtml.find("<h1>") {
        if let Some(end) = xhtml[start..].find("</h1>") {
            let title = &xhtml[start + 4..start + end];
            result.push_str(&format!("# {}\n\n", title));
        }
    }
    
    // 提取所有段落
    let mut search_start = 0;
    while let Some(start) = xhtml[search_start..].find("<p>") {
        let abs_start = search_start + start;
        if let Some(end) = xhtml[abs_start..].find("</p>") {
            let paragraph = &xhtml[abs_start + 3..abs_start + end];
            result.push_str(&format!("{}\n\n", paragraph));
            search_start = abs_start + end + 4;
        } else {
            break;
        }
    }
    
    if result.is_empty() {
        "# 新页面\n\n在此开始编写内容...".to_string()
    } else {
        result.trim().to_string()
    }
}

/// 保存指定页面的内容
pub fn save_page_content_by_id(epub_path: String, page_id: String, markdown: String) -> Result<(), String> {
    let epub_file = PathBuf::from(&epub_path);
    let notebook_folder = epub_file.parent()
        .ok_or("无法获取笔记文件夹路径")?
        .to_path_buf();
    
    // 保存到对应的Markdown文件
    let md_path = notebook_folder.join(format!("{}.md", page_id));
    fs::write(&md_path, &markdown)
        .map_err(|e| format!("写入Markdown文件失败: {}", e))?;
    
    // 同步更新EPUB中的XHTML文件
    sync_xhtml_to_epub(&notebook_folder, epub_path, &page_id, &markdown)?;
    
    Ok(())
}

/// 将Markdown内容同步到EPUB中的XHTML文件
fn sync_xhtml_to_epub(
    notebook_folder: &PathBuf,
    epub_path: String,
    page_id: &str,
    markdown: &str,
) -> Result<(), String> {
    use pulldown_cmark::{Parser, Options, html::push_html};
    
    // 1. Markdown转HTML
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    
    let parser = Parser::new_ext(markdown, options);
    let mut html_output = String::new();
    push_html(&mut html_output, parser);
    
    // 2. 生成完整的XHTML结构
    let xhtml_content = format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <title>{page_id}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
{html_content}
</body>
</html>"#,
        page_id = escape_xml(page_id),
        html_content = html_output
    );
    
    // 3. 找到页面对应的XHTML文件路径
    let (_, opf_content) = read_opf_content(&epub_path)?;
    let xhtml_path = find_xhtml_path_by_id(&opf_content, page_id)?;
    
    // 4. 更新文件夹中的XHTML文件
    let xhtml_file_path = notebook_folder.join(&xhtml_path);
    
    // 确保父目录存在
    if let Some(parent) = xhtml_file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    
    fs::write(&xhtml_file_path, &xhtml_content)
        .map_err(|e| format!("写入XHTML文件失败: {}", e))?;
    
    // 5. 从Markdown中提取第一个一级标题作为页面标题
    let page_title = extract_first_h1_from_markdown(markdown)
        .unwrap_or_else(|| page_id.to_string());
    
    // 6. 更新nav.xhtml中的页面标题
    update_nav_page_title(&notebook_folder, &page_id, &page_title)?;
    
    // 7. 重新打包EPUB
    repackage_epub(notebook_folder, &epub_path)?;
    
    Ok(())
}

/// 更新EPUB的manifest和spine，并重新打包
fn update_epub_manifest_and_spine(epub_path: &str, page_id: &str, page_href: &str, _order: u32, title: &str) -> Result<(), String> {
    
    let epub_file = PathBuf::from(epub_path);
    let notebook_folder = epub_file.parent()
        .ok_or("无法获取笔记文件夹路径")?
        .to_path_buf();
    
    // 1. 读取当前OPF内容
    let (opf_path, mut opf_content) = read_opf_content(epub_path)?;
    
    // 2. 在manifest中添加新的item
    let new_item = format!(
        r#"    <item id="{}" href="{}" media-type="application/xhtml+xml"/>"#,
        page_id, page_href
    );
    
    // 找到</manifest>标签前插入
    if let Some(manifest_end) = opf_content.find("</manifest>") {
        opf_content.insert_str(manifest_end, &format!("\n{}\n", new_item));
    } else {
        return Err("找不到</manifest>标签".to_string());
    }
    
    // 3. 在spine中添加新的itemref
    let new_itemref = format!(
        r#"    <itemref idref="{}"/>"#,
        page_id
    );
    
    if let Some(spine_end) = opf_content.find("</spine>") {
        opf_content.insert_str(spine_end, &format!("\n{}\n", new_itemref));
    } else {
        return Err("找不到</spine>标签".to_string());
    }
    
    // 4. 将更新后的OPF写回文件夹
    let opf_file_path = notebook_folder.join(&opf_path);
    fs::write(&opf_file_path, &opf_content)
        .map_err(|e| format!("写入OPF文件失败: {}", e))?;
    
    // 5. 更新nav.xhtml以包含新页面
    update_nav_xhtml(&notebook_folder, &page_id, &page_href, title)?;
    
    // 6. 重新打包EPUB
    repackage_epub(&notebook_folder, epub_path)?;
    
    Ok(())
}

/// 重新打包EPUB文件
fn repackage_epub(notebook_folder: &PathBuf, epub_path: &str) -> Result<(), String> {
    use std::fs::File;
    use zip::{ZipWriter, CompressionMethod};
    
    println!("[DEBUG] Starting EPUB repackaging: {}", epub_path);
    println!("[DEBUG] Notebook folder: {:?}", notebook_folder);
    
    let temp_epub_path = format!("{}.tmp", epub_path);
    let file = File::create(&temp_epub_path)
        .map_err(|e| format!("创建临时EPUB文件失败: {}", e))?;
    
    let mut zip = ZipWriter::new(file);
    let options = zip::write::FileOptions::default()
        .compression_method(CompressionMethod::Deflated);
    
    // 添加mimetype文件（必须第一个，且不压缩）
    let mimetype_options = zip::write::FileOptions::default()
        .compression_method(CompressionMethod::Stored);
    zip.start_file("mimetype", mimetype_options)
        .map_err(|e| format!("添加mimetype失败: {}", e))?;
    zip.write_all(b"application/epub+zip")
        .map_err(|e| format!("写入mimetype失败: {}", e))?;
    
    // 添加META-INF/container.xml（EPUB必需文件）
    let container_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#;
    
    zip.start_file("META-INF/container.xml", options)
        .map_err(|e| format!("添加container.xml失败: {}", e))?;
    zip.write_all(container_xml.as_bytes())
        .map_err(|e| format!("写入container.xml失败: {}", e))?;
    
    // 递归添加文件夹中的所有文件
    println!("[DEBUG] Adding folder contents to ZIP...");
    add_folder_to_zip(&mut zip, notebook_folder, "", &options)?;
    println!("[DEBUG] Folder contents added to ZIP");
    
    zip.finish().map_err(|e| format!("完成ZIP写入失败: {}", e))?;
    println!("[DEBUG] ZIP writing completed");
    
    // 替换原EPUB文件
    fs::rename(&temp_epub_path, epub_path)
        .map_err(|e| format!("替换EPUB文件失败: {}", e))?;
    println!("[DEBUG] EPUB repackaging completed: {}", epub_path);
    
    Ok(())
}

/// 递归添加文件夹到ZIP
fn add_folder_to_zip(
    zip: &mut ZipWriter<File>,
    folder: &PathBuf,
    prefix: &str,
    options: &zip::write::FileOptions,
) -> Result<(), String> {
    for entry in fs::read_dir(folder).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        
        // 跳过临时文件和EPUB文件本身
        if name.ends_with(".tmp") || name.ends_with(".epub") {
            continue;
        }
        
        // 跳过Markdown缓存文件（这些是外部存储，不需要打包进EPUB）
        if name.ends_with(".md") {
            continue;
        }
        
        let full_path = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", prefix, name)
        };
        
        if path.is_dir() {
            add_folder_to_zip(zip, &path, &full_path, options)?;
        } else {
            zip.start_file(&full_path, *options)
                .map_err(|e| format!("添加文件{}失败: {}", full_path, e))?;
            
            let content = fs::read(&path)
                .map_err(|e| format!("读取文件{}失败: {}", full_path, e))?;
            zip.write_all(&content)
                .map_err(|e| format!("写入文件{}失败: {}", full_path, e))?;
        }
    }
    
    Ok(())
}

/// 将笔记注册到书库配置中（不复制文件）
fn register_notebook_to_library(epub_path: &str, library_path: &str, title: &str) -> Result<(), String> {
    use crate::models::library::{BookEntry, LibraryConfig};
    
    let config_path = PathBuf::from(library_path).join("library.json");
    
    // 读取现有配置
    let mut config = if config_path.exists() {
        let config_json = fs::read_to_string(&config_path)
            .map_err(|e| format!("读取配置文件失败: {}", e))?;
        serde_json::from_str(&config_json)
            .map_err(|e| format!("解析配置文件失败: {}", e))?
    } else {
        LibraryConfig {
            library_path: library_path.to_string(),
            books: Vec::new(),
        }
    };
    
    // 获取文件夹名称作为book_folder_name
    let epub_file = PathBuf::from(epub_path);
    let folder_name = epub_file.parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .ok_or("无法获取文件夹名称")?
        .to_string();
    
    // 创建新的BookEntry
    let new_entry = BookEntry {
        id: uuid::Uuid::new_v4().to_string(),
        book_folder_name: folder_name.clone(),
    };
    
    // 添加到配置
    config.books.push(new_entry.clone());
    
    // 保存配置
    let config_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(&config_path, config_json)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    
    // 创建metadata.json
    let now = chrono::Utc::now().to_rfc3339();
    let metadata = crate::models::library::BookMetadata {
        id: new_entry.id,
        title: title.to_string(),
        author: "用户".to_string(),
        cover_path: None,
        progress: 0,
        last_read_time: None,
        description: None,
        publisher: None,
        added_time: now,
        file_path: Some(epub_path.to_string()),
        is_notebook: true,  // 标记为笔记
        tags: Vec::new(),
    };
    
    let metadata_path = PathBuf::from(library_path)
        .join(&folder_name)
        .join("metadata.json");
    
    let metadata_json = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("序列化元数据失败: {}", e))?;
    fs::write(&metadata_path, metadata_json)
        .map_err(|e| format!("写入元数据文件失败: {}", e))?;
    
    Ok(())
}

/// 从Markdown中提取第一个一级标题
fn extract_first_h1_from_markdown(markdown: &str) -> Option<String> {
    // Markdown中的一级标题格式：# 标题内容
    for line in markdown.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("# ") {
            return Some(trimmed[2..].trim().to_string());
        }
    }
    None
}

/// 更新nav.xhtml中指定页面的标题
fn update_nav_page_title(
    notebook_folder: &PathBuf,
    page_id: &str,
    new_title: &str,
) -> Result<(), String> {
    let nav_path = notebook_folder.join("OEBPS/nav.xhtml");
    
    if !nav_path.exists() {
        return Ok(()); // nav.xhtml不存在，跳过
    }
    
    // 读取现有的nav.xhtml
    let mut nav_content = fs::read_to_string(&nav_path)
        .map_err(|e| format!("读取nav.xhtml失败: {}", e))?;
    
    // 将完整路径转换为相对路径
    let relative_href = format!("{}.xhtml", page_id);
    
    // 查找包含该页面href的<li>标签
    // 格式：<li><a href="page_001.xhtml">旧标题</a></li>
    let search_pattern = format!("<a href=\"{}\">", relative_href);
    
    if let Some(start_pos) = nav_content.find(&search_pattern) {
        // 找到<a>标签的结束位置
        if let Some(end_pos) = nav_content[start_pos..].find("</a>") {
            let link_start = start_pos + search_pattern.len();
            let link_end = start_pos + end_pos;
            
            // 替换标题文本
            let before = &nav_content[..link_start];
            let after = &nav_content[link_end..];
            nav_content = format!("{}{}{}", before, escape_xml(new_title), after);
            
            // 写回文件
            fs::write(&nav_path, &nav_content)
                .map_err(|e| format!("写入nav.xhtml失败: {}", e))?;
        }
    }
    
    Ok(())
}

/// 解析OPF中的spine，返回itemref的idref列表（按顺序）
fn parse_spine_items(opf_content: &str) -> Result<Vec<String>, String> {
    let mut reader = Reader::from_str(opf_content);
    reader.config_mut().trim_text(true);
    
    let mut buf = Vec::new();
    let mut spine_items = Vec::new();
    let mut in_spine = false;
    
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                // 使用local_name()忽略命名空间
                let local_name = e.name().local_name();
                
                if local_name.as_ref() == b"spine" {
                    in_spine = true;
                } else if in_spine && local_name.as_ref() == b"itemref" {
                    // 提取idref属性
                    if let Some(idref) = e.attributes().find_map(|a| {
                        a.ok().and_then(|attr| {
                            if attr.key.local_name().as_ref() == b"idref" {
                                String::from_utf8(attr.value.to_vec()).ok()
                            } else {
                                None
                            }
                        })
                    }) {
                        spine_items.push(idref);
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let local_name = e.name().local_name();
                
                if local_name.as_ref() == b"spine" {
                    in_spine = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("解析spine失败: {}", e)),
            _ => {}
        }
        buf.clear();
    }
    
    Ok(spine_items)
}

/// 解析OPF中的manifest，返回id到href的映射
struct ManifestItem {
    #[allow(dead_code)]  // 为未来扩展预留
    id: String,
    href: String,
}

fn parse_manifest_items(opf_content: &str) -> Result<std::collections::HashMap<String, ManifestItem>, String> {
    let mut reader = Reader::from_str(opf_content);
    reader.config_mut().trim_text(true);
    
    let mut buf = Vec::new();
    let mut items = std::collections::HashMap::new();
    let mut in_manifest = false;
    
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(ref e)) | Ok(Event::Start(ref e)) => {
                // 使用local_name()忽略命名空间
                let local_name = e.name().local_name();
                
                if local_name.as_ref() == b"manifest" {
                    in_manifest = true;
                } else if in_manifest && local_name.as_ref() == b"item" {
                    let mut id = String::new();
                    let mut href = String::new();
                    
                    for attr in e.attributes() {
                        if let Ok(a) = attr {
                            let key = a.key.local_name();
                            let value = String::from_utf8_lossy(&a.value).to_string();
                            
                            if key.as_ref() == b"id" {
                                id = value;
                            } else if key.as_ref() == b"href" {
                                href = value;
                            }
                        }
                    }
                    
                    if !id.is_empty() && !href.is_empty() {
                        items.insert(id.clone(), ManifestItem { id, href });
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let local_name = e.name().local_name();
                
                if local_name.as_ref() == b"manifest" {
                    in_manifest = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("解析manifest失败: {}", e)),
            _ => {}
        }
        buf.clear();
    }
    
    Ok(items)
}

/// 从EPUB中的XHTML文件读取标题（<h1>标签内容）
fn read_title_from_epub_xhtml(epub_path: &str, xhtml_href: &str) -> Option<String> {
    let file = fs::File::open(epub_path).ok()?;
    let mut archive = ZipArchive::new(file).ok()?;
    
    // 读取XHTML文件内容
    let mut xhtml_file = archive.by_name(xhtml_href).ok()?;
    let mut content = String::new();
    xhtml_file.read_to_string(&mut content).ok()?;
    
    // 简单解析<h1>标签
    if let Some(start) = content.find("<h1>") {
        if let Some(end) = content[start..].find("</h1>") {
            let title = &content[start + 4..start + end];
            // 解码XML实体
            let decoded = title
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&amp;", "&")
                .replace("&quot;", "\"")
                .replace("&#39;", "'");
            return Some(decoded);
        }
    }
    
    None
}

/// 删除指定页面
pub fn delete_notebook_page(epub_path: String, page_id: String) -> Result<(), String> {
    let epub_file = PathBuf::from(&epub_path);
    let notebook_folder = epub_file.parent()
        .ok_or("无法获取笔记文件夹路径")?
        .to_path_buf();
    
    // 1. 读取OPF内容
    let (opf_path, mut opf_content) = read_opf_content(&epub_path)?;
    
    // 2. 查找页面对应的XHTML文件路径
    let xhtml_path = find_xhtml_path_by_id(&opf_content, &page_id)?;
    
    // 3. 从manifest中移除item
    let item_pattern = format!(r#"    <item id="{}" href="{}" media-type="application/xhtml+xml"/>"#, page_id, xhtml_path);
    if let Some(pos) = opf_content.find(&item_pattern) {
        let end_pos = pos + item_pattern.len();
        opf_content.replace_range(pos..end_pos, "");
    }
    
    // 4. 从spine中移除itemref
    let itemref_pattern = format!(r#"    <itemref idref="{}"/>"#, page_id);
    if let Some(pos) = opf_content.find(&itemref_pattern) {
        let end_pos = pos + itemref_pattern.len();
        opf_content.replace_range(pos..end_pos, "");
    }
    
    // 5. 更新OPF文件
    let opf_file_path = notebook_folder.join(&opf_path);
    fs::write(&opf_file_path, &opf_content)
        .map_err(|e| format!("写入OPF文件失败: {}", e))?;
    
    // 6. 删除XHTML文件
    let xhtml_file_path = notebook_folder.join(&xhtml_path);
    if xhtml_file_path.exists() {
        fs::remove_file(&xhtml_file_path)
            .map_err(|e| format!("删除XHTML文件失败: {}", e))?;
    }
    
    // 7. 删除Markdown文件
    let md_file_path = notebook_folder.join(format!("{}.md", page_id));
    if md_file_path.exists() {
        fs::remove_file(&md_file_path)
            .map_err(|e| format!("删除Markdown文件失败: {}", e))?;
    }
    
    // 8. 更新nav.xhtml
    update_nav_after_deletion(&notebook_folder, &xhtml_path)?;
    
    // 9. 重新打包EPUB
    repackage_epub(&notebook_folder, &epub_path)?;
    
    Ok(())
}

/// 删除页面后更新nav.xhtml
fn update_nav_after_deletion(notebook_folder: &PathBuf, deleted_href: &str) -> Result<(), String> {
    let nav_path = notebook_folder.join("OEBPS/nav.xhtml");
    
    if !nav_path.exists() {
        return Ok(());
    }
    
    let mut nav_content = fs::read_to_string(&nav_path)
        .map_err(|e| format!("读取nav.xhtml失败: {}", e))?;
    
    // 将完整路径转换为相对路径
    let relative_href = if deleted_href.starts_with("OEBPS/") {
        &deleted_href[6..]
    } else {
        deleted_href
    };
    
    // 查找并删除对应的<li>项
    let pattern = format!(r#"      <li><a href="{}">"#, relative_href);
    if let Some(start_pos) = nav_content.find(&pattern) {
        if let Some(end_pos) = nav_content[start_pos..].find("</li>") {
            let delete_end = start_pos + end_pos + 5; // 包含"</li>"
            nav_content.replace_range(start_pos..delete_end, "");
        }
    }
    
    fs::write(&nav_path, &nav_content)
        .map_err(|e| format!("写入nav.xhtml失败: {}", e))?;
    
    Ok(())
}

