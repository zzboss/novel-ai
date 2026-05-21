import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Element Plus 样式
import 'element-plus/dist/index.css'
// Element Plus 暗色主题 CSS 变量
import 'element-plus/theme-chalk/dark/css-vars.css'

// 自定义全局样式
import '@/styles/global.scss'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
