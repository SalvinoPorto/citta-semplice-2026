export interface Order {
  field: string;
  direction: number; // 1 = asc, -1 = desc, 0 = none
}

export interface Filter {
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
}
