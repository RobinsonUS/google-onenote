import { useEffect, useRef, useState, useCallback, memo } from "react";
import * as THREE from "three";
import { WorldData, BLOCK_TYPES, posKey } from "@/lib/terrain";
import { getBlockAtlasTexture, getBlockUV } from "@/lib/textures";

const CHUNK_SIZE = 10;
const MAX_Y = 15; // reduced: terrain ~6 + trees ~6

interface ChunkedVoxelWorldProps {
  world: WorldData;
  version: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
  lastModifiedBlock?: React.MutableRefObject<{ x: number; y: number; z: number } | null>;
}

const FACES = [
  { dir: [0, 1, 0] as [number,number,number], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] as [number,number,number][], uvRow: 0 as 0|1|2 },
  { dir: [0,-1, 0] as [number,number,number], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] as [number,number,number][], uvRow: 2 as 0|1|2 },
  { dir: [1, 0, 0] as [number,number,number], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] as [number,number,number][], uvRow: 1 as 0|1|2 },
  { dir: [-1,0, 0] as [number,number,number], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] as [number,number,number][], uvRow: 1 as 0|1|2 },
  { dir: [0, 0, 1] as [number,number,number], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] as [number,number,number][], uvRow: 1 as 0|1|2 },
  { dir: [0, 0,-1] as [number,number,number], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] as [number,number,number][], uvRow: 1 as 0|1|2 },
];
const FACE_SHADE = [1.0, 0.5, 0.8, 0.8, 0.7, 0.7];

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

function getChunkCoord(worldCoord: number): number {
  return Math.floor(worldCoord / CHUNK_SIZE);
}

// Check if a block has at least one exposed face (neighbor is air/leaves)
function hasExposedFace(world: WorldData, x: number, y: number, z: number, blockType: number): boolean {
  for (let f = 0; f < 6; f++) {
    const dir = FACES[f].dir;
    const neighbor = world.get(posKey(x + dir[0], y + dir[1], z + dir[2]));
    if (neighbor === undefined || neighbor === BLOCK_TYPES.AIR) return true;
    if (neighbor === BLOCK_TYPES.LEAVES && blockType !== BLOCK_TYPES.LEAVES) return true;
  }
  return false;
}

function buildChunkMesh(world: WorldData, cx: number, cz: number): THREE.BufferGeometry | null {
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  const x1 = x0 + CHUNK_SIZE;
  const z1 = z0 + CHUNK_SIZE;

  // First pass: collect only blocks with at least one exposed face
  let faceCount = 0;
  const entries: [number, number, number, number][] = [];

  for (let x = x0; x < x1; x++) {
    for (let z = z0; z < z1; z++) {
      for (let y = 0; y <= MAX_Y; y++) {
        const key = posKey(x, y, z);
        const blockType = world.get(key);
        if (blockType === undefined || blockType === BLOCK_TYPES.AIR) continue;

        // Skip fully buried blocks - huge perf win
        if (!hasExposedFace(world, x, y, z, blockType)) continue;

        let blockFaces = 0;
        for (let f = 0; f < 6; f++) {
          const dir = FACES[f].dir;
          const neighbor = world.get(posKey(x + dir[0], y + dir[1], z + dir[2])) ?? BLOCK_TYPES.AIR;
          if (neighbor !== BLOCK_TYPES.AIR && neighbor !== BLOCK_TYPES.LEAVES) continue;
          if (blockType === BLOCK_TYPES.LEAVES && neighbor === BLOCK_TYPES.LEAVES) continue;
          blockFaces++;
        }
        if (blockFaces > 0) {
          entries.push([x, y, z, blockType]);
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
  const indices   = new Uint32Array(faceCount * 6);
  let vi = 0, fi = 0;

  for (let e = 0; e < entries.length; e++) {
    const [x, y, z, blockType] = entries[e];
    for (let f = 0; f < 6; f++) {
      const face = FACES[f];
      const dir = face.dir;
      const neighbor = world.get(posKey(x + dir[0], y + dir[1], z + dir[2])) ?? BLOCK_TYPES.AIR;
      if (neighbor !== BLOCK_TYPES.AIR && neighbor !== BLOCK_TYPES.LEAVES) continue;
      if (blockType === BLOCK_TYPES.LEAVES && neighbor === BLOCK_TYPES.LEAVES) continue;

      const shade = FACE_SHADE[f];
      const [u0, u1, v0, v1] = getBlockUV(blockType, face.uvRow);
      const vOffset = vi;
      const dx = dir[0], dy = dir[1], dz = dir[2];

      for (let ci = 0; ci < 4; ci++) {
        const corner = face.corners[ci];
        const pi = vi * 3;
        positions[pi]   = x + corner[0];
        positions[pi+1] = y + corner[1];
        positions[pi+2] = z + corner[2];
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

// Geometry cache to avoid rebuilding unchanged chunks
const geoCache = new Map<string, { geo: THREE.BufferGeometry; version: number }>();

const ChunkMesh = memo(function ChunkMesh({ world, cx, cz, version }: { world: WorldData; cx: number; cz: number; version: number }) {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  const buildIdRef = useRef(0);
  const cacheKey = `${cx},${cz}`;

  useEffect(() => {
    // Check cache first
    const cached = geoCache.get(cacheKey);
    if (cached && cached.version === version) {
      setGeo(cached.geo);
      return;
    }

    const id = ++buildIdRef.current;
    const timer = setTimeout(() => {
      if (id !== buildIdRef.current) return;
      const newGeo = buildChunkMesh(world, cx, cz);
      // Update cache
      const oldCached = geoCache.get(cacheKey);
      if (oldCached && oldCached.geo !== newGeo) oldCached.geo.dispose();
      if (newGeo) {
        geoCache.set(cacheKey, { geo: newGeo, version });
      } else {
        geoCache.delete(cacheKey);
      }
      setGeo(newGeo);
    }, 0);
    return () => clearTimeout(timer);
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
    
    // On world mutation, only bump the affected chunk(s)
    if (versionChanged) {
      const mod = lastModifiedBlock?.current;
      if (mod) {
        const mcx = getChunkCoord(mod.x);
        const mcz = getChunkCoord(mod.z);
        // Bump the modified chunk and adjacent ones (block on edge may affect neighbor)
        for (let ddx = -1; ddx <= 1; ddx++) {
          for (let ddz = -1; ddz <= 1; ddz++) {
            const affectedKey = chunkKey(mcx + ddx, mcz + ddz);
            if (chunks.includes(affectedKey)) {
              chunkVersionsRef.current.set(affectedKey, version);
            }
          }
        }
      } else {
        // Fallback: bump all
        for (const ck of chunks) {
          chunkVersionsRef.current.set(ck, version);
        }
      }
    }
    
    setActiveChunks(chunks);
  }, [playerPos, version, lastModifiedBlock]);

  useEffect(() => {
    const interval = setInterval(computeChunks, 200);
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
