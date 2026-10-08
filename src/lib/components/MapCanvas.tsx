import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { AddProtocolAction, MissingStyleImageResolver } from 'maplibre-gl';
import type { InteractionConfig } from '../map/controlConfig';
import { applyInteractions } from '../map/interactions';
import { isMobile } from '../utils/deviceDetection';

export interface MapInstanceHandle {
    getMap: () => maplibregl.Map | null;
}

// Map Component Props
interface MapProps {
    mapStyle: any;
    initialViewState: {
        center?: [number, number];
        zoom?: number;
        bounds?: [number, number, number, number];
    };
    style: React.CSSProperties;
    attributionControl?: boolean;
    onLoad?: () => void;
    onClick?: (e: maplibregl.MapMouseEvent) => void;
    onDrag?: () => void;
    onMoveEnd?: () => void;
    onDblClick?: () => void;
    resolveMissingStyleImage?: MissingStyleImageResolver;
    customProtocols?: Array<{ name: string; loadFn: AddProtocolAction }>;
    interaction: Required<InteractionConfig>;
    ref?: React.Ref<MapInstanceHandle>;
}

// Custom Map Component
export const MapCanvas = ({ style, ref, ...initializationProps }: MapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<maplibregl.Map | null>(null);
    // Map construction and event registration use the first render's options.
    const [initialOptions] = useState(() => initializationProps);

    React.useImperativeHandle(ref, () => ({
        getMap: () => mapInstance.current
    }));

    useEffect(() => {
        if (!mapContainer.current) return;

        const {
            mapStyle,
            initialViewState,
            attributionControl = true,
            onLoad,
            onClick,
            onDrag,
            onMoveEnd,
            onDblClick,
            resolveMissingStyleImage,
            customProtocols,
            interaction
        } = initialOptions;

        if (customProtocols) {
            customProtocols.forEach((protocol) => {
                maplibregl.addProtocol(protocol.name, protocol.loadFn);
            });
        }

        mapInstance.current = new maplibregl.Map({
            container: mapContainer.current,
            style: mapStyle,
            center: initialViewState.center,
            zoom: initialViewState.zoom,
            bounds: initialViewState.bounds,
            attributionControl: attributionControl ? {} : false
        });

        const map = mapInstance.current;

        applyInteractions(map, interaction, isMobile());

        if (onLoad) {
            map.on('load', onLoad);
        }

        if (onClick) {
            map.on('click', onClick);
        }

        if (onDrag) {
            map.on('drag', onDrag);
        }

        if (onMoveEnd) {
            map.on('moveend', onMoveEnd);
        }

        if (onDblClick) {
            map.on('dblclick', onDblClick);
        }

        if (resolveMissingStyleImage) {
            // MapLibre waits for the resolver before rendering features with custom icons.
            map.setMissingStyleImageResolver(resolveMissingStyleImage);
        }

        return () => {
            map.remove();
            mapInstance.current = null;
        };
    }, [initialOptions]);

    return <div ref={mapContainer} style={style} />;
};

MapCanvas.displayName = 'MapCanvas';
