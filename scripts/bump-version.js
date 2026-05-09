#!/usr/bin/env node

/**
 * 版本更新脚本
 * 用法: node scripts/bump-version.js [major|minor|patch|version]
 * 
 * 示例:
 *   node scripts/bump-version.js patch    # 0.1.0 -> 0.1.1
 *   node scripts/bump-version.js minor    # 0.1.0 -> 0.2.0
 *   node scripts/bump-version.js major    # 0.1.0 -> 1.0.0
 *   node scripts/bump-version.js 1.2.3    # 直接设置为指定版本
 */

const fs = require('fs');
const path = require('path');

// 文件路径
const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');
const CARGO_TOML = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');

// 读取当前版本
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
const currentVersion = packageJson.version;

console.log(`📦 当前版本: ${currentVersion}`);

// 解析新版本
let newVersion;
const args = process.argv[2];

if (!args) {
  console.error('❌ 请指定版本类型或版本号');
  console.log('用法: node bump-version.js [major|minor|patch|version]');
  process.exit(1);
}

if (['major', 'minor', 'patch'].includes(args)) {
  // 语义化版本递增
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  switch (args) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
} else if (/^\d+\.\d+\.\d+$/.test(args)) {
  // 直接指定版本号
  newVersion = args;
} else {
  console.error('❌ 无效的版本号格式');
  console.log('请使用: major, minor, patch 或 x.y.z 格式');
  process.exit(1);
}

console.log(`🚀 更新版本: ${currentVersion} → ${newVersion}`);

// 更新 package.json
packageJson.version = newVersion;
fs.writeFileSync(PACKAGE_JSON, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
console.log('✅ 已更新 package.json');

// 更新 Cargo.toml
let cargoToml = fs.readFileSync(CARGO_TOML, 'utf-8');
cargoToml = cargoToml.replace(
  /version = ".*"(\s*#.*)?/,
  `version = "${newVersion}"  # 版本号与 package.json 保持一致`
);
fs.writeFileSync(CARGO_TOML, cargoToml, 'utf-8');
console.log('✅ 已更新 Cargo.toml');

console.log('\n✨ 版本更新完成！');
console.log(`\n下一步:`);
console.log(`  git add package.json src-tauri/Cargo.toml`);
console.log(`  git commit -m "chore: bump version to ${newVersion}"`);
console.log(`  git tag v${newVersion}`);
console.log(`  git push origin main --tags`);
