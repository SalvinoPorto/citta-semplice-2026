/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, ReactNode, ReactElement } from 'react';
import './THead.css';
import { Order } from '@/lib/models/table';

type THeadGroupProps = {
  children: ReactNode;
  onChange?: (o: Order) => void;
  initialField?: string;
  initialDirection?: number;
};

export function THeadGroup({ children, onChange, initialField = '', initialDirection = 0 }: THeadGroupProps) {
  const [activeField, setActiveField] = useState<string>(initialField);
  const [activeDirection, setActiveDirection] = useState<number>(initialDirection);

  const childClick = (field: string) => {
    const direction =
      field === undefined
        ? 0
        : field === activeField
          ? -activeDirection
          : 1;
    setActiveField(field);
    setActiveDirection(direction);
    if (onChange) {
      onChange({ field, direction });
    }
  };

  const childrenWithProps = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    const element = child as ReactElement<any>;
    const field = (element.props && (element.props as any).field) || '';
    return React.cloneElement(element, {
      childClick,
      active: field && activeField === field,
      direction: activeDirection,
    });
  });

  return (
    <thead>
      <tr>{childrenWithProps}</tr>
    </thead>
  );
}

type THeadProps = {
  width?: number | string;
  childClick?: (id: string) => void;
  field: string;
  active?: boolean;
  direction?: number;
  children?: ReactNode;
};

export function THead({ width, childClick, field, active, direction, children }: THeadProps) {
  const thStyle = width ? { width } : undefined;
  if (field === '') {
    return <th style={thStyle}>{children}</th>;
  }
  return (
    <th
      onClick={() => childClick && childClick(field)}
      className={`thead thead-${active ? 'success' : 'default'}`}
      style={thStyle}
    >
      {children}&nbsp;
      <i className={`fa fa-sort${!active ? '' : direction === 1 ? '-asc' : '-desc'}`}></i>
    </th>
  );
}
