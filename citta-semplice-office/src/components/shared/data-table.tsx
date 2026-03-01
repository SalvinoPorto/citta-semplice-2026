'use client';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  ColumnFiltersState,
  PaginationState,
} from '@tanstack/react-table';
import { useState } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  searchColumn?: string;
  pageSize?: number;
  showPagination?: boolean;
  showSearch?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  striped?: boolean;
  hover?: boolean;
  bordered?: boolean;
  responsive?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = 'Cerca...',
  searchColumn,
  pageSize = 10,
  showPagination = true,
  showSearch = true,
  loading = false,
  emptyMessage = 'Nessun dato disponibile',
  onRowClick,
  striped = true,
  hover = true,
  bordered = false,
  responsive = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
  });

  const tableClasses = clsx(
    'table',
    striped && 'table-striped',
    hover && 'table-hover',
    bordered && 'table-bordered'
  );

  const tableContent = (
    <table className={tableClasses}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                scope="col"
                className={clsx(
                  header.column.getCanSort() && 'cursor-pointer user-select-none'
                )}
                onClick={header.column.getToggleSortingHandler()}
              >
                <div className="d-flex align-items-center gap-2">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() && (
                    <span>
                      {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={columns.length} className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Caricamento...</span>
              </div>
            </td>
          </tr>
        ) : table.getRowModel().rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="text-center py-4 text-muted">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              className={clsx(onRowClick && 'cursor-pointer')}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  return (
    <div className="data-table">
      {showSearch && (
        <div className="mb-3">
          <div className="form-group">
            <input
              type="text"
              className="form-control"
              placeholder={searchPlaceholder}
              value={searchColumn
                ? (table.getColumn(searchColumn)?.getFilterValue() as string) ?? ''
                : globalFilter
              }
              onChange={(e) => {
                if (searchColumn) {
                  table.getColumn(searchColumn)?.setFilterValue(e.target.value);
                } else {
                  setGlobalFilter(e.target.value);
                }
              }}
            />
          </div>
        </div>
      )}

      {responsive ? (
        <div className="table-responsive">{tableContent}</div>
      ) : (
        tableContent
      )}

      {showPagination && table.getPageCount() > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <div className="text-muted small">
            Pagina {table.getState().pagination.pageIndex + 1} di {table.getPageCount()}
            {' '}({data.length} elementi totali)
          </div>
          <nav aria-label="Navigazione pagine">
            <ul className="pagination mb-0">
              <li className={clsx('page-item', !table.getCanPreviousPage() && 'disabled')}>
                <Button
                  variant="link"
                  className="page-link"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  «
                </Button>
              </li>
              <li className={clsx('page-item', !table.getCanPreviousPage() && 'disabled')}>
                <Button
                  variant="link"
                  className="page-link"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  ‹
                </Button>
              </li>
              <li className={clsx('page-item', !table.getCanNextPage() && 'disabled')}>
                <Button
                  variant="link"
                  className="page-link"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  ›
                </Button>
              </li>
              <li className={clsx('page-item', !table.getCanNextPage() && 'disabled')}>
                <Button
                  variant="link"
                  className="page-link"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  »
                </Button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
