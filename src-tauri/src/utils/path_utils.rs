/// 规范化Windows长路径前缀
pub fn normalize_windows_path(path: &str) -> String {
    if path.starts_with("\\\\?\\") {
        path[4..].to_string()
    } else {
        path.to_string()
    }
}
