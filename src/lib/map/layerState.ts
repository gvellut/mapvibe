import type { Map } from 'maplibre-gl';
import type { LayerGroup } from '../types';
import type { BackgroundRuntimeState, BackgroundCatalog } from '../styles/backgrounds';

export interface LayerState {
    backgroundIds: string[];
    dataIds: string[];
    selectedBackgroundLayer: string;
    visibleDataLayers: Set<string>;
}

export type LayerAction =
    | { type: 'select'; id: string }
    | { type: 'visibility'; id: string; visible: boolean }
    | { type: 'move'; group: LayerGroup; id: string; toIndex: number }
    | { type: 'remove'; group: LayerGroup; id: string };

export function createLayerState(catalog: BackgroundCatalog): LayerState {
    return {
        backgroundIds: catalog.backgroundEntries.map((layer) => layer.id),
        dataIds: catalog.dataLayerEntries.map((layer) => layer.id),
        selectedBackgroundLayer: catalog.initialSelection,
        visibleDataLayers: new Set(catalog.initialVisibleDataLayerIds)
    };
}

/** Session-only changes never mutate the input configuration or catalog. */
export function reduceLayerState(state: LayerState, action: LayerAction): LayerState {
    if (action.type === 'select') {
        return state.backgroundIds.includes(action.id) &&
            action.id !== state.selectedBackgroundLayer
            ? { ...state, selectedBackgroundLayer: action.id }
            : state;
    }
    if (action.type === 'visibility') {
        if (
            !state.dataIds.includes(action.id) ||
            state.visibleDataLayers.has(action.id) === action.visible
        )
            return state;
        const visibleDataLayers = new Set(state.visibleDataLayers);
        if (action.visible) visibleDataLayers.add(action.id);
        else visibleDataLayers.delete(action.id);
        return { ...state, visibleDataLayers };
    }
    const key = action.group === 'background' ? 'backgroundIds' : 'dataIds';
    const ids = state[key];
    const index = ids.indexOf(action.id);
    if (index < 0) return state;
    if (action.type === 'move') {
        if (
            !Number.isInteger(action.toIndex) ||
            action.toIndex < 0 ||
            action.toIndex >= ids.length ||
            index === action.toIndex
        )
            return state;
        const ordered = [...ids];
        ordered.splice(index, 1);
        ordered.splice(action.toIndex, 0, action.id);
        return { ...state, [key]: ordered };
    }
    // Keep one selectable background; remove only the logical entry and its visibility.
    if (action.group === 'background' && ids.length === 1) return state;
    const remaining = ids.filter((id) => id !== action.id);
    const visibleDataLayers = new Set(state.visibleDataLayers);
    if (action.group === 'data') visibleDataLayers.delete(action.id);
    return {
        ...state,
        [key]: remaining,
        visibleDataLayers,
        selectedBackgroundLayer:
            action.group === 'background' && state.selectedBackgroundLayer === action.id
                ? remaining[0]
                : state.selectedBackgroundLayer
    };
}

/** MapLibre paints later layers higher; preserve member order within each logical entry. */
export function applyDataLayerOrder(
    map: Map,
    catalog: BackgroundCatalog,
    dataIds: readonly string[],
    runtime: BackgroundRuntimeState
): void {
    const ordered = new Set(
        dataIds.flatMap((id) => catalog.dataLayerConfigs.get(id)?.layerIds ?? [])
    );
    for (const id of ordered) {
        if (map.getLayer(id)) map.moveLayer(id);
    }
    // Background switching/imports must insert below the first overlay after a reorder.
    const backgroundMembers = new Set([
        ...catalog.managedTopLayerIds,
        ...[...runtime.imports.values()].flatMap((entry) => entry.layerIds)
    ]);
    catalog.overlayBoundaryId = map
        .getStyle()
        .layers?.find((layer) => !backgroundMembers.has(layer.id))?.id;
}
