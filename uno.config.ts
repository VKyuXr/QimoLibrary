import { defineConfig, presetUno, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(), // 默认预设，兼容 Tailwind CSS
    presetAttributify(), // 支持属性化写法
  ],
  theme: {
    // 定义统一的尺寸规范
    spacing: {
      'sidebar': '80px', // 侧边栏宽度
      'control-btn': '48px', // 控制按钮尺寸
      'reader-margin': '75px', // 阅读器左右边距
    },
  },
  rules: [
    // 自定义规则用于特殊布局需求
  ],
  shortcuts: [
    // 常用组合样式
    ['btn-control', 'w-12 h-12 flex items-center justify-center cursor-pointer transition-all'],
    ['reader-container', 'relative w-full h-full overflow-hidden'],
    // 重返未来1999风格快捷方式
    ['btn-vintage', 'border border-[#3A3028] dark:border-[#F5F1E8] px-6 py-2 rounded-none hover:bg-[#D4C5A9]/20 transition-colors'],
    ['btn-confirm', 'font-["Pinyon_Script"] text-lg border border-[#8B3A3A] text-[#8B3A3A] px-8 py-2 rounded-none hover:bg-[#8B3A3A] hover:text-white transition-all'],
    ['card-archive', 'border border-[#3A3028] dark:border-[#F5F1E8] rounded-none shadow-none'],
    ['text-serif', 'font-["Playfair_Display"]'],
    ['text-typewriter', 'font-["Courier_Prime"]'],
    ['divider-thin', 'h-px bg-[#3A3028] dark:bg-[#F5F1E8] my-4'],
  ]
})
