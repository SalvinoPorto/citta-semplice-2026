/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, ReactNode, ReactElement } from 'react';
import { Filter } from '@/lib/models/table';

type TFilterHeadGroupProps = {
  children: ReactNode;
  onFilter?: (result: Filter[]) => void;
};

export function TFilterHeadGroup({ children, onFilter }: TFilterHeadGroupProps) {
  const filters = useRef<Map<string, any>>(new Map());

  const handleFilter = (key: string, value: any) => {
    if (onFilter) {
      filters.current.set(key, value);
      const result: Filter[] = [];
      filters.current.forEach((val, k) => {
        if (k && val !== '')
          result.push({ key: k, value: val });
      });
      onFilter(result);
    }
  };

  const childrenWithProps = React.Children.map(children, (child) =>
    React.isValidElement(child)
      ? React.cloneElement(child as ReactElement<any>, {
          onFilter: handleFilter,
        })
      : child
  );

  return (
    <thead>
      <tr>{childrenWithProps}</tr>
    </thead>
  );
}
