// Shared helpers for style documents.

export function resolveMaybeRelativeUrl(value: string, baseUrl: string): string {
    if (!value) {
        return value;
    }

    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) || value.startsWith('//')) {
        return value;
    }

    try {
        return new URL(value, baseUrl).href;
    } catch {
        return value;
    }
}

export function uniqueInOrder<T>(items: T[]): T[] {
    const result: T[] = [];
    const seen = new Set<T>();

    for (const item of items) {
        if (seen.has(item)) {
            continue;
        }

        seen.add(item);
        result.push(item);
    }

    return result;
}

export function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}
