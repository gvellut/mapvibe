import type React from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { AddProtocolAction } from 'maplibre-gl';
import type { ControlsConfig, InteractionConfig, MapVibeRuntimeOptions } from './map/controlConfig';
import type { RememberLastPositionValue } from './map/rememberLastPosition';

export type SpriteConfig = string | Array<{ id: string; url: string }> | undefined;

// --- TYPE DEFINITIONS for custom config properties ---
export interface BackgroundLayerConfig {
    id: string;
    name: string;
    layerIds: string[];
    visible?: boolean;
}

export interface StyleImportConfig {
    id: string;
    url: string;
}

export interface DataLayerConfig {
    id: string;
    name: string;
    layerIds: string[];
    visible?: boolean;
    interactive?: boolean;
    clusterInteractive?: boolean;
    openUrl?: boolean;
}

export interface CustomUiConfig {
    panel: {
        backgroundColor: string;
        width: string;
        imageSizeIsMax?: boolean;
        recenterOnOpen?: boolean;
        marginRecenterOnOpen?: number;
    };
    controls?: ControlsConfig;
    interaction?: InteractionConfig;
    rememberLastPosition?: RememberLastPositionValue;
    imports?: StyleImportConfig[];
    backgroundLayers: BackgroundLayerConfig[];
    dataLayers: DataLayerConfig[];
    globalMinZoom?: number;
    globalMaxZoom?: number;
}

export interface AppConfig {
    title?: string;
    version?: number;
    name?: string;
    metadata?: any;
    center?: [number, number];
    centerAltitude?: number;
    zoom?: number;
    bearing?: number;
    pitch?: number;
    roll?: number;
    bounds?: [number, number, number, number];
    state?: any;
    light?: any;
    sky?: any;
    projection?: any;
    terrain?: any;
    sources?: Record<string, any>;
    sprite?: SpriteConfig;
    glyphs?: string;
    layers?: any[];
    customUi: CustomUiConfig;
    customImageResources?: Array<{
        id: string;
        url: string;
        pixelRatio?: number;
    }>;
}

export interface InfoPanelData {
    title?: string;
    description?: string;
    imageUrl?: string;
    imageBackgroundColor?: string;
    imageSize?: [number, number];
    imagePadding?: [number, number, number, number];
}

export interface MapVibeImportInfo {
    id: string;
    url: string;
    layerIds: string[];
    sourceIds: string[];
    spriteIds: string[];
    glyphsUrl?: string;
}

export interface MapVibeMapHandle {
    getMap: () => maplibregl.Map | null;
    getLayerIdsForBackgroundLayer: (id: string) => string[];
    getImportInfo: (id: string) => MapVibeImportInfo | null;
    closeInfoPanel: () => void;
}

export interface MapVibeMapProps {
    config: AppConfig;
    customProtocols?: Array<{ name: string; loadFn: AddProtocolAction }>;
    /** Host-provided overrides take precedence over JSON settings and defaults. */
    runtimeOptions?: MapVibeRuntimeOptions;
    ref?: React.Ref<MapVibeMapHandle>;
}
