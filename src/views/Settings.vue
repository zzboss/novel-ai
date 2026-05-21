<template>
  <div class="settings h-screen flex flex-col bg-[var(--el-bg-color-page)] text-[var(--el-text-color-primary)]">
    <!-- 顶部导航 -->
    <header class="h-14 border-b flex items-center px-6 flex-shrink-0" style="border-color: var(--el-border-color)">
      <el-button :icon="ArrowLeft" @click="goBack" text>
        返回
      </el-button>
      <h1 class="ml-4 text-lg font-medium">设置</h1>
    </header>

    <main class="flex-1 overflow-y-auto">
      <div class="max-w-4xl mx-auto p-6 pb-12">
      <!-- 模型配置 -->
      <el-card class="mb-6">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="font-medium">模型配置</span>
            <el-button type="primary" @click="goToModelSettings">
              <el-icon class="mr-1"><Plus /></el-icon>
              添加模型
            </el-button>
          </div>
        </template>
        
        <el-empty v-if="models.length === 0" description="暂无模型配置" />
        
        <el-table v-else :data="models" style="width: 100%">
          <el-table-column label="名称" prop="name" />
          <el-table-column label="提供商" prop="provider" />
          <el-table-column label="模型 ID" prop="model">
            <template #default="{ row }">
              <span class="text-[var(--el-text-color-secondary)]">{{ row.model }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag 
                v-if="row.isDefault" 
                type="warning" 
                size="small"
              >
                默认
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="{ row }">
              <el-button 
                type="primary" 
                link 
                size="small"
                :disabled="row.isDefault"
                @click="setAsDefault(row.id)"
              >
                设为默认
              </el-button>
              <el-button 
                type="danger" 
                link 
                size="small"
                @click="removeModel(row.id)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 外观设置 -->
      <el-card class="mb-6">
        <template #header>
          <span class="font-medium">外观设置</span>
        </template>
        
        <div class="mb-4">
          <div class="text-sm mb-4 font-medium">主题</div>
          
          <!-- 主题预览卡片 -->
          <div class="grid grid-cols-3 gap-4">
            <!-- 暗色主题预览 -->
            <div 
              class="cursor-pointer rounded-lg border-2 overflow-hidden transition-all duration-200"
              :class="currentTheme === 'dark' ? 'border-[var(--color-primary)] shadow-lg' : 'border-[var(--el-border-color)] hover:border-[var(--color-primary)]'"
              @click="setTheme('dark')"
            >
              <!-- 预览图 -->
              <div class="h-32 bg-[#0F0F23] p-3 flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded bg-[#1A1A2E] border border-white/10"></div>
                  <div class="h-3 w-20 bg-[#7C3AED] rounded-full opacity-80"></div>
                </div>
                <div class="flex gap-2 flex-1">
                  <div class="w-1/3 bg-[#1A1A2E] rounded border border-white/5 p-1">
                    <div class="h-2 w-full bg-white/10 rounded mb-1"></div>
                    <div class="h-2 w-3/4 bg-white/10 rounded mb-1"></div>
                    <div class="h-2 w-1/2 bg-white/10 rounded"></div>
                  </div>
                  <div class="flex-1 bg-[#1A1A2E] rounded border border-white/5 p-2">
                    <div class="h-2 w-full bg-[#E2E8F0] rounded mb-2"></div>
                    <div class="h-2 w-5/6 bg-[#94A3B8] rounded mb-1"></div>
                    <div class="h-2 w-4/6 bg-[#94A3B8] rounded"></div>
                  </div>
                </div>
              </div>
              <!-- 主题名称 -->
              <div class="p-3 bg-[#1A1A2E] border-t border-white/5 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <el-icon><Moon /></el-icon>
                  <span class="text-sm">暗色主题</span>
                </div>
                <el-icon v-if="currentTheme === 'dark'" class="text-[var(--color-primary)]">
                  <Check />
                </el-icon>
              </div>
            </div>

            <!-- 亮色主题预览 -->
            <div 
              class="cursor-pointer rounded-lg border-2 overflow-hidden transition-all duration-200"
              :class="currentTheme === 'light' ? 'border-[var(--color-primary)] shadow-lg' : 'border-[var(--el-border-color)] hover:border-[var(--color-primary)]'"
              @click="setTheme('light')"
            >
              <!-- 预览图 -->
              <div class="h-32 bg-white p-3 flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded bg-[#F8FAFC] border border-gray-200"></div>
                  <div class="h-3 w-20 bg-[#6366F1] rounded-full opacity-80"></div>
                </div>
                <div class="flex gap-2 flex-1">
                  <div class="w-1/3 bg-[#F8FAFC] rounded border border-gray-200 p-1">
                    <div class="h-2 w-full bg-gray-200 rounded mb-1"></div>
                    <div class="h-2 w-3/4 bg-gray-200 rounded mb-1"></div>
                    <div class="h-2 w-1/2 bg-gray-200 rounded"></div>
                  </div>
                  <div class="flex-1 bg-[#F8FAFC] rounded border border-gray-200 p-2">
                    <div class="h-2 w-full bg-[#1E293B] rounded mb-2"></div>
                    <div class="h-2 w-5/6 bg-[#475569] rounded mb-1"></div>
                    <div class="h-2 w-4/6 bg-[#475569] rounded"></div>
                  </div>
                </div>
              </div>
              <!-- 主题名称 -->
              <div class="p-3 bg-white border-t border-gray-200 flex items-center justify-between">
                <div class="flex items-center gap-2 text-gray-700">
                  <el-icon><Sunny /></el-icon>
                  <span class="text-sm">亮色主题</span>
                </div>
                <el-icon v-if="currentTheme === 'light'" class="text-[var(--color-primary)]">
                  <Check />
                </el-icon>
              </div>
            </div>

            <!-- 护眼主题预览 -->
            <div 
              class="cursor-pointer rounded-lg border-2 overflow-hidden transition-all duration-200"
              :class="currentTheme === 'eye-care' ? 'border-[var(--color-primary)] shadow-lg' : 'border-[var(--el-border-color)] hover:border-[var(--color-primary)]'"
              @click="setTheme('eye-care')"
            >
              <!-- 预览图 -->
              <div class="h-32 bg-[#F5E6C8] p-3 flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded bg-[#EDE0C8] border border-[#8D6E63]/20"></div>
                  <div class="h-3 w-20 bg-[#8B6914] rounded-full opacity-80"></div>
                </div>
                <div class="flex gap-2 flex-1">
                  <div class="w-1/3 bg-[#EDE0C8] rounded border border-[#8D6E63]/10 p-1">
                    <div class="h-2 w-full bg-[#8D6E63]/20 rounded mb-1"></div>
                    <div class="h-2 w-3/4 bg-[#8D6E63]/20 rounded mb-1"></div>
                    <div class="h-2 w-1/2 bg-[#8D6E63]/20 rounded"></div>
                  </div>
                  <div class="flex-1 bg-[#EDE0C8] rounded border border-[#8D6E63]/10 p-2">
                    <div class="h-2 w-full bg-[#3E2723] rounded mb-2"></div>
                    <div class="h-2 w-5/6 bg-[#5D4037] rounded mb-1"></div>
                    <div class="h-2 w-4/6 bg-[#5D4037] rounded"></div>
                  </div>
                </div>
              </div>
              <!-- 主题名称 -->
              <div class="p-3 bg-[#EDE0C8] border-t border-[#8D6E63]/10 flex items-center justify-between">
                <div class="flex items-center gap-2 text-[#3E2723]">
                  <el-icon><Coffee /></el-icon>
                  <span class="text-sm">护眼主题</span>
                </div>
                <el-icon v-if="currentTheme === 'eye-care'" class="text-[var(--color-primary)]">
                  <Check />
                </el-icon>
              </div>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 编辑器设置 -->
      <el-card class="mb-6">
        <template #header>
          <span class="font-medium">编辑器设置</span>
        </template>
        
        <el-form label-width="120px">
          <el-form-item label="自动保存间隔">
            <el-select v-model="autoSaveInterval" @change="updateSetting('autoSaveInterval', $event)">
              <el-option :value="3" label="3 秒" />
              <el-option :value="5" label="5 秒" />
              <el-option :value="10" label="10 秒" />
              <el-option :value="30" label="30 秒" />
            </el-select>
          </el-form-item>
          
          <el-form-item label="字体大小">
            <el-input-number 
              v-model="fontSize" 
              :min="12" 
              :max="24"
              @change="(val: number | undefined) => val !== undefined && updateSetting('fontSize', val)"
            />
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 项目目录设置 -->
      <el-card>
        <template #header>
          <span class="font-medium">项目目录</span>
        </template>
        
        <div class="mb-4">
          <div class="text-sm text-[var(--el-text-color-secondary)] mb-2">
            设置项目目录后，首页将显示该目录下的所有项目，方便快速打开
          </div>
          <div class="flex items-center gap-2">
            <el-input 
              :model-value="projectsDirectory" 
              readonly 
              placeholder="未设置项目目录"
              class="flex-1"
            />
            <el-button @click="selectProjectsDirectory">
              <el-icon class="mr-1"><FolderOpened /></el-icon>
              选择目录
            </el-button>
            <el-button 
              v-if="projectsDirectory" 
              @click="clearProjectsDirectory"
              type="danger"
              plain
            >
              清除
            </el-button>
          </div>
        </div>
      </el-card>
    </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Plus, Moon, Sunny, Coffee, Check, FolderOpened } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'

const router = useRouter()
const settingsStore = useSettingsStore()
const { settings } = storeToRefs(settingsStore)

const models = computed(() => settings.value.models)
const currentTheme = computed({
  get: () => settings.value.theme,
  set: (val) => val
})
const autoSaveInterval = computed({
  get: () => settings.value.autoSaveInterval,
  set: (val) => val
})
const fontSize = computed({
  get: () => settings.value.fontSize,
  set: (val) => val
})
const projectsDirectory = computed({
  get: () => settings.value.projectsDirectory || '',
  set: (val) => val
})

function goBack(): void {
  router.push('/home')
}

function goToModelSettings(): void {
  router.push('/model-settings')
}

function setAsDefault(id: string): void {
  settingsStore.setActiveModel(id)
  ElMessage.success('已设为默认模型')
}

async function removeModel(id: string): Promise<void> {
  try {
    await ElMessageBox.confirm('确定删除该模型配置？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    settingsStore.removeModel(id)
    ElMessage.success('模型已删除')
  } catch {
    // 用户取消
  }
}

function setTheme(theme: string): void {
  settingsStore.updateSettings({ theme: theme as 'dark' | 'light' | 'eye-care' })
  ElMessage.success('主题已切换')
}

async function selectProjectsDirectory(): Promise<void> {
  try {
    const path = await window.electronAPI.selectDirectoryDialog()
    if (path) {
      settingsStore.updateSettings({ projectsDirectory: path })
      ElMessage.success('项目目录已设置')
    }
  } catch (error) {
    console.error('选择项目目录失败:', error)
    ElMessage.error('选择项目目录失败')
  }
}

function clearProjectsDirectory(): void {
  settingsStore.updateSettings({ projectsDirectory: '' })
  ElMessage.success('项目目录已清除')
}

function updateSetting(key: string, value: number): void {
  settingsStore.updateSettings({ [key]: value })
  ElMessage.success('设置已更新')
}
</script>
