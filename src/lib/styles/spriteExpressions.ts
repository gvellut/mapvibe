import type { SpriteConfig } from '../types';
import { resolveMaybeRelativeUrl } from './styleUtils.ts';

const DEFAULT_IMPORTED_SPRITE_ID = 'default';
const RESOLVED_IMAGE_PROPERTIES = [
    'icon-image',
    'fill-pattern',
    'fill-extrusion-pattern',
    'line-pattern',
    'background-pattern'
] as const;

export interface SpriteMapping {
    ids: Map<string, string>;
    urls: Map<string, string>;
    defaultSpriteId?: string;
}

export function normalizeSpriteConfiguration(
    spriteConfig: SpriteConfig,
    baseUrl: string,
    namespacePrefix: string
): SpriteMapping {
    const ids = new Map<string, string>();
    const urls = new Map<string, string>();
    let defaultSpriteId: string | undefined;

    if (typeof spriteConfig === 'string') {
        const runtimeSpriteId = `${namespacePrefix}${DEFAULT_IMPORTED_SPRITE_ID}`;
        ids.set(DEFAULT_IMPORTED_SPRITE_ID, runtimeSpriteId);
        urls.set(runtimeSpriteId, resolveMaybeRelativeUrl(spriteConfig, baseUrl));
        defaultSpriteId = runtimeSpriteId;
    } else if (Array.isArray(spriteConfig)) {
        for (const spriteEntry of spriteConfig) {
            if (
                !spriteEntry ||
                typeof spriteEntry.id !== 'string' ||
                typeof spriteEntry.url !== 'string'
            ) {
                continue;
            }

            const runtimeSpriteId = `${namespacePrefix}${spriteEntry.id}`;
            ids.set(spriteEntry.id, runtimeSpriteId);
            urls.set(runtimeSpriteId, resolveMaybeRelativeUrl(spriteEntry.url, baseUrl));

            if (spriteEntry.id === DEFAULT_IMPORTED_SPRITE_ID) {
                defaultSpriteId = runtimeSpriteId;
            }
        }
    }

    return { ids, urls, defaultSpriteId };
}

export function rewriteLayerImageReferences(layerDefinition: any, spriteMapping: SpriteMapping) {
    for (const propertyName of RESOLVED_IMAGE_PROPERTIES) {
        if (layerDefinition.layout && propertyName in layerDefinition.layout) {
            layerDefinition.layout[propertyName] = rewriteResolvedImageValue(
                layerDefinition.layout[propertyName],
                spriteMapping
            );
        }

        if (layerDefinition.paint && propertyName in layerDefinition.paint) {
            layerDefinition.paint[propertyName] = rewriteResolvedImageValue(
                layerDefinition.paint[propertyName],
                spriteMapping
            );
        }
    }
}

function rewriteResolvedImageValue(value: any, spriteMapping: SpriteMapping): any {
    if (typeof value === 'string') {
        return prefixImageStringReference(value, spriteMapping);
    }

    if (!Array.isArray(value)) {
        return value;
    }

    const operator = typeof value[0] === 'string' ? value[0] : undefined;
    if (operator === 'image') {
        if (value.length < 2) {
            return value;
        }

        const nextValue = [...value];
        nextValue[1] = rewriteResolvedImageStringExpression(nextValue[1], spriteMapping);
        return nextValue;
    }

    if (operator === 'step') {
        return rewriteStepResolvedImageExpression(value, spriteMapping, rewriteResolvedImageValue);
    }

    if (operator === 'interpolate') {
        return rewriteInterpolateResolvedImageExpression(
            value,
            spriteMapping,
            rewriteResolvedImageValue
        );
    }

    if (operator === 'case') {
        return rewriteCaseResolvedImageExpression(value, spriteMapping, rewriteResolvedImageValue);
    }

    if (operator === 'match') {
        return rewriteMatchResolvedImageExpression(value, spriteMapping, rewriteResolvedImageValue);
    }

    if (operator === 'coalesce') {
        return rewriteCoalesceResolvedImageExpression(
            value,
            spriteMapping,
            rewriteResolvedImageValue
        );
    }

    if (operator === 'let') {
        return rewriteLetResolvedImageExpression(value, spriteMapping, rewriteResolvedImageValue);
    }

    if (expressionContainsOperator(value, 'image')) {
        return rewriteNestedResolvedImageExpression(value, spriteMapping);
    }

    return prefixStringExpression(value, spriteMapping);
}

function rewriteNestedResolvedImageExpression(value: any, spriteMapping: SpriteMapping): any {
    if (!Array.isArray(value)) {
        return value;
    }

    const operator = typeof value[0] === 'string' ? value[0] : undefined;
    if (operator === 'image') {
        if (value.length < 2) {
            return value;
        }

        const nextValue = [...value];
        nextValue[1] = rewriteResolvedImageStringExpression(nextValue[1], spriteMapping);
        return nextValue;
    }

    return value.map((item) =>
        Array.isArray(item) ? rewriteNestedResolvedImageExpression(item, spriteMapping) : item
    );
}

function rewriteResolvedImageStringExpression(value: any, spriteMapping: SpriteMapping): any {
    if (typeof value === 'string') {
        return prefixImageStringReference(value, spriteMapping);
    }

    if (!Array.isArray(value)) {
        return value;
    }

    const operator = typeof value[0] === 'string' ? value[0] : undefined;
    if (operator === 'step') {
        return rewriteStepResolvedImageExpression(
            value,
            spriteMapping,
            rewriteResolvedImageStringExpression
        );
    }

    if (operator === 'interpolate') {
        return rewriteInterpolateResolvedImageExpression(
            value,
            spriteMapping,
            rewriteResolvedImageStringExpression
        );
    }

    if (operator === 'case') {
        return rewriteCaseResolvedImageExpression(
            value,
            spriteMapping,
            rewriteResolvedImageStringExpression
        );
    }

    if (operator === 'match') {
        return rewriteMatchResolvedImageExpression(
            value,
            spriteMapping,
            rewriteResolvedImageStringExpression
        );
    }

    if (operator === 'coalesce') {
        return rewriteCoalesceResolvedImageExpression(
            value,
            spriteMapping,
            rewriteResolvedImageStringExpression
        );
    }

    if (operator === 'let') {
        return rewriteLetResolvedImageExpression(
            value,
            spriteMapping,
            rewriteResolvedImageStringExpression
        );
    }

    return prefixStringExpression(value, spriteMapping);
}

function rewriteStepResolvedImageExpression(
    value: any[],
    spriteMapping: SpriteMapping,
    rewriteValue: (branchValue: any, branchSpriteMapping: SpriteMapping) => any
): any {
    if (value.length < 3) {
        return value;
    }

    const nextValue = [...value];
    nextValue[2] = rewriteValue(nextValue[2], spriteMapping);

    for (let index = 4; index < nextValue.length; index += 2) {
        nextValue[index] = rewriteValue(nextValue[index], spriteMapping);
    }

    return nextValue;
}

function rewriteInterpolateResolvedImageExpression(
    value: any[],
    spriteMapping: SpriteMapping,
    rewriteValue: (branchValue: any, branchSpriteMapping: SpriteMapping) => any
): any {
    if (value.length < 5) {
        return value;
    }

    const nextValue = [...value];
    for (let index = 4; index < nextValue.length; index += 2) {
        nextValue[index] = rewriteValue(nextValue[index], spriteMapping);
    }

    return nextValue;
}

function rewriteCaseResolvedImageExpression(
    value: any[],
    spriteMapping: SpriteMapping,
    rewriteValue: (branchValue: any, branchSpriteMapping: SpriteMapping) => any
): any {
    if (value.length < 2) {
        return value;
    }

    const nextValue = [...value];
    for (let index = 2; index < nextValue.length - 1; index += 2) {
        nextValue[index] = rewriteValue(nextValue[index], spriteMapping);
    }

    nextValue[nextValue.length - 1] = rewriteValue(nextValue[nextValue.length - 1], spriteMapping);
    return nextValue;
}

function rewriteMatchResolvedImageExpression(
    value: any[],
    spriteMapping: SpriteMapping,
    rewriteValue: (branchValue: any, branchSpriteMapping: SpriteMapping) => any
): any {
    if (value.length < 3) {
        return value;
    }

    const nextValue = [...value];
    for (let index = 3; index < nextValue.length - 1; index += 2) {
        nextValue[index] = rewriteValue(nextValue[index], spriteMapping);
    }

    nextValue[nextValue.length - 1] = rewriteValue(nextValue[nextValue.length - 1], spriteMapping);
    return nextValue;
}

function rewriteCoalesceResolvedImageExpression(
    value: any[],
    spriteMapping: SpriteMapping,
    rewriteValue: (branchValue: any, branchSpriteMapping: SpriteMapping) => any
): any {
    if (value.length < 2) {
        return value;
    }

    const nextValue = [...value];
    for (let index = 1; index < nextValue.length; index += 1) {
        nextValue[index] = rewriteValue(nextValue[index], spriteMapping);
    }

    return nextValue;
}

function rewriteLetResolvedImageExpression(
    value: any[],
    spriteMapping: SpriteMapping,
    rewriteValue: (branchValue: any, branchSpriteMapping: SpriteMapping) => any
): any {
    if (value.length < 2) {
        return value;
    }

    const nextValue = [...value];
    for (let index = 2; index < nextValue.length - 1; index += 2) {
        nextValue[index] = rewriteValue(nextValue[index], spriteMapping);
    }

    nextValue[nextValue.length - 1] = rewriteValue(nextValue[nextValue.length - 1], spriteMapping);
    return nextValue;
}

function expressionContainsOperator(value: any, operator: string): boolean {
    if (!Array.isArray(value) || value.length === 0) {
        return false;
    }

    if (value[0] === operator) {
        return true;
    }

    return value.some((item) => Array.isArray(item) && expressionContainsOperator(item, operator));
}

function prefixStringExpression(value: any, spriteMapping: SpriteMapping): any {
    if (typeof value === 'string') {
        return prefixImageStringReference(value, spriteMapping);
    }

    if (!spriteMapping.defaultSpriteId) {
        return value;
    }

    return prependToStringExpression(`${spriteMapping.defaultSpriteId}:`, value);
}

function prefixImageStringReference(value: string, spriteMapping: SpriteMapping): any {
    if (value === '') {
        return value;
    }

    const resolvedReference = resolveSpriteReference(value, spriteMapping);
    if (!resolvedReference) {
        return value;
    }

    const imageExpression = resolvedReference.imageReference.includes('{')
        ? tokenStringToExpression(resolvedReference.imageReference)
        : resolvedReference.imageReference;

    return prependToStringExpression(`${resolvedReference.spriteId}:`, imageExpression);
}

function resolveSpriteReference(
    value: string,
    spriteMapping: SpriteMapping
): { spriteId: string; imageReference: string } | null {
    const firstColonIndex = value.indexOf(':');
    if (firstColonIndex > 0) {
        const candidateSpriteId = value.slice(0, firstColonIndex);
        const mappedSpriteId = spriteMapping.ids.get(candidateSpriteId);
        if (mappedSpriteId) {
            return {
                spriteId: mappedSpriteId,
                imageReference: value.slice(firstColonIndex + 1)
            };
        }
    }

    if (!spriteMapping.defaultSpriteId) {
        return null;
    }

    return {
        spriteId: spriteMapping.defaultSpriteId,
        imageReference: value
    };
}

function tokenStringToExpression(value: string): any {
    const parts: any[] = [];
    const tokenPattern = /\{([^}]+)\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null = null;

    while ((match = tokenPattern.exec(value)) !== null) {
        const literalPart = value.slice(lastIndex, match.index);
        if (literalPart) {
            parts.push(literalPart);
        }

        parts.push(['coalesce', ['to-string', ['get', match[1]]], '']);
        lastIndex = match.index + match[0].length;
    }

    const trailingLiteral = value.slice(lastIndex);
    if (trailingLiteral) {
        parts.push(trailingLiteral);
    }

    if (parts.length === 0) {
        return value;
    }

    if (parts.length === 1) {
        return parts[0];
    }

    return ['concat', ...parts];
}

function prependToStringExpression(prefix: string, value: any): any {
    if (typeof value === 'string') {
        return `${prefix}${value}`;
    }

    if (Array.isArray(value) && value[0] === 'concat') {
        return ['concat', prefix, ...value.slice(1)];
    }

    return ['concat', prefix, value];
}
