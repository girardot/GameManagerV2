import { Badge } from './ui'
import type { PegiRating } from '../types'

function ratingColor(
  value: number
): 'green' | 'yellow' | 'red' {
  if (value >= 15) return 'green'
  if (value >= 9) return 'yellow'
  return 'red'
}

export function PegiBadge({ value }: { value: PegiRating }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md border border-orange-500/35 bg-orange-950/50 px-2 py-0.5 text-xs font-bold tracking-wide text-orange-200"
      title={`Classification PEGI ${value}`}
    >
      PEGI&nbsp;{value}
    </span>
  )
}

export function RatingBadge({ value }: { value: number }) {
  return (
    <Badge color={ratingColor(value)}>
      <span className="tabular-nums font-semibold">{value}</span>
      <span className="font-normal opacity-80">/20</span>
    </Badge>
  )
}

export function GameMetaBadges({
  pegi,
  rating,
}: {
  pegi?: PegiRating | null
  rating?: number | null
}) {
  if (pegi == null && rating == null) return null

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {pegi != null && <PegiBadge value={pegi} />}
      {rating != null && <RatingBadge value={rating} />}
    </span>
  )
}
