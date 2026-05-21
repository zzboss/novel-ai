<template>
  <div class="home min-h-screen flex flex-col relative overflow-y-auto">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-20 blur-[120px]" style="background: linear-gradient(135deg, #7C3AED, #3B82F6);"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]" style="background: linear-gradient(135deg, #6D28D9, #1E293B);"></div>
    </div>

    <!-- 顶部导航 -->
    <header class="h-16 flex items-center justify-between px-8 relative z-10 border-b border-[var(--el-border-color)] bg-[var(--el-bg-color)] backdrop-filter: blur(12px);">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--el-color-primary)]">
          <span class="text-white text-sm">📝</span>
        </div>
        <span class="text-lg font-semibold tracking-tight text-[var(--el-text-color-primary)]">AI 小说创作工作台</span>
      </div>
      <el-button
        plain
        @click="openSettings"
      >
        <el-icon class="mr-1"><Setting /></el-icon>
        设置
      </el-button>
    </header>

    <!-- 主内容区 -->
    <main class="flex-1 flex flex-col items-center px-6 py-8 relative z-10">
      <div class="max-w-4xl w-full">
        <!-- 欢迎区域 -->
        <div class="text-center mb-10">
          <h1 class="text-4xl font-bold mb-4 tracking-tight text-[var(--el-text-color-primary)]">
            欢迎使用 <span class="bg-gradient-to-r from-[var(--el-color-primary)] to-[var(--el-color-primary-light-3)] bg-clip-text text-transparent">AI 小说创作工作台</span>
          </h1>
          <p class="text-base text-[var(--el-text-color-secondary)]">
            面向中文网文作者的本地化 AI 创作桌面应用，让灵感触手可及
          </p>
        </div>

        <!-- 操作按钮 -->
        <div class="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <el-button
            type="primary"
            size="large"
            class="!px-8 !py-5 !text-base !font-semibold"
            @click="createProject"
          >
            <template #icon>
              <Plus class="transition-transform duration-300 hover:rotate-90" />
            </template>
            快速创建
          </el-button>
          <el-button
            type="primary"
            plain
            size="large"
            class="!px-8 !py-5 !text-base !font-semibold"
            @click="createWithWizard"
          >
            ✨
            分步创建
          </el-button>
          <el-button
            size="large"
            class="!px-8 !py-5 !text-base !font-semibold"
            @click="openProject"
          >
            <template #icon>
              <FolderOpened class="w-5 h-5 transition-transform duration-300 hover:scale-110" />
            </template>
            打开项目
          </el-button>
          <el-button
            size="large"
            class="!px-8 !py-5 !text-base !font-semibold"
            @click="goToChatHistory"
          >
            <template #icon>
              <el-icon class="w-5 h-5"><Document /></el-icon>
            </template>
            对话历史
          </el-button>
        </div>

        <!-- 项目列表 -->
        <div v-if="projectsDirectory" class="project-list">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold text-[var(--el-text-color-primary)]">我的项目</h2>
            <el-button text type="primary" @click="refreshProjects">
              <el-icon class="mr-1"><Refresh /></el-icon>
              刷新
            </el-button>
          </div>

          <!-- 加载中 -->
          <div v-if="loading" class="text-center py-12">
            <el-icon class="is-loading text-3xl text-[var(--el-color-primary)]"><Loading /></el-icon>
            <p class="mt-2 text-[var(--el-text-color-secondary)]">加载中...</p>
          </div>

          <!-- 项目列表 -->
          <div v-else-if="projects.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="proj in projects"
              :key="proj.path"
              class="project-card group cursor-pointer rounded-lg border border-[var(--el-border-color)] bg-[var(--el-bg-color)] p-5 transition-all duration-300 hover:border-[var(--el-color-primary)] hover:shadow-lg hover:-translate-y-1"
              @click="openExistingProject(proj.path)"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--el-color-primary-light-9] group-hover:bg-[var(--el-color-primary-light-8)] transition-colors">
                  <el-icon class="text-xl text-[var(--el-color-primary)]"><Document /></el-icon>
                </div>
                <el-button
                  text
                  class="!p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  @click.stop="confirmDeleteProject(proj)"
                >
                  <el-icon class="text-[var(--el-color-danger)]"><Delete /></el-icon>
                </el-button>
              </div>
              <h3 class="text-base font-medium text-[var(--el-text-color-primary)] mb-2 truncate">
                {{ proj.name }}
              </h3>
              <p class="text-xs text-[var(--el-text-color-placeholder)]">
                {{ formatTime(proj.updatedAt) }}
              </p>
            </div>
          </div>

          <!-- 空状态 -->
          <el-empty v-else description="暂无项目，点击上方按钮创建" />
        </div>

        <!-- 未设置项目目录提示 -->
        <div v-else class="text-center py-12">
          <el-empty description="请先在设置中指定项目目录">
            <el-button type="primary" @click="openSettings">
              前往设置
            </el-button>
          </el-empty>
        </div>
      </div>
    </main>

    <!-- 底部版权 -->
    <footer class="h-12 flex items-center justify-center relative z-10 text-xs text-[var(--el-text-color-placeholder)]">
      AI 小说创作工作台 · 让创作更自由
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Setting, Plus, FolderOpened, Refresh, Document, Delete, Loading } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

// 项目列表数据
const projects = ref<Array<{ name: string, path: string, updatedAt: number }>>([])
const loading = ref(false)

// 项目目录
const projectsDirectory = computed(() => settingsStore.settings.projectsDirectory || '')

// 初始化时尝试恢复未完成的创建会话，并加载项目列表
onMounted(async () => {
  // 尝试恢复未完成的创建会话
  await projectStore.loadSession()

  // 加载项目列表
  if (projectsDirectory.value) {
    await loadProjects()
  }
})

// 加载项目列表
async function loadProjects(): Promise<void> {
  if (!projectsDirectory.value) return

  loading.value = true
  try {
    const result = await window.electronAPI.scanProjectsDirectory(projectsDirectory.value)
    projects.value = result || []
  } catch (error) {
    console.error('加载项目列表失败:', error)
    ElMessage.error('加载项目列表失败')
  } finally {
    loading.value = false
  }
}

// 刷新项目列表
async function refreshProjects(): Promise<void> {
  await loadProjects()
  ElMessage.success('已刷新')
}

// 打开已有项目
async function openExistingProject(path: string): Promise<void> {
  try {
    await projectStore.openProject(path)
    ElMessage.success(`项目 "${projectStore.project?.name}" 已打开`)
    router.push('/workbench')
  } catch (error) {
    console.error('打开项目失败:', error)
    ElMessage.error(`打开项目失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// 确认删除项目
async function confirmDeleteProject(proj: { name: string, path: string }): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定要删除项目"${proj.name}"吗？此操作不可恢复！`,
      '删除项目',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await projectStore.deleteProject(proj.path)
    await loadProjects()
    ElMessage.success('项目已删除')
  } catch (error) {
    // 用户取消
  }
}

// 跳转到对话历史页面
function goToChatHistory(): void {
  router.push('/chat-history')
}

// 格式化时间
function formatTime(timestamp: number): string {
  if (!timestamp) return '未知时间'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function createProject(): Promise<void> {
  try {
    // 获取项目名称
    const { value: name } = await ElMessageBox.prompt('请输入项目名称', '新建项目', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '例如：我的小说',
      inputValidator: (val: string) => val.trim().length > 0 || '项目名称不能为空'
    })

    // 选择项目保存目录（不验证 meta.json）
    const pathResult = await window.electronAPI.selectDirectoryDialog()
    if (!pathResult) return

    // 在项目路径下创建以项目名称命名的子目录
    const projectPath = `${pathResult}\\${name.trim()}`

    // 创建项目
    await projectStore.createProject(name.trim(), projectPath)

    ElMessage.success('项目创建成功')
    router.push('/workbench')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('创建项目失败:', error)
      ElMessage.error(`创建项目失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

async function createWithWizard(): Promise<void> {
  try {
    // 获取项目名称
    const { value: name } = await ElMessageBox.prompt('请输入项目名称', '分步创建项目', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '例如：我的小说',
      inputValidator: (val: string) => val.trim().length > 0 || '项目名称不能为空'
    })

    // 选择项目保存目录
    const pathResult = await window.electronAPI.selectDirectoryDialog()
    if (!pathResult) return

    // 在项目路径下创建以项目名称命名的子目录
    const projectPath = `${pathResult}\\${name.trim()}`

    // 启动创建向导
    projectStore.startSession(name.trim(), projectPath)

    // 立即创建项目文件，避免数据丢失
    await projectStore.saveProjectToFile()

    // 导航到创建向导页面
    router.push('/creation-wizard')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('启动创建向导失败:', error)
      ElMessage.error(`启动创建向导失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

async function openProject(): Promise<void> {
  try {
    const path = await window.electronAPI.openProjectDialog()
    if (!path) return

    await projectStore.openProject(path)
    ElMessage.success(`项目 "${projectStore.project?.name}" 已打开`)
    router.push('/workbench')
  } catch (error) {
    console.error('打开项目失败:', error)
    ElMessage.error(`打开项目失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function openSettings(): void {
  router.push('/settings')
}
</script>
