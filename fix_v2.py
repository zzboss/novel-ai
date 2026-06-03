#!/usr/bin/env python3
"""精确在 getDatabase 函数中插入 chapter_outlines 表迁移逻辑
只修改 getDatabase（第495行起），不影响 loadDatabase
"""

filepath = r'd:\coding\writing\AIWT\novel-ai\electron\database\index.ts'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找到 getDatabase 函数的起始行（0-based index）
get_db_start = None
get_db_end = None

for i, line in enumerate(lines):
    if 'export async function getDatabase' in line:
        get_db_start = i
        break

if get_db_start is None:
    print("ERROR: getDatabase function not found")
    exit(1)

# 找到 getDatabase 函数结束位置（下一个 export function 或文件末尾）
for i in range(get_db_start + 1, len(lines)):
    # getDatabase 结束于 "}\n" 后跟 "// ====================" 或下一个 export
    if lines[i].strip() == '// ==================== Schema SQL ====================':
        get_db_end = i
        break

if get_db_end is None:
    print("ERROR: getDatabase function end not found")
    exit(1)

print(f"getDatabase: lines {get_db_start+1} to {get_db_end}")

# 在 getDatabase 函数范围内，找到 "角色关系图相关表已存在" 后面紧跟 "地图相关表" 的位置
# loadDatabase 中没有 "地图相关表" 这个注释，所以可以唯一识别
insert_at = None

for i in range(get_db_start, get_db_end):
    if '角色关系图相关表已存在' in lines[i]:
        # 检查后面几行是否有 "地图相关表"
        found = False
        for j in range(i+1, min(i+6, get_db_end)):
            if '地图相关表' in lines[j]:
                found = True
                break
        if found:
            # 在 "  }\n  } catch (e) {\n    console.error(...)\n  }\n\n  // 迁移：检查并创建地图相关表"
            # 插入点在 catch 块结束后、地图迁移注释之前
            # 找到 "  // 迁移：检查并创建地图相关表" 这一行
            for j in range(i, min(i+8, get_db_end)):
                if '迁移：检查并创建地图相关表' in lines[j]:
                    insert_at = j  # 在这一行之前插入
                    break
            break

if insert_at is None:
    print("ERROR: insertion point not found")
else:
    new_block = [
        '  }\r\n',
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
        "      db.exec(`CREATE INDEX idx_chapter_outlines_chapter_id ON chapter_outlines(chapter_id)`)\r\n",
        "      console.log('[Database] chapter_outlines 表创建完成')\r\n",
        '      needsSave = true\r\n',
        '    }\r\n',
        '  } catch (e) {\r\n',
        "    console.error('[Database] chapter_outlines 表迁移检查失败:', e)\r\n",
        '  }\r\n',
        '\r\n',
    ]
    # 在 insert_at 位置插入（在地图迁移注释之前）
    for offset, nl in enumerate(new_block):
        lines.insert(insert_at + offset, nl)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"SUCCESS: inserted chapter_outlines migration at line {insert_at + 1}")
