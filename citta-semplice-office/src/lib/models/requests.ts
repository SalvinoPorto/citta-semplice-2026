import { Order } from "./table";

export type Filter = {
    key: string
    value: string | number | boolean
}

export type BaseRequest = {
    first?: number;
    page: number;
    pages?: number;
    rows?: number;
    order: Order;
    filters: Filter[];
}

export type ServiziRequest = BaseRequest & {
    area?: number;
    soloAttivi?: boolean;
}