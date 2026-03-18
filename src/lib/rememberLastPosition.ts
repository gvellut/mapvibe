import { isFalseString, isTrueString } from './stringBoolean';

export type RememberLastPositionValue = false | 0 | true | 1 | "page" | "domain";
export type RememberLastPositionScope = false | "page" | "domain";

interface StoredViewState {
    center: [number, number];
    zoom: number;
}

const REMEMBER_LAST_POSITION_STORAGE_PREFIX = 'mapvibe:last-position:v1:';

export function normalizeRememberLastPosition(value: unknown): RememberLastPositionScope {
    if (value === true || value === 1) {
        return 'page';
    }

    if (value === false || value === 0 || value == null) {
        return false;
    }

    if (typeof value === 'string') {
        const normalizedValue = value.trim().toLowerCase();
        if (isFalseString(normalizedValue)) {
            return false;
        }

        if (isTrueString(normalizedValue) || normalizedValue === 'page') {
            return 'page';
        }

        if (normalizedValue === 'domain') {
            return 'domain';
        }
    }

    return false;
}

export function loadRememberedViewState(scope: RememberLastPositionScope): StoredViewState | undefined {
    if (scope === false || typeof window === 'undefined') {
        return undefined;
    }

    try {
        const storageKey = getRememberLastPositionStorageKey(scope);
        const storedValue = window.localStorage.getItem(storageKey);
        if (!storedValue) {
            return undefined;
        }

        const parsedValue = JSON.parse(storedValue);
        return isStoredViewState(parsedValue) ? parsedValue : undefined;
    } catch (error) {
        console.warn('MapVibe could not load remembered map position.', error);
        return undefined;
    }
}

export function saveRememberedViewState(scope: RememberLastPositionScope, center: [number, number], zoom: number): void {
    if (scope === false || typeof window === 'undefined') {
        return;
    }

    try {
        const storageKey = getRememberLastPositionStorageKey(scope);
        window.localStorage.setItem(storageKey, JSON.stringify({ center, zoom }));
    } catch (error) {
        console.warn('MapVibe could not save remembered map position.', error);
    }
}

function getRememberLastPositionStorageKey(scope: Exclude<RememberLastPositionScope, false>): string {
    const { hostname, pathname } = window.location;
    const scopeKey = scope === 'domain' ? hostname : `${hostname}${pathname}`;
    return `${REMEMBER_LAST_POSITION_STORAGE_PREFIX}${scopeKey}`;
}

function isStoredViewState(value: unknown): value is StoredViewState {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as { center?: unknown; zoom?: unknown };
    if (!Array.isArray(candidate.center) || candidate.center.length !== 2) {
        return false;
    }

    const [lng, lat] = candidate.center;
    return Number.isFinite(lng) && Number.isFinite(lat) && typeof candidate.zoom === 'number' && Number.isFinite(candidate.zoom);
}
