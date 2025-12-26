export interface Point {
    x: number;
    y: number;
    hit?: boolean;
}

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

export interface Enemy {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    width: number;
    height: number;
    isGrounded: boolean;
    coyoteTimer: number;
    onMovingPlatform: boolean;
    direction: number;
    speed: number;
    rotation: number;
    turnCooldown: number;
}

export interface Boulder {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    mass: number;
    shape: Point[];
    rotation: number;
    av: number;
    destroyed?: boolean;
}

export interface PlatformState {
    t: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    active: boolean;
    direction: number;
}

export interface SelectionItem {
    type: string;
    index?: number;
    layer?: string;
    [key: string]: any;
}

export interface Player {
    x: number;
    y: number;
    vx: number;
    vy: number;
    width: number;
    height: number;
    isGrounded: boolean;
    coyoteTimer: number;
    onMovingPlatform: boolean;
    jumpInputReady: boolean;
    jumpBufferTimer: number;
    rotation: number;
    debugSensors: Point[];
}
