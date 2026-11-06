import { useMemo } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { BlockType, Note } from '../../types'
import { useStore } from '../../store/useStore'
import { focusEditable } from '../../lib/dom'
import { markdownToBlocks } from '../../lib/markdown'
import { escapeHtml } from '../../lib/sanitize'
import { BlockRow } from './BlockRow'

interface BlockListProps {
  note: Note
}

const CONTINUING_TYPES: BlockType[] = ['bulleted', 'numbered', 'todo']

export function BlockList({ note }: BlockListProps) {
  const addBlock = useStore((state) => state.addBlock)
  const insertBlocks = useStore((state) => state.insertBlocks)
  const updateBlock = useStore((state) => state.updateBlock)
  const removeBlock = useStore((state) => state.removeBlock)
  const moveBlock = useStore((state) => state.moveBlock)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const blocks = note.blocks

  const numbers = useMemo(() => {
    let counter = 0
    return blocks.map((block) => {
      if (block.type !== 'numbered') {
        counter = 0
        return undefined
      }
      counter += 1
      return counter
    })
  }, [blocks])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    moveBlock(note.id, String(active.id), String(over.id))
  }

  const splitBlock = (index: number, before: string, after: string) => {
    const block = blocks[index]
    if (!block) return

    const nextType = CONTINUING_TYPES.includes(block.type) ? block.type : 'paragraph'
    updateBlock(note.id, block.id, { html: before })

    const newId = addBlock(
      note.id,
      {
        type: nextType,
        html: after,
        ...(nextType === 'todo' ? { checked: false } : {}),
      },
      block.id,
    )

    focusEditable(newId, 'start')
  }

  const mergeBlock = (index: number) => {
    const block = blocks[index]
    if (!block) return

    if (index === 0) {
      if (block.type !== 'paragraph') {
        updateBlock(note.id, block.id, { type: 'paragraph', emoji: undefined, language: undefined })
        window.setTimeout(() => focusEditable(block.id, 'start'), 10)
      }
      return
    }

    const previous = blocks[index - 1]

    if (previous.type === 'divider' || previous.type === 'image') {
      if (!block.html && !block.src) {
        removeBlock(note.id, block.id)
        const focusTarget = findEditable(blocks, index - 1, 'back')
        if (focusTarget) focusEditable(focusTarget.id, 'end')
      }
      return
    }

    if (previous.type === 'code') {
      const merged = `${decodeCode(previous.html)}${decodeCode(block.html)}`
      updateBlock(note.id, previous.id, { html: escapeHtml(merged) })
      removeBlock(note.id, block.id)
      focusEditable(previous.id, 'end')
      return
    }

    updateBlock(note.id, previous.id, { html: `${previous.html}${block.html}` })
    removeBlock(note.id, block.id)
    focusEditable(previous.id, 'end')
  }

  const deleteBlock = (index: number) => {
    const block = blocks[index]
    if (!block) return

    if (blocks.length === 1) {
      updateBlock(note.id, block.id, { type: 'paragraph', html: '', emoji: undefined, language: undefined })
      focusEditable(block.id, 'start')
      return
    }

    const target = findEditable(blocks, index - 1, 'back') ?? findEditable(blocks, index + 1, 'forward')
    removeBlock(note.id, block.id)
    if (target) focusEditable(target.id, 'start')
  }

  const moveFocus = (index: number, direction: 'up' | 'down') => {
    const step = direction === 'up' ? -1 : 1
    const target = findEditable(blocks, index + step, direction === 'up' ? 'back' : 'forward')
    if (!target) return
    focusEditable(target.id, direction === 'up' ? 'end' : 'start')
  }

  const insertAfter = (index: number, type: BlockType) => {
    const patch = blockDefaults(type)
    const newId = addBlock(note.id, { type, ...patch }, blocks[index]?.id)

    if (type === 'divider') {
      const paragraphId = addBlock(note.id, { type: 'paragraph' }, newId)
      focusEditable(paragraphId, 'start')
      return
    }

    if (type !== 'image') focusEditable(newId, 'start')
  }

  const convertBlock = (index: number, type: BlockType) => {
    const block = blocks[index]
    if (!block) return

    const patch: Parameters<typeof updateBlock>[2] = {
      ...blockDefaults(type),
      type,
    }

    if (type !== 'todo') patch.checked = false

    updateBlock(note.id, block.id, patch)

    if (type === 'divider') {
      const paragraphId = addBlock(note.id, { type: 'paragraph' }, block.id)
      focusEditable(paragraphId, 'start')
      return
    }

    if (type !== 'image') {
      window.setTimeout(() => focusEditable(block.id, 'start'), 10)
    }
  }

  const pasteBlocks = (index: number, text: string) => {
    const parsed = markdownToBlocks(text)
    const ids = insertBlocks(note.id, parsed, blocks[index]?.id)
    if (ids[0]) focusEditable(ids[0], 'start')
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col">
          {blocks.map((block, index) => (
            <BlockRow
              key={block.id}
              noteId={note.id}
              block={block}
              number={numbers[index]}
              onSplit={(before, after) => splitBlock(index, before, after)}
              onMerge={() => mergeBlock(index)}
              onDelete={() => deleteBlock(index)}
              onArrow={(direction) => moveFocus(index, direction)}
              onInsert={(type) => insertAfter(index, type)}
              onConvert={(type) => convertBlock(index, type)}
              onPasteText={(text) => pasteBlocks(index, text)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function blockDefaults(type: BlockType): {
  emoji?: string
  language?: string
  checked?: boolean
} {
  if (type === 'callout') return { emoji: '💡' }
  if (type === 'code') return { language: 'text' }
  if (type === 'todo') return { checked: false }
  return {}
}

function decodeCode(html: string): string {
  if (!html) return ''
  const element = document.createElement('textarea')
  element.innerHTML = html.replace(/<br\s*\/?>/gi, '\n')
  return element.value
}

function findEditable(
  blocks: Note['blocks'],
  startIndex: number,
  direction: 'back' | 'forward',
): Note['blocks'][number] | null {
  let index = startIndex
  while (index >= 0 && index < blocks.length) {
    const block = blocks[index]
    if (block.type !== 'divider' && block.type !== 'image') return block
    index += direction === 'back' ? -1 : 1
  }
  return null
}
