/**
 * 上下文压缩工具函数测试
 */
import {
  filterRelevantWorldSettings,
  filterRelevantCharacters,
  compressPreviousChapters,
  compressChapterOutline,
  getCompressionStrategy
} from './contextCompressor'

// 测试数据
const mockWorldSettings = `
# 世界观设定

## 地理
- 王府：位于京城中心，是王爷的居所
- 太子府：位于京城东侧，太子居住在
- 海外仙山：位于东海之中，是修仙者的圣地
- 城南旧书店：位于城南，是一家不起眼的小店

## 势力
- 王府势力：以王爷为核心
- 太子党：支持太子的官员
- 仙门：海外仙山的修仙者

## 修炼体系
- 练气期
- 筑基期
- 金丹期
`

const mockCharacters = `
苏晚：女主角，热爱旧书
身份：普通书店老板
性格：痴迷旧书、内向

顾辞：男主角，神秘富商
身份：表面是富商，实际是仙门弟子
性格：低调、内敛

王爷：反派
身份：京城王爷
性格：野心勃勃
`

const mockChapterOutline = JSON.stringify({
  chapterTitle: "初遇",
  chapterNumber: 3,
  coreGoal: "让男女主角第一次相遇",
  scenes: [
    {
      sceneId: 1,
      location: "城南旧书店",
      emotionalTone: "轻松中带着尴尬",
      characters: ["苏晚", "顾辞"],
      events: "苏晚在旧书店找书，误认顾辞为店员",
      foreshadowing: '',
      twists: ''
    }
  ],
  plotProgression: "",
  characterDevelopment: "",
  nextChapterHook: ""
})

// 测试 filterRelevantWorldSettings
console.log("=== 测试 filterRelevantWorldSettings ===")
const compressedWorld = filterRelevantWorldSettings(mockWorldSettings, mockChapterOutline)
console.log("压缩后的世界观设定：")
console.log(compressedWorld)
console.log("\n")

// 测试 filterRelevantCharacters
console.log("=== 测试 filterRelevantCharacters ===")
const compressedChars = filterRelevantCharacters(mockCharacters, mockChapterOutline)
console.log("压缩后的角色档案：")
console.log(compressedChars)
console.log("\n")

// 测试 compressPreviousChapters
console.log("=== 测试 compressPreviousChapters ===")
const mockPreviousChapters = [
  { title: "第1章：开端", summary: "故事开始，介绍了世界观和主要角色。苏晚是一家旧书店的老板，每天过着平静的生活。有一天，她在一本旧书中发现了一张神秘的地图。" },
  { title: "第2章：发现", summary: "苏晚研究了那张地图，发现它指向一个神秘的地方。她决定去寻找这个答案。在准备过程中，她遇到了一些奇怪的事情。" }
]
const compressedPrev = compressPreviousChapters(mockPreviousChapters, 2, 100)
console.log("压缩后的前文摘要：")
console.log(compressedPrev)
console.log("\n")

// 测试 compressChapterOutline
console.log("=== 测试 compressChapterOutline ===")
const compressedOutline = compressChapterOutline(mockChapterOutline)
console.log("压缩后的章节细纲：")
console.log(compressedOutline)
console.log("\n")

// 测试 getCompressionStrategy
console.log("=== 测试 getCompressionStrategy ===")
console.log("第1章策略：", getCompressionStrategy(1))
console.log("第5章策略：", getCompressionStrategy(5))
console.log("第20章策略：", getCompressionStrategy(20))
console.log("第50章策略（长篇）：", getCompressionStrategy(50, 100))

console.log("\n=== 所有测试完成 ===")
