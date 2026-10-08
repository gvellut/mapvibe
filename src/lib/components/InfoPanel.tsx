import type React from 'react';
import type { CustomUiConfig, InfoPanelData } from '../types';

// Info Panel Component
export const InfoPanel: React.FC<{
    config: CustomUiConfig['panel'];
    data: InfoPanelData;
    onClose: () => void;
}> = ({ config, data, onClose }) => {
    const ratio = data.imageSize ? `${data.imageSize[0]} / ${data.imageSize[1]}` : undefined;
    const imagePadding = formatBoxSpacing(data.imagePadding);
    const imageContainerStyle: React.CSSProperties =
        config.imageSizeIsMax && data.imageSize
            ? {
                  width: '100%',
                  maxWidth: `${data.imageSize[0]}px`,
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  aspectRatio: ratio
              }
            : {
                  width: '100%',
                  aspectRatio: ratio
              };
    const imageStyle: React.CSSProperties = ratio
        ? { width: '100%', height: '100%', objectFit: 'contain', display: 'block' }
        : { width: '100%', height: 'auto', display: 'block' };
    return (
        <div
            id="info-panel"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                backgroundColor: config.backgroundColor,
                width: config.width,
                zIndex: 1000,
                display: 'flex'
            }}
        >
            <div id="info-panel__header">
                <button id="info-panel__close-btn" onClick={onClose}></button>
            </div>
            <div id="info-panel__content">
                <div id="info-panel__content-img">
                    {data.imageUrl && (
                        <div
                            style={{
                                width: '100%',
                                padding: imagePadding,
                                boxSizing: 'border-box',
                                backgroundColor: data.imageBackgroundColor
                            }}
                        >
                            <div style={imageContainerStyle}>
                                <img
                                    src={data.imageUrl}
                                    alt={data.title || ''}
                                    key={data.imageUrl}
                                    style={imageStyle}
                                />
                            </div>
                        </div>
                    )}
                </div>
                <div id="info-panel__content-text">
                    {data.title && <h1>{data.title}</h1>}
                    {data.description && (
                        <div dangerouslySetInnerHTML={{ __html: data.description }} />
                    )}
                </div>
            </div>
        </div>
    );
};

function extractNumericValues(value: unknown): number[] {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? [value] : [];
    }

    if (Array.isArray(value)) {
        return value
            .map((item) => (typeof item === 'number' ? item : Number(item)))
            .filter((item) => Number.isFinite(item));
    }

    if (typeof value === 'string') {
        const matches = value.match(/-?\d*\.?\d+/g);
        if (!matches) {
            return [];
        }

        return matches.map((item) => Number(item)).filter((item) => Number.isFinite(item));
    }

    return [];
}

export function parseImageSize(value: unknown): [number, number] | undefined {
    const numbers = extractNumericValues(value);
    if (numbers.length !== 2 || numbers.some((item) => item <= 0)) {
        return undefined;
    }

    return [numbers[0], numbers[1]];
}

export function parseImagePadding(value: unknown): [number, number, number, number] | undefined {
    const numbers = extractNumericValues(value);
    if (numbers.length === 1 && numbers[0] >= 0) {
        return [numbers[0], numbers[0], numbers[0], numbers[0]];
    }

    if (numbers.length === 4 && numbers.every((item) => item >= 0)) {
        return [numbers[0], numbers[1], numbers[2], numbers[3]];
    }

    return undefined;
}

function formatBoxSpacing(value?: [number, number, number, number]): string {
    if (!value) {
        return '0px';
    }

    return value.map((item) => `${item}px`).join(' ');
}
