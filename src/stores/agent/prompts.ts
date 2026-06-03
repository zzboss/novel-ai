import type { ProjectType } from '../project'

/**
 * ============================================================
 * 提示词模板 - 分步交互式创建流程
 * ============================================================
 */

/** 灵感生成提示词模板 */
export const IDEA_PROMPT_TEMPLATE = (userInput: string, projectType: ProjectType, context?: string): string => {
  const typeMap = {
    'novel': '长篇小说',
    'short-story': '短篇故事',
    'script': '短剧剧本'
  }
  
  let prompt = `你是一位资深${typeMap[projectType]}创作顾问。请根据用户的选择，为用户完善创作灵感。

=== 用户选择 ===
${userInput}

`
  
  // 如果有上下文（之前步骤的内容），加入到 prompt 中
  if (context) {
    prompt += `=== 已有设定（请基于这些设定来完善灵感，保持一致性）===
${context}

`
  }
  
  prompt += `=== 强制约束 ===
1. 必须基于用户选择生成，不要偏离用户的意思
2. 如果用户选择中包含多个题材类型（如：修仙+系统），必须同时包含这些元素
3. 如果用户选择中包含"其他：xxx"，必须将其作为用户自定义内容，包含在生成结果中
4. 如果用户回答中提到特定元素（如：特定职业、特定场景、特定冲突），必须在生成结果中体现
5. 保持创意和启发性，但不要完全脱离用户的原始意图

=== 禁止内容 ===
1. 不要添加用户未选择的题材类型
2. 不要改变用户设定的核心冲突
3. 不要偏离用户设定的主题
4. 不要生成与用户选择无关的内容

=== 输出要求 ===
请仔细思考：先复述用户的选择，确保理解正确，再生成内容。

输出格式：
1. 核心创意：基于用户选择提炼出独特的核心创意点（1-2句话）
2. 题材与风格：明确作品的类型、风格基调（如：轻松搞笑、严肃深沉、悬疑紧凑等）
3. 主题探讨：基于用户选择挖掘可以深入探讨的主题和思想
4. 故事概要：基于用户选择，写出一个简短的故事概要（100-200字）
5. 一句话简介：用一句话概括这个故事（类似出版物的简介）

重要：
- 输出格式要清晰，使用标题分隔各个部分
- 必须确保生成的内容与用户选择高度相关`

  return prompt
}

/** 世界观生成提示词模板 */
export const WORLD_PROMPT_TEMPLATE = (idea: string, projectType: ProjectType, context?: string): string => {
  const typeMap = {
    'novel': '长篇小说',
    'short-story': '短篇故事',
    'script': '短剧剧本'
  }
  
  let prompt = `你是一位资深${typeMap[projectType]}世界观架构师。请根据创作灵感和用户选择，构建完整的世界观设定。

=== 创作灵感 ===
${idea}

`
  
  // 如果有上下文（用户对世界设定的回答），加入到 prompt 中
  if (context) {
    prompt += `=== 用户选择 ===
${context}

注意："其他：xxx" 表示用户自定义的选项，必须包含在生成结果中！

`
  }
  
  prompt += `=== 强制约束 ===
1. 必须基于创作灵感和用户选择生成，不要偏离用户的意图
2. 如果用户选择中包含特定元素（如：特定时代、特定地点、特定规则），必须在生成结果中体现
3. 如果用户选择中包含"其他：xxx"，必须将其作为用户自定义内容，包含在生成结果中
4. 保持创意和启发性，但不要完全脱离原始设定
5. 不要添加用户未选择的元素

=== 禁止内容 ===
1. 不要添加用户未选择的时代背景
2. 不要添加与用户选择冲突的设定
3. 不要偏离创作灵感的主题
4. 不要生成与用户选择无关的内容

=== 输出要求 ===
请直接生成世界观设定，不要复述用户的选择和创作灵感。

请生成包含以下要素的世界观设定：
1. 世界背景：时代、地点、环境特征
2. 核心设定：世界的运行规则、特殊能力体系（如适用）
3. 社会结构：势力分布、等级制度、文化习俗
4. 重要地点：关键场景和地域特征
5. 历史渊源：影响故事背景的重要历史事件

${projectType === 'script' ? '特别注意：短剧剧本需要紧凑的世界观，避免过度复杂的设定。' : ''}

重要：
- 输出格式要清晰，使用标题分隔各个部分
- 必须确保生成的内容与用户选择高度相关
- 请以清晰的结构输出世界观设定，便于后续创作参考。`

  return prompt
}

/** 角色生成提示词模板 */
export const CHARACTER_PROMPT_TEMPLATE = (idea: string, worldSettings: string, projectType: ProjectType, context?: string): string => {
  const typeMap = {
    'novel': '长篇小说',
    'short-story': '短篇故事',
    'script': '短剧剧本'
  }
  
  const countMap = {
    'novel': '5-8个主要角色',
    'short-story': '2-4个主要角色',
    'script': '3-6个主要角色（男女主角+配角）'
  }
  
  let prompt = `你是一位资深${typeMap[projectType]}角色设计师。请根据创作灵感、世界观和用户选择，设计${countMap[projectType]}。

=== 创作灵感 ===
${idea}

=== 世界观设定 ===
${worldSettings}

`
  
  // 如果有上下文（用户对角色设定的回答），加入到 prompt 中
  if (context) {
    prompt += `=== 用户选择 ===
${context}

注意："其他：xxx" 表示用户自定义的选项，必须包含在生成结果中！

`
  }
  
  prompt += `=== 强制约束 ===
1. 必须基于创作灵感、世界观和用户选择来设计角色，不要偏离设定
2. 如果用户选择中包含特定角色特征（如：特定职业、特定关系、特定目标），必须在生成结果中体现
3. 如果用户选择中包含"其他：xxx"，必须将其作为用户自定义内容，包含在生成结果中
4. 角色要符合世界观设定（如：魔幻世界中的角色应该有魔法能力或相关设定）
5. 不要添加用户未选择的特征

=== 禁止内容 ===
1. 不要设计不符合世界观的角色
2. 不要偏离用户设定的角色关系
3. 不要添加与主题无关的角色
4. 不要生成与用户选择无关的内容

=== 输出要求 ===
请仔细思考：先复述用户的选择，确保理解正确，再生成内容。

请为每个主要角色生成包含以下信息的设定：
1. 基本信息：姓名、年龄、性别、外貌特征
2. 性格特点：性格标签、行为习惯、口头禅
3. 背景故事：成长经历、重要事件、心理创伤（如适用）
4. 能力/技能：特长、弱点、成长空间
5. 人物关系：与其他角色的关联
6. 角色弧光：在故事中的成长轨迹

重要：
- 输出格式要清晰，每个角色单独分段，使用标题分隔
- 必须确保生成的角色与用户选择高度相关`

  return prompt
}

/** 一级大纲生成提示词模板（卷/部分） */
export const OUTLINE1_PROMPT_TEMPLATE = (idea: string, worldSettings: string, characters: string, projectType: ProjectType, context?: string): string => {
  const typeMap = {
    'novel': '长篇小说（分卷）',
    'short-story': '短篇故事（分部分）',
    'script': '短剧剧本（分集）'
  }
  
  const unitMap = {
    'novel': '卷',
    'short-story': '部分',
    'script': '集'
  }
  
  let prompt = `你是一位资深${typeMap[projectType]}结构设计师。请根据前面的所有内容，设计${typeMap[projectType]}的一级大纲（${unitMap[projectType]}级结构）。

=== 创作灵感 ===
${idea}

=== 世界观设定 ===
${worldSettings}

=== 角色设定 ===
${characters}

`
  
  // 如果有上下文（用户对大纲的回答），加入到 prompt 中
  if (context) {
    prompt += `=== 用户选择 ===
${context}

注意："其他：xxx" 表示用户自定义的选项，必须包含在生成结果中！

`
  }
  
  prompt += `=== 强制约束 ===
1. 必须基于前面的所有设定和用户选择来设计大纲，不要偏离设定
2. 大纲要符合角色的成长轨迹和故事的主题
3. 如果用户选择中包含"其他：xxx"，必须将其作为用户自定义内容，包含在生成结果中
4. 不要添加用户未选择的元素
5. 角色发展必须符合角色设定

=== 禁止内容 ===
1. 不要偏离前面设定的主题
2. 不要添加与世界观冲突的情节
3. 不要设计不符合角色性格的行为
4. 不要生成与用户选择无关的内容

=== 输出要求 ===
请直接生成大纲，不要复述用户的选择和前面所有设定。

请设计${unitMap[projectType]}级结构，每个${unitMap[projectType]}包含：
1. ${unitMap[projectType]}标题
2. 核心事件：这一${unitMap[projectType]}的主要情节
3. 角色发展：主要角色在这一${unitMap[projectType]}中的成长
4. 情感基调：这一${unitMap[projectType]}的整体氛围

${projectType === 'novel' ? '建议设置3-5卷。' : projectType === 'short-story' ? '建议设置2-4个部分。' : '建议设置10-20集。'}

重要：
- 一级大纲是整体框架，不需要太详细的情节，但要清晰展示故事结构
- 输出格式要清晰，使用标题和编号分隔各个部分
- 每个卷的第一行格式必须是：# 第N${unitMap[projectType]}：[卷标题]，例如"# 第1卷：破晓"
- 必须确保生成的大纲与用户选择高度相关

请以清晰的层级结构输出一级大纲。`

  return prompt
}

/** 灵感修改提示词模板 */
export const IDEA_MODIFY_PROMPT_TEMPLATE = (currentContent: string, userInput: string, projectType: ProjectType): string => {
  const typeMap = {
    'novel': '长篇小说',
    'short-story': '短篇故事',
    'script': '短剧剧本'
  }
  
  return `你是一位资深${typeMap[projectType]}创作顾问。请根据用户的修改要求，修改已有的灵感描述。

=== 当前灵感内容 ===
${currentContent}

=== 修改要求 ===
${userInput}

=== 修改要求 ===
请根据用户的修改要求，对当前灵感内容进行修改。保持原有优秀内容，只修改用户要求修改的部分。

重要：
- 保持原有内容的结构和风格
- 只修改用户明确要求修改的部分
- 修改后的内容要连贯、自然
- 输出修改后的完整灵感内容`
}

/** 世界观修改提示词模板 */
export const WORLD_MODIFY_PROMPT_TEMPLATE = (currentContent: string, userInput: string, projectType: ProjectType): string => {
  const typeMap = {
    'novel': '长篇小说',
    'short-story': '短篇故事',
    'script': '短剧剧本'
  }
  
  return `你是一位资深${typeMap[projectType]}世界观架构师。请根据用户的修改要求，修改已有的世界观设定。

=== 当前世界观设定 ===
${currentContent}

=== 修改要求 ===
${userInput}

=== 修改要求 ===
请根据用户的修改要求，对当前世界观设定进行修改。保持原有优秀设定，只修改用户要求修改的部分。

重要：
- 保持原有设定的结构和风格
- 只修改用户明确要求修改的部分
- 修改后的设定要连贯、自然，符合逻辑
- 输出修改后的完整世界观设定`
}

/**
 * 地图生成提示词模板
 * 生成地点列表及地点之间的关系
 */
export const MAP_PROMPT_TEMPLATE = (mapName: string, projectContext?: string): string => {
  let prompt = `你是一位资深的世界观地理架构师。请根据提供的信息，为地图"${mapName}"生成地点列表及地点之间的关系。

=== 输出格式要求 ===
你必须严格按照以下 JSON 格式输出，不要输出任何 JSON 以外的内容（不需要 markdown 代码块标记）：

{
  "locations": [
    {
      "name": "地点名称",
      "description": "地点描述，50-200字",
      "color": "#颜色十六进制值（可选）",
      "size": 30
    }
  ],
  "relationships": [
    {
      "sourceIndex": 0,
      "targetIndex": 1,
      "relationType": "custom",
      "relationLabel": "关系描述标签（2-6个字）",
      "description": "关系详细描述（可选）",
      "color": "#颜色十六进制值（可选）",
      "lineStyle": "solid"
    }
  ]
}

=== 字段说明 ===
- locations: 地点数组
  - name: 地点名称（必填）
  - description: 地点描述（必填，50-200字）
  - color: 节点颜色，十六进制值如 "#409EFF"（可选，不填则自动分配）
  - size: 节点大小，建议 20-60（可选，默认 30）
- relationships: 地点关系数组
  - sourceIndex: 起始地点在 locations 数组中的索引（从 0 开始）
  - targetIndex: 目标地点在 locations 数组中的索引（从 0 开始）
  - relationType: 关系类型，固定为 "custom"
  - relationLabel: 关系标签，显示在连线上（2-6个字）
  - description: 关系描述（可选）
  - color: 连线颜色（可选）
  - lineStyle: 连线样式，"solid" 实线 / "dashed" 虚线 / "dotted" 点线

=== 生成要求 ===
1. 地点数量：建议 5-15 个，根据地图主题合理确定
2. 地点名称要有特色，符合世界观设定
3. 地点描述要详细，体现地理特征、功能、历史等
4. 关系要合理，体现地点之间的地理、经济、政治等联系
5. 确保 sourceIndex 和 targetIndex 不越界
6. JSON 格式必须合法，可以被程序解析`

  if (projectContext) {
    prompt += `

=== 项目背景（用于保持一致性）===
${projectContext}`
  }

  return prompt
}

