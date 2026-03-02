import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getBlockAtlasTexture, getBlockUV } from "@/lib/textures";
import { isItem, ITEM_TYPES } from "@/lib/terrain";

export interface DroppedItem {
  id: number;
  x: number;
  y: number;
  z: number;
  velY: number;
  blockType: number;
  age: number;
  count: number;
}

let nextId = 0;
export function createDroppedItem(x: number, y: number, z: number, blockType: number): DroppedItem {
  return {
    id: nextId++,
    x: x + 0.5,
    y: y + 0.8,
    z: z + 0.5,
    velY: 3,
    blockType,
    age: 0,
    count: 1,
  };
}

const ITEM_SIZE = 0.3;
const PICKUP_RADIUS = 2.0;
const MERGE_RADIUS = 2.0;
const DESPAWN_TIME = 300;
const DESPAWN_DISTANCE = 20;

const ITEM_TEXTURE_PATHS: Record<number, string> = {
  [ITEM_TYPES.COAL]: '/textures/coal.png',
  [ITEM_TYPES.STICK]: '/textures/stick.webp',
};

const itemTextureCache = new Map<number, THREE.Texture>();

function getItemTexture(itemType: number): THREE.Texture | null {
  if (itemTextureCache.has(itemType)) return itemTextureCache.get(itemType)!;
  const path = ITEM_TEXTURE_PATHS[itemType];
  if (!path) return null;
  const tex = new THREE.TextureLoader().load(path);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  itemTextureCache.set(itemType, tex);
  return tex;
}

function makeItemGeo(blockType: number): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(ITEM_SIZE, ITEM_SIZE, ITEM_SIZE);
  const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute;
  const faceRows: (0 | 1 | 2)[] = [1, 1, 0, 2, 1, 1];
  for (let face = 0; face < 6; face++) {
    const [u0, u1, v0, v1] = getBlockUV(blockType, faceRows[face]);
    const base = face * 4;
    uvAttr.setXY(base + 0, u0, v1);
    uvAttr.setXY(base + 1, u1, v1);
    uvAttr.setXY(base + 2, u0, v0);
    uvAttr.setXY(base + 3, u1, v0);
  }
  uvAttr.needsUpdate = true;
  return geo;
}

interface DroppedItemsProps {
  itemsRef: React.MutableRefObject<DroppedItem[]>;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onPickup: (blockType: number) => void;
  worldRef: React.MutableRefObject<Map<string, number>>;
}

export function DroppedItems({ itemsRef, playerPosRef, onPickup, worldRef }: DroppedItemsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshesRef = useRef<Map<number, THREE.Group>>(new Map());
  const geoCache = useRef<Map<number, THREE.BoxGeometry>>(new Map());

  const atlas = useMemo(() => getBlockAtlasTexture(), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: atlas, roughness: 1, metalness: 0 }), [atlas]);

  const getGeo = (blockType: number) => {
    if (!geoCache.current.has(blockType)) {
      geoCache.current.set(blockType, makeItemGeo(blockType));
    }
    return geoCache.current.get(blockType)!;
  };

  const itemPlaneGeo = useMemo(() => new THREE.PlaneGeometry(ITEM_SIZE, ITEM_SIZE), []);

  const createItemMesh = (blockType: number): THREE.Mesh => {
    if (isItem(blockType)) {
      const tex = getItemTexture(blockType);
      const itemMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 1,
        metalness: 0,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      });
      return new THREE.Mesh(itemPlaneGeo, itemMat);
    }
    return new THREE.Mesh(getGeo(blockType), mat);
  };

  const posKey = (x: number, y: number, z: number) => `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const group = groupRef.current;
    if (!group) return;

    const items = itemsRef.current;
    const playerPos = playerPosRef.current;
    const activeIds = new Set<number>();

    // Merge nearby items of same type
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      for (let j = items.length - 1; j > i; j--) {
        const b = items[j];
        if (a.blockType !== b.blockType) continue;
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        if (dx * dx + dy * dy + dz * dz < MERGE_RADIUS * MERGE_RADIUS) {
          a.count += b.count;
          items.splice(j, 1);
        }
      }
    }

    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      item.age += dt;

      if (item.age > DESPAWN_TIME) {
        items.splice(i, 1);
        continue;
      }

      const pdx = playerPos.x - item.x;
      const pdz = playerPos.z - item.z;
      if (pdx * pdx + pdz * pdz > DESPAWN_DISTANCE * DESPAWN_DISTANCE) {
        items.splice(i, 1);
        continue;
      }

      // Gravity
      item.velY -= 15 * dt;
      const newY = item.y + item.velY * dt;

      const groundKey = posKey(item.x, newY - 0.15, item.z);
      const blockBelow = worldRef.current.get(groundKey);
      if (blockBelow !== undefined && blockBelow !== 0 && blockBelow !== 6) {
        item.y = Math.floor(newY - 0.15) + 1 + ITEM_SIZE / 2;
        item.velY = 0;
      } else {
        item.y = newY;
      }

      if (item.y < -20) {
        items.splice(i, 1);
        continue;
      }

      // Pickup check
      const dx = playerPos.x - item.x;
      const dy = (playerPos.y - 0.8) - item.y;
      const dz = playerPos.z - item.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < PICKUP_RADIUS && item.age > 0.5) {
        for (let c = 0; c < item.count; c++) {
          onPickup(item.blockType);
        }
        items.splice(i, 1);
        continue;
      }

      activeIds.add(item.id);

      const displayCount = item.count >= 3 ? 3 : item.count;

      let itemGroup = meshesRef.current.get(item.id);
      if (!itemGroup || (itemGroup as any).__displayCount !== displayCount) {
        if (itemGroup) {
          group.remove(itemGroup);
        }
        itemGroup = new THREE.Group();
        (itemGroup as any).__displayCount = displayCount;
        const offsets = displayCount === 1
          ? [[0, 0, 0]]
          : displayCount === 2
            ? [[-0.08, 0, -0.08], [0.08, 0.06, 0.08]]
            : [[-0.1, 0, -0.1], [0.1, 0.05, 0.08], [0, 0.1, -0.05]];
        for (const [ox, oy, oz] of offsets) {
          const m = createItemMesh(item.blockType);
          m.position.set(ox, oy, oz);
          itemGroup.add(m);
        }
        meshesRef.current.set(item.id, itemGroup);
        group.add(itemGroup);
      }
      itemGroup.position.set(item.x, item.y + Math.sin(item.age * 2) * 0.08, item.z);
      itemGroup.rotation.y = item.age * 1.5;
    }

    // Remove old meshes
    for (const [id, mesh] of meshesRef.current) {
      if (!activeIds.has(id)) {
        group.remove(mesh);
        meshesRef.current.delete(id);
      }
    }
  });

  return <group ref={groupRef} />;
}
