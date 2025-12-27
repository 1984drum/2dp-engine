/**
 * Base types for the Entity Component System (ECS)
 */

export type EntityId = string;

export interface Component {
    type: string;
}

export interface Entity {
    id: EntityId;
    components: Map<string, Component>;
}

export abstract class System {
    abstract update(dt: number, entities: Entity[]): void;
}

// Common Component Definitions
export interface Transform extends Component {
    type: 'transform';
    x: number;
    y: number;
    rotation: number;
}

export interface Physics extends Component {
    type: 'physics';
    vx: number;
    vy: number;
    mass: number;
    isStatic: boolean;
    isGrounded?: boolean;
    coyoteTimer: number;    // Leeway for jumping after leaving platform
    jumpBufferTimer: number; // Intent to jump stored before landing
    isJumping: boolean;     // Tracking if currently in a jump arc
    jumpProcessed: boolean; // Prevention of auto-jumping on hold
}

export interface Collider extends Component {
    type: 'collider';
    width: number;
    height: number;
    isTrigger: boolean;
}

export interface Animation extends Component {
    type: 'animation';
    frame: number;
    frameCount: number;
    frameDuration: number;
    timer: number;
}
