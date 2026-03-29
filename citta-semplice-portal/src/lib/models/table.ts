export type Order = {
  field: string;
  direction: number; // 1 = asc, -1 = desc, 0 = nessuno
};

export type Filter = {
  key: string;
  value: string;
};
