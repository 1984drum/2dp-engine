import React, { useRef, useEffect, useState } from 'react';
import { RefreshCw, Paintbrush, Eraser, Move, Image as ImageIcon, Eye, EyeOff, Layers, Check, CircleDashed, Anchor, MousePointer2, Square, Undo, Redo, Circle, X, GripHorizontal, Info, Trash2, MapPin, Flag, Grid, Play, StopCircle, Video, Download, Upload } from 'lucide-react';
import { CameraSystem } from './systems/CameraSystem';
import * as Constants from './constants';
import * as Physics from './systems/PhysicsSystem';
import { Point, SelectionItem, Enemy, Player, Boulder, PlatformState, Particle } from './types';
import { getSlopeColor, getLayerColor, generateBoulderShape, getPointOnSpline } from './utils';

// Destructure common constants for brevity
const {
    GRAVITY, FALL_GRAVITY_MULTIPLIER, JUMP_FORCE, MAX_MOVE_SPEED, ACCELERATION,
    BRAKE_ACCELERATION, FRICTION, AIR_ACCELERATION, AIR_FRICTION, MIN_JUMP_GRAVITY,
    WALL_BOUNCE, MAX_FALL_SPEED, COYOTE_FRAMES, JUMP_BUFFER_FRAMES, SLOPE_CHECK_DIST,
    ANGLE_YELLOW_THRESHOLD, ANGLE_RED_THRESHOLD, MAX_GROUND_ANGLE, WORLD_WIDTH,
    WORLD_HEIGHT, STEP_HEIGHT, BOULDER_FRICTION, BOULDER_SLOPE_ACCEL, PUSH_FORCE,
    DESTRUCTION_SPEED_THRESHOLD, BLOCK_SIZE, PLAYER_WIDTH, PLAYER_HEIGHT,
    DEFAULT_START_X, DEFAULT_START_Y, ASPECT_RATIO, CAMERA_LERP, DEAD_ZONE_W,
    DEAD_ZONE_H, VERTICAL_OFFSET
} = Constants;



const App = () => {
    // --- UI STATE ---
    const [activeLayer, setActiveLayer] = useState<string>('ground');
    const [toolMode, setToolMode] = useState<string>('brush');
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEditingPath, setIsEditingPath] = useState(false);
    const [debugMode, setDebugMode] = useState(false);
    const [brushSize] = useState(4); // Hardcoded to 4px as requested
    const [platformSpeed, setPlatformSpeed] = useState(1.0);
    const [showCollisions, setShowCollisions] = useState(true);
    const [showGrid, setShowGrid] = useState(true);
    const [gridSize, setGridSize] = useState(60);
    const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
        ground: true, wall: true, platform: true, ceiling: true, breakable: true, enemy_wall: true, spawn: true, goal: true
    });
    const [showPaths, setShowPaths] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    const [showWelcome, setShowWelcome] = useState(true);
    const [isPaused, setIsPaused] = useState(true); // Default to paused for editor mode
    const [isRecording, setIsRecording] = useState(false);
    const [isReplaying, setIsReplaying] = useState(false);
    const [replayFrameIndex, setReplayFrameIndex] = useState(0);
    const [projectLevels, setProjectLevels] = useState<string[]>([]);

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, dragging?: boolean, dragOffsetX?: number, dragOffsetY?: number } | null>(null);
    const [selectedItem, setSelectedItem] = useState<SelectionItem | null>(null);
    const [isDraggingItem, setIsDraggingItem] = useState(false);

    const cursorPosRef = useRef<Point>({ x: -100, y: -100 });
    const isHoveringRef = useRef(false);

    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 450 });
    const containerRef = useRef<HTMLDivElement>(null);

    const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
    const [foregroundImage, setForegroundImage] = useState<HTMLImageElement | null>(null);
    const bgTransformRef = useRef({ x: 0, y: 0, scale: 1 });
    const fgTransformRef = useRef({ x: 0, y: 0, scale: 1 });
    const [bgScaleUI, setBgScaleUI] = useState(1);
    const [fgScaleUI, setFgScaleUI] = useState(1);

    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const layerCanvasesRef = useRef<Record<string, HTMLCanvasElement>>({});
    const bgInputRef = useRef<HTMLInputElement>(null);
    const fgInputRef = useRef<HTMLInputElement>(null);

    const historyRef = useRef<any[]>([]);
    const historyIndexRef = useRef(-1);
    const [historyVersion, setHistoryVersion] = useState(0);

    const spawnPointRef = useRef<Point | null>(null);
    const goalPointRef = useRef<Point | null>(null);
    const platformPathRef = useRef<Point[]>([]);
    const draggingPointIndex = useRef(-1);
    const platformBoundsRef = useRef<{ minX: number, minY: number, maxX: number, maxY: number } | null>(null);
    const platformOffsetRef = useRef<Point>({ x: 0, y: 0 });
    const platformStateRef = useRef<PlatformState>({
        t: 0, x: 0, y: 0, vx: 0, vy: 0, active: false, direction: 1
    });

    const bouldersRef = useRef<Boulder[]>([]);
    const enemiesRef = useRef<Enemy[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const playerRef = useRef({
        x: DEFAULT_START_X, y: DEFAULT_START_Y, vx: 0, vy: 0,
        width: PLAYER_WIDTH, height: PLAYER_HEIGHT,
        isGrounded: false, coyoteTimer: 0, onMovingPlatform: false,
        jumpInputReady: true,
        jumpBufferTimer: 0,
        rotation: 0,
        debugSensors: [] as Point[]
    });

    const cameraRef = useRef(new CameraSystem(
        { x: 0, y: 0, targetX: 0, targetY: 0 },
        { deadZoneWidth: DEAD_ZONE_W, deadZoneHeight: DEAD_ZONE_H, lerpFactor: CAMERA_LERP, verticalOffset: VERTICAL_OFFSET }
    ));
    const cameraStateRef = useRef({ x: 0, y: 0 }); // To avoid breaking code that expects cameraRef.current.x
    const isPanningRef = useRef(false);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const recordedFramesRef = useRef<any[]>([]);
    const replayIndexRef = useRef(0);

    const collisionDataRef = useRef<Record<string, Uint8ClampedArray | null>>({
        ground: null, platform: null, wall: null, ceiling: null, breakable: null, enemy_wall: null
    });

    const keysPressed = useRef<Record<string, boolean>>({});
    const lastPoint = useRef<Point | null>(null);
    const isWorldInitializedRef = useRef(false);

    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === containerRef.current) {
                    const contW = entry.contentRect.width;
                    const contH = entry.contentRect.height;

                    let w, h;
                    if (contW / contH > ASPECT_RATIO) {
                        h = contH;
                        w = h * ASPECT_RATIO;
                    } else {
                        w = contW;
                        h = w / ASPECT_RATIO;
                    }
                    // Force strict 16:9 on the canvas element itself via state
                    setCanvasSize({ width: Math.floor(w), height: Math.floor(h) });
                }
            }
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    useEffect(() => {
        const layers = ['ground', 'platform', 'wall', 'ceiling', 'breakable', 'enemy_wall'];
        layers.forEach(layer => {
            if (!layerCanvasesRef.current[layer]) {
                const c = document.createElement('canvas');
                c.width = WORLD_WIDTH; // Support large levels
                c.height = WORLD_HEIGHT;
                layerCanvasesRef.current[layer] = c;
                const ctx = c.getContext('2d', { willReadFrequently: true });
                collisionDataRef.current[layer] = new Uint8ClampedArray(WORLD_WIDTH * WORLD_HEIGHT * 4);
            }
        });
        saveState();
    }, []);


    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
            keysPressed.current[e.code] = true;
        };
        const up = (e: KeyboardEvent) => keysPressed.current[e.code] = false;
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
        };
    }, []);

    const updateCollisionData = (layerName: string) => {
        const ctx = layerCanvasesRef.current[layerName].getContext('2d');
        if (ctx) {
            const imageData = ctx.getImageData(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
            collisionDataRef.current[layerName as keyof typeof collisionDataRef.current] = imageData.data;
        }
    };

    const saveLevel = () => {
        const layers = ['ground', 'platform', 'wall', 'ceiling', 'breakable', 'enemy_wall'];
        const drawingData: Record<string, string> = {};

        layers.forEach(layer => {
            const canvas = layerCanvasesRef.current[layer];
            if (canvas) {
                drawingData[layer] = canvas.toDataURL();
            }
        });

        const levelData = {
            version: "1.0",
            drawingData,
            metadata: {
                spawnPoint: spawnPointRef.current,
                goalPoint: goalPointRef.current,
                boulders: bouldersRef.current,
                enemies: enemiesRef.current,
                platformPath: platformPathRef.current,
                platformOffset: platformOffsetRef.current
            }
        };

        const blob = new Blob([JSON.stringify(levelData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `level_${new Date().getTime()}.2de7`;
        a.click();
        URL.revokeObjectURL(url);
        setNotification("Level exported as .2de7 file");
    };

    const loadLevel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const levelData = JSON.parse(event.target?.result as string);

                // Restore Metadata
                spawnPointRef.current = levelData.metadata.spawnPoint;
                goalPointRef.current = levelData.metadata.goalPoint;
                bouldersRef.current = levelData.metadata.boulders || [];
                enemiesRef.current = levelData.metadata.enemies || [];
                platformPathRef.current = levelData.metadata.platformPath || [];
                platformOffsetRef.current = levelData.metadata.platformOffset || { x: 0, y: 0 };

                // Restore Drawings
                const layers = Object.keys(levelData.drawingData);
                for (const layer of layers) {
                    const canvas = layerCanvasesRef.current[layer];
                    const ctx = canvas?.getContext('2d');
                    if (ctx && levelData.drawingData[layer]) {
                        const img = new Image();
                        img.src = levelData.drawingData[layer];
                        await new Promise((resolve) => {
                            img.onload = () => {
                                ctx?.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
                                ctx?.drawImage(img, 0, 0);
                                updateCollisionData(layer);
                                resolve(null);
                            };
                        });
                    }
                }

                setNotification("Level loaded successfully!");
                isWorldInitializedRef.current = true;
                saveState(); // Update undo history
            } catch (err) {
                console.error("Failed to load level:", err);
                setNotification("Error loading level file.");
            }
        };
        reader.readAsText(file);
    };

    const fetchProjectLevels = async () => {
        try {
            const res = await fetch('/api/levels');
            const data = await res.json();
            setProjectLevels(data);
        } catch (err) {
            console.error("Failed to fetch levels:", err);
        }
    };

    const saveToProject = async () => {
        let name = prompt("Enter level name:");
        if (name === null) return; // User cancelled
        if (name === "") name = `level_${new Date().getTime()}`; // Fallback for empty name

        const layers = ['ground', 'platform', 'wall', 'ceiling', 'breakable', 'enemy_wall'];
        const drawingData: Record<string, string> = {};

        try {
            setNotification(`Preparing "${name}"...`);
            layers.forEach(layer => {
                const canvas = layerCanvasesRef.current[layer];
                if (canvas) {
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    const pix = ctx?.getImageData(0, 0, canvas.width, canvas.height).data;
                    let hasData = false;
                    if (pix) {
                        for (let i = 3; i < pix.length; i += 4) {
                            if (pix[i] > 0) { hasData = true; break; }
                        }
                    }
                    if (hasData) {
                        drawingData[layer] = canvas.toDataURL('image/png');
                    }
                }
            });

            const levelData = {
                version: "1.0",
                drawingData,
                metadata: {
                    spawnPoint: spawnPointRef.current,
                    goalPoint: goalPointRef.current,
                    boulders: bouldersRef.current,
                    enemies: enemiesRef.current,
                    platformPath: platformPathRef.current,
                    platformOffset: platformOffsetRef.current
                }
            };

            const payload = JSON.stringify({ name, data: levelData });
            console.log(`[Save] Attempting to save "${name}". Payload size: ${Math.round(payload.length / 1024)} KB`);

            setNotification(`Sending "${name}" to server...`);
            const res = await fetch('/api/save-level', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            });

            if (res.ok) {
                const result = await res.text();
                if (result.startsWith('fail:')) {
                    throw new Error(result.substring(6));
                }
                console.log(`[Save] Successfully saved "${name}"`);
                setNotification(`Saved "${name}" to project!`);
                await fetchProjectLevels();
            } else {
                const errText = await res.text();
                throw new Error(`Server error (${res.status}): ${errText}`);
            }
        } catch (err: any) {
            console.error("[Save] Error during save process:", err);
            setNotification(`Save failed: ${err.message || 'Unknown error'}`);
        }
    };

    const loadFromProject = async (name: string) => {
        try {
            const res = await fetch(`/api/load-level?name=${name}`);
            const levelData = await res.json();

            spawnPointRef.current = levelData.metadata.spawnPoint;
            goalPointRef.current = levelData.metadata.goalPoint;
            bouldersRef.current = levelData.metadata.boulders || [];
            enemiesRef.current = levelData.metadata.enemies || [];
            platformPathRef.current = levelData.metadata.platformPath || [];
            platformOffsetRef.current = levelData.metadata.platformOffset || { x: 0, y: 0 };

            for (const layer of Object.keys(levelData.drawingData)) {
                const canvas = layerCanvasesRef.current[layer];
                const ctx = canvas?.getContext('2d');
                if (ctx && levelData.drawingData[layer]) {
                    const img = new Image();
                    img.src = levelData.drawingData[layer];
                    await new Promise((resolve) => {
                        img.onload = () => {
                            ctx?.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
                            ctx?.drawImage(img, 0, 0);
                            updateCollisionData(layer);
                            resolve(null);
                        };
                    });
                }
            }
            setNotification(`Loaded level: ${name}`);
            isWorldInitializedRef.current = true;
            setIsDraggingItem(false);
            setSelectedItem(null);
            saveState();
        } catch (err) {
            console.error("Load failed:", err);
            setNotification("Failed to load level from project.");
        }
    };

    useEffect(() => {
        const init = async () => {
            await fetchProjectLevels();
            // Auto-load demo-1 if it exists
            const res = await fetch('/api/levels');
            const levels = await res.json();
            /* 
            if (levels.includes('demo-1')) {
                await loadFromProject('demo-1');
                respawnPlayer();
                setToolMode('brush');
                setIsPaused(false);
                setShowWelcome(false);
            }
            */
        };
        init();
    }, []);

    const spawnDebris = (x: number, y: number, color: string) => {
        for (let i = 0; i < 6; i++) {
            particlesRef.current.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1.0,
                color: color
            });
        }
    };

    const respawnPlayer = () => {
        playerRef.current = {
            ...playerRef.current,
            x: spawnPointRef.current ? spawnPointRef.current.x : DEFAULT_START_X,
            y: spawnPointRef.current ? spawnPointRef.current.y : DEFAULT_START_Y,
            vx: 0,
            vy: 0,
            isGrounded: false,
            coyoteTimer: 0,
            onMovingPlatform: false,
            jumpInputReady: true,
            jumpBufferTimer: 0,
            rotation: 0,
            debugSensors: []
        };
        // Reset camera to player position
        cameraRef.current.reset(playerRef.current.x, playerRef.current.y, canvasSize, { width: WORLD_WIDTH, height: WORLD_HEIGHT });
    };

    const toggleLayerVis = (layer: string) => {
        setVisibleLayers(prev => ({ ...prev, [layer]: !((prev as any)[layer]) }));
    };

    // Improved pointer tracking that updates the ref directly
    const updateCursorPos = (clientX: number, clientY: number) => {
        const canvas = mainCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // Check if within bounds
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
            isHoveringRef.current = true;
            const x = (clientX - rect.left) * scaleX + cameraRef.current.getState().x;
            const y = (clientY - rect.top) * scaleY + cameraRef.current.getState().y;
            cursorPosRef.current = { x, y };
            return { x, y };
        } else {
            isHoveringRef.current = false;
            return { x: -100, y: -100 }; // Return out of bounds
        }
    };

    const getPointerPos = (e: any) => {
        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }
        return updateCursorPos(clientX, clientY);
    };

    const toggleRecording = () => {
        if (isRecording) {
            setIsRecording(false);
            setNotification("Recording stopped");
        } else {
            recordedFramesRef.current = [];
            setIsRecording(true);
            setIsPaused(false);
            setNotification("Recording session...");
        }
        setTimeout(() => setNotification(null), 3000);
    };

    const toggleReplay = () => {
        if (isReplaying) {
            setIsReplaying(false);
            replayIndexRef.current = 0;
            setNotification("Replay stopped");
        } else {
            if (recordedFramesRef.current.length === 0) {
                setNotification("No session recorded yet");
            } else {
                replayIndexRef.current = 0;
                setReplayFrameIndex(0);
                setIsReplaying(true);
                setNotification("Playing back session...");
            }
        }
        setTimeout(() => setNotification(null), 3000);
    };

    const clearRecording = () => {
        recordedFramesRef.current = [];
        setNotification("Session memory cleared");
        setTimeout(() => setNotification(null), 3000);
    };

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const showReminder = () => {
        setNotification("Reminder: Ensure this item connects to a breakable or burnable collision!");
    };

    const saveState = () => {
        const layers = ['ground', 'platform', 'wall', 'ceiling', 'breakable', 'enemy_wall'];
        const layerData: Record<string, ImageData> = {};
        layers.forEach(l => {
            const ctx = layerCanvasesRef.current[l].getContext('2d');
            if (ctx) layerData[l] = ctx.getImageData(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        });

        const snapshot = {
            layerData,
            boulders: JSON.parse(JSON.stringify(bouldersRef.current)),
            platformPath: JSON.parse(JSON.stringify(platformPathRef.current)),
            platformOffset: { ...platformOffsetRef.current },
            platformState: { ...platformStateRef.current },
            platformBounds: platformBoundsRef.current ? { ...platformBoundsRef.current } : null,
            spawnPoint: spawnPointRef.current ? { ...spawnPointRef.current } : null,
            goalPoint: goalPointRef.current ? { ...goalPointRef.current } : null,
            bgTransform: { ...bgTransformRef.current },
            fgTransform: { ...fgTransformRef.current }
        };

        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        newHistory.push(snapshot);
        if (newHistory.length > 8) newHistory.shift();

        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length - 1;
        setHistoryVersion(v => v + 1);
    };

    const undo = () => {
        if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
            restoreState(historyRef.current[historyIndexRef.current]);
            setHistoryVersion(v => v + 1);
        }
    };

    const redo = () => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current++;
            restoreState(historyRef.current[historyIndexRef.current]);
            setHistoryVersion(v => v + 1);
        }
    };

    const restoreState = (state: any) => {
        if (!state) return;
        Object.keys(state.layerData).forEach(l => {
            const ctx = layerCanvasesRef.current[l].getContext('2d');
            if (ctx) {
                ctx.putImageData(state.layerData[l], 0, 0);
                updateCollisionData(l);
            }
        });
        bouldersRef.current = JSON.parse(JSON.stringify(state.boulders));
        platformPathRef.current = JSON.parse(JSON.stringify(state.platformPath));
        platformOffsetRef.current = { ...state.platformOffset };
        platformStateRef.current = { ...state.platformState };
        platformBoundsRef.current = state.platformBounds ? { ...state.platformBounds } : null;
        spawnPointRef.current = state.spawnPoint ? { ...state.spawnPoint } : null;
        goalPointRef.current = state.goalPoint ? { ...state.goalPoint } : null;

        if (state.bgTransform) {
            bgTransformRef.current = { ...state.bgTransform };
            setBgScaleUI(state.bgTransform.scale);
        }
        if (state.fgTransform) {
            fgTransformRef.current = { ...state.fgTransform };
            setFgScaleUI(state.fgTransform.scale);
        }

        if (spawnPointRef.current) respawnPlayer();
        setSelectedItem(null);
        setContextMenu(null);
    };

    const canUndo = historyIndexRef.current > 0;
    const canRedo = historyIndexRef.current < historyRef.current.length - 1;

    const liftConnectedPixels = (startX: number, startY: number, layerName: string) => {
        const ctx = layerCanvasesRef.current[layerName].getContext('2d');
        if (!ctx) return null;
        const imgData = ctx.getImageData(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        const data = imgData.data;
        const w = WORLD_WIDTH;
        const h = WORLD_HEIGHT;

        const startIdx = (Math.floor(startY) * w + Math.floor(startX)) * 4;
        if (data[startIdx + 3] === 0) return null;

        const visited = new Uint8Array(w * h);
        const stack = [[Math.floor(startX), Math.floor(startY)]];
        const chunkPixels = [];
        let minX = w, maxX = 0, minY = h, maxY = 0;

        while (stack.length > 0) {
            const popped = stack.pop();
            if (!popped) continue;
            const [x, y] = popped;
            const idx = y * w + x;
            if (x < 0 || x >= w || y < 0 || y >= h || visited[idx]) continue;

            const pixelIdx = idx * 4;
            if (data[pixelIdx + 3] > 0) {
                visited[idx] = 1;
                chunkPixels.push({ x, y, r: data[pixelIdx], g: data[pixelIdx + 1], b: data[pixelIdx + 2], a: data[pixelIdx + 3] });
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
                stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
            }
        }
        if (chunkPixels.length === 0) return null;

        const chunkW = maxX - minX + 1;
        const chunkH = maxY - minY + 1;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = chunkW;
        offCanvas.height = chunkH;
        const offCtx = offCanvas.getContext('2d');
        if (!offCtx) return null;
        const offImgData = offCtx.createImageData(chunkW, chunkH);

        chunkPixels.forEach(p => {
            const localX = p.x - minX;
            const localY = p.y - minY;
            const i = (localY * chunkW + localX) * 4;
            offImgData.data[i] = p.r;
            offImgData.data[i + 1] = p.g;
            offImgData.data[i + 2] = p.b;
            offImgData.data[i + 3] = p.a;
            const origIdx = (p.y * w + p.x) * 4;
            data[origIdx + 3] = 0;
        });

        offCtx.putImageData(offImgData, 0, 0);
        ctx.putImageData(imgData, 0, 0);
        updateCollisionData(layerName);

        return { layer: layerName, canvas: offCanvas, x: minX, y: minY, width: chunkW, height: chunkH };
    };

    const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const scale = Math.min(canvasSize.width / img.width, canvasSize.height / img.height);
                    const x = (canvasSize.width - img.width * scale) / 2;
                    const y = (canvasSize.height - img.height * scale) / 2;
                    bgTransformRef.current = { x, y, scale };
                    setBgScaleUI(scale);
                    setBackgroundImage(img);
                    saveState();
                };
                if (event.target?.result) img.src = event.target.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleFgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const scale = Math.min(canvasSize.width / img.width, canvasSize.height / img.height);
                    const x = (canvasSize.width - img.width * scale) / 2;
                    const y = (canvasSize.height - img.height * scale) / 2;
                    fgTransformRef.current = { x, y, scale };
                    setFgScaleUI(scale);
                    setForegroundImage(img);
                    saveState();
                };
                if (event.target?.result) img.src = event.target.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleToolChange = (newTool: string) => { setToolMode(newTool); }
    const handleBoulderChange = (key: string, value: string) => {
        if (selectedItem?.type === 'boulder' && selectedItem.index !== undefined && bouldersRef.current[selectedItem.index]) {
            (bouldersRef.current[selectedItem.index] as any)[key] = parseFloat(value);
        }
    };

    const updateImageScale = (type: string, newScale: string) => {
        const numScale = parseFloat(newScale);
        if (type === 'bg' && backgroundImage) {
            bgTransformRef.current.scale = numScale;
            setBgScaleUI(numScale);
        } else if (type === 'fg' && foregroundImage) {
            fgTransformRef.current.scale = numScale;
            setFgScaleUI(numScale);
        }
    };

    const handleMenuMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const menu = target.closest('.context-menu');
        if (!menu) return;
        const rect = menu.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        setContextMenu(prev => prev ? ({ ...prev, dragging: true, dragOffsetX: offsetX, dragOffsetY: offsetY } as any) : null);
    };

    const handleMouseMoveGlobal = (e: any) => {
        if (contextMenu && (contextMenu as any).dragging) {
            if (mainCanvasRef.current?.parentElement) {
                const mainRect = mainCanvasRef.current.parentElement.getBoundingClientRect();
                const x = e.clientX - (contextMenu as any).dragOffsetX - mainRect.left;
                const y = e.clientY - (contextMenu as any).dragOffsetY - mainRect.top;
                setContextMenu(prev => prev ? ({ ...prev, x, y }) : null);
            }
        }

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        if (isPanningRef.current) {
            const dx = clientX - lastMousePosRef.current.x;
            const dy = clientY - lastMousePosRef.current.y;
            cameraRef.current.pan(dx, dy, canvasSize, { width: WORLD_WIDTH, height: WORLD_HEIGHT });
            lastMousePosRef.current = { x: clientX, y: clientY };
            return;
        }

        updateCursorPos(clientX, clientY);

        if (isDrawing && toolMode !== 'select' && toolMode !== 'move_bg' && toolMode !== 'move_fg') {
            // Force draw update on global move for smoother lines
            draw(e);
        }
    };

    const handleMouseUpGlobal = () => {
        if (contextMenu && (contextMenu as any).dragging) {
            setContextMenu(prev => prev ? ({ ...prev, dragging: false } as any) : null);
        }
        if (isPanningRef.current) {
            isPanningRef.current = false;
        }
        stopDrawing();
    };

    const startDrawing = (e: any) => {
        setShowWelcome(false);

        // Middle mouse button for panning
        if (e.button === 1) {
            setIsPaused(true); // Auto-pause for editor feel
            isPanningRef.current = true;
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        let { x, y } = getPointerPos(e);

        // Infinite Start Logic: Lock off world on first draw
        if (!isWorldInitializedRef.current && toolMode !== 'select' && !isPanningRef.current) {
            isWorldInitializedRef.current = true;
            // Center the "world" under the current camera view
            // We want the current view center to map to the center of our internal canvases
            const cam = cameraRef.current.getState();
            const centerX = cam.x + canvasSize.width / 2;
            const centerY = cam.y + canvasSize.height / 2;

            // Calculate shift to put (centerX, centerY) at (WORLD_WIDTH/2, WORLD_HEIGHT/2)
            const shiftX = (WORLD_WIDTH / 2) - centerX;
            const shiftY = (WORLD_HEIGHT / 2) - centerY;

            // Shift camera and all persistent refs
            cameraRef.current.pan(-shiftX, -shiftY, canvasSize, { width: WORLD_WIDTH, height: WORLD_HEIGHT });

            // Re-calculate x,y for the current stroke after the shift
            const newPos = getPointerPos(e);
            x = newPos.x;
            y = newPos.y;
        }

        if (toolMode === 'move_bg') {
            saveState();
            setIsDraggingItem(true);
            lastPoint.current = { x, y };
            return;
        }
        if (toolMode === 'move_fg') {
            saveState();
            setIsDraggingItem(true);
            lastPoint.current = { x, y };
            return;
        }

        if (toolMode === 'select') {
            saveState();
            if (visibleLayers.spawn && spawnPointRef.current && Math.hypot(spawnPointRef.current.x - x, spawnPointRef.current.y - y) < 30) {
                setSelectedItem({ type: 'spawn' });
                setContextMenu({ x: x + 40, y: y - 40 });
                setIsDraggingItem(true);
                return;
            }
            if (visibleLayers.goal && goalPointRef.current && Math.hypot(goalPointRef.current.x - x, goalPointRef.current.y - y) < 30) {
                setSelectedItem({ type: 'goal' });
                setContextMenu({ x: x + 40, y: y - 40 });
                setIsDraggingItem(true);
                return;
            }
            const bIdx = bouldersRef.current.findIndex(b => Math.hypot(b.x - x, b.y - y) < b.r + 5);
            if (bIdx !== -1) {
                setSelectedItem({ type: 'boulder', index: bIdx });
                setContextMenu({ x: x + 40, y: y - 40 });
                setIsDraggingItem(true);
                return;
            }
            if (visibleLayers.platform && activeLayer === 'platform' && platformBoundsRef.current) {
                const ps = platformStateRef.current;
                const off = platformOffsetRef.current;
                const b = platformBoundsRef.current;
                const cx = ps.x + off.x;
                const cy = ps.y + off.y;
                if (x >= cx + b.minX && x <= cx + b.maxX && y >= cy + b.minY && y <= cy + b.maxY) {
                    setSelectedItem({ type: 'platform' });
                    setContextMenu({ x: x + 40, y: y - 40 });
                    setIsDraggingItem(true);
                    return;
                }
            }
            if (['ground', 'wall', 'ceiling', 'breakable', 'enemy_wall'].includes(activeLayer) && visibleLayers[activeLayer]) {
                const chunk = liftConnectedPixels(x, y, activeLayer);
                if (chunk) {
                    setSelectedItem({ type: 'pixel_chunk', ...chunk });
                    setContextMenu({ x: x + 40, y: y - 40 });
                    setIsDraggingItem(true);
                    lastPoint.current = { x: x - chunk.x, y: y - chunk.y };
                    return;
                }
            }
            setSelectedItem(null);
            setContextMenu(null);
            return;
        }

        if (toolMode === 'spawn_place') {
            saveState();
            spawnPointRef.current = { x, y };
            respawnPlayer();
            setToolMode('select');
            return;
        }

        if (toolMode === 'goal_place') {
            saveState();
            goalPointRef.current = { x, y };
            setToolMode('select');
            return;
        }

        if (toolMode === 'boulder_place') {
            saveState();
            const newBoulder: Boulder = { x, y, r: 20, mass: 1.0, vx: 0, vy: 0, rotation: 0, av: 0, shape: generateBoulderShape(20) };
            bouldersRef.current.push(newBoulder);
            const idx = bouldersRef.current.length - 1;
            setSelectedItem({ type: 'boulder', index: idx });
            setContextMenu({ x: x + 40, y: y - 40 });
            setToolMode('select');
            return;
        }

        if (toolMode === 'enemy_place') {
            saveState();
            const newEnemy: Enemy = {
                id: Math.random().toString(36).substr(2, 9),
                x: x - 15,
                y: y - 20,
                vx: 0,
                vy: 0,
                width: 30,
                height: 40,
                isGrounded: false,
                coyoteTimer: 0,
                onMovingPlatform: false,
                direction: 1, // Start Left to Right
                speed: 1.5 + Math.random() * 1.5,
                rotation: 0,
                turnCooldown: 0
            };
            enemiesRef.current.push(newEnemy);
            // Tool stays active to allow multiple drops
            return;
        }

        if (isEditingPath && activeLayer === 'platform') {
            const hitIndex = platformPathRef.current.findIndex(p => Math.hypot(p.x - x, p.y - y) < 15);
            if (hitIndex !== -1) {
                draggingPointIndex.current = hitIndex;
            } else {
                saveState();
                platformPathRef.current.push({ x, y });
                draggingPointIndex.current = platformPathRef.current.length - 1;
            }
            setIsDrawing(true);
            return;
        }

        setIsDrawing(true);
        lastPoint.current = { x, y };
        draw(e);
    };

    const stopDrawing = () => {
        let changed = false;
        if (isDraggingItem && (toolMode === 'move_bg' || toolMode === 'move_fg')) {
            setIsDraggingItem(false);
            changed = true;
        }
        if (isDraggingItem && selectedItem?.type === 'pixel_chunk') {
            const { layer, canvas, x, y } = selectedItem;
            if (layer && canvas && x !== undefined && y !== undefined) {
                const ctx = layerCanvasesRef.current[layer].getContext('2d');
                if (ctx) ctx.drawImage(canvas, x, y);
                updateCollisionData(layer);
            }
            setIsDraggingItem(false);
            changed = true;
        }
        if (activeLayer === 'platform' && toolMode === 'brush') {
            scanPlatformBounds();
        }
        if (isEditingPath && activeLayer === 'platform') {
            draggingPointIndex.current = -1;
            changed = true;
        } else if (isDrawing) {
            ['ground', 'wall', 'platform', 'ceiling', 'breakable', 'enemy_wall'].forEach(l => updateCollisionData(l));
            changed = true;
        }
        setIsDrawing(false);
        setIsDraggingItem(false); // Always reset dragging state to prevent pausing physics
        lastPoint.current = null;
        if (changed) saveState();
    };

    const scanPlatformBounds = () => {
        const ctx = layerCanvasesRef.current['platform'].getContext('2d');
        if (!ctx) return;
        const imgData = ctx.getImageData(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        const data = imgData.data;
        let minX = WORLD_WIDTH, maxX = 0, minY = WORLD_HEIGHT, maxY = 0;
        let found = false;
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            for (let x = 0; x < WORLD_WIDTH; x++) {
                const idx = (y * WORLD_WIDTH + x) * 4;
                if (data[idx + 3] > 0) {
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                    found = true;
                }
            }
        }
        if (found) {
            platformBoundsRef.current = { minX, minY, maxX, maxY };
        } else {
            platformBoundsRef.current = null;
        }
    };

    const draw = (e: any) => {
        const { x, y } = getPointerPos(e);

        if (isDraggingItem && toolMode === 'move_bg') {
            if (lastPoint.current) {
                const dx = x - lastPoint.current.x;
                const dy = y - lastPoint.current.y;
                bgTransformRef.current.x += dx;
                bgTransformRef.current.y += dy;
            }
            lastPoint.current = { x, y };
            return;
        }
        if (isDraggingItem && toolMode === 'move_fg') {
            if (lastPoint.current) {
                const dx = x - lastPoint.current.x;
                const dy = y - lastPoint.current.y;
                fgTransformRef.current.x += dx;
                fgTransformRef.current.y += dy;
            }
            lastPoint.current = { x, y };
            return;
        }

        if (isDraggingItem && selectedItem) {
            if (selectedItem.type === 'boulder' && selectedItem.index !== undefined) {
                const b = bouldersRef.current[selectedItem.index];
                if (b) { b.x = x; b.y = y; b.vx = 0; b.vy = 0; }
            }
            else if (selectedItem.type === 'spawn') {
                spawnPointRef.current = { x, y };
            }
            else if (selectedItem.type === 'goal') {
                goalPointRef.current = { x, y };
            }
            else if (selectedItem.type === 'platform') {
                if (lastPoint.current) {
                    const dx = x - lastPoint.current.x;
                    const dy = y - lastPoint.current.y;
                    platformOffsetRef.current.x += dx;
                    platformOffsetRef.current.y += dy;
                }
                lastPoint.current = { x, y };
            }
            else if (selectedItem.type === 'pixel_chunk') {
                if (lastPoint.current) {
                    const offsetX = lastPoint.current.x;
                    const offsetY = lastPoint.current.y;
                    setSelectedItem((prev: SelectionItem | null) => prev ? ({ ...prev, x: x - offsetX, y: y - offsetY }) : null);
                }
            }
            return;
        }

        if (!isDrawing) return;

        if (activeLayer === 'breakable') {
            const ctx = layerCanvasesRef.current['breakable'].getContext('2d');
            if (ctx) {
                const gx = Math.floor(x / BLOCK_SIZE) * BLOCK_SIZE;
                const gy = Math.floor(y / BLOCK_SIZE) * BLOCK_SIZE;
                ctx.fillStyle = '#9ca3af'; ctx.fillRect(gx, gy, BLOCK_SIZE, BLOCK_SIZE);
                ctx.strokeStyle = '#6b7280'; ctx.strokeRect(gx, gy, BLOCK_SIZE, BLOCK_SIZE);
                lastPoint.current = { x, y };
            }
            return;
        }

        if (activeLayer === 'platform' && toolMode === 'move_platform') {
            if (lastPoint.current) {
                const dx = x - lastPoint.current.x;
                const dy = y - lastPoint.current.y;
                platformOffsetRef.current.x += dx;
                platformOffsetRef.current.y += dy;
                lastPoint.current = { x, y };
            }
            return;
        }

        if (isEditingPath && activeLayer === 'platform') {
            if (draggingPointIndex.current !== -1) {
                platformPathRef.current[draggingPointIndex.current] = { x, y };
            }
            return;
        }

        if (!lastPoint.current) return;

        if (toolMode === 'eraser') {
            const targets = activeLayer === 'platform' ? ['platform'] : ['ground', 'wall', 'ceiling', 'breakable', 'enemy_wall'];
            targets.forEach(layer => {
                const ctx = layerCanvasesRef.current[layer].getContext('2d');
                if (ctx && lastPoint.current) {
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.lineWidth = brushSize;
                    ctx.beginPath();
                    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                    ctx.globalCompositeOperation = 'source-over';
                }
            });
            lastPoint.current = { x, y };
            return;
        }

        const brushCtx = layerCanvasesRef.current[activeLayer].getContext('2d');
        if (!brushCtx) return;
        brushCtx.lineCap = 'round';
        brushCtx.lineJoin = 'round';
        brushCtx.lineWidth = brushSize;

        let targetX = x;
        let targetY = y;

        // Angle Governor for Ground Layer: max 35 degrees
        if (activeLayer === 'ground' && lastPoint.current) {
            const dx = x - lastPoint.current.x;
            const dy = y - lastPoint.current.y;
            const maxAngle = 35 * (Math.PI / 180);
            const maxDragY = Math.abs(dx) * Math.tan(maxAngle);

            if (Math.abs(dy) > maxDragY) {
                targetY = lastPoint.current.y + Math.sign(dy) * maxDragY;
            }

            const finalDx = Math.abs(targetX - lastPoint.current.x);
            const finalDy = Math.abs(targetY - lastPoint.current.y);
            const angle = Math.atan2(finalDy, finalDx);
            brushCtx.strokeStyle = getSlopeColor(angle);
        } else {
            brushCtx.strokeStyle = getLayerColor(activeLayer);
        }

        if (lastPoint.current) {
            const p1 = lastPoint.current;
            const p2 = { x: targetX, y: targetY };
            const midPoint = {
                x: p1.x + (p2.x - p1.x) / 2,
                y: p1.y + (p2.y - p1.y) / 2
            };

            brushCtx.beginPath();
            brushCtx.moveTo(p1.x, p1.y);
            brushCtx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
            brushCtx.lineTo(midPoint.x, midPoint.y);
            brushCtx.stroke();

            lastPoint.current = midPoint;
        }
    };

    const clearLayer = () => {
        saveState();
        if (activeLayer === 'platform') {
            const ctx = layerCanvasesRef.current['platform'].getContext('2d');
            if (ctx) ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
            updateCollisionData('platform');
            platformPathRef.current = [];
            platformStateRef.current.active = false;
            platformBoundsRef.current = null;
            platformOffsetRef.current = { x: 0, y: 0 };
            setIsEditingPath(true);
        } else {
            const ctx = layerCanvasesRef.current[activeLayer].getContext('2d');
            if (ctx) ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
            updateCollisionData(activeLayer);
        }
    };

    const confirmPath = () => {
        setIsEditingPath(false);
        if (platformPathRef.current.length > 1) {
            platformStateRef.current.active = true;
            platformStateRef.current.t = 0;
            platformStateRef.current.direction = 1;
        }
    };

    const destroyBreakable = (x: number, y: number) => {
        const gx = Math.floor(x / BLOCK_SIZE) * BLOCK_SIZE;
        const gy = Math.floor(y / BLOCK_SIZE) * BLOCK_SIZE;
        const ctx = layerCanvasesRef.current['breakable'].getContext('2d');
        if (ctx) {
            ctx.clearRect(gx, gy, BLOCK_SIZE, BLOCK_SIZE);
            updateCollisionData('breakable');
            spawnDebris(gx + BLOCK_SIZE / 2, gy + BLOCK_SIZE / 2, '#9ca3af');
        }
    };

    const destroyBreakableChain = (startX: number, startY: number) => {
        const visited = new Set<string>();
        const queue: { x: number; y: number }[] = [];
        const ctx = layerCanvasesRef.current['breakable'].getContext('2d');
        if (!ctx) return;
        const startGx = Math.floor(startX / BLOCK_SIZE) * BLOCK_SIZE;
        const startGy = Math.floor(startY / BLOCK_SIZE) * BLOCK_SIZE;

        queue.push({ x: startGx, y: startGy });
        visited.add(`${startGx},${startGy}`);

        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) continue;
            const { x, y } = item;
            ctx.clearRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
            spawnDebris(x + BLOCK_SIZE / 2, y + BLOCK_SIZE / 2, '#9ca3af');

            const neighbors = [
                { dx: BLOCK_SIZE, dy: 0 }, { dx: -BLOCK_SIZE, dy: 0 },
                { dx: 0, dy: BLOCK_SIZE }, { dx: 0, dy: -BLOCK_SIZE },
                { dx: BLOCK_SIZE, dy: BLOCK_SIZE }, { dx: -BLOCK_SIZE, dy: BLOCK_SIZE },
                { dx: BLOCK_SIZE, dy: -BLOCK_SIZE }, { dx: -BLOCK_SIZE, dy: -BLOCK_SIZE }
            ];

            for (let n of neighbors) {
                const nx = x + n.dx;
                const ny = y + n.dy;
                const key = `${nx},${ny}`;
                if (!visited.has(key)) {
                    const pixel = ctx.getImageData(nx + BLOCK_SIZE / 2, ny + BLOCK_SIZE / 2, 1, 1).data;
                    if (pixel[3] > 0) {
                        visited.add(key);
                        queue.push({ x: nx, y: ny });
                    }
                }
            }
        }
        updateCollisionData('breakable');
    };

    const updateBoulders = () => {
        const boulders = bouldersRef.current;
        const p = playerRef.current;
        boulders.forEach((b, index) => {
            b.vy += GRAVITY * b.mass;
            if (b.vy > MAX_FALL_SPEED) b.vy = MAX_FALL_SPEED;
            b.vx *= BOULDER_FRICTION;
            const checkSideCollision = (sideOffset: number) => {
                const checkX = b.x + sideOffset + b.vx;
                const scanPoints = [b.y, b.y - b.r * 0.5, b.y + b.r * 0.5];
                for (let scanY of scanPoints) {
                    if (checkPixel(checkX, scanY, 'wall') || checkPixel(checkX, scanY, 'breakable')) {
                        if (Math.abs(b.vx) > DESTRUCTION_SPEED_THRESHOLD) {
                            const lookAhead = sideOffset > 0 ? 5 : -5;
                            if (checkPixel(checkX + lookAhead, scanY, 'breakable')) {
                                destroyBreakableChain(checkX + lookAhead, scanY);
                                spawnDebris(b.x, b.y, '#57534e');
                                (b as any).destroyed = true;
                                return true;
                            }
                        }
                        b.vx *= -0.5;
                        return true;
                    }
                }
                return false;
            };
            if (!checkSideCollision(b.r) && !checkSideCollision(-b.r)) { b.x += b.vx; }
            let onGround = false;
            const groundCheckY = Math.floor(b.y + b.r);
            for (let i = 0; i < 10; i++) {
                if (checkPixel(b.x, groundCheckY + i, 'ground') || checkPixel(b.x, groundCheckY + i, 'platform')) {
                    b.y = groundCheckY + i - b.r;
                    b.vy = 0;
                    onGround = true;
                    const y1 = getSurfaceHeight(b.x - 5, b.y + b.r, 'ground') || (b.y + b.r);
                    const y2 = getSurfaceHeight(b.x + 5, b.y + b.r, 'ground') || (b.y + b.r);
                    const rise = y2 - y1;
                    const slopeAngle = Math.atan2(rise, 10);
                    b.vx += Math.sin(slopeAngle) * BOULDER_SLOPE_ACCEL;
                    b.rotation += b.vx * 0.1;
                    break;
                }
            }
            if (!onGround) { b.y += b.vy; b.rotation += b.vx * 0.05; }
            const dx = (p.x + p.width / 2) - b.x;
            const dy = (p.y + p.height / 2) - b.y;
            const dist = Math.hypot(dx, dy);
            const minDist = b.r + Math.max(p.width, p.height) / 2;
            if (dist < minDist) {
                const playerToLeft = (p.x + p.width / 2) < b.x;
                const pushingInto = (playerToLeft && p.vx > 0) || (!playerToLeft && p.vx < 0);
                if (pushingInto) {
                    const force = p.vx * PUSH_FORCE * (1 / b.mass);
                    b.vx += force;
                    p.vx *= 0.3;
                    if (playerToLeft) { p.x = b.x - b.r - p.width; } else { p.x = b.x + b.r; }
                }
            }
        });
        if (boulders.some(b => b.destroyed)) { bouldersRef.current = boulders.filter(b => !b.destroyed); }
    };

    const updateParticles = () => {
        particlesRef.current.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.05; });
        particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    };

    const solveCatmullRom = (p0: number, p1: number, p2: number, p3: number, t: number) => {
        const t2 = t * t; const t3 = t2 * t;
        const v0 = (p2 - p0) * 0.5; const v1 = (p3 - p1) * 0.5;
        return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
    };

    const getPointOnSpline = (path: Point[], tCombined: number) => {
        if (path.length < 2) return path[0];
        let t = Math.max(0, Math.min(path.length - 1, tCombined));
        const p1Idx = Math.floor(t);
        const p2Idx = Math.min(path.length - 1, p1Idx + 1);
        const p0Idx = Math.max(0, p1Idx - 1);
        const p3Idx = Math.min(path.length - 1, p2Idx + 1);
        const localT = t - p1Idx;
        const x = solveCatmullRom(path[p0Idx].x, path[p1Idx].x, path[p2Idx].x, path[p3Idx].x, localT);
        const y = solveCatmullRom(path[p0Idx].y, path[p1Idx].y, path[p2Idx].y, path[p3Idx].y, localT);
        return { x, y };
    };

    const updatePlatformMovement = () => {
        const ps = platformStateRef.current;
        const path = platformPathRef.current;
        if (isEditingPath || !ps.active || path.length < 2) { ps.vx = 0; ps.vy = 0; return; }
        const maxT = path.length - 1;
        const distFromEdge = Math.min(ps.t, maxT - ps.t);
        let ease = Math.min(1, distFromEdge / 0.5);
        ease = Math.max(0.05, ease);
        const speed = 0.02 * platformSpeed * ease;
        ps.t += speed * ps.direction;
        if (ps.t >= maxT) { ps.t = maxT; ps.direction = -1; } else if (ps.t <= 0) { ps.t = 0; ps.direction = 1; }
        const newPos = getPointOnSpline(path, ps.t);
        const startPoint = path[0];
        const targetAbsX = newPos.x - startPoint.x;
        const targetAbsY = newPos.y - startPoint.y;
        ps.vx = targetAbsX - ps.x;
        ps.vy = targetAbsY - ps.y;
        ps.x = targetAbsX; ps.y = targetAbsY;
    };

    const checkPixel = (x: number, y: number, layerName: string) => {
        let lookupX = x;
        let lookupY = y;
        if (layerName === 'platform') {
            lookupX -= (platformStateRef.current.x + platformOffsetRef.current.x);
            lookupY -= (platformStateRef.current.y + platformOffsetRef.current.y);
        }
        const data = collisionDataRef.current[layerName as keyof typeof collisionDataRef.current];
        if (!data) return false;
        const ix = Math.floor(lookupX);
        const iy = Math.floor(lookupY);
        if (ix < 0 || ix >= WORLD_WIDTH || iy < 0 || iy >= WORLD_HEIGHT) return false;
        const index = (iy * WORLD_WIDTH + ix) * 4;
        return data[index + 3] > 100;
    };

    const getSurfaceHeight = (x: number, startY: number, layer: string) => {
        for (let i = -15; i < 15; i++) {
            if (checkPixel(x, startY + i, layer) && !checkPixel(x, startY + i - 1, layer)) { return startY + i; }
        }
        return null;
    };

    const updateCamera = () => {
        cameraRef.current.update(
            { x: playerRef.current.x, y: playerRef.current.y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT },
            canvasSize,
            { width: WORLD_WIDTH, height: WORLD_HEIGHT }
        );
    };

    const updatePhysics = () => {
        const p = playerRef.current;
        const ps = platformStateRef.current;
        const keys = keysPressed.current;
        p.debugSensors = [];

        if (p.onMovingPlatform && p.isGrounded) { p.x += ps.vx; p.y += ps.vy; }

        const isLeft = keys['ArrowLeft'] || keys['KeyA'];
        const isRight = keys['ArrowRight'] || keys['KeyD'];
        const isJumping = keys['Space'] || keys['ArrowUp'] || keys['KeyW'];

        // --- JUMP INPUT & BUFFERING ---
        if (!p.jumpInputReady && !isJumping) p.jumpInputReady = true;
        if (p.jumpInputReady && isJumping) {
            p.jumpBufferTimer = JUMP_BUFFER_FRAMES;
            p.jumpInputReady = false;
        }

        // --- HORIZONTAL MOVEMENT ---
        const currentAccel = p.isGrounded ? ACCELERATION : AIR_ACCELERATION;
        const currentBrake = p.isGrounded ? BRAKE_ACCELERATION : (AIR_ACCELERATION * 3.5);
        const currentFriction = p.isGrounded ? FRICTION : AIR_FRICTION;

        if (isLeft) {
            if (p.vx > 0) p.vx -= currentBrake;
            else if (p.vx > -MAX_MOVE_SPEED) p.vx -= currentAccel;
        } else if (isRight) {
            if (p.vx < 0) p.vx += currentBrake;
            else if (p.vx < MAX_MOVE_SPEED) p.vx += currentAccel;
        } else {
            p.vx *= currentFriction;
            if (Math.abs(p.vx) < 0.5) p.vx = 0;
        }

        if (!isReplaying && Math.abs(p.vx) > MAX_MOVE_SPEED * 2) p.vx = Math.sign(p.vx) * MAX_MOVE_SPEED * 2;

        // --- VERTICAL MOVEMENT (GRAVITY) ---
        let appliedGravity = GRAVITY;
        if (p.vy < 0 && isJumping) appliedGravity = MIN_JUMP_GRAVITY;
        else if (p.vy > 0) appliedGravity *= FALL_GRAVITY_MULTIPLIER;

        p.vy += appliedGravity;
        if (p.vy < 0 && !isJumping) p.vy *= 0.65;
        if (p.vy > MAX_FALL_SPEED) p.vy = MAX_FALL_SPEED;

        // --- UNIFIED COLLISION STEPS ---
        const steps = Math.ceil(Math.abs(p.vx));
        const stepSize = steps > 0 ? p.vx / steps : 0;
        const deps = { checkPixel, getSurfaceHeight };

        // X Collision
        Physics.updateHorizontalCollisions(p, stepSize, steps, deps, false);

        // Y Movement & Ceiling
        p.y += p.vy;
        if (p.vy < 0) Physics.checkCeilingCollision(p, deps);

        // Grounding & slopes
        const g = Physics.updateGrounding(p, deps, p.onMovingPlatform, { vx: ps.vx, vy: ps.vy });

        if (g.groundedThisFrame && Math.abs(g.slopeAngle) > 0.05) {
            const slopeFactor = (Math.abs(g.slopeAngle) / ANGLE_RED_THRESHOLD);
            const movingRight = p.vx > 0.1;
            const movingLeft = p.vx < -0.1;
            const rise = Math.tan(g.slopeAngle) * (SLOPE_CHECK_DIST * 2);

            let isDownhill = (movingRight && rise > 0) || (movingLeft && rise < 0);
            let isUphill = (movingRight && rise < 0) || (movingLeft && rise > 0);

            if (isDownhill) {
                const momentum = slopeFactor * 1.5;
                if (movingRight) p.vx += momentum; else p.vx -= momentum;
                const dsMax = MAX_MOVE_SPEED * (1 + slopeFactor * 0.6);
                if (Math.abs(p.vx) > dsMax) p.vx = Math.sign(p.vx) * dsMax;
            } else if (isUphill) {
                p.vx *= (1 - slopeFactor * 0.45);
                const usCap = MAX_MOVE_SPEED * (1 - slopeFactor * 0.82);
                if (Math.abs(p.vx) > usCap) p.vx = Math.sign(p.vx) * usCap;
            }
        }

        // Execute Jump
        if (p.jumpBufferTimer > 0 && (p.isGrounded || p.coyoteTimer > 0)) {
            p.vy = JUMP_FORCE;
            p.isGrounded = false;
            p.coyoteTimer = 0;
            p.jumpBufferTimer = 0;
            p.onMovingPlatform = false;
            p.jumpInputReady = false;
        }

        if (p.jumpBufferTimer > 0) p.jumpBufferTimer--;
        if (p.y > WORLD_HEIGHT) respawnPlayer();
    };

    const updateEnemyPhysics = () => {
        const enemies = enemiesRef.current;
        const ps = platformStateRef.current;
        if (isPaused || isReplaying) return;

        enemies.forEach(en => {
            if (en.turnCooldown > 0) en.turnCooldown--;

            // Horizontal Movement (Patrol)
            en.vx = en.direction * en.speed;

            // Apply Gravity
            en.vy += GRAVITY;
            if (en.vy > MAX_FALL_SPEED) en.vy = MAX_FALL_SPEED;

            // --- UNIFIED COLLISION STEPS ---
            const steps = Math.ceil(Math.abs(en.vx));
            const stepSize = steps > 0 ? en.vx / steps : 0;
            const deps = { checkPixel, getSurfaceHeight };

            // X Movement & Wall/EnemyWall collision
            const hitWall = Physics.updateHorizontalCollisions(en, stepSize, steps, deps, true);

            if (hitWall && en.turnCooldown === 0) {
                en.direction *= -1;
                en.turnCooldown = 15;
                en.vx = 0;
            }

            // Y Movement & Ceiling
            en.y += en.vy;
            if (en.vy < 0) Physics.checkCeilingCollision(en, deps);

            // Grounding & slopes (same as player)
            const g = Physics.updateGrounding(en, deps, en.onMovingPlatform, { vx: ps.vx, vy: ps.vy });

            // Edge Detection
            if (g.groundedThisFrame && en.turnCooldown === 0) {
                const lookAheadX = en.direction > 0 ? en.x + en.width + 1 : en.x - 1;
                if (lookAheadX < 0 || lookAheadX >= WORLD_WIDTH) {
                    en.direction *= -1;
                    en.turnCooldown = 20;
                } else {
                    let hasGround = false;
                    const feetY = Math.floor(en.y + en.height);
                    for (let y = feetY - 2; y < feetY + 15; y++) {
                        if (checkPixel(lookAheadX, y, 'ground') || checkPixel(lookAheadX, y, 'platform')) {
                            hasGround = true;
                            break;
                        }
                    }
                    if (!hasGround) {
                        en.direction *= -1;
                        en.turnCooldown = 30; // Solid turn
                    }
                }
            }

            if (en.y > WORLD_HEIGHT) (en as any).removed = true;
        });

        if (enemies.some(e => (e as any).removed)) {
            enemiesRef.current = enemies.filter(e => !(e as any).removed);
        }
    };

    useEffect(() => {
        let animationFrameId: number;
        const loop = () => {
            if (isReplaying) {
                const frame = recordedFramesRef.current[replayIndexRef.current];
                if (frame) {
                    playerRef.current.x = frame.px;
                    playerRef.current.y = frame.py;
                    // Replay uses direct state sync
                    const cam = cameraRef.current;
                    cam.reset(frame.px, frame.py, canvasSize, { width: WORLD_WIDTH, height: WORLD_HEIGHT });
                    (cam as any).state.x = frame.cx;
                    (cam as any).state.y = frame.cy;
                    replayIndexRef.current++;
                    setReplayFrameIndex(replayIndexRef.current);
                } else {
                    setIsReplaying(false);
                    replayIndexRef.current = 0;
                }
            } else if (draggingPointIndex.current === -1 && !isDraggingItem && !isPaused) {
                updatePlatformMovement();
                updateBoulders();
                updateParticles();
                updateEnemyPhysics();
                if (spawnPointRef.current) {
                    updatePhysics();
                    updateCamera();
                }

                if (isRecording) {
                    recordedFramesRef.current.push({
                        px: playerRef.current.x,
                        py: playerRef.current.y,
                        cx: cameraRef.current.getState().x,
                        cy: cameraRef.current.getState().y
                    });
                }
            }
            drawFrame();
            animationFrameId = requestAnimationFrame(loop);
        };
        animationFrameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationFrameId);
    }, [visibleLayers, showPaths, backgroundImage, foregroundImage, isEditingPath, debugMode, activeLayer, toolMode, platformSpeed, selectedItem, contextMenu, isDraggingItem, showCollisions, showGrid, gridSize, bgScaleUI, fgScaleUI, canvasSize, isRecording, isReplaying, isPaused]);

    const deleteSelectedItem = () => {
        saveState();
        if (selectedItem?.type === 'boulder' && selectedItem.index !== undefined) {
            bouldersRef.current.splice(selectedItem.index, 1);
        } else if (selectedItem?.type === 'platform') {
            const ctx = layerCanvasesRef.current['platform'].getContext('2d');
            if (ctx) ctx.clearRect(0, 0, 2560, 1440);

            updateCollisionData('platform');
            platformPathRef.current = [];
            platformStateRef.current.active = false;
            platformBoundsRef.current = null;
            platformOffsetRef.current = { x: 0, y: 0 };
            setIsEditingPath(false);
        }
        setSelectedItem(null);
        setContextMenu(null);
    };

    const closeContextMenu = () => {
        setContextMenu(null);
        setSelectedItem(null);
        showReminder();
    };

    const resetGame = () => {
        spawnPointRef.current = null;
        goalPointRef.current = null;
        bouldersRef.current = [];
        particlesRef.current = [];
        platformPathRef.current = [];
        platformStateRef.current = { t: 0, x: 0, y: 0, vx: 0, vy: 0, active: false, direction: 1 };
        platformBoundsRef.current = null;
        platformOffsetRef.current = { x: 0, y: 0 };
        setBackgroundImage(null);
        setForegroundImage(null);
        setIsEditingPath(false);
        setShowWelcome(true);
        bgTransformRef.current = { x: 0, y: 0, scale: 1 };
        fgTransformRef.current = { x: 0, y: 0, scale: 1 };
        ['ground', 'platform', 'wall', 'ceiling', 'breakable', 'enemy_wall'].forEach(l => {
            const ctx = layerCanvasesRef.current[l].getContext('2d');
            if (ctx) ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
            collisionDataRef.current[l as keyof typeof collisionDataRef.current] = new Uint8ClampedArray(WORLD_WIDTH * WORLD_HEIGHT * 4);
        });
        enemiesRef.current = [];
        historyRef.current = [];
        historyIndexRef.current = -1;
        saveState();
    };

    const drawFrame = () => {
        const canvas = mainCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const cam = cameraRef.current.getState();

        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

        ctx.save();
        ctx.translate(-cam.x, -cam.y);

        if (backgroundImage) {
            const { x, y, scale } = bgTransformRef.current;
            const w = backgroundImage.width * scale;
            const h = backgroundImage.height * scale;
            ctx.drawImage(backgroundImage, x, y, w, h);
        }

        if (showGrid) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.setLineDash([2, 4]);
            ctx.lineWidth = 1;
            // Draw infinite grid in world space based on camera view
            const startX = Math.floor(cam.x / gridSize) * gridSize;
            const endX = cam.x + canvasSize.width;
            for (let x = startX; x <= endX; x += gridSize) {
                ctx.moveTo(x, cam.y);
                ctx.lineTo(x, cam.y + canvasSize.height);
            }

            const startY = Math.floor(cam.y / gridSize) * gridSize;
            const endY = cam.y + canvasSize.height;
            for (let y = startY; y <= endY; y += gridSize) {
                ctx.moveTo(cam.x, y);
                ctx.lineTo(cam.x + canvasSize.width, y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (showCollisions) {
            const layers = ['ground', 'wall', 'ceiling', 'breakable', 'enemy_wall'] as const;
            layers.forEach(layer => {
                if (!visibleLayers[layer]) return;
                const layerCanvas = layerCanvasesRef.current[layer];
                if (layerCanvas) ctx.drawImage(layerCanvas, 0, 0);
            });
            if (visibleLayers.platform) {
                const ps = platformStateRef.current;
                const off = platformOffsetRef.current;
                const platCanvas = layerCanvasesRef.current['platform'];
                if (platCanvas) {
                    ctx.save();
                    ctx.translate(ps.x + off.x, ps.y + off.y);
                    ctx.drawImage(platCanvas, 0, 0);
                    if (activeLayer === 'platform' && platformBoundsRef.current) {
                        const b = platformBoundsRef.current;
                        const isSelected = selectedItem?.type === 'platform';
                        ctx.strokeStyle = (toolMode === 'select' && isSelected) || toolMode === 'move_platform' ? '#facc15' : 'rgba(250, 204, 21, 0.4)';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([4, 4]);
                        ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
                        ctx.setLineDash([]);
                    }
                    ctx.restore();
                }
            }
        }


        particlesRef.current.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillRect(p.x, p.y, 4, 4);
            ctx.globalAlpha = 1.0;
        });

        bouldersRef.current.forEach((b, idx) => {
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(b.rotation);
            ctx.beginPath();
            if (b.shape && b.shape.length > 0) {
                ctx.moveTo(b.shape[0].x, b.shape[0].y);
                for (let i = 1; i < b.shape.length; i++) ctx.lineTo(b.shape[i].x, b.shape[i].y);
                ctx.closePath();
            } else {
                ctx.arc(0, 0, b.r, 0, Math.PI * 2);
            }
            const grad = ctx.createRadialGradient(-b.r / 3, -b.r / 3, b.r / 10, 0, 0, b.r);
            grad.addColorStop(0, '#9ca3af');
            grad.addColorStop(1, '#4b5563');
            ctx.fillStyle = grad;
            ctx.fill();
            const isSelected = selectedItem?.type === 'boulder' && selectedItem.index === idx;
            if (isSelected) {
                ctx.lineWidth = 2; ctx.strokeStyle = '#facc15'; ctx.stroke();
            } else {
                ctx.lineWidth = 1; ctx.strokeStyle = '#1f2937'; ctx.stroke();
            }
            ctx.restore();
        });

        // Draw Enemies
        enemiesRef.current.forEach(en => {
            ctx.save();
            ctx.translate(en.x, en.y);

            // Draw Enemy Body (Purple Capsule/Rectangle)
            ctx.fillStyle = '#9333ea'; // Purple
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(0, 0, en.width, en.height, 8);
            } else {
                ctx.rect(0, 0, en.width, en.height);
            }
            ctx.fill();

            // Draw Eyes/Direction
            ctx.fillStyle = '#fff';
            const eyeX = en.direction > 0 ? en.width - 10 : 5;
            ctx.fillRect(eyeX, 8, 5, 5);

            ctx.restore();
        });

        if (visibleLayers.spawn && spawnPointRef.current) {
            const spawn = spawnPointRef.current;
            const isSpawnSelected = selectedItem?.type === 'spawn';

            // Draw actual player at their position
            const p = playerRef.current;
            ctx.save();
            ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
            ctx.rotate(p.rotation);
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
            // Eyes/Front indicator
            ctx.fillStyle = '#fff';
            const faceDir = p.vx !== 0 ? Math.sign(p.vx) : 1;
            ctx.fillRect(faceDir > 0 ? (p.width / 2 - 8) : (-p.width / 2 + 3), -5, 5, 5);
            ctx.restore();

            // Draw Spawn Marker
            ctx.strokeStyle = isSpawnSelected ? '#facc15' : '#ef4444';
            ctx.lineWidth = 2;
            ctx.strokeRect(spawn.x, spawn.y, PLAYER_WIDTH, PLAYER_HEIGHT);
            ctx.fillStyle = isSpawnSelected ? '#facc15' : '#ef4444';
            ctx.font = '10px monospace';
            ctx.fillText('SPAWN', spawn.x, spawn.y - 5);
        }

        if (visibleLayers.goal && goalPointRef.current) {
            const goal = goalPointRef.current;
            const isGoalSelected = selectedItem?.type === 'goal';
            ctx.save();
            ctx.translate(goal.x, goal.y);
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(15, -10); ctx.lineTo(0, -20);
            ctx.fill();
            ctx.strokeStyle = isGoalSelected ? '#fff' : '#a16207';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -30); ctx.stroke();
            ctx.restore();
        }

        if (activeLayer === 'platform' && platformPathRef.current.length > 0 && showPaths) {
            const path = platformPathRef.current;
            ctx.beginPath();
            if (path.length < 2) { ctx.moveTo(path[0].x, path[0].y); }
            else {
                const steps = path.length * 20; const maxT = path.length - 1;
                for (let i = 0; i <= steps; i++) {
                    const t = (i / steps) * maxT;
                    const pt = getPointOnSpline(path, t);
                    if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
                }
            }
            ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            if (isEditingPath) {
                const time = Date.now() * 0.005;
                const r = Math.floor(100 + 100 * Math.sin(time));
                const g = Math.floor(200 + 55 * Math.sin(time + 2));
                ctx.strokeStyle = `rgb(${r}, ${g}, 255)`;
                ctx.setLineDash([10, 10]);
                ctx.lineDashOffset = -Date.now() * 0.02;
                ctx.stroke();
                ctx.setLineDash([]);
                path.forEach((pt, idx) => {
                    ctx.fillStyle = idx === 0 ? '#4ade80' : '#60a5fa';
                    ctx.beginPath(); ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
                });
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.setLineDash([]); ctx.stroke();
            }
        }

        if (spawnPointRef.current) {
            const p = playerRef.current;
            ctx.fillStyle = 'white';
            let scaleX = 1; let scaleY = 1;
            if (Math.abs(p.vy) > 2) { scaleX = 0.9; scaleY = 1.1; }
            if (Math.abs(p.vx) > 3) { scaleX = 1.1; scaleY = 0.9; }

            ctx.save();
            ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
            ctx.scale(scaleX, scaleY);
            ctx.beginPath(); ctx.ellipse(0, 0, p.width / 2, p.height / 2, 0, 0, 2 * Math.PI); ctx.fill();
            ctx.restore();

            if (debugMode && showCollisions) {
                ctx.fillStyle = '#0000ff';
                ctx.fillRect(p.x, p.y + 5, 2, 2); ctx.fillRect(p.x + p.width, p.y + 5, 2, 2);
                p.debugSensors.forEach(s => {
                    ctx.fillStyle = s.hit ? '#00ff00' : '#ff0000';
                    ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, Math.PI * 2); ctx.fill();
                });
            }
        }

        if (foregroundImage) {
            const { x, y, scale } = fgTransformRef.current;
            const w = foregroundImage.width * scale;
            const h = foregroundImage.height * scale;
            ctx.drawImage(foregroundImage, x, y, w, h);
        }

        ctx.restore();

        // ALWAYS RENDER CURSOR ON TOP
        if (isHoveringRef.current && !contextMenu?.dragging) {
            const cx = cursorPosRef.current.x - cam.x;
            const cy = cursorPosRef.current.y - cam.y;

            ctx.font = '10px sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            let labelText = '';

            if (toolMode === 'brush') {
                labelText = `Painting ${activeLayer.charAt(0).toUpperCase() + activeLayer.slice(1)}`;
                if (activeLayer === 'ground') {
                    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, brushSize, 0, Math.PI * 2); ctx.stroke();
                } else if (activeLayer === 'wall') {
                    ctx.fillStyle = '#ef4444'; ctx.fillRect(cx - brushSize, cy - brushSize * 2, brushSize * 2, brushSize * 4);
                } else if (activeLayer === 'platform') {
                    ctx.fillStyle = '#60a5fa'; ctx.fillRect(cx - brushSize * 3, cy - brushSize, brushSize * 6, brushSize * 2);
                } else if (activeLayer === 'breakable') {
                    ctx.fillStyle = '#9ca3af'; ctx.fillRect(cx - 10, cy - 10, 20, 20); ctx.strokeStyle = '#fff'; ctx.strokeRect(cx - 10, cy - 10, 20, 20);
                } else if (activeLayer === 'ceiling') {
                    ctx.fillStyle = '#c026d3'; ctx.fillRect(cx - brushSize * 2, cy - brushSize, brushSize * 4, brushSize * 2);
                }
            } else if (toolMode === 'eraser') {
                labelText = "Erasing";
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, brushSize, 0, Math.PI * 2); ctx.stroke();
            } else if (toolMode === 'select') {
                labelText = "Select / Move";
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 12, cy + 12); ctx.lineTo(cx + 6, cy + 12); ctx.lineTo(cx + 9, cy + 18); ctx.lineTo(cx + 6, cy + 19); ctx.lineTo(cx + 3, cy + 13); ctx.lineTo(cx, cy + 16); ctx.fill();
            } else if (toolMode === 'boulder_place') {
                labelText = "Place Boulder";
                ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
            } else if (toolMode === 'spawn_place') {
                labelText = "Set Spawn";
                ctx.fillStyle = 'rgba(250, 204, 21, 0.5)'; ctx.beginPath(); ctx.arc(cx, cy - 10, 10, 0, Math.PI * 2); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + 10); ctx.fill(); ctx.stroke();
            } else if (toolMode === 'goal_place') {
                labelText = "Set Goal";
                ctx.fillStyle = 'rgba(251, 146, 60, 0.5)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 15, cy - 10); ctx.lineTo(cx, cy - 20); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 30); ctx.stroke();
            } else if (toolMode === 'move_bg') {
                labelText = "Move Background";
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();
            } else if (toolMode === 'move_fg') {
                labelText = "Move Foreground";
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();
            }
            ctx.fillText(labelText, cx - 20, cy - 25);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-neutral-900 text-white font-sans select-none overflow-hidden"
            onMouseMove={handleMouseMoveGlobal} onMouseUp={handleMouseUpGlobal}>

            {notification && (
                <div className="fixed top-14 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white px-4 py-2 rounded shadow-xl flex items-center gap-2 animate-bounce z-50">
                    <Info size={16} /> {notification}
                </div>
            )}

            {/* TOP BAR */}
            <div className="h-14 shrink-0 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between px-4 z-30 shadow-md">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 font-bold text-lg bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        2D ENGINE V7
                    </div>
                    <div className="h-6 w-px bg-neutral-700"></div>
                    <div className="flex gap-1">
                        <button onClick={undo} disabled={!canUndo} className={`p-2 rounded transition-all ${canUndo ? 'hover:bg-neutral-700 text-white' : 'text-neutral-600 cursor-not-allowed'}`} title="Undo"><Undo size={18} /></button>
                        <button onClick={redo} disabled={!canRedo} className={`p-2 rounded transition-all ${canRedo ? 'hover:bg-neutral-700 text-white' : 'text-neutral-600 cursor-not-allowed'}`} title="Redo"><Redo size={18} /></button>
                    </div>

                    <div className="h-6 w-px bg-neutral-700 mx-2"></div>

                    <div className="flex gap-1">
                        <button onClick={saveToProject} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-all shadow-lg" title="Save current level to project folder">
                            <Download size={16} /> Save to Project
                        </button>
                    </div>

                    <div className="h-6 w-px bg-neutral-700 mx-2"></div>

                    <div className="flex gap-1">
                        <button onClick={saveLevel} className="flex items-center gap-2 px-3 py-1.5 text-neutral-400 hover:bg-neutral-700 hover:text-white rounded text-sm transition-colors" title="Export Level as .2de7 file">
                            Export
                        </button>
                        <label className="flex items-center gap-2 px-3 py-1.5 text-neutral-400 hover:bg-neutral-700 hover:text-white rounded text-sm transition-colors cursor-pointer" title="Import Level from .2de7 file">
                            Import
                            <input type="file" accept=".2de7" className="hidden" onChange={loadLevel} />
                        </label>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex gap-1 p-1 bg-neutral-900 rounded-lg">
                        <button onClick={() => setToolMode('select')} className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm transition-all ${toolMode === 'select' ? 'bg-neutral-700 text-white shadow-inner' : 'text-neutral-500 hover:text-white'}`}>
                            <MousePointer2 size={16} /> Select
                        </button>
                        <button onClick={() => setToolMode('brush')} className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm transition-all ${toolMode === 'brush' ? 'bg-neutral-700 text-white shadow-inner' : 'text-neutral-500 hover:text-white'}`}>
                            <Paintbrush size={16} /> Brush
                        </button>
                        <button onClick={() => setToolMode('eraser')} className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm transition-all ${toolMode === 'eraser' ? 'bg-red-900/50 text-red-200 ring-1 ring-red-500/50' : 'text-neutral-500 hover:text-white'}`}>
                            <Eraser size={16} /> Eraser
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 border-l border-neutral-700 ml-1 pl-4 mr-1">
                    <button
                        onClick={toggleRecording}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-all ${isRecording ? 'bg-red-600/20 text-red-400 border border-red-500/50 blink' : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'}`}
                        title={isRecording ? "Stop Recording" : "Record Session"}
                    >
                        {isRecording ? <StopCircle size={16} /> : <Video size={16} />}
                        {isRecording ? "STOP" : "RECORD"}
                    </button>

                    <button
                        onClick={toggleReplay}
                        disabled={isRecording || recordedFramesRef.current.length === 0}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-all ${isReplaying ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50' : 'text-neutral-300 hover:bg-neutral-700 hover:text-white disabled:opacity-30'}`}
                        title={isReplaying ? "Stop Replay" : "Watch Replay"}
                    >
                        {isReplaying ? <StopCircle size={16} /> : <Play size={16} />}
                        {isReplaying ? "STOP" : "WATCH REPLAY"}
                    </button>

                    {recordedFramesRef.current.length > 0 && !isRecording && !isReplaying && (
                        <button onClick={clearRecording} className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors" title="Clear Recording">
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => setIsPaused(!isPaused)} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-all ${isPaused ? 'bg-orange-600/20 text-orange-400 border border-orange-500/50 hover:bg-orange-600/30' : 'bg-green-600/20 text-green-400 border border-green-500/50 hover:bg-green-600/30'}`}>
                        {isPaused ? <MapPin size={16} /> : <RefreshCw size={16} />} {isPaused ? 'PAUSED (Editor)' : 'RUNNING (Game)'}
                    </button>
                    <button onClick={resetGame} className="flex items-center gap-2 px-3 py-1.5 text-neutral-300 hover:bg-neutral-700 hover:text-white rounded text-sm transition-colors">
                        <RefreshCw size={16} /> Reset
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* SIDE BAR */}
                <div className="w-64 shrink-0 bg-neutral-800 border-r border-neutral-700 flex flex-col p-4 gap-4 overflow-y-auto z-20 shadow-xl">

                    <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Layers</h3>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { id: 'ground', label: 'Ground', color: 'bg-green-400', activeColor: 'bg-green-900/80 border-green-500' },
                                { id: 'wall', label: 'Wall', color: 'bg-red-400', activeColor: 'bg-red-900/80 border-red-500' },
                                { id: 'platform', label: 'Platform', color: 'bg-blue-400', activeColor: 'bg-blue-900/80 border-blue-500' },
                                { id: 'breakable', label: 'Breakable', color: 'bg-gray-400', activeColor: 'bg-gray-700/80 border-gray-500' },
                                { id: 'ceiling', label: 'Ceiling', color: 'bg-fuchsia-600', activeColor: 'bg-fuchsia-900/80 border-fuchsia-500' },
                                { id: 'enemy_wall', label: 'Enemy Walls', color: 'bg-cyan-500', activeColor: 'bg-cyan-900/80 border-cyan-500' },
                            ].map(l => (
                                <div key={l.id} className={`relative flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${activeLayer === l.id ? l.activeColor : 'bg-neutral-900/50 border-transparent hover:bg-neutral-700'}`} onClick={() => { setActiveLayer(l.id); setToolMode('brush'); }}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 ${l.color} rounded-sm shadow-sm`}></div>
                                        <span className="text-xs font-medium">{l.label}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); toggleLayerVis(l.id); }} className={`hover:text-white transition-colors ${visibleLayers[l.id] ? 'text-neutral-500' : 'text-red-500'}`}>
                                        {visibleLayers[l.id] ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-neutral-700/50"></div>

                    <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Interactive Items</h3>
                        <div className="grid grid-cols-1 gap-2">
                            <div className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${toolMode === 'spawn_place' ? 'bg-yellow-900/80 border-yellow-500' : 'bg-neutral-900/50 border-transparent hover:bg-neutral-700'}`} onClick={() => setToolMode('spawn_place')}>
                                <div className="flex items-center gap-2">
                                    <MapPin size={14} className="text-yellow-400" />
                                    <span className="text-xs font-medium">Spawn Point</span>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); toggleLayerVis('spawn'); }} className={`hover:text-white ${visibleLayers.spawn ? 'text-neutral-500' : 'text-red-500'}`}>
                                    {visibleLayers.spawn ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                            </div>

                            <div className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${toolMode === 'goal_place' ? 'bg-orange-900/80 border-orange-500' : 'bg-neutral-900/50 border-transparent hover:bg-neutral-700'}`} onClick={() => setToolMode('goal_place')}>
                                <div className="flex items-center gap-2">
                                    <Flag size={14} className="text-orange-400" />
                                    <span className="text-xs font-medium">Goal Point</span>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); toggleLayerVis('goal'); }} className={`hover:text-white ${visibleLayers.goal ? 'text-neutral-500' : 'text-red-500'}`}>
                                    {visibleLayers.goal ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                            </div>

                            <div className={`flex items-center p-2 rounded border cursor-pointer transition-all ${toolMode === 'boulder_place' ? 'bg-purple-900/80 border-purple-500' : 'bg-neutral-900/50 border-transparent hover:bg-neutral-700'}`} onClick={() => setToolMode('boulder_place')}>
                                <div className="flex items-center gap-2">
                                    <Circle size={14} className="text-purple-400" />
                                    <span className="text-xs font-medium">Boulder</span>
                                </div>
                            </div>

                            <div className={`flex items-center p-2 rounded border cursor-pointer transition-all ${toolMode === 'enemy_place' ? 'bg-indigo-900/80 border-indigo-500' : 'bg-neutral-900/50 border-transparent hover:bg-neutral-700'}`} onClick={() => setToolMode('enemy_place')}>
                                <div className="flex items-center gap-2">
                                    <Square size={14} className="text-indigo-400" />
                                    <span className="text-xs font-medium">Enemy</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-neutral-700/50"></div>

                    <div className="flex flex-col gap-3 flex-1 min-h-0">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Level Library</h3>
                            <button onClick={fetchProjectLevels} className="text-neutral-500 hover:text-white" title="Refresh projects">
                                <RefreshCw size={12} />
                            </button>
                        </div>
                        <div className="flex flex-col gap-1 overflow-y-auto pr-1 custom-scrollbar">
                            {projectLevels.length === 0 ? (
                                <div className="text-[10px] text-neutral-600 italic p-2 text-center bg-neutral-900/30 rounded border border-dashed border-neutral-700">
                                    No levels found in project folder.
                                </div>
                            ) : (
                                projectLevels.map(name => (
                                    <div key={name} className="group flex items-center justify-between p-2 rounded bg-neutral-900/50 hover:bg-neutral-700 transition-all border border-transparent hover:border-neutral-600">
                                        <span className="text-xs truncate max-w-[120px]" title={name}>{name}</span>
                                        <button
                                            onClick={() => loadFromProject(name)}
                                            className="px-2 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white text-[10px] rounded transition-all opacity-0 group-hover:opacity-100 font-bold"
                                        >
                                            LOAD
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="h-px bg-neutral-700/50"></div>

                    <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Canvas Settings</h3>
                        <div className="flex flex-col gap-2 p-3 bg-neutral-900/50 rounded-lg border border-neutral-700/50">
                            <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2">
                                    <Grid size={14} className="text-neutral-400" />
                                    <span className="text-xs font-medium text-neutral-300">Grid Overlay</span>
                                </div>
                                <button onClick={() => setShowGrid(!showGrid)} className={`transition-colors ${showGrid ? 'text-blue-400' : 'text-neutral-600'}`}>
                                    {showGrid ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                            </div>
                            {showGrid && (
                                <div className="mt-1">
                                    <input type="range" min="20" max="100" step="10" value={gridSize} onChange={(e) => setGridSize(parseInt(e.target.value))} className="w-full accent-blue-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer" />
                                    <div className="text-[10px] text-right text-neutral-500 mt-1">{gridSize}px</div>
                                </div>
                            )}
                        </div>

                    </div>

                    <div className="mt-auto flex flex-col gap-2 pt-4">
                        <button onClick={clearLayer} className="flex items-center justify-center gap-2 p-2 text-red-400 hover:bg-neutral-700 rounded text-sm transition-colors border border-red-900/30">
                            <Trash2 size={16} /> Clear Active Layer
                        </button>
                    </div>
                </div>

                {/* MAIN CONTENT AREA */}
                <div ref={containerRef} className="flex-1 relative bg-black overflow-hidden shadow-inner flex items-center justify-center">
                    <div
                        style={{ width: canvasSize.width, height: canvasSize.height }}
                        className={`relative shadow-2xl overflow-hidden ${toolMode === 'eraser' ? 'cursor-cell' : toolMode === 'move_platform' ? 'cursor-move' : toolMode === 'boulder_place' || toolMode === 'spawn_place' || toolMode === 'goal_place' ? 'cursor-crosshair' : toolMode === 'select' ? 'cursor-default' : 'cursor-crosshair'}`}
                    >
                        <canvas
                            ref={mainCanvasRef}
                            width={canvasSize.width}
                            height={canvasSize.height}
                            onMouseDown={startDrawing}
                            onMouseMove={handleMouseMoveGlobal}
                            onMouseUp={handleMouseUpGlobal}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className="block"
                        />

                        {showWelcome && (
                            <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-neutral-800/95 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 border border-neutral-600 animate-in fade-in slide-in-from-top-4 duration-500 z-40">
                                <span className="text-sm font-medium">✨ Ready to build? Start drawing terrain or place items!</span>
                                <button onClick={() => setShowWelcome(false)} className="text-neutral-400 hover:text-white transition-colors"><X size={16} /></button>
                            </div>
                        )}

                        {contextMenu && (
                            <div
                                id="context-menu"
                                className="absolute bg-neutral-800/95 backdrop-blur border border-neutral-600 rounded-xl shadow-2xl z-40 w-52 context-menu animate-in zoom-in-95 duration-150"
                                style={{ left: contextMenu.x, top: contextMenu.y }}
                            >
                                <div
                                    className="bg-neutral-700/50 p-2.5 rounded-t-xl flex justify-between items-center cursor-move border-b border-neutral-600"
                                    onMouseDown={handleMenuMouseDown}
                                >
                                    <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-tighter flex gap-2 items-center">
                                        <GripHorizontal size={12} />
                                        {selectedItem?.type === 'boulder' ? 'Boulder' :
                                            selectedItem?.type === 'platform' ? 'Platform' :
                                                selectedItem?.type === 'spawn' ? 'Spawn Point' :
                                                    selectedItem?.type === 'goal' ? 'Goal Point' :
                                                        selectedItem?.type === 'pixel_chunk' ? 'SelectionItem' : 'Item'}
                                    </span>
                                    <div className="flex gap-1">
                                        {selectedItem?.type !== 'spawn' && selectedItem?.type !== 'goal' && (
                                            <button onClick={deleteSelectedItem} className="p-1 text-red-400 hover:bg-neutral-600 rounded transition-colors" title="Delete"><Trash2 size={12} /></button>
                                        )}
                                        <button onClick={closeContextMenu} className="p-1 text-neutral-400 hover:bg-neutral-600 rounded transition-colors"><X size={12} /></button>
                                    </div>
                                </div>

                                <div className="p-4">
                                    {selectedItem?.type === 'boulder' && (
                                        <div className="flex flex-col gap-3">
                                            <div>
                                                <label className="text-[10px] text-neutral-400 block mb-1.5 uppercase font-bold">Radius</label>
                                                <input type="range" min="10" max="100" value={(selectedItem.index !== undefined && bouldersRef.current[selectedItem.index]?.r) || 20} onChange={(e) => handleBoulderChange('r', e.target.value)} className="w-full h-1 accent-purple-500 bg-neutral-700 rounded-lg appearance-none cursor-pointer" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-neutral-400 block mb-1.5 uppercase font-bold">Mass</label>
                                                <input type="range" min="0.1" max="10" step="0.1" value={(selectedItem.index !== undefined && bouldersRef.current[selectedItem.index]?.mass) || 1} onChange={(e) => handleBoulderChange('mass', e.target.value)} className="w-full h-1 accent-purple-500 bg-neutral-700 rounded-lg appearance-none cursor-pointer" />
                                            </div>
                                        </div>
                                    )}

                                    {selectedItem?.type === 'platform' && (
                                        <div className="flex flex-col gap-3">
                                            <div>
                                                <label className="text-[10px] text-neutral-400 block mb-1.5 uppercase font-bold">Speed</label>
                                                <input type="range" min="0.1" max="10.0" step="0.1" value={platformSpeed} onChange={(e) => setPlatformSpeed(parseFloat(e.target.value))} className="w-full h-1 accent-blue-500 bg-neutral-700 rounded-lg appearance-none cursor-pointer" />
                                            </div>
                                            <button onClick={() => { setIsEditingPath(!isEditingPath); closeContextMenu(); }} className="w-full mt-1 text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg">
                                                <Move size={14} /> {isEditingPath ? 'Finish Path' : 'Edit Path'}
                                            </button>
                                        </div>
                                    )}

                                    {selectedItem?.type === 'spawn' && (
                                        <div className="flex flex-col gap-3">
                                            <div className="text-[10px] text-neutral-400 text-center italic">Drag to reposition.</div>
                                            <button onClick={() => { respawnPlayer(); closeContextMenu(); }} className="w-full text-xs font-bold bg-yellow-600 hover:bg-yellow-500 text-white py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg">
                                                <RefreshCw size={14} /> Respawn Player
                                            </button>
                                        </div>
                                    )}

                                    {selectedItem?.type === 'goal' && (
                                        <div className="text-[10px] text-neutral-400 text-center italic">Drag flag to set the exit goal.</div>
                                    )}

                                    {selectedItem?.type === 'pixel_chunk' && (
                                        <div className="text-[10px] text-neutral-400 text-center italic">
                                            Repositioning drawn {selectedItem.layer} content.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="absolute bottom-4 left-4 pointer-events-none bg-black/40 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono text-neutral-400 border border-neutral-700/50">
                            VIEWPORT: {canvasSize.width}x{canvasSize.height} | ACTIVE: {activeLayer.toUpperCase()}
                        </div>
                        {isEditingPath && (<div className="absolute top-4 right-4 bg-blue-600/90 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold shadow-2xl animate-pulse flex items-center gap-2 border border-blue-400/50 z-40"><Move size={14} /> PATH EDIT MODE: CLICK TO ADD NODES, DRAG TO MOVE</div>)}
                    </div>
                </div>
            </div>

            {/* BOTTOM BAR */}
            <div className="h-12 shrink-0 bg-neutral-800 border-t border-neutral-700 flex items-center justify-between px-4 z-30">
                <div className="flex items-center gap-6">
                    <button onClick={() => setShowCollisions(!showCollisions)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showCollisions ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-neutral-500 hover:text-neutral-300'}`}>
                        {showCollisions ? <Eye size={14} /> : <EyeOff size={14} />} COLLISION VIEW
                    </button>
                    <div className="h-4 w-px bg-neutral-700"></div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                        DEBUG: {debugMode ? 'ON' : 'OFF'}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                        <div className="relative">
                            <button onClick={() => bgInputRef.current?.click()} className={`flex items-center gap-2 px-3 py-1 text-xs rounded-lg border transition-all ${backgroundImage ? 'bg-neutral-700 text-white border-blue-500/50' : 'bg-neutral-900/50 text-neutral-500 border-neutral-700 hover:text-white hover:bg-neutral-800'}`}>
                                <ImageIcon size={14} /> {backgroundImage ? 'CHANGE BG' : 'UPLOAD BG'}
                            </button>
                            {backgroundImage && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setToolMode(toolMode === 'move_bg' ? 'select' : 'move_bg'); }}
                                    className={`absolute -top-1 -right-1 p-1 rounded-full border shadow-lg ${toolMode === 'move_bg' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-neutral-700 border-neutral-600 text-neutral-300'}`}
                                >
                                    <Move size={8} />
                                </button>
                            )}
                        </div>

                        <div className="relative">
                            <button onClick={() => fgInputRef.current?.click()} className={`flex items-center gap-2 px-3 py-1 text-xs rounded-lg border transition-all ${foregroundImage ? 'bg-neutral-700 text-white border-blue-500/50' : 'bg-neutral-900/50 text-neutral-500 border-neutral-700 hover:text-white hover:bg-neutral-800'}`}>
                                <Layers size={14} /> {foregroundImage ? 'CHANGE FG' : 'UPLOAD FG'}
                            </button>
                            {foregroundImage && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setToolMode(toolMode === 'move_fg' ? 'select' : 'move_fg'); }}
                                    className={`absolute -top-1 -right-1 p-1 rounded-full border shadow-lg ${toolMode === 'move_fg' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-neutral-700 border-neutral-600 text-neutral-300'}`}
                                >
                                    <Move size={8} />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="h-6 w-px bg-neutral-700"></div>
                </div>
            </div>

            <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
            <input ref={fgInputRef} type="file" accept="image/*" onChange={handleFgUpload} className="hidden" />
        </div>
    );
};


export default App;
