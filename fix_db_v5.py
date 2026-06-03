#!/usr/bin/env python3
"""在 index.ts 的 getDatabase 函数中插入 chapter_outlines 表迁移逻辑
使用 str.find(substr, start_pos) 确保只匹配 getDatabase 函数内的内容
"""

filepath = r'd:\coding\writing\AIWT\novel-ai\electron\database\index.ts'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 找到 getDatabase 函数的起始位置
get_db_marker = 'export async function getDatabase'
get_db_start = content.find(get_db_marker)
if get_db_start == -1:
    print("ERROR: getDatabase function not found")
    exit(1)

print(f"getDatabase starts at offset {get_db_start}")

# 在 getDatabase 范围内查找插入点
# 插入点特征：角色关系图迁移的 catch 块结束后，紧接着是 "地图相关表" 注释
target = (
    "  } catch (e) {\n"
    "    console.error('[Database] 角色关系图相关表迁移检查失败:', e)\n"
    "  }\n"
    "\n"
    "  // 迁移：检查并创建地图相关表"
)
pos = content.find(target, get_db_start)

if pos == -1:
    print("ERROR: target text not found after getDatabase start")
    exit(1)

print(f"Target found at offset {pos}")

# 构造要插入的代码（注意 Python 三引号字符串中的反引号和引号）
new_code = (
    "  } catch (e) {\n"
    "    console.error('[Database] 角色关系图相关表迁移检查失败:', e)\n"
    "  }\n"
    "\n"
    "  // 迁移：检查并创建 chapter_outlines 表\n"
    "  try {\n"
    "    const tableExists = queryAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='chapter_outlines'`)\n"
    "    if (tableExists.length === 0) {\n"
    "      db.exec(`\n"
    "        CREATE TABLE chapter_outlines (\n"
    "          id TEXT PRIMARY KEY,\n"
    "          chapter_id TEXT NOT NULL UNIQUE,\n"
    "          core_goal TEXT DEFAULT '',\n"
    "          plot_progression TEXT DEFAULT '',\n"
    "          character_development TEXT DEFAULT '',\n"
    "          overall_foreshadowing TEXT DEFAULT '[]',\n"
    "          overall_twists TEXT DEFAULT '[]',\n"
    "          next_chapter_hook TEXT DEFAULT '',\n"
    "          scenes TEXT DEFAULT '[]',\n"
    "          created_at INTEGER NOT NULL,\n"
    "          updated_at INTEGER NOT NULL,\n"
    "          FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE\n"
    "        )\n"
    "      `)\n"
    "      db.exec(`CREATE INDEX idx_chapter_outlines_chapter_id ON chapter_outlines(chapter_id)`)\n"
    "      console.log('[Database] chapter_outlines 表创建完成')\n"
    "      needsSave = true\n"
    "    }\n"
    "  } catch (e) {\n"
    "    console.error('[Database] chapter_outlines 表迁移检查失败:', e)\n"
    "  }\n"
    "\n"
    "  // 迁移：检查并创建地图相关表"
)

# 替换：把 target 替换为 new_code（new_code 末尾包含了原来的 "地图相关表" 注释）
new_content = content[:pos] + new_code + content[pos + len(target):]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("SUCCESS: chapter_outlines migration inserted into getDatabase")
