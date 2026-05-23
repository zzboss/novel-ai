<template>
  <div class="workbench h-screen flex flex-col bg-[var(--el-bg-color-page)] text-[var(--el-text-color-primary)]">
    <header class="h-12 border-b flex items-center px-4 gap-3 shrink-0" style="border-color: var(--el-border-color)">
      <el-button :icon="ArrowLeft" @click="goHome" text>返回</el-button>
      <el-divider direction="vertical" />
      <span class="text-sm font-medium">{{ projectName }}</span>
      <span class="text-xs text-[var(--el-text-color-placeholder)]">{{ editorWordCount }} 字</span>
      <div class="ml-auto flex gap-2">
        <el-tooltip content="专注模式" placement="bottom"><el-button :icon="FullScreen" @click="showPanel('focus')" text :type="activePanel === 'focus' ? 'primary' : 'default'" /></el-tooltip>
        <el-tooltip content="全文搜索" placement="bottom"><el-button :icon="Search" @click="showPanel('search')" text :type="activePanel === 'search' ? 'primary' : 'default'" /></el-tooltip>
        <el-tooltip content="对话历史" placement="bottom"><el-button :icon="Document" @click="showPanel('chat-history')" text :type="activePanel === 'chat-history' ? 'primary' : 'default'" /></el-tooltip>
        <el-tooltip content="记忆管理" placement="bottom"><el-button :icon="Avatar" @click="showPanel('memory')" text :type="activePanel === 'memory' ? 'primary' : 'default'" /></el-tooltip>
        <el-tooltip content="Agent 协作" placement="bottom"><el-button :icon="User" @click="showPanel('orchestrator')" text :type="activePanel === 'orchestrator' ? 'primary' : 'default'" /></el-tooltip>
        <el-tooltip content="Skill 管理" placement="bottom"><el-button :icon="FolderOpened" @click="showPanel('skill')" text :type="activePanel === 'skill' ? 'primary' : 'default'" /></el-tooltip>
        <el-tooltip content="MCP 管理" placement="bottom"><el-button :icon="Setting" @click="showPanel('mcp')" text :type="activePanel === 'mcp' ? 'primary' : 'default'" /></el-tooltip>
      </div>
    </header>
    <div class="flex-1 flex overflow-hidden">
      <div ref="leftPanelRef" class="border-r overflow-y-auto shrink-0" style="border-color: var(--el-border-color)" :style="{ width: leftPanelWidth + 'px' }">
        <div class="p-3">
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs text-[var(--el-text-color-placeholder)]">项目结构</div>
            <el-button size="small" :icon="Plus" circle @click="addChapter" :disabled="!projectStore.project" />
          </div>
          <el-empty v-if="volumes.length === 0" description="暂无章节" :image-size="60" />
          <el-tree v-else :data="treeData" :props="treeProps" default-expand-all :highlight-current="true"
            :expand-on-click-node="false"
            @node-click="onNodeClick" @node-contextmenu="onNodeContextMenu"
            @node-drag-start="onDragStart" @node-drag-end="onDragEnd" draggable>
            <template #default="{ data }">
              <span class="text-sm flex-1 flex items-center justify-between group"
                :draggable="data.type === 'character' || data.type === 'world'">
                <span v-if="data.type === 'chapter'" class="flex-1 flex items-center gap-1">
                  <el-icon class="mr-1"><Document /></el-icon>
                  <el-input v-if="editingChapterId === data.id" :ref="(el: any) => setEditInputRef(data.id, el)"
                    v-model="editingTitle" size="small" class="inline-edit-input"
                    @keyup.enter="confirmTitleEdit(data.id)" @blur="confirmTitleEdit(data.id)" />
                  <span v-else class="flex-1 cursor-pointer" @dblclick="startTitleEdit(data)">{{ data.label }}</span>
                  <el-button v-if="!editingChapterId" size="small" :icon="EditPen" circle
                    class="opacity-0 group-hover:opacity-100 transition-opacity ml-1" @click.stop="startTitleEdit(data)" />
                </span>
                <span v-else>
                  <el-icon v-if="data.type === 'character'" class="mr-1"><Avatar /></el-icon>
                  <el-icon v-else class="mr-1"><FolderOpened /></el-icon>
                  {{ data.label }}
                </span>
                <el-button v-if="data.type === 'chapter' && !editingChapterId" size="small" :icon="Delete" circle
                  class="opacity-0 group-hover:opacity-100 transition-opacity"
                  @click.stop="deleteChapter(data.id, data.label)" />
              </span>
            </template>
          </el-tree>
        </div>
      </div>
      <div class="w-1 cursor-col-resize hover:bg-[var(--el-color-primary)] transition-colors shrink-0"
        @mousedown="startLeftResize" />
      <el-main class="overflow-hidden flex flex-col p-0" @dragover="onDragOver" @drop="onDrop">
        <!-- 动态面板区域：所有功能统一在中间部分显示 -->
        
        <!-- 专注模式 -->
        <FocusMode v-if="activePanel === 'focus'" :content="editorContent"
          :chapter-title="currentChapterTitle || '未选择章节'" @exit="activePanel = null" @save="onFocusModeSave" />
        
        <!-- 全文搜索 -->
        <GlobalSearch v-else-if="activePanel === 'search'" @close="activePanel = null" />
        
        <!-- 对话历史 -->
        <ChatHistoryPanel v-else-if="activePanel === 'chat-history'" />
        
        <!-- 记忆管理 -->
        <MemoryPanel v-else-if="activePanel === 'memory'" />
        
        <!-- AI 写作助手（替换原 Agent 协作） -->
        <AIWritingAssistant v-else-if="activePanel === 'orchestrator'" />
        
        <!-- Skill 管理 -->
        <SkillManager v-else-if="activePanel === 'skill'" @close="activePanel = null" />
        
        <!-- MCP 管理 -->
        <MCPManagerPanel v-else-if="activePanel === 'mcp'" @close="activePanel = null" />
        
        <!-- 灵感面板 -->
        <IdeaPanel v-else-if="selectedNodeType === 'idea'" />
        <!-- 世界观面板 -->
        <WorldEditor v-else-if="selectedNodeType === 'world'" />
        <!-- 角色列表面板 -->
        <CharacterListView v-else-if="selectedNodeType === 'characters'" @select="onCharacterSelect" />
        <!-- 角色详情面板 -->
        <CharacterEditor v-else-if="selectedNodeType === 'character'" :character-id="selectedNodeId" @update:characterId="onCharacterIdUpdate" />
        <!-- 卷编辑面板 -->
        <VolumeEditor v-else-if="selectedNodeType === 'volume'" />
        <!-- LLM 交互记录面板 -->
        <LLMInteractionPanel v-else-if="selectedNodeType === 'llm-interaction'" />
        <!-- 当前状态面板 -->
        <CurrentStatePanel v-else-if="selectedNodeType === 'current-state'" />
        
        <!-- 章节编辑器（默认显示） -->
        <template v-else>
          <ChapterEditorWithOutline
            v-if="currentChapterId"
            ref="chapterEditorRef"
            :chapter-id="currentChapterId"
            :chapter-title="currentChapterTitle"
            :volume-outline="currentVolumeOutline"
            @update:outline="onOutlineUpdate"
            @update:content="onContentUpdate"
            @save="onSaveChapter"
          />
          <ChapterEditor
            v-else
            ref="chapterEditorRef"
            :content="editorContent"
            :editable="!isStreaming"
            @update="onEditorUpdate"
            @ready="onEditorReady"
          />
          <div v-if="isStreaming" class="h-8 border-t flex items-center px-4 text-xs"
            style="border-color: var(--el-border-color); color: var(--el-color-primary)">
            <el-icon class="is-loading mr-2"><Loading /></el-icon>
            <span>{{ agentStore.pipelineProgress || 'AI 正在生成...' }}</span>
            <el-button class="ml-auto" type="danger" link size="small" @click="stopStreaming">停止</el-button>
          </div>
        </template>
      </el-main>
      
      <!-- 右侧面板：始终显示 ChatAssistant -->
      <div class="w-1 cursor-col-resize hover:bg-[var(--el-color-primary)] transition-colors shrink-0"
        @mousedown="startRightResize" />
      <div ref="rightPanelRef" class="shrink-0" :style="{ width: rightPanelWidth + 'px' }">
        <ChatAssistant :is-executing="isStreaming" :executing-agent-name="executingAgentName"
          @run-agent="runAgent" @stop-agent="stopStreaming" />
      </div>
    </div>
    <AddChapterDialog v-model="addChapterDialogVisible" :volumes="volumeInfos"
      :default-volume-id="defaultVolumeId" @confirm="onAddChapterConfirm" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount, getCurrentInstance } from 'vue'
import { ArrowLeft, FullScreen, Search, Document, FolderOpened, Loading, Plus, Delete, Setting, EditPen, Avatar, User } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useAgentStore } from '@/stores/agent'
import ChapterEditor from '@/components/ChapterEditor.vue'
import ChapterEditorWithOutline from '@/components/ChapterEditorWithOutline.vue'
import FocusMode from '@/components/FocusMode.vue'
import GlobalSearch from '@/components/GlobalSearch.vue'
import AddChapterDialog from '@/components/AddChapterDialog.vue'
import ChatAssistant from '@/components/ChatAssistant.vue'
import IdeaPanel from './IdeaPanel.vue'
import WorldEditor from '@/components/WorldEditor.vue'
import CharacterEditor from '@/components/CharacterEditor.vue'
import CharacterListView from '@/components/CharacterListView.vue'
import VolumeEditor from '@/components/VolumeEditor.vue'
import ChatHistoryPanel from './ChatHistoryPanel.vue'
import CurrentStatePanel from './CurrentStatePanel.vue'
import LLMInteractionPanel from './LLMInteractionPanel.vue'
import { usePanelResize } from './usePanelResize'
import { useChapterManager } from './useChapterManager'
import { useEditorManager } from './useEditorManager'
import { useAgentRunner } from './useAgentRunner'
import { useProjectTree } from './useProjectTree'
import { useDragDrop } from './useDragDrop'
import MemoryPanel from '@/components/MemoryPanel.vue'
import AIWritingAssistant from '@/components/AIWritingAssistant.vue'
import SkillManager from '@/components/agent/SkillManager.vue'
import MCPManagerPanel from '@/components/agent/orchestrator/MCPManagerPanel.vue'

// 安全检查：确保 Pinia 已安装
const instance = getCurrentInstance()
if (!instance) {
  console.error('[Workbench] Component instance not found')
}

// 活动面板状态（统一管理所有功能面板）
const activePanel = ref<string | null>(null)
function showPanel(panelName: string): void {
  if (activePanel.value === panelName) {
    activePanel.value = null // 再次点击同一按钮，关闭面板
  } else {
    activePanel.value = panelName
  }
}

const projectStore = useProjectStore()
const agentStore = useAgentStore()
const currentChapterId = computed(() => projectStore.currentChapterId)
const projectName = computed(() => projectStore.project?.name || '未命名项目')
const volumes = computed(() => projectStore.project?.volumes || [])

const { leftPanelWidth, rightPanelWidth, leftPanelRef, rightPanelRef, startLeftResize, startRightResize } = usePanelResize()
const { editorContent, editorWordCount, chapterEditorRef, onEditorReady, onEditorUpdate, onFocusModeSave, tipTapEditor } = useEditorManager({ projectStore, agentStore, currentChapterId })
const { isStreaming, executingAgentName, runAgent, stopStreaming } = useAgentRunner({ projectStore, agentStore, chapterEditorRef, tipTapEditor } as any)
const { treeData, treeProps, selectedNodeType, selectedNodeId, editingChapterId, editingTitle, editInputRefs, focusModeVisible, globalSearchVisible, setEditInputRef, startTitleEdit, confirmTitleEdit, handleNodeClick: onTreeClick, onNodeContextMenu, openCreationWizard, goHome, goToChatHistory } = useProjectTree({ projectStore: projectStore, editorContent })
const { selectChapter, saveCurrentChapterContent, addChapter, deleteChapter, onAddChapterConfirm, saveProject, volumeInfos, defaultVolumeId, addChapterDialogVisible } = useChapterManager({ projectStore, chapterEditorRef, editorContent, editorWordCount, currentChapterId })
const { onDragStart, onDragEnd, onDragOver, onDrop } = useDragDrop({ projectStore, tipTapEditor } as any)

// 当前章节标题
const currentChapterTitle = computed(() => {
  if (!currentChapterId.value || !projectStore.project) return ''
  for (const volume of projectStore.project.volumes) {
    const chapter = volume.chapters.find((ch: any) => ch.id === currentChapterId.value)
    if (chapter) return chapter.title || `第${chapter.chapterNumber}章`
  }
  return ''
})

// 当前章节所属卷的大纲
const currentVolumeOutline = computed(() => {
  if (!currentChapterId.value || !projectStore.project) return ''
  for (const volume of projectStore.project.volumes) {
    if (volume.chapters.some((ch: any) => ch.id === currentChapterId.value)) {
      return volume.content || ''
    }
  }
  return ''
})

// 处理细纲更新
function onOutlineUpdate(outline: string): void {
  if (!currentChapterId.value || !projectStore.project) return
  // 更新 store 中的章节细纲
  for (const volume of projectStore.project.volumes) {
    const chapter = volume.chapters.find((ch: any) => ch.id === currentChapterId.value)
    if (chapter) {
      chapter.outline = outline
      break
    }
  }
}

// 处理正文内容更新（来自 ChapterEditorWithOutline）
function onContentUpdate(html: string, text: string, wordCount: number): void {
  editorContent.value = html
  editorWordCount.value = wordCount
}

// 处理保存
function onSaveChapter(): void {
  saveCurrentChapterContent()
}

function onNodeClick(data: any): void {
  onTreeClick(data)
  if (data.type === 'chapter') selectChapter(data.id)
}

function onCharacterIdUpdate(newId: string): void {
  if (!newId) {
    selectedNodeType.value = ''
    selectedNodeId.value = ''
  }
}

function onCharacterSelect(characterId: string): void {
  selectedNodeType.value = 'character'
  selectedNodeId.value = characterId
}

onBeforeUnmount(() => {
  saveCurrentChapterContent()
  // 如果项目有未保存的变更，强制立即保存（防止自动保存定时器未触发）
  if (projectStore.isDirty) {
    projectStore.saveProject().catch((err: unknown) => {
      console.error('卸载前保存项目失败:', err)
    })
  }
  projectStore.stopAutoSave()
})
</script>
