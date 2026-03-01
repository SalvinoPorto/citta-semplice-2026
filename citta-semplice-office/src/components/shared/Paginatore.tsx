import React, { MouseEventHandler } from 'react';

type PaginatoreProps = {
  page: number;
  pages: number;
  onChange?: (page: number) => void;
};

export const Paginatore: React.FC<PaginatoreProps> = ({ page, pages, onChange }) => {
  const offs = !pages ? 0 : (pages > 3 ? 4 : pages - 1);
  let first = 1;
  let last = 1 + offs;

  if (page) {
    if (page < first) {
      first = page;
      last = first + offs;
    } else if (page > last) {
      last = page;
      first = last - offs;
    }
  }

  const triggerPrev: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    if (page > 1 && onChange) {
      onChange(page - 1);
    }
  };

  const triggerNext: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    if (page < pages && onChange) {
      onChange(page + 1);
    }
  };

  const triggerClick: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    const p = parseInt(e.currentTarget.innerText, 10);
    if (!isNaN(p) && onChange) {
      onChange(p);
    }
  };

  const items: React.ReactNode[] = [];
  let key = 0;

  if (first > 1) {
    items.push(
      <li key={key++} className="page-item">
        <button className="page-link" onClick={triggerClick}>{1}</button>
      </li>
    );
    items.push(
      <li key={key++} className="page-item page-link disabled">...</li>
    );
  }

  for (let i = first; i <= last && i <= pages; i++) {
    items.push(
      <li key={key++} className={`page-item${page === i ? ' active' : ''}`}>
        <button className="page-link" onClick={triggerClick}>{i}</button>
      </li>
    );
  }

  if (last < pages) {
    items.push(
      <li key={key++} className="page-item page-link disabled">...</li>
    );
    items.push(
      <li key={key++} className="page-item">
        <button className="page-link" onClick={triggerClick}>{pages}</button>
      </li>
    );
  }

  return (
    <ul className="pagination mb-0">
      <li className="page-item">
        <button className="page-link" onClick={triggerPrev} disabled={page <= 1}>
          Precedente
        </button>
      </li>
      {items}
      <li className="page-item">
        <button className="page-link" onClick={triggerNext} disabled={page >= pages}>
          Successiva
        </button>
      </li>
    </ul>
  );
};

export default Paginatore;
