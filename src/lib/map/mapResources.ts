import { LngLatBounds } from 'maplibre-gl';
import type * as maplibregl from 'maplibre-gl';
import type { AppConfig } from '../types';

/**
 * Calculates the bounding box of all GeoJSON sources and fits the map view.
 */
export async function fitMapToBounds(map: maplibregl.Map, sources: Record<string, any>) {
    const bounds = new LngLatBounds();
    const geojsonFetches: Promise<any>[] = [];

    for (const sourceName in sources) {
        const source = sources[sourceName];
        if (source.type === 'geojson' && typeof source.data === 'string') {
            const mapSource = map.getSource(sourceName) as maplibregl.GeoJSONSource | undefined;
            if (mapSource && typeof mapSource.getData === 'function') {
                const data = mapSource.getData();
                if (data && typeof data === 'object') {
                    geojsonFetches.push(Promise.resolve(data));
                    continue;
                }
            }

            geojsonFetches.push(fetch(source.data).then((res) => res.json()));
        }
    }

    try {
        const geojsons = await Promise.all(geojsonFetches);
        geojsons.forEach((geojson) => {
            geojson.features.forEach((feature: any) => {
                if (feature.geometry?.coordinates) {
                    if (feature.geometry.type === 'Point') {
                        bounds.extend(feature.geometry.coordinates as [number, number]);
                    } else if (feature.geometry.type === 'LineString') {
                        (feature.geometry.coordinates as [number, number][]).forEach((coord) => {
                            bounds.extend(coord);
                        });
                    } else if (feature.geometry.type === 'Polygon') {
                        (feature.geometry.coordinates as [number, number][][]).forEach((ring) => {
                            ring.forEach((coord) => {
                                bounds.extend(coord);
                            });
                        });
                    }
                }
            });
        });

        if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 100 });
        }
    } catch (error) {
        console.error('Could not fit map to bounds:', error);
    }
}

/**
 * Loads a custom image on demand when requested by the map style.
 */
export async function loadCustomImageOnDemand(
    map: maplibregl.Map,
    config: AppConfig,
    imageId: string
) {
    const customImages = config.customImageResources;
    if (!customImages || !Array.isArray(customImages)) {
        return;
    }

    const imageInfo = customImages.find((img: any) => img.id === imageId);
    if (!imageInfo || !imageInfo.url) {
        console.warn(`Image info for "${imageId}" not found in config.customImageResources.`);
        return;
    }

    if (map.hasImage(imageId)) {
        return;
    }

    try {
        const image = await map.loadImage(imageInfo.url);
        if (map.hasImage(imageId)) {
            return;
        }
        map.addImage(imageId, image.data, { pixelRatio: imageInfo.pixelRatio || 1 });
    } catch (error) {
        console.error(`Error loading image ${imageId} from ${imageInfo.url}:`, error);
    }
}
