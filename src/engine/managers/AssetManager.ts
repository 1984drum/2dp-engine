/**
 * AssetManager.ts
 * Manages the loading and caching of all visual assets.
 */
class AssetManager {
    private images: Map<string, HTMLImageElement> = new Map();

    async loadImage(url: string, id: string): Promise<HTMLImageElement> {
        if (this.images.has(id)) return this.images.get(id)!;

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.images.set(id, img);
                resolve(img);
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    getImage(id: string): HTMLImageElement | undefined {
        return this.images.get(id);
    }
}

export const assetManager = new AssetManager();
export default assetManager;
