<template>
  <div class="skill-manager h-full flex flex-col bg-[var(--el-bg-color-page)]">
    <!-- 页面头部 -->
    <div class="p-4 border-b flex items-center justify-between" style="border-color: var(--el-border-color)">
      <div>
        <div class="text-base font-bold" style="color: var(--el-text-color-primary)">📦 Skill 管理</div>
        <div class="text-xs mt-1" style="color: var(--el-text-color-placeholder)">管理和配置 AI 辅助写作技能</div>
      </div>
      <div class="flex gap-2">
        <el-button size="default" type="primary" @click="handleLoadBuiltin">
          <el-icon><Download /></el-icon>
          加载内置 Skill
        </el-button>
        <el-button size="default" @click="handleImportSkill">
          <el-icon><FolderOpened /></el-icon>
          导入 Skill
        </el-button>
        <el-button size="default" type="warning" @click="handleClearCache">
          <el-icon><Delete /></el-icon>
          清除缓存
        </el-button>
        <button class="close-btn" @click="$emit('close')">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="p-4">
      <el-row :gutter="16" class="mb-4">
        <el-col :span="8">
          <div class="stat-card p-4 rounded-lg border" style="border-color: var(--el-border-color); background-color: var(--el-fill-color-light)">
            <div class="text-2xl font-bold" style="color: var(--el-color-primary)">{{ registeredSkills.length }}</div>
            <div class="text-sm" style="color: var(--el-text-color-regular)">已注册 Skill</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-card p-4 rounded-lg border" style="border-color: var(--el-border-color); background-color: var(--el-fill-color-light)">
            <div class="text-2xl font-bold" style="color: var(--el-color-success)">{{ enabledSkills.length }}</div>
            <div class="text-sm" style="color: var(--el-text-color-regular)">已启用</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-card p-4 rounded-lg border" style="border-color: var(--el-border-color); background-color: var(--el-fill-color-light)">
            <div class="text-2xl font-bold" style="color: var(--el-color-warning)">{{ cacheStats.size }}</div>
            <div class="text-sm" style="color: var(--el-text-color-regular)">缓存项</div>
          </div>
        </el-col>
      </el-row>

      <!-- Skill 列表 -->
      <div v-if="registeredSkills.length === 0" class="empty-state">
        <el-empty description="暂无已注册的 Skill">
          <el-button type="primary" @click="handleLoadBuiltin">加载内置 Skill</el-button>
        </el-empty>
      </div>

      <el-row v-else :gutter="16">
        <el-col :span="8" v-for="skill in registeredSkills" :key="skill.id" class="mb-4">
          <div
            class="skill-card p-4 rounded-lg border h-full flex flex-col"
            :class="{ 'is-disabled': !isEnabled(skill.id) }"
            style="border-color: var(--el-border-color); background-color: var(--el-bg-color-page)"
          >
            <!-- Skill 头部 -->
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-sm font-bold" style="color: var(--el-text-color-primary)">
                    {{ skill.name }}
                  </span>
                  <el-tag size="small">v{{ skill.version }}</el-tag>
                  <el-tag v-if="skill.requiresToolCall" size="small" type="warning">需授权</el-tag>
                </div>
                <div class="text-xs mb-2" style="color: var(--el-text-color-regular)">
                  {{ skill.description }}
                </div>
                <div class="flex items-center gap-2 text-xs" style="color: var(--el-text-color-placeholder)">
                  <span>ID: {{ skill.id }}</span>
                  <el-divider direction="vertical" />
                  <span>作者: {{ skill.author }}</span>
                </div>
              </div>
            </div>

            <!-- 适用 Agent -->
            <div class="mb-2">
              <div class="text-xs mb-1" style="color: var(--el-text-color-placeholder)">适用 Agent</div>
              <div class="flex flex-wrap gap-1">
                <el-tag
                  v-if="skill.applicableAgents.length === 0"
                  size="small"
                  type="success"
                >
                  全部
                </el-tag>
                <el-tag
                  v-for="agent in skill.applicableAgents"
                  :key="agent"
                  size="small"
                >
                  {{ agent }}
                </el-tag>
              </div>
            </div>

            <!-- 依赖信息 -->
            <div v-if="skill.dependencies && skill.dependencies.length > 0" class="mb-2">
              <div class="text-xs mb-1" style="color: var(--el-text-color-placeholder)">依赖</div>
              <div class="flex flex-wrap gap-1">
                <el-tag
                  v-for="dep in skill.dependencies"
                  :key="dep.skillId"
                  size="small"
                  :type="isRegistered(dep.skillId) ? 'success' : 'danger'"
                >
                  {{ dep.skillId }}
                </el-tag>
              </div>
            </div>

            <!-- 操作栏 -->
            <div class="mt-auto pt-3 border-t flex items-center justify-between" style="border-color: var(--el-border-color)">
              <div class="flex gap-1">
                <el-button size="small" text type="primary" @click="handleViewDetail(skill)">
                  详情
                </el-button>
                <el-button size="small" text type="danger" @click="handleUnregister(skill.id)">
                  卸载
                </el-button>
              </div>
              <el-switch
                :model-value="isEnabled(skill.id)"
                @change="(val: boolean) => handleToggleSkill(skill.id, val)"
              />
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="showDetailDialog"
      title="Skill 详情"
      width="600px"
    >
      <div v-if="selectedSkill" class="skill-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="ID">{{ selectedSkill.id }}</el-descriptions-item>
          <el-descriptions-item label="名称">{{ selectedSkill.name }}</el-descriptions-item>
          <el-descriptions-item label="版本">{{ selectedSkill.version }}</el-descriptions-item>
          <el-descriptions-item label="作者">{{ selectedSkill.author }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">{{ selectedSkill.description }}</el-descriptions-item>
          <el-descriptions-item label="入口文件" :span="2">{{ selectedSkill.entry }}</el-descriptions-item>
          <el-descriptions-item label="需要工具调用">
            <el-tag :type="selectedSkill.requiresToolCall ? 'warning' : 'success'">
              {{ selectedSkill.requiresToolCall ? '是' : '否' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="适用 Agent">
            <el-tag v-if="selectedSkill.applicableAgents.length === 0" size="small" type="success">全部</el-tag>
            <el-tag v-for="agent in selectedSkill.applicableAgents" :key="agent" size="small" class="mr-1">{{ agent }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, ElEmpty, ElTag, ElDescriptions, ElDescriptionsItem } from 'element-plus'
import { Download, FolderOpened, Close } from '@element-plus/icons-vue'
import { useSkillStore } from '@/stores/skill'
import { SkillRegistry } from '@/skills/SkillRegistry'
import { SkillLoader } from '@/skills/SkillLoader'
import type { SkillManifest } from '@/skills/types'

// 定义事件
defineEmits<{
  (e: 'close'): void
}>()

// 使用 Store
const skillStore = useSkillStore()
const registry = SkillRegistry.getInstance()

// 本地状态
const showDetailDialog = ref(false)
const selectedSkill = ref<SkillManifest | null>(null)

// 计算属性
const registeredSkills = computed(() => skillStore.registeredSkills)
const enabledSkills = computed(() => skillStore.enabledSkills)
const cacheStats = computed(() => SkillLoader.getCacheStats())

// 方法
function isEnabled(skillId: string): boolean {
  return skillStore.enabledSkillIds.has(skillId)
}

function isRegistered(skillId: string): boolean {
  return registry.isRegistered(skillId)
}

async function handleLoadBuiltin(): Promise<void> {
  try {
    const builtin = SkillLoader.loadBuiltinSkills()

    for (const manifest of builtin) {
      const result = registry.register(manifest)
      if (!result.success) {
        console.warn(`注册 Skill ${manifest.id} 失败:`, result.errors)
      }
    }

    ElMessage.success(`成功加载 ${builtin.length} 个内置 Skill`)
  } catch (error) {
    ElMessage.error(`加载内置 Skill 失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function handleImportSkill(): Promise<void> {
  // TODO: 实现从文件系统导入 Skill
  ElMessage.info('导入 Skill 功能开发中...')
}

function handleClearCache(): void {
  SkillLoader.clearCache()
  ElMessage.success('已清除 Skill 缓存')
}

function handleToggleSkill(skillId: string, enabled: boolean): void {
  if (enabled) {
    skillStore.enableSkill(skillId)
    ElMessage.success(`已启用 Skill: ${skillId}`)
  } else {
    skillStore.disableSkill(skillId)
    ElMessage.warning(`已禁用 Skill: ${skillId}`)
  }
}

function handleViewDetail(skill: SkillManifest): void {
  selectedSkill.value = skill
  showDetailDialog.value = true
}

async function handleUnregister(skillId: string): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定要卸载 Skill "${skillId}" 吗？`,
      '确认卸载',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const result = registry.unregister(skillId)
    if (result.warnings) {
      ElMessage.warning(result.warnings[0])
    }

    ElMessage.success(`已卸载 Skill: ${skillId}`)
  } catch (error) {
    // 用户取消
    if (error !== 'cancel') {
      console.error('卸载 Skill 失败:', error)
    }
  }
}

// 生命周期
onMounted(() => {
  console.log('[SkillManager] 面板已加载')
})
</script>

<style scoped>
.skill-manager {
  width: 100%;
  min-height: 500px;
  padding: 0;
}

.close-btn {
  background: none;
  border: 1px solid var(--el-border-color);
  cursor: pointer;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  padding: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.3s;
}

.close-btn:hover {
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  border-color: var(--color-primary);
}

.stat-card {
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.skill-card {
  transition: all 0.3s;
}

.skill-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.skill-card.is-disabled {
  opacity: 0.5;
}

.skill-detail {
  font-size: 14px;
  line-height: 1.8;
}
</style>
