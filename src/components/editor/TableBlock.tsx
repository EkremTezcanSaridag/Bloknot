import { useRef, type KeyboardEvent } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import type { Block } from '../../types'
import {
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  addTableColumn,
  addTableRow,
  normalizeTableRows,
  removeTableColumn,
  removeTableRow,
  setTableCell,
} from '../../lib/table'

interface TableBlockProps {
  block: Block
  onChange: (patch: Partial<Block>) => void
}

export function TableBlock({ block, onChange }: TableBlockProps) {
  const rows = normalizeTableRows(block.rows)
  const headerRow = block.headerRow !== false
  const containerRef = useRef<HTMLDivElement>(null)

  const commit = (next: string[][]) => onChange({ rows: next })

  const focusCell = (row: number, column: number) => {
    window.requestAnimationFrame(() => {
      const input = containerRef.current?.querySelector<HTMLInputElement>(
        `input[data-cell="${row}:${column}"]`,
      )
      input?.focus()
      input?.select()
    })
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    row: number,
    column: number,
  ) => {
    const width = rows[0]?.length ?? 1

    if (event.key === 'Tab') {
      event.preventDefault()
      const forward = !event.shiftKey
      let nextRow = row
      let nextColumn = column + (forward ? 1 : -1)

      if (nextColumn >= width) {
        nextColumn = 0
        nextRow += 1
      } else if (nextColumn < 0) {
        nextColumn = width - 1
        nextRow -= 1
      }

      if (nextRow >= rows.length) {
        const next = addTableRow(rows)
        commit(next)
        focusCell(next.length - 1, nextColumn)
        return
      }

      if (nextRow < 0) return
      focusCell(nextRow, nextColumn)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (row + 1 < rows.length) {
        focusCell(row + 1, column)
        return
      }
      const next = addTableRow(rows)
      commit(next)
      focusCell(next.length - 1, column)
    }
  }

  const toolbarButton =
    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.66rem] font-bold text-[var(--text-faint)] transition hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="py-1">
      <div ref={containerRef} className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full border-collapse text-left text-sm" aria-label="Tablo">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="group/table-row">
                {row.map((cell, columnIndex) => {
                  const isHeader = headerRow && rowIndex === 0
                  return (
                    <td
                      key={columnIndex}
                      className={`min-w-[7rem] border-b border-r border-[var(--border)] p-0 align-top last:border-r-0 ${
                        isHeader ? 'bg-[var(--surface-2)]' : ''
                      }`}
                    >
                      <input
                        data-cell={`${rowIndex}:${columnIndex}`}
                        value={cell}
                        onChange={(event) =>
                          commit(setTableCell(rows, rowIndex, columnIndex, event.target.value))
                        }
                        onKeyDown={(event) => handleKeyDown(event, rowIndex, columnIndex)}
                        placeholder={isHeader ? `Başlık ${columnIndex + 1}` : ''}
                        aria-label={
                          isHeader
                            ? `Sütun ${columnIndex + 1} başlığı`
                            : `Satır ${rowIndex + 1}, sütun ${columnIndex + 1}`
                        }
                        className={`w-full min-w-0 bg-transparent px-2.5 py-2 outline-none placeholder:text-[var(--text-faint)] focus:bg-[var(--accent-mist)] ${
                          isHeader ? 'font-extrabold' : 'font-medium'
                        }`}
                      />
                    </td>
                  )
                })}
                <td className="w-7 border-b border-[var(--border)] p-0 align-middle">
                  <button
                    type="button"
                    onClick={() => commit(removeTableRow(rows, rowIndex))}
                    className="grid size-6 w-full place-items-center text-[var(--text-faint)] opacity-0 transition hover:text-[var(--danger)] group-hover/table-row:opacity-100 focus-visible:opacity-100"
                    aria-label={`${rowIndex + 1}. satırı sil`}
                    title="Satırı sil"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => commit(addTableRow(rows))}
          disabled={rows.length >= MAX_TABLE_ROWS}
          className={toolbarButton}
          title="En alta satır ekle"
        >
          <Plus className="size-3" />
          Satır
        </button>
        <button
          type="button"
          onClick={() => commit(addTableColumn(rows))}
          disabled={rows[0].length >= MAX_TABLE_COLUMNS}
          className={toolbarButton}
          title="Sağa sütun ekle"
        >
          <Plus className="size-3" />
          Sütun
        </button>

        <span className="mx-0.5 h-4 w-px bg-[var(--border)]" aria-hidden="true" />

        <button
          type="button"
          onClick={() => commit(removeTableRow(rows, rows.length - 1))}
          disabled={rows.length <= 1}
          className={toolbarButton}
          title="Son satırı sil"
        >
          <Minus className="size-3" />
          Satır
        </button>
        <button
          type="button"
          onClick={() => commit(removeTableColumn(rows, rows[0].length - 1))}
          disabled={rows[0].length <= 1}
          className={toolbarButton}
          title="Son sütunu sil"
        >
          <Minus className="size-3" />
          Sütun
        </button>

        <span className="mx-0.5 h-4 w-px bg-[var(--border)]" aria-hidden="true" />

        <button
          type="button"
          onClick={() => onChange({ headerRow: !headerRow })}
          aria-pressed={headerRow}
          className={`${toolbarButton} ${headerRow ? 'text-[var(--accent)]' : ''}`}
          title="İlk satırı başlık olarak biçimlendir"
        >
          Başlık satırı
        </button>
      </div>
    </div>
  )
}
