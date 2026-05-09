'use client'

import { AwardBadge } from '@/components/ui/award-badge'

const demoLink =
  'https://www.producthunt.com/golden-kitty-awards/hall-of-fame?year=2024#bootstrapped-small-teams-2'

export function GoldenKittyDemo() {
  return (
    <div className="grid grid-cols-1 gap-4">
      <AwardBadge type="golden-kitty" link={demoLink} />
    </div>
  )
}

export function ProductOfTheDayDemo() {
  return (
    <div className="grid grid-cols-1 gap-4">
      <AwardBadge type="product-of-the-day" place={1} link={demoLink} />
    </div>
  )
}

export function ProductOfTheMonthDemo() {
  return (
    <div className="grid grid-cols-1 gap-4">
      <AwardBadge type="product-of-the-month" place={2} link={demoLink} />
    </div>
  )
}

export function ProductOfTheWeekDemo() {
  return (
    <div className="grid grid-cols-1 gap-4">
      <AwardBadge type="product-of-the-week" place={3} link={demoLink} />
    </div>
  )
}
