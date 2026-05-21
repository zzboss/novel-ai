import { defineConfig, presetUno, presetIcons, transformerDirectives } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(), // 核心预设（类似 Tailwind 的功能类）
    presetIcons(), // 图标支持
  ],
  transformers: [
    transformerDirectives(), // 支持 @apply 指令
  ],
  theme: {
    colors: {
      primary: {
        50: '#f0f9ff',
        100: '#e0f2fe',
        200: '#bae6fd',
        300: '#7dd3fc',
        400: '#38bdf8',
        500: '#0ea5e9',
        600: '#0284c7',
        700: '#0369a1',
        800: '#075985',
        900: '#0c4a6e',
      },
    },
  },
  shortcuts: {
    'btn': 'px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer',
    'btn-primary': 'btn bg-primary-600 text-white hover:bg-primary-700',
    'card': 'bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6',
  },
})
