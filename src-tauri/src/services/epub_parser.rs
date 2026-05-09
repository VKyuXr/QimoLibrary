use std::fs::File;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;
use quick_xml::events::Event;
use quick_xml::reader::Reader;

#[derive(Debug, Clone)]
pub struct EpubMetadata {
    pub title: String,
    pub author: String,
    pub publisher: Option<String>,
    pub description: Option<String>,
    pub cover_data: Option<Vec<u8>>,
}

pub fn extract_epub_metadata(epub_path: &Path) -> Result<EpubMetadata, String> {
    let file = File::open(epub_path)
        .map_err(|e| format!("无法打开EPUB文件: {}", e))?;
    
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("无法读取EPUB文件: {}", e))?;
    
    // 1. 读取 container.xml 找到 content.opf 的位置
    let opf_path = find_opf_path(&mut archive)?;
    
    // 2. 解析 content.opf 获取元数据
    let metadata = parse_opf_metadata(&mut archive, &opf_path)?;
    
    Ok(metadata)
}

fn find_opf_path(archive: &mut ZipArchive<File>) -> Result<String, String> {
    let mut container_file = archive.by_name("META-INF/container.xml")
        .map_err(|e| format!("找不到container.xml: {}", e))?;
    
    let mut content = String::new();
    container_file.read_to_string(&mut content)
        .map_err(|e| format!("读取container.xml失败: {}", e))?;
    
    let mut reader = Reader::from_str(&content);
    reader.trim_text(true);
    
    let mut buf = Vec::new();
    
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
                        return Ok(path_attr);
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("解析XML失败: {}", e)),
            _ => {}
        }
        buf.clear();
    }
    
    Err("未找到content.opf路径".to_string())
}

fn parse_opf_metadata(archive: &mut ZipArchive<File>, opf_path: &str) -> Result<EpubMetadata, String> {
    // 先读取OPF文件内容
    let opf_content = {
        let mut opf_file = archive.by_name(opf_path)
            .map_err(|e| format!("找不到{}: {}", opf_path, e))?;
        
        let mut content = String::new();
        opf_file.read_to_string(&mut content)
            .map_err(|e| format!("读取{}失败: {}", opf_path, e))?;
        content
    }; // opf_file在这里被释放
    
    let mut reader = Reader::from_str(&opf_content);
    reader.trim_text(true);
    
    let mut title = String::new();
    let mut creator = String::new();
    let mut publisher: Option<String> = None;
    let mut description: Option<String> = None;
    let mut cover_id: Option<String> = None;
    let mut manifest_items: Vec<(String, String)> = Vec::new();
    
    let mut buf = Vec::new();
    let mut in_metadata = false;
    let mut in_manifest = false;
    let mut current_element = String::new();
    
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                current_element = tag_name.clone();
                
                match tag_name.as_str() {
                    "metadata" => in_metadata = true,
                    "manifest" => in_manifest = true,
                    "item" => {
                        if in_manifest {
                            let mut id = String::new();
                            let mut href = String::new();
                            let mut media_type = String::new();
                            let mut is_cover_image = false;
                            
                            for attr in e.attributes().flatten() {
                                let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                                let value = String::from_utf8_lossy(&attr.value).to_string();
                                
                                match key.as_str() {
                                    "id" => id = value.clone(),
                                    "href" => href = value,
                                    "media-type" => media_type = value,
                                    _ => {}
                                }
                            }
                            
                            // 检查是否是封面图片
                            if media_type.starts_with("image/") {
                                if let Some(properties_attr) = e.attributes().find_map(|a| {
                                    a.ok().and_then(|attr| {
                                        if attr.key.as_ref() == b"properties" {
                                            String::from_utf8(attr.value.to_vec()).ok()
                                        } else {
                                            None
                                        }
                                    })
                                }) {
                                    if properties_attr.contains("cover-image") {
                                        is_cover_image = true;
                                    }
                                }
                            }
                            
                            // 如果是封面，先保存ID
                            if is_cover_image && cover_id.is_none() {
                                cover_id = Some(id.clone());
                            }
                            
                            manifest_items.push((id, href));
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(ref e)) => {
                let text = String::from_utf8_lossy(e.as_ref()).trim().to_string();
                
                if in_metadata {
                    match current_element.as_str() {
                        "dc:title" | "title" => {
                            if title.is_empty() {
                                title = text;
                            }
                        }
                        "dc:creator" | "creator" => {
                            if creator.is_empty() {
                                creator = text;
                            }
                        }
                        "dc:publisher" | "publisher" => {
                            if publisher.is_none() {
                                publisher = Some(text);
                            }
                        }
                        "dc:description" | "description" => {
                            if description.is_none() {
                                description = Some(text);
                            }
                        }
                        _ => {}
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag_name.as_str() {
                    "metadata" => in_metadata = false,
                    "manifest" => in_manifest = false,
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("解析OPF文件失败: {}", e)),
            _ => {}
        }
        buf.clear();
    }
    
    // 如果没有通过properties找到封面，尝试通过meta标签查找
    if cover_id.is_none() {
        cover_id = find_cover_via_meta(&opf_content);
    }
    
    // 提取封面图片数据
    let cover_data = if let Some(cover_item_id) = cover_id {
        if let Some((_, cover_href)) = manifest_items.iter().find(|(id, _)| id == &cover_item_id) {
            // 计算封面图片的完整路径
            let opf_dir = std::path::Path::new(opf_path)
                .parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            
            let cover_full_path = if opf_dir.is_empty() {
                cover_href.clone()
            } else {
                format!("{}/{}", opf_dir, cover_href)
            };
            
            // 规范化路径（处理 ../ 等）
            let normalized_path = normalize_path(&cover_full_path);
            
            // 现在可以安全地再次借用archive
            archive.by_name(&normalized_path)
                .ok()
                .and_then(|mut cover_file| {
                    let mut data = Vec::new();
                    cover_file.read_to_end(&mut data).ok()?;
                    Some(data)
                })
        } else {
            None
        }
    } else {
        None
    };
    
    Ok(EpubMetadata {
        title: if title.is_empty() { "未知标题".to_string() } else { title },
        author: if creator.is_empty() { "未知作者".to_string() } else { creator },
        publisher,
        description,
        cover_data,
    })
}

fn find_cover_via_meta(content: &str) -> Option<String> {
    let mut reader = Reader::from_str(content);
    reader.trim_text(true);
    
    let mut buf = Vec::new();
    
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(ref e)) => {
                if e.name().as_ref() == b"meta" {
                    let mut name = String::new();
                    let mut content_val = String::new();
                    
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                        let value = String::from_utf8_lossy(&attr.value).to_string();
                        
                        match key.as_str() {
                            "name" => name = value,
                            "content" => content_val = value,
                            _ => {}
                        }
                    }
                    
                    if name == "cover" && !content_val.is_empty() {
                        return Some(content_val);
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    
    None
}

fn normalize_path(path: &str) -> String {
    // 简单的路径规范化，处理 ./ 和 ../
    let parts: Vec<&str> = path.split('/').collect();
    let mut result: Vec<String> = Vec::new();
    
    for part in parts {
        match part {
            "." => continue,
            ".." => {
                result.pop();
            }
            _ => result.push(part.to_string()),
        }
    }
    
    result.join("/")
}
