import {
    normalizeRememberLastPosition,
    type RememberLastPositionScope,
    type RememberLastPositionValue
} from './rememberLastPosition.ts';

export type RememberLayerVisibilityValue = RememberLastPositionValue;
export type RememberLayerVisibilityScope = RememberLastPositionScope;

export interface RememberedLayerVisibility {
    selectedBackgroundLayer: string;
    dataLayerVisibility: Record<string, boolean>;
}

const STORAGE_PREFIX = 'mapvibe:layer-visibility:v1:';

export function normalizeRememberLayerVisibility(value: unknown): RememberLayerVisibilityScope {
    return normalizeRememberLastPosition(value);
}

export function loadRememberedLayerVisibility(
    scope: RememberLayerVisibilityScope
): RememberedLayerVisibility | undefined {
    if (scope === false || typeof window === 'undefined') return undefined;

    try {
        const storedValue = window.localStorage.getItem(getStorageKey(scope));
        if (!storedValue) return undefined;
        const parsedValue: unknown = JSON.parse(storedValue);
        return isRememberedLayerVisibility(parsedValue) ? parsedValue : undefined;
    } catch (error) {
        console.warn('MapVibe could not load remembered layer visibility.', error);
        return undefined;
    }
}

export function saveRememberedLayerVisibility(
    scope: RememberLayerVisibilityScope,
    visibility: RememberedLayerVisibility
): void {
    if (scope === false || typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(getStorageKey(scope), JSON.stringify(visibility));
    } catch (error) {
        console.warn('MapVibe could not save remembered layer visibility.', error);
    }
}

function getStorageKey(scope: Exclude<RememberLayerVisibilityScope, false>): string {
    const { hostname, pathname } = window.location;
    return `${STORAGE_PREFIX}${scope === 'domain' ? hostname : `${hostname}${pathname}`}`;
}

function isRememberedLayerVisibility(value: unknown): value is RememberedLayerVisibility {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const candidate = value as Partial<RememberedLayerVisibility>;
    return (
        typeof candidate.selectedBackgroundLayer === 'string' &&
        candidate.dataLayerVisibility !== null &&
        typeof candidate.dataLayerVisibility === 'object' &&
        !Array.isArray(candidate.dataLayerVisibility) &&
        Object.values(candidate.dataLayerVisibility).every(
            (visible) => typeof visible === 'boolean'
        )
    );
}
