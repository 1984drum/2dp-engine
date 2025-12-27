import { entityManager } from '../ecs/EntityManager';
import { Entity, EntityId, Component, Transform, Physics, Collider } from '../ecs/types';
import eventBus from '../core/EventBus';

/**
 * SceneManager.ts
 * Manages level loading, saving, and entity spawning/cleanup.
 */
class SceneManager {
    /**
     * Clear current scene and load from JSON
     */
    loadScene(levelJson: any) {
        entityManager.clear();
        console.log("[SceneManager] Loading level:", levelJson.name);

        // ECS conversion logic for legacy or new format
        if (levelJson.entities) {
            this.loadEcsData(levelJson.entities);
        } else {
            this.convertLegacyToEcs(levelJson);
        }

        eventBus.emit('SCENE_LOADED', levelJson.name);
    }

    private loadEcsData(entities: any[]) {
        entities.forEach(data => {
            const entity = entityManager.createEntity();
            if (data.components) {
                data.components.forEach((c: Component) => {
                    entityManager.addComponent(entity.id, c);
                });
            }
        });
    }

    private convertLegacyToEcs(legacyData: any) {
        console.log("[SceneManager] Converting legacy level data...");
        // 1. Player
        this.spawnPlayer(
            legacyData.metadata?.spawnPoint?.x || 100,
            legacyData.metadata?.spawnPoint?.y || 100
        );

        // 2. Add other entities (Boulders, Enemies, etc.) from metadata
        if (legacyData.metadata?.boulders) {
            legacyData.metadata.boulders.forEach((b: any) => this.spawnBoulder(b));
        }
    }

    spawnPlayer(x: number, y: number) {
        const player = entityManager.createEntity();
        entityManager.addComponent(player.id, { type: 'transform', x, y, rotation: 0 } as Transform);
        entityManager.addComponent(player.id, {
            type: 'physics',
            vx: 0,
            vy: 0,
            mass: 1,
            isStatic: false,
            coyoteTimer: 0,
            jumpBufferTimer: 0,
            isJumping: false,
            jumpProcessed: false
        } as Physics);
        entityManager.addComponent(player.id, { type: 'collider', width: 20, height: 32, isTrigger: false } as Collider);
        entityManager.addComponent(player.id, { type: 'player_control' } as any);
        return player;
    }

    spawnBoulder(data: any) {
        const boulder = entityManager.createEntity();
        entityManager.addComponent(boulder.id, { type: 'transform', x: data.x, y: data.y, rotation: data.rotation || 0 } as Transform);
        entityManager.addComponent(boulder.id, {
            type: 'physics',
            vx: data.vx || 0,
            vy: data.vy || 0,
            mass: data.mass || 1,
            isStatic: false,
            coyoteTimer: 0,
            jumpBufferTimer: 0,
            isJumping: false,
            jumpProcessed: false
        } as Physics);
        entityManager.addComponent(boulder.id, { type: 'collider', width: data.r * 2 || 40, height: data.r * 2 || 40, isTrigger: false } as Collider);
        entityManager.addComponent(boulder.id, { type: 'boulder', r: data.r || 20 } as any);
        return boulder;
    }

    spawnEnemy(data: any) {
        const enemy = entityManager.createEntity();
        entityManager.addComponent(enemy.id, { type: 'transform', x: data.x, y: data.y, rotation: 0 } as Transform);
        entityManager.addComponent(enemy.id, {
            type: 'physics',
            vx: data.vx || 2,
            vy: 0,
            mass: 1,
            isStatic: false,
            coyoteTimer: 0,
            jumpBufferTimer: 0,
            isJumping: false,
            jumpProcessed: false
        } as Physics);
        entityManager.addComponent(enemy.id, { type: 'collider', width: data.width || 32, height: data.height || 32, isTrigger: false } as Collider);
        entityManager.addComponent(enemy.id, { type: 'enemy' } as any);
        return enemy;
    }

    serialize(): any {
        const entities = entityManager.getEntities().map(e => ({
            id: e.id,
            components: Array.from(e.components.values())
        }));
        return { entities };
    }
}

export const sceneManager = new SceneManager();
export default sceneManager;
