import type React from 'react';
import type { BackgroundLayerConfig, DataLayerConfig } from '../types';

// Layer Chooser Component, rendered inside its MapLibre control host.
export const LayerChooser: React.FC<{
    backgroundLayers: BackgroundLayerConfig[];
    dataLayers: DataLayerConfig[];
    visible: boolean;
    onToggle: () => void;
    selectedBackgroundLayer: string;
    visibleDataLayers: Set<string>;
    onBackgroundLayerChange: (layerId: string) => void;
    onDataLayerToggle: (layerId: string, visible: boolean) => void;
}> = ({
    backgroundLayers,
    dataLayers,
    visible,
    onToggle,
    selectedBackgroundLayer,
    visibleDataLayers,
    onBackgroundLayerChange,
    onDataLayerToggle
}) => {
    return (
        <>
            <button className="layer-chooser-btn" type="button" title="Layers" onClick={onToggle} />
            {visible && (
                <div className="layer-chooser-panel visible">
                    <h4>Background Layers</h4>
                    {backgroundLayers.map((layer) => (
                        <div key={layer.id}>
                            <input
                                type="radio"
                                name="background-layer"
                                id={`bg-${layer.id}`}
                                checked={selectedBackgroundLayer === layer.id}
                                onChange={() => onBackgroundLayerChange(layer.id)}
                            />
                            <label htmlFor={`bg-${layer.id}`}>{layer.name}</label>
                        </div>
                    ))}

                    <h4>Data Layers</h4>
                    {dataLayers.map((layer) => (
                        <div key={layer.id}>
                            <input
                                type="checkbox"
                                id={`data-${layer.id}`}
                                checked={visibleDataLayers.has(layer.id)}
                                onChange={(e) => onDataLayerToggle(layer.id, e.target.checked)}
                            />
                            <label htmlFor={`data-${layer.id}`}>{layer.name}</label>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};
