import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/home'
    },
    {
      path: '/home',
      name: 'Home',
      component: () => import('@/views/Home.vue')
    },
    {
      path: '/workbench',
      name: 'Workbench',
      component: () => import('@/views/Workbench/Workbench.vue')
    },
    {
      path: '/creation-wizard',
      name: 'CreationWizard',
      component: () => import('@/views/CreationWizard.vue')
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/Settings.vue')
    },
    {
      path: '/model-settings',
      name: 'ModelSettings',
      component: () => import('@/views/ModelSettings.vue')
    },
    {
      path: '/chat-history',
      name: 'ChatHistory',
      component: () => import('@/views/ChatHistory.vue')
    }
  ]
})

export default router
