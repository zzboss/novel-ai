#!/usr/bin/env python3
"""精确在 getDatabase 函数中插入 chapter_outlines 表迁移逻辑
通过函数作用域精确定位，只修改 getDatabase 内的代码
"""

filepath = r'd:\coding\writing\AIWT\novel-ai\electron\database\index.ts'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找到 getDatabase 函数的起始和结束行索引（0-based）
get_db_start = None
get_db_end = None

for i, line in enumerate(lines):
    if 'export async function getDatabase' in line:
        get_db_start = i
        break

if get_db_start is None:
    print("ERROR: getDatabase function not found")
    exit(1)

# getDatabase 结束于下一个顶层 export function 或 function 定义
for i in range(get_db_start + 1, len(lines)):
    stripped = lines[i].strip()
    # 下一个导出函数或顶层 function 标志着当前函数结束
    if (stripped.startswith('export async function') or
        stripped.startswith('export function') or
        (stripped.startswith('function ') and i > get_db_start + 100)):
        get_db_end = i
        break

if get_db_end is None:
    get_db_end = len(lines)

print(f"getDatabase function: lines {get_db_start+1} to {get_db_end}")

# 在 getDatabase 范围内查找插入点
# 插入点特征：角色关系图迁移的 catch 块结束后，紧接着是 "地图相关表" 注释
insert_idx = None

for i in range(get_db_start, get_db_end):
    if '角色关系图相关表迁移检查失败' in lines[i]:
        # 往后找 "地图相关表" 注释行
        for j in range(i, min(i + 10, get_db_end)):
            if '迁移：检查并创建地图相关表' in lines[j]:
                insert_idx = j  # 在这行之前插入
                break
        if insert_idx:
            break

if insert_idx is None:
    print("ERROR: insertion point not found in getDatabase")
    exit(1)

print(f"Inserting at line {insert_idx + 1}")

# 构造要插入的代码行
new_lines = [
    '  }\r\n',
    '\r\n',
    '  // 迁移：检查并创建 chapter_outlines 表\r\n',
    '  try {\r\n',
    "    const tableExists = queryAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='chapter_outlines'`)\r\n",
    '    if (tableExists.length === 0) {\r\n',
    '      db.exec(`\r\n',
    '        CREATE TABLE chapter_outlines (\r\n',
    '          id TEXT PRIMARY KEY,\r\n',
    '          chapter_id TEXT NOT NULL UNIQUE,\r\n',
    "          core_goal TEXT DEFAULT '',\r\n",
    "          plot_progression TEXT DEFAULT '',\r\n",
    "          character_development TEXT DEFAULT '',\r\n",
    "          overall_foreshadowing TEXT DEFAULT '[]',\r\n",
    "          overall_twists TEXT DEFAULT '[]',\r\n",
    "          next_chapter_hook TEXT DEFAULT '',\r\n",
    "          scenes TEXT DEFAULT '[]',\r\n",
    '          created_at INTEGER NOT NULL,\r\n',
    '          updated_at INTEGER NOT NULL,\r\n',
    '          FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE\r\n',
    '        )\r\n',
    '      `)\r\n',
    '      db.exec(`CREATE INDEX idx_chapter_outlines_chapter_id ON chapter_outlines(chapter_id)`)\r\n',
    "      console.log('[Database] chapter_outlines 表创建完成')\r\n",
    '      needsSave = true\r\n',
    '    }\r\n',
    '  } catch (e) {\r\n',
    "    console.error('[Database] chapter_outlines 表迁移检查失败:', e)\r\n",
    '  }\r\n',
    '\r\n',
]

# 在 insert_idx 位置插入新行
for offset, nl in enumerate(new_lines):
    lines.insert(insert_idx + offset, nl)

# 写回文件
with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"SUCCESS: inserted {len(new_lines)} lines at line {insert_idx + 1}")
