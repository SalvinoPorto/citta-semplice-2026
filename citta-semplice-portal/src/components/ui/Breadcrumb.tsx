import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="breadcrumb-container" aria-label="breadcrumb">
      <ol className="breadcrumb">
        {items.map((item, i) => (
          <li key={i} className={`breadcrumb-item${item.active ? ' active' : ''}`}>
            {item.href && !item.active ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span>{item.label}</span>
            )}
            {i < items.length - 1 && (
              <span className="separator">&gt;</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
