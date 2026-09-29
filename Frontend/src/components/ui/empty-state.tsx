import type { ReactNode } from 'react';

export function EmptyState({ eyebrow, title, children, action }: {
  eyebrow?: string; title: string; children: ReactNode; action?: ReactNode;
}) {
  return (
    <section className="empty-state">
      <span className="empty-state-mark" aria-hidden="true">✳</span>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      <div className="muted prose">{children}</div>
      {action && <div className="actions">{action}</div>}
    </section>
  );
}
