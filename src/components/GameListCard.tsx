import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Card } from './ui'

type RankColor = 'indigo' | 'green'

const rankStyles: Record<RankColor, string> = {
  indigo: 'bg-indigo-500/20 text-indigo-300 ring-indigo-500/30',
  green: 'bg-green-500/20 text-green-300 ring-green-500/30',
}

interface GameListCardProps {
  dragHandle?: ReactNode
  rank?: number
  showRank?: boolean
  rankColor?: RankColor
  title: string
  badges?: ReactNode
  meta?: ReactNode
  actions: ReactNode
}

export function GameListCard({
  dragHandle,
  rank,
  showRank = false,
  rankColor = 'indigo',
  title,
  badges,
  meta,
  actions,
}: GameListCardProps) {
  return (
    <Card className="overflow-hidden p-0 shadow-sm shadow-black/20 sm:p-4 sm:shadow-none">
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 gap-2 p-3 pb-2.5 sm:p-0">
          {(dragHandle || showRank) && (
            <div className="flex shrink-0 flex-col items-center gap-1">
              {dragHandle}
              {showRank && rank != null && (
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ring-1 ${rankStyles[rankColor]}`}
                >
                  {rank}
                </span>
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-snug text-white break-words sm:text-sm sm:font-medium">
              {title}
            </h3>
            {badges && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>
            )}
            {meta && (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400 break-words">
                {meta}
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-slate-800/80 bg-slate-950/40 sm:border-0 sm:bg-transparent">
          <div className="flex items-stretch justify-around px-0.5 py-0.5 sm:justify-end sm:gap-0.5 sm:p-0">
            {actions}
          </div>
        </div>
      </div>
    </Card>
  )
}

export function GameListActionButton({
  label,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string
}) {
  return (
    <button
      type="button"
      title={label}
      className={`flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-slate-400 transition hover:text-white active:bg-slate-800/80 sm:min-h-0 sm:min-w-0 sm:flex-none sm:p-2.5 sm:active:bg-transparent ${className}`}
      {...props}
    >
      {children}
      {label && (
        <span className="max-w-full truncate text-[10px] font-medium leading-none sm:hidden">
          {label}
        </span>
      )}
    </button>
  )
}

interface ListToolbarProps {
  summary: ReactNode
  sortLabel?: string
  sortControl: ReactNode
}

export function ListToolbar({
  summary,
  sortLabel = 'Trier par',
  sortControl,
}: ListToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:p-0">
      <div className="text-sm text-slate-500">{summary}</div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <span className="shrink-0 text-sm font-medium text-slate-300">
          {sortLabel}
        </span>
        {sortControl}
      </div>
    </div>
  )
}
