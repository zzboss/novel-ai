<template>
  <div class="character-graph-panel h-full flex flex-col bg-[var(--el-bg-color-page)]">
    <!-- 顶部工具栏 -->
    <div class="h-12 flex items-center justify-between px-4 border-b border-[var(--el-border-color)] bg-[var(--el-bg-color)]">
      <div class="flex items-center gap-3">
        <el-icon class="text-[var(--el-color-primary)]"><Share /></el-icon>
        <span class="font-semibold text-[var(--el-text-color-primary)]">角色关系图测试</span>
      </div>
      <div class="flex items-center gap-2">
        <el-button-group size="small">
          <el-button @click="handleRefresh">
            <el-icon><Refresh /></el-icon>
          </el-button>
          <el-button @click="handleReset">
            <el-icon><Crop /></el-icon>
          </el-button>
        </el-button-group>
      </div>
    </div>

    <!-- 关系图容器 -->
    <div class="flex-1 relative bg-[var(--el-bg-color)]">
      <div
        ref="graphContainer"
        class="w-full h-full"
      >
        <relation-graph
          v-if="graphData"
          ref="graphRef"
          :options="graphOptions"
          :data="graphData"
          class="w-full h-full"
          @node-click="handleNodeClick"
          @line-click="handleLineClick"
        />
      </div>

      <!-- 空状态 -->
      <div
        v-if="!graphData"
        class="absolute inset-0 flex items-center justify-center"
      >
        <div class="text-center">
          <el-icon class="text-6xl text-[var(--el-text-color-secondary)] mb-4"><Share /></el-icon>
          <p class="text-[var(--el-text-color-secondary)]">正在加载关系图...</p>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="h-8 flex items-center justify-between px-4 border-t border-[var(--el-border-color)] bg-[var(--el-bg-color)] text-xs text-[var(--el-text-color-secondary)]">
      <span>{{ statusText }}</span>
      <span>{{ nodeCount }} 个节点 / {{ edgeCount }} 条边</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { Share, Refresh, Crop } from '@element-plus/icons-vue'
import RelationGraph from '@relation-graph/vue'
import '@relation-graph/vue/dist/style.css'
import type { RelationGraphInstance, RelationGraphOptions } from '@relation-graph/vue'

const graphRef = ref<any>()
const graphContainer = ref<HTMLElement>()

// 关系图数据
const graphData = ref<any>(null)

// 状态文本
const statusText = ref('就绪')

// 节点和边数量
const nodeCount = computed(() => graphData.value?.nodes?.length || 0)
const edgeCount = computed(() => graphData.value?.links?.length || 0)

// 关系图配置
const graphOptions = ref<RelationGraphOptions>({
  debug: false,
  showDebugPanel: false,
  backgroundColor: 'transparent',
  backgroundImage: '',
  backgroundImageNoRepeat: true,
  layout: {
    layoutName: 'force',
    layoutClassName: 'seeks-layout-force'
  },
  defaultNode: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#409EFF',
    color: '#409EFF',
    fontColor: '#FFFFFF',
    fontSize: 14
  },
  defaultLine: {
    width: 2,
    color: '#409EFF',
    fontColor: '#FFFFFF'
  },
  allowSwitchLineShape: true,
  allowSwitchJunctionPoint: true,
  switchLineShapeName: 'curve',
  switchJunctionPointName: 'border'
})

/**
 * 初始化测试数据
 */
function initTestData() {
  graphData.value = {
    nodes: [
      {
        id: 'node1',
        text: '主角',
        color: '#FFD700',
        borderColor: '#FFD700',
        width: 70,
        height: 70,
        borderRadius: 35,
        fontSize: 16,
        fontBold: true
      },
      {
        id: 'node2',
        text: '反派',
        color: '#DC143C',
        borderColor: '#DC143C',
        width: 70,
        height: 70,
        borderRadius: 35
      },
      {
        id: 'node3',
        text: '配角A',
        color: '#4169E1',
        borderColor: '#4169E1'
      },
      {
        id: 'node4',
        text: '配角B',
        color: '#4169E1',
        borderColor: '#4169E1'
      },
      {
        id: 'node5',
        text: '导师',
        color: '#00CED1',
        borderColor: '#00CED1'
      }
    ],
    links: [
      {
        from: 'node1',
        to: 'node2',
        text: '敌对',
        color: '#DC143C',
        lineWidth: 3
      },
      {
        from: 'node1',
        to: 'node3',
        text: '好友',
        color: '#32CD32'
      },
      {
        from: 'node1',
        to: 'node5',
        text: '师徒',
        color: '#00CED1'
      },
      {
        from: 'node2',
        to: 'node4',
        text: '利用',
        color: '#FF8C00'
      },
      {
        from: 'node3',
        to: 'node4',
        text: '搭档',
        color: '#32CD32'
      },
      {
        from: 'node5',
        to: 'node2',
        text: '昔日同门',
        color: '#9370DB'
      }
    ]
  }

  statusText.value = '测试数据已加载'
}

/**
 * 节点点击事件
 */
function handleNodeClick(node: any) {
  statusText.value = `选中节点: ${node.text || node.id}`
  console.log('Node clicked:', node)
}

/**
 * 连线点击事件
 */
function handleLineClick(line: any) {
  statusText.value = `选中关系: ${line.text || '未命名'}`
  console.log('Line clicked:', line)
}

/**
 * 刷新
 */
function handleRefresh() {
  statusText.value = '刷新中...'
  initTestData()
}

/**
 * 重置视图
 */
function handleReset() {
  const instance = graphRef.value?.getInstance()
  if (instance) {
    instance.resetView()
    statusText.value = '视图已重置'
  }
}

onMounted(async () => {
  initTestData()
  // 显式调用 setJsonData 渲染关系图
  await nextTick()
  const instance = graphRef.value?.getInstance()
  if (instance && graphData.value) {
    await instance.setJsonData(graphData.value)
    instance.zoomToFit() // 自适应缩放，避免节点重叠
  }
})
</script>

<style scoped>
.character-graph-panel {
  --graph-bg: var(--el-bg-color-page);
}


:deep(.rel-node) {
  transition: all 0.3s ease;
}

:deep(.rel-node:hover) {
  transform: scale(1.1);
  filter: brightness(1.2);
}

:deep(.rel-line) {
  transition: all 0.3s ease;
}

:deep(.rel-line:hover) {
  filter: brightness(1.3);
}
</style>
