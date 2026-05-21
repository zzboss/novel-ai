<template>
  <div id="app" class="h-screen w-screen overflow-hidden">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const settingsStore = useSettingsStore()

onMounted(async () => {
  // 初始化设置（从持久化存储加载）
  await settingsStore.initialize()

  // 应用主题
  applyTheme(settingsStore.theme)

  // 默认跳转到首页
  if (router.currentRoute.value.path === '/') {
    router.push('/home')
  }
})

watch(() => settingsStore.theme, (theme) => {
  applyTheme(theme)
})

function applyTheme(theme: string) {
  const htmlElement = document.documentElement

  // 移除所有主题类
  htmlElement.classList.remove('dark', 'theme-light', 'theme-eye-care')

  // 应用新主题
  if (theme === 'dark') {
    htmlElement.classList.add('dark')
  } else if (theme === 'light') {
    htmlElement.classList.add('theme-light')
  } else if (theme === 'eye-care') {
    htmlElement.classList.add('theme-eye-care')
  }
}
</script>
