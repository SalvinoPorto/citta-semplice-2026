/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, ReactNode, ReactElement } from 'react'

type TFilterHeadGroupProps = {
    children: ReactNode
    onFilter?: (result: { key: string; value: any }[]) => void
}

export function TFilterHeadGroup({ children, onFilter }: TFilterHeadGroupProps) {
    const filters = useRef<Map<string, any>>(new Map())

    const handleFilter = (key: string, value: any) => {
        if (onFilter) {
            filters.current.set(key, value)
            const result: { key: string; value: any }[] = []
            filters.current.forEach((value, key) => {
                if (key && value !== '') 
                    result.push({ key, value })
            })
            onFilter(result)
        }
    }

    const childrenWithProps = React.Children.map(children, (child) =>
        React.isValidElement(child)
            ? React.cloneElement(child as ReactElement<any>, {
                onFilter: handleFilter,
            })
            : child
    )

    return (
        <thead>
            <tr>{childrenWithProps}</tr>
        </thead>
    )
}