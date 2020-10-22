/**
 * Converts an input string into a string array of selected values.
 *
 * The input string may be the value of a multi-selection template variable. In this case the input string is
 * delimited by curly braces that enclose a comma separated list of values.
 *
 * The dropUnresolved parameter determines if an empty array is returned if the input starts with '$'.
 * The dropAll parameter determines if an empty array is returned if the input is "all".
 */
export function processSelectionVariable(input: string, dropUnresolved: boolean, dropAll: boolean): string[] {
    if (input) {
        if (input.startsWith('{') && input.endsWith('}')) {
            const args = input.substring(1, input.length - 1).split(',').map(s => s.trim())
            if (dropAll && args.some(s => s === 'all')) {
                return []
            } else {
                return args
            }
        } else if (dropUnresolved && input.startsWith('$')) {
            return [];
        } else if (dropAll && input === 'all') {
            return []
        } else {
            return [input]
        }
    } else {
        return []
    }
}

/** Checks if the given index is the first index of the given t. */
export function isFirst<T>(t: T, index: number, array: T[]) {
    return array.indexOf(t) === index;
}

/**
 * Converts multiple (possibly multi-selection) inputs into a string array of all contained selections.
 *
 * Unresolved template variables (detected by a leading '$' sign) are ignored. This allows to remove template variables
 * from a dashboard without having to adjust queries that use them.
 *
 * An empty array is returned if "all" would be included in the selections. Duplicates are removed.
 */
export function processSelectionVariables(input?: string[]): string[] {
    if (input) {
        const mapped = input.map(i => processSelectionVariable(i, true, false))
        if (mapped.some(m => m.some(s => s === 'all'))) {
            return []
        } else {
            return ([] as string[]).concat(...mapped).filter(isFirst)
        }
    } else {
        return []
    }
}
