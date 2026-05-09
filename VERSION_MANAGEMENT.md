# 版本管理指南

## 📋 版本号位置说明

在 Tauri 项目中，版本号需要在多个地方维护。为了简化管理，我们采用以下策略：

### ✅ 推荐做法（已配置）

**只需修改一个文件：** `package.json`

```json
{
  "name": "qimo-library",
  "version": "0.1.0",  // ← 只需要修改这里
  ...
}
```

### 🔄 自动同步

#### 1. **tauri.conf.json** - 已配置为自动读取
```json
{
  "version": "../package.json"  // 自动从 package.json 读取
}
```

#### 2. **Cargo.toml** - 需要手动同步
```toml
[package]
version = "0.1.0"  # 请与 package.json 保持一致
```

> ⚠️ **注意**：Rust 的 Cargo.toml 无法直接引用 package.json，需要手动保持同步。

### 📝 版本更新流程

当需要更新版本时：

1. **修改 `package.json`**
   ```json
   "version": "0.2.0"  // 从 0.1.0 改为 0.2.0
   ```

2. **同步修改 `src-tauri/Cargo.toml`**
   ```toml
   version = "0.2.0"  # 同步更新
   ```

3. **完成！** 
   - `tauri.conf.json` 会自动读取新版本
   - `package-lock.json` 和 `Cargo.lock` 会在下次构建时自动更新

### 🔍 版本号影响的地方

| 文件 | 是否自动同步 | 说明 |
|------|------------|------|
| `package.json` | ❌ 主文件 | **唯一需要手动修改的地方** |
| `tauri.conf.json` | ✅ 自动 | 通过 `"../package.json"` 引用 |
| `Cargo.toml` | ❌ 需手动 | Rust 包管理器要求独立声明 |
| `package-lock.json` | ✅ 自动 | `npm install` 时自动生成 |
| `Cargo.lock` | ✅ 自动 | `cargo build` 时自动生成 |

### 💡 最佳实践

1. **使用语义化版本** (Semantic Versioning)
   - `MAJOR.MINOR.PATCH`
   - 例如：`1.2.3`
   - MAJOR: 不兼容的 API 变更
   - MINOR: 向下兼容的功能新增
   - PATCH: 向下兼容的问题修正

2. **版本更新检查清单**
   ```bash
   # 1. 更新 package.json
   # 2. 更新 Cargo.toml
   # 3. 提交代码
   git add package.json src-tauri/Cargo.toml
   git commit -m "chore: bump version to 0.2.0"
   
   # 4. 打标签（可选）
   git tag v0.2.0
   git push origin v0.2.0
   ```

3. **验证版本号**
   ```bash
   # 查看当前版本
   npm version
   
   # 或在 Tauri 应用中
   npm run tauri info
   ```

### 🎯 为什么不能完全自动化？

- **前端生态** (npm/yarn): 可以通过相对路径引用
- **后端生态** (Cargo): Rust 的包管理器要求显式声明版本号
- **设计哲学**: Cargo 强调明确性和可重现性

### 📚 相关文档

- [Tauri 配置文档](https://tauri.app/reference/config/)
- [Cargo.toml 格式](https://doc.rust-lang.org/cargo/reference/manifest.html)
- [语义化版本规范](https://semver.org/lang/zh-CN/)

---

*最后更新: 2026-05-09*
