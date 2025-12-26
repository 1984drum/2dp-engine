// --- PHYSICS CONSTANTS ---
export const GRAVITY = 0.82;
export const FALL_GRAVITY_MULTIPLIER = 2.15;
export const JUMP_FORCE = -9.8;
export const MAX_MOVE_SPEED = 9;
export const ACCELERATION = 1.4;
export const BRAKE_ACCELERATION = 3.6;
export const FRICTION = 0.72; // Increased traction (lower value = faster stop)
export const AIR_ACCELERATION = 0.8;
export const AIR_FRICTION = 0.98;
export const MIN_JUMP_GRAVITY = 0.38;
export const WALL_BOUNCE = 0.0;
export const MAX_FALL_SPEED = 15;
export const COYOTE_FRAMES = 10;
export const JUMP_BUFFER_FRAMES = 8; // Leeway for early jump presses
export const SLOPE_CHECK_DIST = 5;
export const ANGLE_YELLOW_THRESHOLD = 45 * (Math.PI / 180);
export const ANGLE_RED_THRESHOLD = 60 * (Math.PI / 180);
export const MAX_GROUND_ANGLE = 75 * (Math.PI / 180);
export const WORLD_WIDTH = 6400;
export const WORLD_HEIGHT = 3600;
export const STEP_HEIGHT = 16;

// --- BOULDER CONSTANTS ---
export const BOULDER_FRICTION = 0.96;
export const BOULDER_SLOPE_ACCEL = 0.5;
export const PUSH_FORCE = 0.3;
export const DESTRUCTION_SPEED_THRESHOLD = 2.5;
export const BLOCK_SIZE = 20;

// --- PLAYER CONSTANTS ---
export const PLAYER_WIDTH = 24;
export const PLAYER_HEIGHT = 32;
export const DEFAULT_START_X = 100;
export const DEFAULT_START_Y = 100;

// --- CAMERA CONSTANTS ---
export const ASPECT_RATIO = 16 / 9;
export const CAMERA_LERP = 0.08;
export const DEAD_ZONE_W = 120;
export const DEAD_ZONE_H = 80;
export const VERTICAL_OFFSET = -40;

// --- LAYERS ---
export const LAYERS = ['ground', 'platform', 'wall', 'ceiling', 'breakable', 'enemy_wall'] as const;
export type LayerName = typeof LAYERS[number];
