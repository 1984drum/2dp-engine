import { Point } from './types';

export const getSlopeColor = (angle: number) => {
    const angleDeg = angle * (180 / Math.PI);
    if (angleDeg > 75) return 'rgba(255, 0, 0, 0.2)';
    const t = Math.min(angleDeg / 60, 1);
    const r = Math.floor(74 + (250 - 74) * t);
    const g = Math.floor(222 + (204 - 222) * t);
    const b = Math.floor(128 + (21 - 128) * t);
    return `rgb(${r}, ${g}, ${b})`;
};

export const getLayerColor = (layer: string) => {
    switch (layer) {
        case 'platform': return '#60a5fa';
        case 'ceiling': return '#c026d3';
        case 'wall': return '#ef4444';
        case 'breakable': return '#9ca3af';
        case 'enemy_wall': return '#06b6d4';
        default: return '#ffffff';
    }
};

export const generateBoulderShape = (radius: number) => {
    const points: Point[] = [];
    const segments = 8;
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const r = radius * (0.8 + Math.random() * 0.4);
        points.push({
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r
        });
    }
    return points;
};

export const getPointOnSpline = (points: Point[], t: number): Point => {
    const i = Math.floor(t);
    const f = t - i;
    if (i >= points.length - 1) return points[points.length - 1];

    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const catmullRom = (v0: number, v1: number, v2: number, v3: number, t: number) => {
        const t2 = t * t;
        const t3 = t2 * t;
        return 0.5 * (
            (2 * v1) +
            (-v0 + v2) * t +
            (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 +
            (-v0 + 3 * v1 - 3 * v2 + v3) * t3
        );
    };

    return {
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, f),
        y: catmullRom(p0.y, p1.y, p2.y, p3.y, f)
    };
};
