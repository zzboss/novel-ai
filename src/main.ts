import { createApp } from 'vue'
import { createPinia, getActivePinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Element Plus 样式
import 'element-plus/dist/index.css'
// Element Plus 暗色主题 CSS 变量
import 'element-plus/theme-chalk/dark/css-vars.css'

// 自定义全局样式
import '@/styles/global.scss'

const app = createApp(App)

// 创建并安装 Pinia
const pinia = createPinia()
app.use(pinia)

// HMR 支持：在热更新时保持 Pinia 状态
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // HMR 更新时，确保 Pinia 保持活跃
    const activePinia = getActivePinia()
    if (!activePinia) {
      // 如果 Pinia 实例丢失，重新安装
      app.use(pinia)
    }
  })
}

app.use(router)
app.mount('#app')
