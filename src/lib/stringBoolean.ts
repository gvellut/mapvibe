const FALSE_STRINGS = ['false', '0', 'n', 'no'] as const;
const TRUE_STRINGS = ['true', '1', 'y', 'yes'] as const;

export function isFalseString(value: unknown): value is typeof FALSE_STRINGS[number] {
    return typeof value === 'string' && FALSE_STRINGS.includes(value.trim().toLowerCase() as typeof FALSE_STRINGS[number]);
}

export function isTrueString(value: unknown): value is typeof TRUE_STRINGS[number] {
    return typeof value === 'string' && TRUE_STRINGS.includes(value.trim().toLowerCase() as typeof TRUE_STRINGS[number]);
}

export function normalizeOptionalBooleanString(value: unknown): boolean | null {
    if (value === true || value === 1) {
        return true;
    }

    if (value === false || value === 0) {
        return false;
    }

    if (isTrueString(value)) {
        return true;
    }

    if (isFalseString(value)) {
        return false;
    }

    return null;
}
