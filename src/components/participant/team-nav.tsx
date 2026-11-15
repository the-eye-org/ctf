'use client';

import { usePathname } from 'next/navigation';

import GooeyNav from '@/components/GooeyNav';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/history', label: 'History' },
  { href: '/tools', label: 'Code Space' },
];

export function TeamNav() {
  const path = usePathname();
  return (
    <nav aria-label="Team" className="order-last w-full sm:order-none sm:w-auto">
      <GooeyNav
        items={LINKS}
        activeIndex={LINKS.findIndex(({ href }) => href === path)}
        onChange={undefined}
        color="#8f2a30"
        activeTextColor="#f1e6e7"
        colors={['#2d6bff', '#38bdf8', '#8f2a30'] as never[]}
        style={{ '--gn-y': '14px', '--gn-frame': 'rgba(14, 19, 32, 0.8)', textShadow: 'none' }}
      />
    </nav>
  );
}
