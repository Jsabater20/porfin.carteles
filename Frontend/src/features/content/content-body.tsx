import type { PublicContent } from '@/lib/contracts/content';

export function ContentBody({ content }: { content: PublicContent }) {
  return <div className="content-body">
    {content.body && <p className="preserve-lines">{content.body}</p>}
    {content.sections.map((section) => <section key={section.key}><h2>{section.heading}</h2><p className="preserve-lines">{section.text}</p></section>)}
    {content.faqItems.length > 0 && <div className="faq-list">{content.faqItems.map((item) =>
      <details key={item.key}><summary>{item.question}</summary><p className="preserve-lines">{item.answer}</p></details>)}</div>}
  </div>;
}
