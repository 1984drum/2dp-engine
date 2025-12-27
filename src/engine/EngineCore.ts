import kernel from './core/Kernel';
import eventBus from './core/EventBus';
import inputBridge from './core/InputBridge';
import { entityManager } from './ecs/EntityManager';
import { sceneManager } from './managers/SceneManager';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { CollisionSystem } from './systems/CollisionSystem';
import { PlayerControlSystem } from './systems/PlayerControlSystem';
import { ScriptingSystem } from './systems/ScriptingSystem';
import { AnimationSystem } from './systems/AnimationSystem';

/**
 * EngineCore.ts
 * Central entry point for the Headless Engine.
 * Coordinates systems, kernel, and input.
 */
class EngineCore {
    private systems: any[] = [];

    init(checkPixelFn: (x: number, y: number, layer: string) => boolean) {
        console.log("[EngineCore] Initializing modular engine...");

        // Initialize Core Subsystems
        inputBridge.init();

        // Initialize Systems
        this.systems.push(new PlayerControlSystem());
        this.systems.push(new ScriptingSystem(checkPixelFn));
        this.systems.push(new AnimationSystem());
        this.systems.push(new PhysicsSystem());
        this.systems.push(new CollisionSystem(checkPixelFn));

        // Subscribe to Kernel Tick
        kernel.subscribe(this.update);

        eventBus.emit('ENGINE_READY');
    }

    start() {
        kernel.start();
    }

    stop() {
        kernel.stop();
    }

    private update = (dt: number) => {
        const entities = entityManager.getEntities();

        // Run all systems
        for (const system of this.systems) {
            system.update(dt, entities);
        }

        // Final frame cleanup or syncing
        eventBus.emit('ENGINE_TICK_COMPLETE', { dt, entityCount: entities.length });
    };

    /**
     * Editor/UI Command Bridge
     */
    loadLevel(levelData: any) {
        sceneManager.loadScene(levelData);
    }

    serialize(): any {
        return sceneManager.serialize();
    }

    getPlayerEntity() {
        return entityManager.query(['player_control'])[0];
    }

    getEntitiesByComponent(componentType: string) {
        return entityManager.query([componentType]);
    }

    spawnPlayer(x: number, y: number) {
        return sceneManager.spawnPlayer(x, y);
    }

    spawnBoulder(data: any) {
        return sceneManager.spawnBoulder(data);
    }

    spawnEnemy(data: any) {
        return sceneManager.spawnEnemy(data);
    }
}

export const engineCore = new EngineCore();
export default engineCore;
