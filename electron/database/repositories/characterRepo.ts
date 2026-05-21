/**
 * 角色数据访问层 - Character Repository
 */
import type { Database } from 'sql.js'
import { queryAll, run } from '../index'

export interface CharacterRecord {
  id: string
  name: string
  role: string
  gender: string | null
  age: number | null
  appearance: string
  personality: string
  background: string
  abilities: string
  motivation: string
  arc: string
  dialogueStyle: string
  description: string
  relationships: Array<{ characterId: string; relation: string }>
}

export function getCharacters(db: Database): CharacterRecord[] {
  const rows = queryAll(db, 'SELECT * FROM characters')
  return rows.map(r => {
    const char: CharacterRecord = {
      id: r.id,
      name: r.name,
      role: r.role,
      gender: r.gender,
      age: r.age,
      appearance: r.appearance || '',
      personality: r.personality || '',
      background: r.background || '',
      abilities: r.abilities || '',
      motivation: r.motivation || '',
      arc: r.arc || '',
      dialogueStyle: r.dialogue_style || '',
      description: r.description || '',
      relationships: []
    }

    const rels = queryAll(db, 'SELECT * FROM character_relationships WHERE character_id = ?', [r.id])
    char.relationships = rels.map(rel => ({
      characterId: rel.related_character_id,
      relation: rel.relation
    }))

    return char
  })
}

export function getCharacterById(db: Database, id: string): CharacterRecord | null {
  const r = queryAll(db, 'SELECT * FROM characters WHERE id = ?', [id])[0]
  if (!r) return null

  const char: CharacterRecord = {
    id: r.id,
    name: r.name,
    role: r.role,
    gender: r.gender,
    age: r.age,
    appearance: r.appearance || '',
    personality: r.personality || '',
    background: r.background || '',
    abilities: r.abilities || '',
    motivation: r.motivation || '',
    arc: r.arc || '',
    dialogueStyle: r.dialogue_style || '',
    description: r.description || '',
    relationships: []
  }

  const rels = queryAll(db, 'SELECT * FROM character_relationships WHERE character_id = ?', [id])
  char.relationships = rels.map(rel => ({
    characterId: rel.related_character_id,
    relation: rel.relation
  }))

  return char
}

export function upsertCharacter(db: Database, char: Omit<CharacterRecord, 'relationships'>): void {
  const existing = queryAll(db, 'SELECT id FROM characters WHERE id = ?', [char.id])[0]
  if (existing) {
    run(db, `
      UPDATE characters SET
        name = ?, role = ?, gender = ?, age = ?, appearance = ?,
        personality = ?, background = ?, abilities = ?, motivation = ?,
        arc = ?, dialogue_style = ?, description = ?
      WHERE id = ?
    `, [
      char.name, char.role, char.gender, char.age, char.appearance,
      char.personality, char.background, char.abilities, char.motivation,
      char.arc, char.dialogueStyle, char.description, char.id
    ])
  } else {
    run(db, `
      INSERT INTO characters (
        id, name, role, gender, age, appearance, personality,
        background, abilities, motivation, arc, dialogue_style, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      char.id, char.name, char.role, char.gender, char.age, char.appearance,
      char.personality, char.background, char.abilities, char.motivation,
      char.arc, char.dialogueStyle, char.description
    ])
  }
}

export function deleteCharacter(db: Database, id: string): void {
  run(db, 'DELETE FROM character_relationships WHERE character_id = ? OR related_character_id = ?', [id, id])
  run(db, 'DELETE FROM characters WHERE id = ?', [id])
}

export function upsertCharacterRelationships(
  db: Database,
  characterId: string,
  relationships: Array<{ characterId: string; relation: string }>
): void {
  run(db, 'DELETE FROM character_relationships WHERE character_id = ?', [characterId])
  for (const rel of relationships) {
    run(db, `
      INSERT INTO character_relationships (character_id, related_character_id, relation)
      VALUES (?, ?, ?)
    `, [characterId, rel.characterId, rel.relation])
  }
}
