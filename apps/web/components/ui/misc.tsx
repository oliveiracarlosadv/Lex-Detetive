'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('animate-pulse rounded-md bg-muted', className)} />;

export function Empty({ icon: Icon, title, children, className }: { icon?: React.ElementType; title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}>
      {Icon && <div className="mb-3 rounded-full bg-muted p-3 text-muted-foreground"><Icon className="size-5" /></div>}
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mt-1 text-xs text-muted-foreground max-w-md">{children}</div>}
    </div>
  );
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 cursor-pointer', checked ? 'bg-primary' : 'bg-input')}>
      <span className={cn('inline-block size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4.5' : 'translate-x-0.5')} />
    </button>
  );
}

export function Dialog({ open, onClose, title, description, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={cn('w-full rounded-xl border border-border bg-card text-left text-foreground shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted cursor-pointer" aria-label="Fechar"><X className="size-4" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; icon?: React.ElementType }[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
      {items.map((it) => (
        <button key={it.value} role="tab" aria-selected={value === it.value} onClick={() => onChange(it.value)}
          className={cn('flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors cursor-pointer',
            value === it.value ? 'border-gold text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground')}>
          {it.icon && <it.icon className="size-4" />}{it.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const Table = ({ className, ...p }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <div className="overflow-x-auto"><table className={cn('w-full text-sm', className)} {...p} /></div>
);
export const Th = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground border-b border-border', className)} {...p} />
);
export const Td = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-3 py-2.5 border-b border-border/70 align-top', className)} {...p} />
);
