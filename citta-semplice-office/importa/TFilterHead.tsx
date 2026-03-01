import React, { useEffect, useState } from 'react'

type TFilterHeadProps = {
    field?: string
    onFilter?: (field: string | undefined, value: string) => void
    placeholder?: string
}

export function TFilterHead({ field, onFilter, placeholder }: TFilterHeadProps) {
    const [inputValue, setInputValue] = useState<string>('')
    // const [debouncedInputValue, setDebouncedInputValue] = useState<string>('')

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (onFilter) 
                onFilter(field, inputValue)
            // setDebouncedInputValue(inputValue)
        }, 2000)
        return () => {
            clearTimeout(timeoutId)
        }
    }, [inputValue])

     return (
        <th className="f-filter-column">
            {field ? (
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="f-inputtext f-component f-column-filter"
                    placeholder={placeholder}
                />
            ) : (
                <span>&nbsp;</span>
            )}
        </th>
    )
}