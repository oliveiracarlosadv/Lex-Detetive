import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badge = cva('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium border', {
  variants: {
    tone: {
      neutral: 'bg-muted text-muted-foreground border-transparent',
      blue: 'bg-primary/10 text-primary border-primary/20',
      gold: 'bg-gold/15 text-[#8a6d10] dark:text-gold border-gold/30',
      green: 'bg-success/10 text-success border-success/25',
      red: 'bg-danger/10 text-danger border-danger/25',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...p} />;
}
