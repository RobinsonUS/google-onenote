import { useEffect, useRef, useState, useCallback, memo } from "react";
import * as THREE from "three";
import { WorldData, BLOCK_TYPES, posKey } from "@/lib/terrain";
import { getBlockAtlasTexture, getBlockUV } from "@/lib/textures";

const CHUNK_SIZE = 8;
const MAX_Y = 18;

interface ChunkedVoxelWorldProps {
  world: WorldData;
  version: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
  lastModifiedBlock?: React.MutableRefObject<{ x: number; y: number; z: number } | null>;
}

// Face directions and corner data as flat arrays for speed
const FACE_DIR = [
  0, 1, 0,   // top
  0,-1, 0,   // bottom
  1, 0, 0,   // right
 -1, 0, 0,   // left
  0, 0, 1,   // front
  0, 0,-1,   // back
];
const FACE_CORNERS = [
  // top
  0,1,1, 1,1,1, 1,1,0, 0,1,0,
  // bottom
  0,0,0, 1,0,0, 1,0,1, 0,0,1,
  // right
  1,0,0, 1,1,0, 1,1,1, 1,0,1,
  // left
  0,0,1, 0,1,1, 0,1,0, 0,0,0,
  // front
  1,0,1, 1,1,1, 0,1,1, 0,0,1,
  // back
  0,0,0, 0,1,0, 1,1,0, 1,0,0,
];
const FACE_UV_ROW: (0|1|2)[] = [0, 2, 1, 1, 1, 1];
const FACE_SHADE = [1.0, 0.5, 0.8, 0.8, 0.7, 0.7];

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

function getChunkCoord(worldCoord: number): number {
  return Math.floor(worldCoord / CHUNK_SIZE);
}

// Fast inline key - avoid string alloc in hot path by using numeric hash
function numKey(x: number, y: number, z: number): number {
  return ((x + 512) * 131072) + ((z + 512) * 64) + y;
}

function buildChunkMesh(world: WorldData, cx: number, cz: number): THREE.BufferGeometry | null {
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  const x1 = x0 + CHUNK_SIZE;
  const z1 = z0 + CHUNK_SIZE;

  // Build a local fast-lookup map for this chunk + 1-block border
  const localBlocks = new Map<number, number>();
  for (let x = x0 - 1; x <= x1; x++) {
    for (let z = z0 - 1; z <= z1; z++) {
      for (let y = 0; y <= MAX_Y; y++) {
        const bt = world.get(posKey(x, y, z));
        if (bt !== undefined && bt !== BLOCK_TYPES.AIR) {
          localBlocks.set(numKey(x, y, z), bt);
        }
      }
    }
  }

  // Single pass: count faces and collect visible block data
  let faceCount = 0;
  const entries: number[] = []; // packed as [x, y, z, blockType, ...faceFlags]

  for (let x = x0; x < x1; x++) {
    for (let z = z0; z < z1; z++) {
      for (let y = 0; y <= MAX_Y; y++) {
        const nk = numKey(x, y, z);
        const blockType = localBlocks.get(nk);
        if (blockType === undefined) continue;

        let blockFaces = 0;
        for (let f = 0; f < 6; f++) {
          const fi3 = f * 3;
          const neighbor = localBlocks.get(numKey(x + FACE_DIR[fi3], y + FACE_DIR[fi3+1], z + FACE_DIR[fi3+2]));
          const nb = neighbor ?? 0; // AIR = 0
          if (nb !== 0 && nb !== BLOCK_TYPES.LEAVES) continue;
          if (blockType === BLOCK_TYPES.LEAVES && nb === BLOCK_TYPES.LEAVES) continue;
          blockFaces++;
        }
        if (blockFaces > 0) {
          entries.push(x, y, z, blockType);
          faceCount += blockFaces;
        }
      }
    }
  }

  if (faceCount === 0) return null;

  const positions = new Float32Array(faceCount * 4 * 3);
  const normals   = new Float32Array(faceCount * 4 * 3);
  const uvs       = new Float32Array(faceCount * 4 * 2);
  const colors    = new Float32Array(faceCount * 4 * 3);
  const indices   = faceCount * 4 < 65536 ? new Uint16Array(faceCount * 6) : new Uint32Array(faceCount * 6);
  let vi = 0, fi = 0;

  for (let e = 0; e < entries.length; e += 4) {
    const x = entries[e], y = entries[e+1], z = entries[e+2], blockType = entries[e+3];
    for (let f = 0; f < 6; f++) {
      const fi3 = f * 3;
      const dx = FACE_DIR[fi3], dy = FACE_DIR[fi3+1], dz = FACE_DIR[fi3+2];
      const neighbor = localBlocks.get(numKey(x + dx, y + dy, z + dz)) ?? 0;
      if (neighbor !== 0 && neighbor !== BLOCK_TYPES.LEAVES) continue;
      if (blockType === BLOCK_TYPES.LEAVES && neighbor === BLOCK_TYPES.LEAVES) continue;

      const shade = FACE_SHADE[f];
      const [u0, u1, v0, v1] = getBlockUV(blockType, FACE_UV_ROW[f]);
      const vOffset = vi;
      const cornerBase = f * 12;

      for (let ci = 0; ci < 4; ci++) {
        const ci3 = cornerBase + ci * 3;
        const pi = vi * 3;
        positions[pi]   = x + FACE_CORNERS[ci3];
        positions[pi+1] = y + FACE_CORNERS[ci3+1];
        positions[pi+2] = z + FACE_CORNERS[ci3+2];
        normals[pi]   = dx;
        normals[pi+1] = dy;
        normals[pi+2] = dz;
        colors[pi]   = shade;
        colors[pi+1] = shade;
        colors[pi+2] = shade;
        vi++;
      }

      const ui = (vi - 4) * 2;
      uvs[ui]   = u0; uvs[ui+1] = v0;
      uvs[ui+2] = u0; uvs[ui+3] = v1;
      uvs[ui+4] = u1; uvs[ui+5] = v1;
      uvs[ui+6] = u1; uvs[ui+7] = v0;

      const ii = fi * 6;
      indices[ii]   = vOffset;
      indices[ii+1] = vOffset+1;
      indices[ii+2] = vOffset+2;
      indices[ii+3] = vOffset;
      indices[ii+4] = vOffset+2;
      indices[ii+5] = vOffset+3;
      fi++;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeBoundingSphere();
  return geo;
}

// Shared material singleton
let sharedMat: THREE.MeshLambertMaterial | null = null;
function getSharedMaterial(): THREE.MeshLambertMaterial {
  if (!sharedMat) {
    sharedMat = new THREE.MeshLambertMaterial({
      map: getBlockAtlasTexture(),
      vertexColors: true,
      side: THREE.FrontSide,
      alphaTest: 0.1,
    });
  }
  return sharedMat;
}

// Geometry cache
const geoCache = new Map<string, { geo: THREE.BufferGeometry; version: number }>();

const ChunkMesh = memo(function ChunkMesh({ world, cx, cz, version }: { world: WorldData; cx: number; cz: number; version: number }) {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  const cacheKey = `${cx},${cz}`;

  useEffect(() => {
    const cached = geoCache.get(cacheKey);
    if (cached && cached.version === version) {
      setGeo(cached.geo);
      return;
    }

    const newGeo = buildChunkMesh(world, cx, cz);
    const oldCached = geoCache.get(cacheKey);
    if (oldCached && oldCached.geo !== newGeo) oldCached.geo.dispose();
    if (newGeo) {
      geoCache.set(cacheKey, { geo: newGeo, version });
    } else {
      geoCache.delete(cacheKey);
    }
    setGeo(newGeo);
  }, [version, cx, cz, world, cacheKey]);

  if (!geo) return null;
  return <mesh geometry={geo} material={getSharedMaterial()} />;
});

export function ChunkedVoxelWorld({ world, version, playerPos, lastModifiedBlock }: ChunkedVoxelWorldProps) {
  const [activeChunks, setActiveChunks] = useState<string[]>([]);
  const lastChunkRef = useRef<string>("");
  const chunkVersionsRef = useRef<Map<string, number>>(new Map());
  const lastGlobalVersion = useRef(version);

  const computeChunks = useCallback(() => {
    const px = playerPos.current.x;
    const pz = playerPos.current.z;
    const pcx = getChunkCoord(px);
    const pcz = getChunkCoord(pz);
    const key = `${pcx},${pcz}`;
    
    const versionChanged = version !== lastGlobalVersion.current;
    if (key === lastChunkRef.current && !versionChanged) return;
    
    lastChunkRef.current = key;
    lastGlobalVersion.current = version;

    const chunks: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const ck = chunkKey(pcx + dx, pcz + dz);
        chunks.push(ck);
        if (!chunkVersionsRef.current.has(ck)) {
          chunkVersionsRef.current.set(ck, version);
        }
      }
    }
    
    if (versionChanged) {
      const mod = lastModifiedBlock?.current;
      if (mod) {
        const mcx = getChunkCoord(mod.x);
        const mcz = getChunkCoord(mod.z);
        for (let ddx = -1; ddx <= 1; ddx++) {
          for (let ddz = -1; ddz <= 1; ddz++) {
            const affectedKey = chunkKey(mcx + ddx, mcz + ddz);
            if (chunks.includes(affectedKey)) {
              chunkVersionsRef.current.set(affectedKey, version);
            }
          }
        }
      } else {
        for (const ck of chunks) {
          chunkVersionsRef.current.set(ck, version);
        }
      }
    }
    
    setActiveChunks(chunks);
  }, [playerPos, version, lastModifiedBlock]);

  useEffect(() => {
    const interval = setInterval(computeChunks, 300);
    return () => clearInterval(interval);
  }, [computeChunks]);

  useEffect(() => {
    computeChunks();
  }, [version, computeChunks]);

  return (
    <>
      {activeChunks.map(ck => {
        const [cx, cz] = ck.split(',').map(Number);
        const cv = chunkVersionsRef.current.get(ck) ?? 0;
        return <ChunkMesh key={ck} world={world} cx={cx} cz={cz} version={cv} />;
      })}
    </>
  );
}
