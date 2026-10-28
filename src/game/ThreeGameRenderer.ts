import * as THREE from 'three';
import {
  Player,
  Bystander,
  Chaser,
  Obstacle,
  Coin,
  Powerup,
  Particle,
  FloatingText,
  Shockwave,
  CharacterSkin,
  IntroVictim,
} from './types.ts';
import { ROAD_WIDTH, CHARACTER_SKINS } from './constants.ts';
import { MapDefinition, GAME_MAPS, getMapById } from './maps.ts';
import { buildDinoCharacterMesh, DinoMeshComponents, buildDinoHeadwear } from './DinoMeshBuilder.ts';

// World coordinate scale mapping
const SCALE_X = 0.05;
const SCALE_Y = 0.05; // Game Y (forward) -> Three -Z
const SCALE_Z = 0.05; // Game Z (height) -> Three +Y

export class ThreeGameRenderer {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private width: number = 800;
  private height: number = 600;
  private dpr: number = 1;
  private screenShake: number = 0;
  private hitFreeze: number = 0;
  private startTime: number = performance.now();
  private currentMap: MapDefinition = GAME_MAPS[0];

  // Lighting
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private playerPointLight: THREE.PointLight;
  private playerRimLight: THREE.PointLight;

  // Road, Sky & Environment Chunks
  private roadGroup: THREE.Group;
  private weatherGroup: THREE.Group;
  private skyGroup: THREE.Group;
  private clouds: { mesh: THREE.Group; speedX: number; speedZ: number; baseOffsetZ: number; rangeX: number }[] = [];
  private weatherParticles: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; rotX: number; rotY: number; life: number; maxLife: number; kind: string }[] = [];
  private celestialMesh?: THREE.Group;
  private roadSegments: THREE.Group[] = [];
  private readonly segmentLength: number = 64; // in Three.js world units
  private readonly numSegments: number = 7;

  // Dynamic Voxel Player Character Group
  private playerGroup: THREE.Group;
  private playerHead: THREE.Group | THREE.Mesh;
  private playerTorso: THREE.Mesh;
  private playerLeftArm: THREE.Group;
  private playerRightArm: THREE.Group;
  private playerLeftLeg: THREE.Group;
  private playerRightLeg: THREE.Group;
  private playerHatGroup: THREE.Group;
  private playerShadow: THREE.Mesh;
  private megaSlapGlove: THREE.Mesh;
  private playerTail?: THREE.Group;
  private currentSkin?: CharacterSkin;
  private playerFireAura: THREE.Group;
  private playerFireLight: THREE.PointLight;
  private fireAuraFlames: THREE.Mesh[] = [];

  // High-Clarity Player Focus Elements
  private playerFocusGroup!: THREE.Group;
  private playerFocusRing!: THREE.Mesh;
  private playerFocusArrow!: THREE.Mesh;
  private playerOverheadMarker!: THREE.Group;
  private playerOverheadDiamond!: THREE.Mesh;
  private playerJerseyDecal?: THREE.Mesh;
  private characterFocusEnabled: boolean = true;

  // Intro Cinematic Target Victim (Smug Boss standing in middle of road)
  private introVictimGroup!: THREE.Group;
  private introVictimGlasses!: THREE.Mesh;
  private introVictimHat!: THREE.Group;

  // Entity Meshes Maps
  private bystanderMeshes: Map<number, THREE.Group> = new Map();
  private chaserMeshes: Map<number, THREE.Group> = new Map();
  private obstacleMeshes: Map<number, THREE.Group> = new Map();
  private coinMeshes: Map<number, THREE.Group> = new Map();
  private powerupMeshes: Map<number, THREE.Group> = new Map();
  private particleGroup: THREE.Group;
  private floatingTextSprites: Map<number, THREE.Sprite> = new Map();
  /** Shared box geometry and palette for flame rendering, built once. */
  private flameGeo: THREE.BoxGeometry | null = null;
  private flameMats: THREE.MeshBasicMaterial[] | null = null;

  // Materials & Geometries Cache (Flat-shaded retro pixel art materials)
  private materials: { [key: string]: THREE.Material } = {};
  private sharedGeometries: { [key: string]: THREE.BufferGeometry } = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.startTime = performance.now();

    // 1. Initialize High-Performance WebGL Renderer with Anti-Aliased Crisp Pixel Rendering
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true, // Smooth, clean pixel edges with zero shimmer
      powerPreference: 'high-performance',
      alpha: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap; // Hard pixel shadows

    // 2. Initialize Voxel Scene, Retro Cyan Sky & Atmospheric Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x38bdf8); // Vibrant 8-bit sky
    this.scene.fog = new THREE.FogExp2(0x7dd3fc, 0.007);

    // 3. 3D Camera with dynamic tracking (closer, high-clarity arcade follow angle)
    this.camera = new THREE.PerspectiveCamera(50, 800 / 600, 0.5, 360);
    this.camera.position.set(0, 5.2, 9.2);

    // 4. Retro Arcade 3-Point Studio Lighting Rig
    this.dirLight = new THREE.DirectionalLight(0xfffaed, 2.5);
    this.dirLight.position.set(16, 32, 22);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 130;
    this.dirLight.shadow.camera.left = -28;
    this.dirLight.shadow.camera.right = 28;
    this.dirLight.shadow.camera.top = 28;
    this.dirLight.shadow.camera.bottom = -28;
    this.dirLight.shadow.bias = -0.0004;
    this.scene.add(this.dirLight);

    // Cool Sky & Warm Tarmac Hemisphere Fill
    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x181824, 1.3);
    this.scene.add(this.hemiLight);

    // Dynamic Player Point Light
    this.playerPointLight = new THREE.PointLight(0x10b981, 1.0, 16);
    this.scene.add(this.playerPointLight);

    // Dynamic Player Rim / Backlight (crisp illumination of player's back & shoulders against dark tarmac)
    this.playerRimLight = new THREE.PointLight(0xfffaed, 2.6, 16);
    this.playerRimLight.position.set(0, 5, 4);
    this.scene.add(this.playerRimLight);

    // 5. Hierarchy Groups
    this.skyGroup = new THREE.Group();
    this.scene.add(this.skyGroup);

    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);

    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    this.weatherGroup = new THREE.Group();
    this.scene.add(this.weatherGroup);

    // 6. Build Flat-Shaded Retro Materials
    this.initMaterials();

    // 7. Build Procedural 3D Voxel Boulevard Track
    this.buildRoadSegments();
    this.buildSkyAndCloudsForMap();
    this.initWeatherForMap();

    // 8. Build 3D Voxel Player Character
    const charBuild = this.createCharacterMesh();
    this.playerGroup = charBuild.playerGroup;
    this.playerHead = charBuild.head;
    this.playerTorso = charBuild.torso;
    this.playerLeftArm = charBuild.leftArm;
    this.playerRightArm = charBuild.rightArm;
    this.playerLeftLeg = charBuild.leftLeg;
    this.playerRightLeg = charBuild.rightLeg;
    this.playerHatGroup = charBuild.hatGroup;
    this.playerShadow = charBuild.shadow;
    this.megaSlapGlove = charBuild.megaSlapGlove;
    this.playerTail = charBuild.tail;
    this.scene.add(this.playerGroup);

    // Flame Mode aura: a handful of voxel flames that flicker around the dino.
    this.playerFireAura = new THREE.Group();
    const flameOuter = new THREE.MeshBasicMaterial({
      color: 0xff6b1a,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const flameInner = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const flameSpots: Array<[number, number, number, number]> = [
      [-0.62, 0.85, 0.1, 0.34],
      [0.66, 1.15, -0.1, 0.4],
      [-0.45, 1.9, 0.2, 0.28],
      [0.5, 2.05, 0.05, 0.3],
      [0, 1.5, 0.55, 0.46],
      [0, 2.9, 0, 0.3],
    ];
    flameSpots.forEach(([x, y, z, size], index) => {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(size, size * 2.2, 5),
        index % 2 === 0 ? flameOuter : flameInner
      );
      flame.position.set(x, y, z);
      this.fireAuraFlames.push(flame);
      this.playerFireAura.add(flame);
    });
    this.playerFireAura.visible = false;
    this.scene.add(this.playerFireAura);

    this.playerFireLight = new THREE.PointLight(0xff7a18, 0, 14, 2);
    this.playerFireLight.visible = false;
    this.scene.add(this.playerFireLight);

    // 9. Build 3D Voxel Intro Target Character (The Smug Boss)
    this.introVictimGroup = this.createIntroVictimMesh();
  }

  private initMaterials(): void {
    // Crisp Flat-Shaded Voxel Materials
    this.materials['road'] = new THREE.MeshStandardMaterial({
      color: 0x181a24,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    });

    this.materials['sidewalk'] = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.7,
      metalness: 0.05,
      flatShading: true,
    });

    this.materials['curb'] = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.5,
      flatShading: true,
    });

    this.materials['curbBevel'] = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      flatShading: true,
    });

    this.materials['roadLine'] = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    this.materials['chevron'] = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
    });

    this.materials['grass'] = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.95,
      flatShading: true,
    });

    this.materials['gold'] = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.2,
      metalness: 0.85,
      flatShading: true,
    });

    this.materials['wood'] = new THREE.MeshStandardMaterial({
      color: 0x854d0e,
      roughness: 0.75,
      flatShading: true,
    });

    this.materials['copperBand'] = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.3,
      metalness: 0.8,
      flatShading: true,
    });

    this.materials['orangeStripe'] = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.4,
      flatShading: true,
    });

    this.materials['whiteStripe'] = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      flatShading: true,
    });

    this.materials['ramp'] = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.25,
      emissive: 0x0891b2,
      emissiveIntensity: 0.4,
      flatShading: true,
    });

    this.materials['crateWood'] = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.75,
      flatShading: true,
    });

    this.materials['apple'] = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.3,
      flatShading: true,
    });

    this.materials['orange'] = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.3,
      flatShading: true,
    });

    this.materials['banana'] = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.3,
      flatShading: true,
    });

    this.materials['shadow'] = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });

    this.materials['slapGlove'] = new THREE.MeshStandardMaterial({
      color: 0xff4757,
      roughness: 0.25,
      flatShading: true,
    });

    this.materials['foliageA'] = new THREE.MeshStandardMaterial({
      color: 0x059669,
      roughness: 0.9,
      flatShading: true,
    });

    this.materials['foliageB'] = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.85,
      flatShading: true,
    });

    this.materials['woodTrunk'] = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.85,
      flatShading: true,
    });

    this.materials['lampIron'] = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
      flatShading: true,
    });

    this.materials['lampLight'] = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfde047,
      emissiveIntensity: 1.2,
      flatShading: true,
    });

    this.materials['windowLit'] = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfde047,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      flatShading: true,
    });
  }

  /**
   * Procedural Voxel Track Segment (Crossy Road Style)
   */
  private createSegment(index: number): THREE.Group {
    const group = new THREE.Group();
    const halfRoad = (ROAD_WIDTH / 2) * SCALE_X; // 140 * 0.05 = 7.0
    const sidewalkWidth = 70 * SCALE_X; // 3.5
    const length = this.segmentLength;

    // 1. Asphalt Roadbed (Blocky Voxel Slab)
    const roadGeo = new THREE.BoxGeometry(halfRoad * 2, 0.4, length);
    const roadMesh = new THREE.Mesh(roadGeo, this.materials['road']);
    roadMesh.position.y = -0.2;
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // 2. Sidewalks (Raised Voxel Slabs)
    const swGeo = new THREE.BoxGeometry(sidewalkWidth, 0.46, length);
    const swLeft = new THREE.Mesh(swGeo, this.materials['sidewalk']);
    swLeft.position.set(-halfRoad - sidewalkWidth / 2, 0.23, 0);
    swLeft.receiveShadow = true;
    group.add(swLeft);

    const swRight = new THREE.Mesh(swGeo, this.materials['sidewalk']);
    swRight.position.set(halfRoad + sidewalkWidth / 2, 0.23, 0);
    swRight.receiveShadow = true;
    group.add(swRight);

    // 3. Voxel Curbs with White Top Lip Block
    const curbGeo = new THREE.BoxGeometry(0.38, 0.52, length);
    const curbLeft = new THREE.Mesh(curbGeo, this.materials['curbBevel']);
    curbLeft.position.set(-halfRoad - 0.19, 0.26, 0);
    curbLeft.receiveShadow = true;
    group.add(curbLeft);

    const curbRight = new THREE.Mesh(curbGeo, this.materials['curbBevel']);
    curbRight.position.set(halfRoad + 0.19, 0.26, 0);
    curbRight.receiveShadow = true;
    group.add(curbRight);

    // 4. Solid Voxel Outer Road Boundary Line Blocks
    const lineGeo = new THREE.BoxGeometry(0.22, 0.04, length);
    const lineL = new THREE.Mesh(lineGeo, this.materials['roadLine']);
    lineL.position.set(-halfRoad + 0.35, 0.02, 0);
    group.add(lineL);

    const lineR = new THREE.Mesh(lineGeo, this.materials['roadLine']);
    lineR.position.set(halfRoad - 0.35, 0.02, 0);
    group.add(lineR);

    // 5. 2 Dashed Voxel Lane Blocks (-45, 45) cleanly separating 3 lanes
    const dividers = [-45, 45].map((d) => d * SCALE_X);
    const dashLen = 2.2;
    const dashGap = 2.4;
    const numDashes = Math.floor(length / (dashLen + dashGap));

    dividers.forEach((divX) => {
      for (let i = 0; i < numDashes; i++) {
        const dashGeo = new THREE.BoxGeometry(0.18, 0.04, dashLen);
        const dashMesh = new THREE.Mesh(dashGeo, this.materials['roadLine']);
        const zPos = -length / 2 + i * (dashLen + dashGap) + dashLen / 2;
        dashMesh.position.set(divX, 0.02, zPos);
        group.add(dashMesh);
      }
    });



    // 7. Voxel Grass Parkways (Clean, spacious open parkway without noisy ground clutter)
    const grassGeo = new THREE.BoxGeometry(45, 0.4, length);
    const grassL = new THREE.Mesh(grassGeo, this.materials['grass']);
    grassL.position.set(-halfRoad - sidewalkWidth - 22.5, 0.04, 0);
    grassL.receiveShadow = true;
    group.add(grassL);

    const grassR = new THREE.Mesh(grassGeo, this.materials['grass']);
    grassR.position.set(halfRoad + sidewalkWidth + 22.5, 0.04, 0);
    grassR.receiveShadow = true;
    group.add(grassR);

    // 8. Roadside Props dynamically customized for each map biome
    // (Placed gracefully on the outer grass parkway, leaving sidewalks and road 100% clean and clear!)
    [-1, 1].forEach((side) => {
      const propGroup = this.createPropsForMap(side, halfRoad, sidewalkWidth, length, index);
      group.add(propGroup);
    });

    // 9. Biome-Specific 3D Architecture & Environmental Scenery
    [-1, 1].forEach((side) => {
      const archGroup = this.createArchitectureForMap(side, halfRoad, sidewalkWidth, length, index);
      group.add(archGroup);
    });

    return group;
  }

  /**
   * Builds distinctive, high-fidelity 3D environment architecture uniquely tailored to each map biome:
   * - Market: Traditional Mediterranean market townhouses with terracotta tiles & striped market stalls
   * - Tropical Coast: Ocean shoreline with rolling turquoise waves, sandy beaches, bamboo tiki cabanas & surfboards
   * - Sunset Desert: Monumental terracotta sandstone canyon mesas, glowing volcanic magma fissures & dinosaur fossil skeletons
   * - Neon Night: Cyberpunk skyscrapers with glowing cyan/magenta neon pipes, holographic billboards & cyber street arches
   * - Winter Peak: Alpine timber log chalets with thick snow-capped pitched roofs & warm dormer windows
   * - Golden Temple: 2-story Japanese Pagodas with curved vermilion eaves, red Torii gates & hanging crimson festival lanterns
   */
  private createArchitectureForMap(side: number, halfRoad: number, sidewalkWidth: number, length: number, index: number): THREE.Group {
    const group = new THREE.Group();
    const mapId = this.currentMap.id;
    const parkwayX = side * (halfRoad + sidewalkWidth + 8.5);
    const bldZ = (index % 2 === 0 ? -1 : 1) * (length * 0.16);
    const modelVariation = (index + (side > 0 ? 0 : 1)) % 2;

    if (mapId === 'tropical_coast') {
      // 1. Tropical Beach Resort: Ocean Water Strip, Sand Shore, Tiki Cabanas & Luxury Villas
      // Ocean Water Surface along outer edge
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.15,
        metalness: 0.35,
        flatShading: true,
      });
      const waterMesh = new THREE.Mesh(new THREE.BoxGeometry(28, 0.3, length), waterMat);
      waterMesh.position.set(side * (halfRoad + sidewalkWidth + 24), -0.05, 0);
      group.add(waterMesh);

      // White Wave Crest Foam Strip
      const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const foamMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.32, length), foamMat);
      foamMesh.position.set(side * (halfRoad + sidewalkWidth + 10.5), 0.02, 0);
      group.add(foamMesh);

      if (modelVariation === 0) {
        // Model A: Full 2-Story Pastel Beachfront Resort Villa & Tiki Lounge
        const villaColors = [0x06b6d4, 0xf43f5e, 0xfacc15, 0x10b981];
        const villaMat = new THREE.MeshStandardMaterial({
          color: villaColors[index % villaColors.length],
          roughness: 0.6,
          flatShading: true,
        });
        const whiteTrimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, flatShading: true });
        const bambooMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8, flatShading: true });
        const thatchMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9, flatShading: true });

        const villaGroup = new THREE.Group();
        villaGroup.position.set(parkwayX, 0, bldZ);

        // Ground Floor Villa Base
        const base = new THREE.Mesh(new THREE.BoxGeometry(9.0, 4.5, 18), villaMat);
        base.position.y = 2.25;
        base.castShadow = true;
        villaGroup.add(base);

        // White Timber Trim Bands
        const trim = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.4, 18.4), whiteTrimMat);
        trim.position.y = 4.5;
        villaGroup.add(trim);

        // Second Story Villa Retreat
        const story2 = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.8, 14), villaMat);
        story2.position.set(side * 0.8, 6.4, 0);
        story2.castShadow = true;
        villaGroup.add(story2);

        // Second Story Overhanging Roof
        const roof = new THREE.Mesh(new THREE.ConeGeometry(5.8, 2.4, 4), thatchMat);
        roof.position.set(side * 0.8, 9.4, 0);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        villaGroup.add(roof);

        // Wrap-around Veranda Balcony & Railings
        const balc = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 14.5), whiteTrimMat);
        balc.position.set(-side * 3.8, 4.5, 0);
        villaGroup.add(balc);

        for (let r = 0; r < 5; r++) {
          const railPost = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.1, 0.15), whiteTrimMat);
          railPost.position.set(-side * 4.4, 5.15, -6 + r * 3);
          villaGroup.add(railPost);
        }

        // Attached Tiki Cocktail Bar with Bamboo Posts & Thatch Canopy
        [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]].forEach(([px, pz]) => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 4.2, 0.28), bambooMat);
          post.position.set(-side * 5.2 + px * 0.6, 2.1, pz * 0.8);
          post.castShadow = true;
          villaGroup.add(post);
        });

        // Surfboards propped upright
        const boardColors = [0xef4444, 0x06b6d4, 0xfacc15];
        const boardMat = new THREE.MeshStandardMaterial({
          color: boardColors[index % boardColors.length],
          roughness: 0.25,
          flatShading: true,
        });
        const surfboard = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.2, 0.16), boardMat);
        surfboard.position.set(-side * 4.8, 1.6, -3.2);
        surfboard.rotation.z = side * 0.2;
        surfboard.castShadow = true;
        villaGroup.add(surfboard);

        // Carved Tiki Totem with glowing eyes
        const totemMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85, flatShading: true });
        const totemEyeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
        const totem = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 0.8), totemMat);
        totem.position.set(-side * 4.6, 1.3, 3.5);
        totem.castShadow = true;
        villaGroup.add(totem);
        const totemEye1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), totemEyeMat);
        totemEye1.position.set(-side * 4.2, 2.0, 3.3);
        const totemEye2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), totemEyeMat);
        totemEye2.position.set(-side * 4.2, 2.0, 3.7);
        villaGroup.add(totemEye1);
        villaGroup.add(totemEye2);

        group.add(villaGroup);

      } else {
        // Model B: Seaside Boardwalk & Lifeguard Lookout Tower
        const woodMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85, flatShading: true });
        const whiteWoodMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.6, flatShading: true });
        const redStripeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5, flatShading: true });

        const towerGroup = new THREE.Group();
        towerGroup.position.set(parkwayX, 0, bldZ);

        // Boardwalk Pier Decking
        const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 0.45, 20), woodMat);
        pier.position.y = 0.25;
        towerGroup.add(pier);

        // 4 Tall Stilt Legs
        [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]].forEach(([px, pz]) => {
          const stilt = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.2, 0.35), woodMat);
          stilt.position.set(px, 3.1, pz);
          stilt.castShadow = true;
          towerGroup.add(stilt);
        });

        // Elevated Observation Cabin
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.2, 5.2), whiteWoodMat);
        cabin.position.y = 7.2;
        cabin.castShadow = true;
        towerGroup.add(cabin);

        // Striped Lifeguard Roof
        const canopy = new THREE.Mesh(new THREE.ConeGeometry(4.2, 1.8, 4), redStripeMat);
        canopy.position.y = 9.7;
        canopy.rotation.y = Math.PI / 4;
        towerGroup.add(canopy);

        // Ladder & Lifebuoy
        const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.15, 6.0, 1.2), woodMat);
        ladder.position.set(-side * 2.5, 3.0, 0);
        towerGroup.add(ladder);

        const lifebuoy = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.16, 6, 12), redStripeMat);
        lifebuoy.position.set(-side * 2.7, 7.0, 1.5);
        lifebuoy.rotation.y = Math.PI / 2;
        towerGroup.add(lifebuoy);

        // Beach Umbrella & Sun Lounger
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.8), whiteWoodMat);
        pole.position.set(side * 2.8, 1.9, -5);
        towerGroup.add(pole);

        const umbrella = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.1, 8), redStripeMat);
        umbrella.position.set(side * 2.8, 3.8, -5);
        towerGroup.add(umbrella);

        group.add(towerGroup);
      }

    } else if (mapId === 'sunset_desert') {
      // 2. Sunset Terracotta Desert: Canyon Mesas, Prehistoric Fossils & Ancient Cliff Pueblos
      const mesaMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.95, flatShading: true });
      const ledgeMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.9, flatShading: true });
      const magmaMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xf97316,
        emissiveIntensity: 2.4,
        flatShading: true,
      });
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6, flatShading: true });

      const desertGroup = new THREE.Group();
      desertGroup.position.set(parkwayX, 0, bldZ);

      if (modelVariation === 0) {
        // Model A: Monumental Stepped Sandstone Mesa with Magma Fissure & Giant Dino Skeleton
        const baseRock = new THREE.Mesh(new THREE.BoxGeometry(11, 8.5, 24), mesaMat);
        baseRock.position.y = 4.25;
        baseRock.castShadow = true;
        desertGroup.add(baseRock);

        const upperLedge = new THREE.Mesh(new THREE.BoxGeometry(8, 5.0, 18), ledgeMat);
        upperLedge.position.set(side * 1.5, 11, 0);
        upperLedge.castShadow = true;
        desertGroup.add(upperLedge);

        const peak = new THREE.Mesh(new THREE.BoxGeometry(5, 4.0, 10), mesaMat);
        peak.position.set(side * 2.5, 15, 0);
        peak.castShadow = true;
        desertGroup.add(peak);

        // Glowing Magma Crevice Cascade
        for (let m = 0; m < 4; m++) {
          const fissure = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.6), magmaMat);
          fissure.position.set(-side * 5.4, 2.0 + m * 2.8, -5 + m * 3.5);
          desertGroup.add(fissure);
        }

        // Giant Prehistoric Dinosaur Fossil Ribs arching out of rock
        for (let r = 0; r < 4; r++) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.8, 0.4), boneMat);
          rib.position.set(-side * 5.3, 5.5, -4.5 + r * 3);
          rib.rotation.z = side * 0.45;
          desertGroup.add(rib);
        }

        // Fossilized Dinosaur Skull embedded in canyon face
        const skull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.8), boneMat);
        skull.position.set(-side * 5.2, 7.8, 6.0);
        skull.rotation.y = side * 0.3;
        desertGroup.add(skull);

      } else {
        // Model B: Ancient Cliff-Dwelling Adobe Pueblo Fortress & Obelisk
        const adobeMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9, flatShading: true });
        const vigaMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8, flatShading: true });

        // Tier 1 Adobe Base
        const tier1 = new THREE.Mesh(new THREE.BoxGeometry(9.5, 5.0, 20), adobeMat);
        tier1.position.y = 2.5;
        tier1.castShadow = true;
        desertGroup.add(tier1);

        // Tier 2 Adobe Terrace
        const tier2 = new THREE.Mesh(new THREE.BoxGeometry(6.5, 4.2, 14), adobeMat);
        tier2.position.set(side * 1.5, 7.1, 0);
        tier2.castShadow = true;
        desertGroup.add(tier2);

        // Projecting Timber Vigas (Roof Beams)
        for (let v = 0; v < 6; v++) {
          const viga = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.25), vigaMat);
          viga.position.set(-side * 4.9, 4.8, -7 + v * 2.8);
          desertGroup.add(viga);
        }

        // Rustic Wooden Ladder leaning to terrace
        const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.2, 0.9), vigaMat);
        ladder.position.set(-side * 4.8, 2.5, 3.5);
        ladder.rotation.z = side * -0.22;
        desertGroup.add(ladder);

        // Clay Pottery Amphora Urns on terrace
        const urnMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85, flatShading: true });
        const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.1, 6), urnMat);
        urn.position.set(-side * 2.2, 5.5, -2.5);
        desertGroup.add(urn);

        // Ancient Sandstone Obelisk Pillar with glowing hieroglyph
        const obelisk = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4.8, 4), ledgeMat);
        obelisk.position.set(-side * 4.5, 2.4, -6.5);
        obelisk.rotation.y = Math.PI / 4;
        obelisk.castShadow = true;
        desertGroup.add(obelisk);
      }

      group.add(desertGroup);

    } else if (mapId === 'neon_night') {
      // 3. Synthwave Night Metropolis: Cyber Skyscraper Megastructures, Holographic Marquees & Skyways
      const cyberTowerMat = new THREE.MeshStandardMaterial({
        color: 0x090d16,
        roughness: 0.2,
        metalness: 0.85,
        flatShading: true,
      });
      const neonCyanMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 2.4,
        flatShading: true,
      });
      const neonPinkMat = new THREE.MeshStandardMaterial({
        color: 0xec4899,
        emissive: 0xec4899,
        emissiveIntensity: 2.4,
        flatShading: true,
      });
      const neonGreenMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 2.2,
        flatShading: true,
      });

      const towerGroup = new THREE.Group();
      towerGroup.position.set(parkwayX, 0, bldZ);

      if (modelVariation === 0) {
        // Model A: Cyber Shibuya Megatower with Glowing Window Matrix & Holographic RAMEN Sign
        const towerHeight = 18 + (index % 3) * 4;
        const tower = new THREE.Mesh(new THREE.BoxGeometry(8.5, towerHeight, 22), cyberTowerMat);
        tower.position.y = towerHeight / 2;
        tower.castShadow = true;
        towerGroup.add(tower);

        // Vertical Neon Conduit Rails running along building corners
        [-4.2, 4.2].forEach((nx) => {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(0.25, towerHeight, 0.35), nx < 0 ? neonCyanMat : neonPinkMat);
          strip.position.set(nx, towerHeight / 2, -10.9);
          towerGroup.add(strip);
        });

        // High-Tech Cyber Window Matrix (Glowing Window Grids)
        for (let row = 1; row < 5; row++) {
          for (let col = 0; col < 3; col++) {
            const winMat = (row + col) % 2 === 0 ? neonCyanMat : neonPinkMat;
            const cyberWin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 1.8), winMat);
            cyberWin.position.set(-side * 4.3, 3 + row * 2.8, -6 + col * 5);
            towerGroup.add(cyberWin);
          }
        }

        // Giant Holographic Billboard [RAMEN / DINO]
        const holoBoard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.5, 9.5), neonCyanMat);
        holoBoard.position.set(-side * 4.4, 9.5, 0);
        towerGroup.add(holoBoard);

        const holoSignDetail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.6, 6.5), neonPinkMat);
        holoSignDetail.position.set(-side * 4.45, 9.5, 0);
        towerGroup.add(holoSignDetail);

        // Rooftop Antenna Mast with blinking aviation light
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 5.0), cyberTowerMat);
        antenna.position.set(0, towerHeight + 2.5, 0);
        towerGroup.add(antenna);

        const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), neonPinkMat);
        beacon.position.set(0, towerHeight + 5.0, 0);
        towerGroup.add(beacon);

      } else {
        // Model B: Cyber Arcade Club & Skyway Complex
        const clubHeight = 14;
        const mainClub = new THREE.Mesh(new THREE.BoxGeometry(9.0, clubHeight, 20), cyberTowerMat);
        mainClub.position.y = clubHeight / 2;
        mainClub.castShadow = true;
        towerGroup.add(mainClub);

        // Angular Cyber Entrance Portal with Neon Green Archway
        const portal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.5, 8.5), neonGreenMat);
        portal.position.set(-side * 4.6, 2.75, 0);
        towerGroup.add(portal);

        // Holographic [ARCADE 2077] Marquee Board
        const arcadeMarquee = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.8, 11), neonPinkMat);
        arcadeMarquee.position.set(-side * 4.6, 7.5, 0);
        towerGroup.add(arcadeMarquee);

        // Overhead Cyber Skybridge spanning to neighboring structure
        const skybridge = new THREE.Mesh(new THREE.BoxGeometry(7.0, 3.2, 5.0), cyberTowerMat);
        skybridge.position.set(0, 11, -8);
        towerGroup.add(skybridge);

        const bridgeNeon = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.3, 5.2), neonCyanMat);
        bridgeNeon.position.set(0, 9.5, -8);
        towerGroup.add(bridgeNeon);
      }

      group.add(towerGroup);

    } else if (mapId === 'winter_peak') {
      // 4. Frosty Alps: Alpine Timber Log Chalet & Clocktower with Snowdrifts & Icicles
      const timberMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85, flatShading: true });
      const snowCoverMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, flatShading: true });
      const icicleMat = new THREE.MeshStandardMaterial({
        color: 0xcffafe,
        roughness: 0.1,
        transparent: true,
        opacity: 0.85,
        flatShading: true,
      });
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9, flatShading: true });
      const warmWinMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfde047,
        emissiveIntensity: 1.4,
        flatShading: true,
      });

      const chaletGroup = new THREE.Group();
      chaletGroup.position.set(parkwayX, 0, bldZ);

      if (modelVariation === 0) {
        // Model A: Rustic Log Chalet with Snow Roof, Icicles & Smoking Chimney
        const stoneBase = new THREE.Mesh(new THREE.BoxGeometry(8.6, 2.0, 19), stoneMat);
        stoneBase.position.y = 1.0;
        chaletGroup.add(stoneBase);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(8.2, 5.0, 18), timberMat);
        cabin.position.y = 4.5;
        cabin.castShadow = true;
        chaletGroup.add(cabin);

        // Thick Steep Snow-Laden Pitched Roof
        const roof = new THREE.Mesh(new THREE.BoxGeometry(9.6, 3.6, 20), snowCoverMat);
        roof.position.y = 8.5;
        roof.castShadow = true;
        chaletGroup.add(roof);

        // Translucent Hanging Icicles along eave
        for (let ic = 0; ic < 8; ic++) {
          const icicle = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.4, 4), icicleMat);
          icicle.position.set(-side * 4.7, 6.8, -8 + ic * 2.3);
          icicle.rotation.x = Math.PI;
          chaletGroup.add(icicle);
        }

        // Cozy Bavarian Balcony with Frosted Pine Planters
        const balcony = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 8.0), timberMat);
        balcony.position.set(-side * 4.3, 4.6, 0);
        chaletGroup.add(balcony);

        // Warm Glowing Windows
        for (let w = 0; w < 3; w++) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 1.6), warmWinMat);
          win.position.set(-side * 4.2, 4.2, -5 + w * 5);
          chaletGroup.add(win);
        }

        // Riverstone Chimney with White Smoke Voxels
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.6, 6.8, 1.6), stoneMat);
        chimney.position.set(side * 2.5, 9.5, -4);
        chaletGroup.add(chimney);

        for (let s = 0; s < 3; s++) {
          const smoke = new THREE.Mesh(new THREE.BoxGeometry(0.6 + s * 0.3, 0.6 + s * 0.3, 0.6 + s * 0.3), snowCoverMat);
          smoke.position.set(side * 2.5, 13.5 + s * 1.2, -4);
          chaletGroup.add(smoke);
        }

        // Stacked Firewood Log Pile
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9, flatShading: true });
        const woodPile = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 4.0), woodMat);
        woodPile.position.set(-side * 4.6, 0.75, 6.0);
        chaletGroup.add(woodPile);

      } else {
        // Model B: Alpine Ski Lodge Clocktower
        const lodgeBase = new THREE.Mesh(new THREE.BoxGeometry(9.0, 7.0, 18), timberMat);
        lodgeBase.position.y = 3.5;
        chaletGroup.add(lodgeBase);

        // Central Square Clocktower
        const clockTower = new THREE.Mesh(new THREE.BoxGeometry(4.2, 8.0, 4.2), stoneMat);
        clockTower.position.set(0, 11, 0);
        chaletGroup.add(clockTower);

        // Snow-Dusted Clock Face
        const clockFace = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.0, 2.0), warmWinMat);
        clockFace.position.set(-side * 2.15, 12.5, 0);
        chaletGroup.add(clockFace);

        // Steep Pyramid Roof on Clocktower
        const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 4.0, 4), snowCoverMat);
        towerRoof.position.set(0, 16.5, 0);
        towerRoof.rotation.y = Math.PI / 4;
        chaletGroup.add(towerRoof);

        // Ski Rack with Skis leaned upright
        const skiMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4, flatShading: true });
        const ski1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.3), skiMat);
        ski1.position.set(-side * 4.8, 1.6, -2.5);
        ski1.rotation.z = side * 0.15;
        chaletGroup.add(ski1);
      }

      group.add(chaletGroup);

    } else if (mapId === 'golden_temple') {
      // 5. Sacred Lantern Way: Multi-Tiered Pagoda & Torii Sanctuary with Crimson Lanterns
      const redPillarMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.45, flatShading: true });
      const pagodaRoofMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.5, flatShading: true });
      const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.3, flatShading: true });
      const lanternMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xf43f5e,
        emissiveIntensity: 2.2,
        flatShading: true,
      });
      const shojiMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfde047,
        emissiveIntensity: 1.1,
        flatShading: true,
      });

      const pagodaGroup = new THREE.Group();
      pagodaGroup.position.set(parkwayX, 0, bldZ);

      if (modelVariation === 0) {
        // Model A: Majestic 3-Story Japanese Pagoda with Flared Eaves & Sorin Spire
        // Story 1
        const story1 = new THREE.Mesh(new THREE.BoxGeometry(8.0, 4.5, 16), redPillarMat);
        story1.position.y = 2.25;
        story1.castShadow = true;
        pagodaGroup.add(story1);

        // Flared Eave 1
        const eave1 = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.7, 18.5), pagodaRoofMat);
        eave1.position.y = 4.8;
        eave1.castShadow = true;
        pagodaGroup.add(eave1);

        // Story 2
        const story2 = new THREE.Mesh(new THREE.BoxGeometry(6.0, 3.8, 12), redPillarMat);
        story2.position.y = 7.0;
        story2.castShadow = true;
        pagodaGroup.add(story2);

        // Flared Eave 2
        const eave2 = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.7, 14.5), pagodaRoofMat);
        eave2.position.y = 9.25;
        eave2.castShadow = true;
        pagodaGroup.add(eave2);

        // Story 3
        const story3 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.2, 8.5), redPillarMat);
        story3.position.y = 11.2;
        story3.castShadow = true;
        pagodaGroup.add(story3);

        // Top Roof & Golden Sorin Finial
        const eave3 = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.6, 4), pagodaRoofMat);
        eave3.position.y = 13.8;
        eave3.rotation.y = Math.PI / 4;
        pagodaGroup.add(eave3);

        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 4.5), goldTrimMat);
        spire.position.y = 16.5;
        pagodaGroup.add(spire);

        // Hanging Crimson Paper Festival Lanterns under eaves
        for (let l = 0; l < 4; l++) {
          const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.55), lanternMat);
          lantern.position.set(-side * 5.2, 4.2, -6 + l * 4);
          pagodaGroup.add(lantern);
        }

        // Shoji paper lattice windows
        for (let s = 0; s < 3; s++) {
          const shoji = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 2.2), shojiMat);
          shoji.position.set(-side * 4.1, 2.4, -4 + s * 4);
          pagodaGroup.add(shoji);
        }

      } else {
        // Model B: Vermilion Torii Sanctuary & Sacred Stone Shrines
        const toriiGroup = new THREE.Group();

        // Stone Foundation Platform
        const stoneBase = new THREE.Mesh(new THREE.BoxGeometry(9.0, 1.2, 18), this.materials['sidewalk']);
        stoneBase.position.y = 0.6;
        toriiGroup.add(stoneBase);

        // Grand Vermilion Torii Gate Pillars
        [-4, 4].forEach((tz) => {
          const toriiPost = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 9.0), redPillarMat);
          toriiPost.position.set(-side * 3.5, 5.1, tz);
          toriiPost.castShadow = true;
          toriiGroup.add(toriiPost);
        });

        // Top Horizontal Crossbeam (Kasagi)
        const kasagi = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 12.0), pagodaRoofMat);
        kasagi.position.set(-side * 3.5, 9.4, 0);
        toriiGroup.add(kasagi);

        // Stone Garden Lanterns (Ishidoro) along base
        const ishidoroMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9, flatShading: true });
        for (let i = 0; i < 3; i++) {
          const stonePost = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.7), ishidoroMat);
          stonePost.position.set(-side * 4.8, 2.3, -5 + i * 5);
          toriiGroup.add(stonePost);

          const candle = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), lanternMat);
          candle.position.set(-side * 4.8, 2.8, -5 + i * 5);
          toriiGroup.add(candle);
        }

        pagodaGroup.add(toriiGroup);
      }

      group.add(pagodaGroup);

    } else {
      // 6. Bazaar Boulevard (Market): Full Multi-Story Mediterranean Townhouses & Domed Merchant Mansions
      const wallColors = [0xb45309, 0xd97706, 0x1e3a8a, 0x0284c7, 0x991b1b, 0x854d0e, 0x065f46];
      const wallMat = new THREE.MeshStandardMaterial({
        color: wallColors[index % wallColors.length],
        roughness: 0.85,
        flatShading: true,
      });
      const tileRoofMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.7, flatShading: true });
      const woodTrimMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8, flatShading: true });
      const awningColors = [0xef4444, 0x3b82f6, 0xf59e0b, 0x10b981];
      const awningMat = new THREE.MeshStandardMaterial({
        color: awningColors[index % awningColors.length],
        roughness: 0.4,
        flatShading: true,
      });

      const mktGroup = new THREE.Group();
      mktGroup.position.set(parkwayX, 0, bldZ);

      if (modelVariation === 0) {
        // Model A: Full 3-Story Townhouse with Cantilevered Wooden Balcony, Flower Planter & Fruit Crates
        const bldH = 9.5 + (index % 3) * 1.5;
        const bld = new THREE.Mesh(new THREE.BoxGeometry(8.5, bldH, 20), wallMat);
        bld.position.y = bldH / 2;
        bld.castShadow = true;
        mktGroup.add(bld);

        // Sloped Terracotta Roof with Clay Ridge Tile
        const roof = new THREE.Mesh(new THREE.BoxGeometry(9.4, 1.2, 21), tileRoofMat);
        roof.position.y = bldH + 0.6;
        roof.castShadow = true;
        mktGroup.add(roof);

        // Rooftop Brick Chimney with White Smoke Voxel
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 1.2), tileRoofMat);
        chimney.position.set(side * 2.0, bldH + 2.0, -4);
        mktGroup.add(chimney);

        const smoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
        smoke.position.set(side * 2.0, bldH + 3.8, -4);
        mktGroup.add(smoke);

        // Colorful Fabric Market Stall Awning facing sidewalk
        const awning = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 8.5), awningMat);
        awning.position.set(-side * 4.6, 2.8, 0);
        awning.rotation.z = side * 0.22;
        awning.castShadow = true;
        mktGroup.add(awning);

        // Wooden Fruit Crates Under Awning
        const crateMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85, flatShading: true });
        const melonMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.3, flatShading: true });
        const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3, flatShading: true });

        const crate1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.8), crateMat);
        crate1.position.set(-side * 4.6, 0.4, -2.2);
        mktGroup.add(crate1);

        const melon = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.2), melonMat);
        melon.position.set(-side * 4.6, 0.9, -2.2);
        mktGroup.add(melon);

        const crate2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.8), crateMat);
        crate2.position.set(-side * 4.6, 0.4, 2.2);
        mktGroup.add(crate2);

        const oranges = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.2), orangeMat);
        oranges.position.set(-side * 4.6, 0.9, 2.2);
        mktGroup.add(oranges);

        // Cantilevered Wooden Balcony on Second Floor
        const balcFloor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 7.5), woodTrimMat);
        balcFloor.position.set(-side * 4.8, 5.5, 0);
        mktGroup.add(balcFloor);

        // Flower Planter Box with Blooming Red/Yellow Flowers
        const planter = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 6.8), woodTrimMat);
        planter.position.set(-side * 5.6, 5.8, 0);
        mktGroup.add(planter);

        const flowerMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        for (let fl = 0; fl < 5; fl++) {
          const flower = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), flowerMat);
          flower.position.set(-side * 5.6, 6.2, -2.5 + fl * 1.2);
          mktGroup.add(flower);
        }

        // Hanging Brass Bazaar Lantern
        const lampMat = new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xf59e0b,
          emissiveIntensity: 2.0,
          flatShading: true,
        });
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.45), lampMat);
        lamp.position.set(-side * 5.2, 3.8, -4.2);
        mktGroup.add(lamp);

        // Warm Upper Story Windows
        for (let f = 1; f <= 2; f++) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1.8), this.materials['windowLit']);
          win.position.set(-side * 4.3, 3.0 + f * 2.4, 0);
          mktGroup.add(win);
        }

      } else {
        // Model B: Grand Bazaar Domed Merchant House with Mosaic Bands & Rooftop Dome
        const bldH = 11.0;
        const bld = new THREE.Mesh(new THREE.BoxGeometry(9.0, bldH, 18), wallMat);
        bld.position.y = bldH / 2;
        bld.castShadow = true;
        mktGroup.add(bld);

        // Decorative Mosaic Ceramic Tile Band
        const mosaicMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, flatShading: true });
        const mosaicBand = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.8, 18.3), mosaicMat);
        mosaicBand.position.y = 5.2;
        mktGroup.add(mosaicBand);

        // Golden Rooftop Dome
        const domeMat = new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          metalness: 0.5,
          roughness: 0.3,
          flatShading: true,
        });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
        dome.position.set(0, bldH, 0);
        dome.castShadow = true;
        mktGroup.add(dome);

        // Arched Double Windows
        for (let w = 0; w < 3; w++) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.0, 1.4), this.materials['windowLit']);
          win.position.set(-side * 4.6, 7.5, -4.5 + w * 4.5);
          mktGroup.add(win);
        }

        // Hanging Bazaar Tapestry Banner
        const bannerMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5, flatShading: true });
        const banner = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.0, 1.8), bannerMat);
        banner.position.set(-side * 4.6, 4.0, 5.0);
        mktGroup.add(banner);
      }

      group.add(mktGroup);
    }

    return group;
  }

  private createPropsForMap(side: number, halfRoad: number, sidewalkWidth: number, length: number, index: number): THREE.Group {
    const propGroup = new THREE.Group();
    const type = this.currentMap.propType;
    const parkwayX = side * (halfRoad + sidewalkWidth + 1.8);
    const propZ = (index % 2 === 0 ? 0.25 : -0.25) * length * side;

    if (type === 'palm') {
      // 1. Tropical Coconut Palm Tree on outer parkway
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.8, flatShading: true });
      const frondMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.6, flatShading: true });
      const coconutsMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7, flatShading: true });

      const palmGroup = new THREE.Group();
      for (let s = 0; s < 4; s++) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.36 - s * 0.04, 1.2, 0.36 - s * 0.04), trunkMat);
        seg.position.set(side * s * 0.12, 0.6 + s * 1.1, 0);
        seg.rotation.z = side * -0.06;
        seg.castShadow = true;
        palmGroup.add(seg);
      }
      const coco = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), coconutsMat);
      coco.position.set(side * 0.45, 4.6, 0);
      palmGroup.add(coco);

      const frondGeo = new THREE.BoxGeometry(2.4, 0.15, 0.8);
      for (let a = 0; a < 4; a++) {
        const frond = new THREE.Mesh(frondGeo, frondMat);
        frond.position.set(side * 0.45, 4.9, 0);
        frond.rotation.y = (a * Math.PI) / 2;
        frond.rotation.z = 0.28;
        frond.castShadow = true;
        palmGroup.add(frond);
      }
      palmGroup.position.set(parkwayX, 0.23, propZ);
      propGroup.add(palmGroup);

    } else if (type === 'cactus') {
      // 2. Saguaro Cactus on outer parkway
      const cactusMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8, flatShading: true });
      const cGroup = new THREE.Group();
      const mainStem = new THREE.Mesh(new THREE.BoxGeometry(0.65, 4.4, 0.65), cactusMat);
      mainStem.position.y = 2.2;
      mainStem.castShadow = true;
      cGroup.add(mainStem);

      const arm1H = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.45), cactusMat);
      arm1H.position.set(0.6, 2.3, 0);
      cGroup.add(arm1H);
      const arm1V = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 0.45), cactusMat);
      arm1V.position.set(0.9, 2.8, 0);
      cGroup.add(arm1V);

      const arm2H = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.45), cactusMat);
      arm2H.position.set(-0.6, 1.8, 0);
      cGroup.add(arm2H);
      const arm2V = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.2, 0.45), cactusMat);
      arm2V.position.set(-0.9, 2.2, 0);
      cGroup.add(arm2V);

      cGroup.position.set(parkwayX, 0.23, propZ);
      propGroup.add(cGroup);

    } else if (type === 'pine') {
      // 3. Snow-Capped Alpine Pine on outer parkway
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9, flatShading: true });
      const pineMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.8, flatShading: true });
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, flatShading: true });

      const pGroup = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.5, 0.4), trunkMat);
      trunk.position.y = 1.25;
      pGroup.add(trunk);

      const tiers = [
        { w: 2.6, h: 1.2, y: 2.4, snowH: 0.25 },
        { w: 2.0, h: 1.1, y: 3.4, snowH: 0.25 },
        { w: 1.3, h: 1.0, y: 4.3, snowH: 0.25 },
      ];
      tiers.forEach((t) => {
        const needle = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.w), pineMat);
        needle.position.y = t.y;
        pGroup.add(needle);
        const snow = new THREE.Mesh(new THREE.BoxGeometry(t.w + 0.05, t.snowH, t.w + 0.05), snowMat);
        snow.position.y = t.y + t.h / 2 + 0.1;
        pGroup.add(snow);
      });

      pGroup.position.set(parkwayX, 0.23, propZ);
      propGroup.add(pGroup);

    } else if (type === 'cherry') {
      // 4. Cherry Blossom Tree with Pink Sakura Foliage on outer parkway
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9, flatShading: true });
      const sakuraMatA = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.7, flatShading: true });
      const sakuraMatB = new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.6, flatShading: true });

      const cGroup = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.46, 3.4, 0.46), trunkMat);
      trunk.position.y = 1.7;
      cGroup.add(trunk);

      const folA = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 2.4), sakuraMatA);
      folA.position.y = 3.6;
      cGroup.add(folA);
      const folB = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 1.7), sakuraMatB);
      folB.position.y = 5.0;
      cGroup.add(folB);

      cGroup.position.set(parkwayX, 0.23, propZ);
      propGroup.add(cGroup);

    } else if (type === 'cyber') {
      // 5. Holographic Cyber Pylon / Monolith on outer parkway
      const cyberMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.3, metalness: 0.7, flatShading: true });
      const neonStripMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 1.8, flatShading: true });

      const pGroup = new THREE.Group();
      const column = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.2, 0.6), cyberMat);
      column.position.y = 2.6;
      pGroup.add(column);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.25, 0.65), neonStripMat);
      strip.position.y = 4.4;
      pGroup.add(strip);
      const strip2 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.25, 0.65), neonStripMat);
      strip2.position.y = 2.2;
      pGroup.add(strip2);

      pGroup.position.set(parkwayX, 0.23, propZ);
      propGroup.add(pGroup);

    } else {
      // 6. Default Market Foliage on outer parkway
      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.4, 0.42), this.materials['woodTrunk']);
      trunk.position.y = 1.7;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      const folL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 2.2), this.materials['foliageA']);
      folL.position.y = 3.6;
      folL.castShadow = true;
      treeGroup.add(folL);

      const folU = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 1.5), this.materials['foliageB']);
      folU.position.y = 5.0;
      folU.castShadow = true;
      treeGroup.add(folU);

      treeGroup.position.set(parkwayX, 0.23, propZ);
      propGroup.add(treeGroup);
    }

    return propGroup;
  }

  /**
   * Builds distinct celestial bodies, 3D voxel clouds, and atmospheric horizon scenery for each map biome.
   */
  private buildSkyAndCloudsForMap(): void {
    while (this.skyGroup.children.length > 0) {
      this.skyGroup.remove(this.skyGroup.children[0]);
    }
    this.clouds = [];
    this.celestialMesh = undefined;

    const map = this.currentMap;
    const mapId = map.id;

    // 1. Build Biome-Specific Celestial Body & Sky Environment
    const celestialGroup = new THREE.Group();

    if (mapId === 'market') {
      // Golden Noon Sun & Sun Corona + Soaring Market Pigeons
      const sunGeo = new THREE.SphereGeometry(6.5, 12, 8);
      const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
      const sun = new THREE.Mesh(sunGeo, sunMat);
      sun.position.set(28, 44, -95);
      celestialGroup.add(sun);

      const haloGeo = new THREE.RingGeometry(7.0, 13.5, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(sun.position);
      halo.lookAt(0, 0, 0);
      celestialGroup.add(halo);

      // Soaring Market White Pigeons (V-Wing meshes)
      const birdMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (let b = 0; b < 4; b++) {
        const bird = new THREE.Group();
        bird.userData = { animType: 'bird', baseAngle: b * 1.5, speed: 0.8 + b * 0.2 };
        const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.3), birdMat);
        leftWing.position.x = -0.35;
        leftWing.rotation.z = -0.2;
        bird.add(leftWing);
        const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.3), birdMat);
        rightWing.position.x = 0.35;
        rightWing.rotation.z = 0.2;
        bird.add(rightWing);
        bird.position.set(-15 + b * 10, 26 + (b % 2) * 4, -40 - b * 15);
        celestialGroup.add(bird);
      }

    } else if (mapId === 'tropical_coast') {
      // Blazing Tropical Sun & Large Solar Ring + Soaring Ocean Seagulls + Distant Dunes
      const sunGeo = new THREE.SphereGeometry(7.5, 14, 8);
      const sunMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
      const sun = new THREE.Mesh(sunGeo, sunMat);
      sun.position.set(0, 50, -105);
      celestialGroup.add(sun);

      const haloGeo = new THREE.RingGeometry(8.2, 16.0, 20);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(sun.position);
      halo.lookAt(0, 0, 0);
      celestialGroup.add(halo);

      // 6 Ocean Seagulls gliding in updrafts
      const gullMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
      for (let g = 0; g < 6; g++) {
        const gull = new THREE.Group();
        gull.userData = { animType: 'gull', angle: g * 1.0, radius: 18 + g * 4, baseHeight: 28 + (g % 3) * 3 };
        const w1 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.35), gullMat);
        w1.position.x = -0.42;
        w1.rotation.z = -0.15;
        gull.add(w1);
        const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.35), gullMat);
        w2.position.x = 0.42;
        w2.rotation.z = 0.15;
        gull.add(w2);
        celestialGroup.add(gull);
      }

      // Distant Tropical Island Silhouette Ridge on horizon
      const islandMat = new THREE.MeshBasicMaterial({ color: 0x0369a1 });
      for (let is = 0; is < 5; is++) {
        const dune = new THREE.Mesh(new THREE.ConeGeometry(18 + is * 6, 8, 4), islandMat);
        dune.position.set(-50 + is * 26, 4, -135);
        dune.scale.set(1.5, 0.6, 0.5);
        celestialGroup.add(dune);
      }

    } else if (mapId === 'sunset_desert') {
      // Massive Low Crimson Setting Sun + Fiery Corona + Distant Canyon Mesas
      const sunGeo = new THREE.SphereGeometry(9.5, 16, 10);
      const sunMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
      const sun = new THREE.Mesh(sunGeo, sunMat);
      sun.position.set(-18, 19, -115);
      celestialGroup.add(sun);

      const haloGeo = new THREE.RingGeometry(10.2, 22.0, 20);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(sun.position);
      halo.lookAt(0, 0, 0);
      celestialGroup.add(halo);

      // Distant Jagged Red Sandstone Canyon Ridge Silhouettes
      const ridgeMat = new THREE.MeshBasicMaterial({ color: 0x7c2d12 });
      for (let r = 0; r < 6; r++) {
        const mesa = new THREE.Mesh(new THREE.BoxGeometry(24 + r * 5, 12 + (r % 3) * 4, 8), ridgeMat);
        mesa.position.set(-60 + r * 25, 6, -130);
        celestialGroup.add(mesa);
      }

    } else if (mapId === 'neon_night') {
      // Holographic Neon Moon + Twinkling 3D Voxel Starfield + Flying Cyber Speeders
      const moonMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
      const moon = new THREE.Mesh(new THREE.TorusGeometry(6.0, 1.2, 6, 12, Math.PI * 1.5), moonMat);
      moon.position.set(24, 42, -100);
      moon.rotation.z = 0.6;
      celestialGroup.add(moon);

      const moonCore = new THREE.Mesh(new THREE.SphereGeometry(2.5, 6, 6), new THREE.MeshBasicMaterial({ color: 0xec4899 }));
      moonCore.position.copy(moon.position);
      celestialGroup.add(moonCore);

      // 85 Twinkling 3D Voxel Stars
      const starColors = [0x06b6d4, 0xec4899, 0xa78bfa, 0xffffff, 0x38bdf8];
      const starGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
      for (let s = 0; s < 85; s++) {
        const starMat = new THREE.MeshBasicMaterial({
          color: starColors[s % starColors.length],
          transparent: true,
          opacity: 0.85,
        });
        const star = new THREE.Mesh(starGeo, starMat);
        star.userData = { animType: 'star', phase: s * 0.4 };
        const sx = ((s * 47) % 130) - 65;
        const sy = 18 + ((s * 23) % 40);
        const sz = -120 + ((s * 31) % 110);
        star.position.set(sx, sy, sz);
        celestialGroup.add(star);
      }

      // 3 Flying Cyber Speeders with Neon Light Trails
      for (let sp = 0; sp < 3; sp++) {
        const speeder = new THREE.Group();
        speeder.userData = { animType: 'speeder', speed: 1.4 + sp * 0.4, minX: -60, maxX: 60 };
        const speederBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 0.8), new THREE.MeshBasicMaterial({ color: 0x06b6d4 }));
        speeder.add(speederBody);
        const trail = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: 0xec4899, transparent: true, opacity: 0.7 }));
        trail.position.x = -3.0;
        speeder.add(trail);
        speeder.position.set(-40 + sp * 35, 32 + sp * 5, -80 - sp * 18);
        celestialGroup.add(speeder);
      }

    } else if (mapId === 'winter_peak') {
      // Pale Frost Winter Sun + Towering Alpine Snow Mountain Peaks
      const sunGeo = new THREE.SphereGeometry(6.0, 10, 8);
      const sunMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
      const sun = new THREE.Mesh(sunGeo, sunMat);
      sun.position.set(16, 40, -100);
      celestialGroup.add(sun);

      const haloGeo = new THREE.RingGeometry(6.6, 13.0, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xbae6fd,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(sun.position);
      halo.lookAt(0, 0, 0);
      celestialGroup.add(halo);

      // 6 Towering Jagged Alpine Snow Mountains along horizon
      const rockMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
      const snowCapMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (let m = 0; m < 6; m++) {
        const mtnGroup = new THREE.Group();
        const baseCone = new THREE.Mesh(new THREE.ConeGeometry(20 + m * 4, 30 + (m % 3) * 6, 4), rockMat);
        baseCone.position.y = 14;
        baseCone.rotation.y = Math.PI / 4;
        mtnGroup.add(baseCone);

        const capCone = new THREE.Mesh(new THREE.ConeGeometry(10 + m * 2, 14, 4), snowCapMat);
        capCone.position.y = 22;
        capCone.rotation.y = Math.PI / 4;
        mtnGroup.add(capCone);

        mtnGroup.position.set(-65 + m * 26, 0, -135);
        celestialGroup.add(mtnGroup);
      }

    } else if (mapId === 'golden_temple') {
      // Luminous Golden Harvest Full Moon + Lavender Halo + Floating Sky Lanterns + Starfield
      const moonGeo = new THREE.SphereGeometry(7.5, 14, 10);
      const moonMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const moon = new THREE.Mesh(moonGeo, moonMat);
      moon.position.set(-22, 45, -105);
      celestialGroup.add(moon);

      const haloGeo = new THREE.RingGeometry(8.2, 16.5, 20);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xfbcfe8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(moon.position);
      halo.lookAt(0, 0, 0);
      celestialGroup.add(halo);

      // 75 Golden & White Twinkling Stars
      const starGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      for (let s = 0; s < 75; s++) {
        const sColor = s % 2 === 0 ? 0xfef08a : 0xf472b6;
        const star = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ color: sColor }));
        star.userData = { animType: 'star', phase: s * 0.5 };
        const sx = ((s * 43) % 130) - 65;
        const sy = 16 + ((s * 29) % 40);
        const sz = -120 + ((s * 37) % 110);
        star.position.set(sx, sy, sz);
        celestialGroup.add(star);
      }

      // 8 Floating Paper Sky Lanterns rising gently into the night sky
      const lanternMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      for (let l = 0; l < 8; l++) {
        const pLantern = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.8), lanternMat);
        pLantern.userData = { animType: 'lantern', speed: 0.04 + (l % 3) * 0.02, seed: l };
        pLantern.position.set(-20 + l * 6, 12 + l * 3.5, -45 - l * 8);
        celestialGroup.add(pLantern);
      }
    }

    this.celestialMesh = celestialGroup;
    this.skyGroup.add(celestialGroup);

    // 2. Build 14 Procedural 3D Voxel Clouds for this Map's Cloud Style
    const cloudStyle = map.cloudStyle;
    const cloudCount = 14;

    for (let c = 0; c < cloudCount; c++) {
      const cloudGroup = new THREE.Group();

      // Cloud Palette Selection
      let mainColor = 0xffffff;
      let shadeColor = 0xe0f2fe;

      if (cloudStyle === 'tropical_cumulus') {
        mainColor = 0xfffbeb;
        shadeColor = 0xfde68a;
      } else if (cloudStyle === 'sunset_amber') {
        mainColor = c % 2 === 0 ? 0xfb923c : 0xf59e0b;
        shadeColor = 0x9a3412;
      } else if (cloudStyle === 'cyber_neon') {
        mainColor = c % 2 === 0 ? 0x4c1d95 : 0x1e1b4b;
        shadeColor = 0x06b6d4;
      } else if (cloudStyle === 'snow_blizzard') {
        mainColor = 0xffffff;
        shadeColor = 0x94a3b8;
      } else if (cloudStyle === 'twilight_mist') {
        mainColor = c % 2 === 0 ? 0x581c87 : 0x701a75;
        shadeColor = 0xf472b6;
      }

      const mainMat = new THREE.MeshBasicMaterial({ color: mainColor, transparent: true, opacity: 0.92 });
      const shadeMat = new THREE.MeshBasicMaterial({ color: shadeColor, transparent: true, opacity: 0.85 });

      // Build clustered 3D Voxel Cloud Puff Boxes
      const baseWidth = 4.5 + (c % 3) * 1.5;
      const baseHeight = 1.4 + (c % 2) * 0.4;
      const baseDepth = 2.4 + (c % 2) * 0.8;

      // Central Puff
      const centerPuff = new THREE.Mesh(new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth), mainMat);
      cloudGroup.add(centerPuff);

      // Left & Right Flank Puffs
      const leftPuff = new THREE.Mesh(new THREE.BoxGeometry(baseWidth * 0.65, baseHeight * 0.8, baseDepth * 0.8), shadeMat);
      leftPuff.position.set(-baseWidth * 0.45, -baseHeight * 0.1, 0);
      cloudGroup.add(leftPuff);

      const rightPuff = new THREE.Mesh(new THREE.BoxGeometry(baseWidth * 0.65, baseHeight * 0.8, baseDepth * 0.8), mainMat);
      rightPuff.position.set(baseWidth * 0.45, -baseHeight * 0.1, 0);
      cloudGroup.add(rightPuff);

      // Top Dome Puff
      const topPuff = new THREE.Mesh(new THREE.BoxGeometry(baseWidth * 0.5, baseHeight * 0.7, baseDepth * 0.7), mainMat);
      topPuff.position.set(0, baseHeight * 0.5, 0);
      cloudGroup.add(topPuff);

      // Spread clouds across sky
      const cx = ((c * 37) % 90) - 45;
      const cy = 25 + ((c * 19) % 12);
      const cz = -110 + ((c * 23) % 180);

      cloudGroup.position.set(cx, cy, cz);

      const speedX = 0.015 + ((c % 4) * 0.008);
      const speedZ = 0.01 + ((c % 3) * 0.005);
      const rangeX = 55;

      this.clouds.push({ mesh: cloudGroup, speedX, speedZ, baseOffsetZ: cz, rangeX });
      this.skyGroup.add(cloudGroup);
    }
  }

  /**
   * Initializes high-performance 3D ambient weather particle system uniquely customized per map.
   */
  private initWeatherForMap(): void {
    while (this.weatherGroup.children.length > 0) {
      this.weatherGroup.remove(this.weatherGroup.children[0]);
    }
    this.weatherParticles = [];

    const effect = this.currentMap.weatherEffect;
    let particleCount = 50;

    if (effect === 'cyber_rain' || effect === 'snow') {
      particleCount = 65;
    } else if (effect === 'sand') {
      particleCount = 60;
    }

    for (let i = 0; i < particleCount; i++) {
      let geo: THREE.BufferGeometry;
      let mat: THREE.Material;
      let vx = 0;
      let vy = 0;
      let vz = 0;
      let rotX = 0;
      let rotY = 0;
      let kind = effect;

      if (effect === 'market_breeze') {
        // Confetti petals & warm sunlight motes
        const colors = [0xfacc15, 0xef4444, 0x3b82f6, 0x10b981, 0xf97316];
        geo = new THREE.BoxGeometry(0.18, 0.04, 0.18);
        mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
        vx = (Math.random() - 0.5) * 0.04;
        vy = -0.025 - Math.random() * 0.02;
        vz = 0.04 + Math.random() * 0.03;
        rotX = 0.04;
        rotY = 0.03;

      } else if (effect === 'sea_mist') {
        // Sparkling sea spray foam & green palm leaf fragments
        const isLeaf = i % 4 === 0;
        if (isLeaf) {
          geo = new THREE.BoxGeometry(0.25, 0.04, 0.14);
          mat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
          vx = 0.06 + Math.random() * 0.04;
          vy = -0.03 - Math.random() * 0.02;
          vz = 0.05 + Math.random() * 0.04;
          rotX = 0.06;
          rotY = 0.05;
        } else {
          geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
          mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 });
          vx = 0.04 + Math.random() * 0.03;
          vy = -0.02 - Math.random() * 0.015;
          vz = 0.03 + Math.random() * 0.02;
          rotX = 0.02;
          rotY = 0.02;
        }

      } else if (effect === 'sand') {
        // Swirling desert sand & glowing magma embers
        const isEmber = i % 5 === 0;
        if (isEmber) {
          geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
          mat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
          vx = -0.08 - Math.random() * 0.06;
          vy = 0.015 + Math.random() * 0.02; // Embers float up!
          vz = 0.04 + Math.random() * 0.03;
          rotX = 0.05;
          rotY = 0.05;
        } else {
          geo = new THREE.BoxGeometry(0.15, 0.08, 0.15);
          mat = new THREE.MeshBasicMaterial({ color: 0xd97706, transparent: true, opacity: 0.85 });
          vx = -0.12 - Math.random() * 0.08;
          vy = -0.02 - Math.random() * 0.02;
          vz = 0.05 + Math.random() * 0.04;
          rotX = 0.08;
          rotY = 0.06;
        }

      } else if (effect === 'cyber_rain') {
        // High-velocity vertical neon rain streaks
        geo = new THREE.BoxGeometry(0.06, 1.4, 0.06);
        const rainColor = i % 2 === 0 ? 0x06b6d4 : 0xec4899;
        mat = new THREE.MeshBasicMaterial({ color: rainColor, transparent: true, opacity: 0.85 });
        vx = (Math.random() - 0.5) * 0.02;
        vy = -0.75 - Math.random() * 0.35; // Fast downward rainfall
        vz = 0.06 + Math.random() * 0.04;
        rotX = 0.0;
        rotY = 0.0;

      } else if (effect === 'snow') {
        // 3D Tumbling Snowflakes
        geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
        mat = new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xe0f2fe : 0xffffff });
        vx = (Math.random() - 0.5) * 0.03;
        vy = -0.045 - Math.random() * 0.035;
        vz = 0.02 + Math.random() * 0.02;
        rotX = 0.04;
        rotY = 0.03;

      } else {
        // sakura: Pink cherry blossoms & glowing golden fireflies
        const isFirefly = i % 4 === 0;
        if (isFirefly) {
          geo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
          mat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
          vx = (Math.random() - 0.5) * 0.03;
          vy = 0.01 + Math.random() * 0.015;
          vz = (Math.random() - 0.5) * 0.02;
          rotX = 0.02;
          rotY = 0.02;
        } else {
          geo = new THREE.BoxGeometry(0.24, 0.05, 0.24);
          mat = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xf472b6 : 0xfb7185, transparent: true, opacity: 0.9 });
          vx = (Math.random() - 0.5) * 0.05;
          vy = -0.035 - Math.random() * 0.025;
          vz = 0.03 + Math.random() * 0.02;
          rotX = 0.05;
          rotY = 0.04;
        }
      }

      const mesh = new THREE.Mesh(geo, mat);
      const px = (Math.random() - 0.5) * 24;
      const py = 0.5 + Math.random() * 12;
      const pz = -60 + Math.random() * 80;
      mesh.position.set(px, py, pz);

      this.weatherParticles.push({
        mesh,
        vx,
        vy,
        vz,
        rotX,
        rotY,
        life: Math.random() * 10,
        maxLife: 10,
        kind,
      });

      this.weatherGroup.add(mesh);
    }
  }

  /**
   * Animates clouds drifting across the sky and celestial bodies with camera tracking.
   */
  private updateSkyAndClouds(elapsedTime: number, pz: number): void {
    // Keep entire sky canopy anchored to camera Z so horizon is infinite
    this.skyGroup.position.set(this.camera.position.x * 0.35, 0, pz);

    // 1. Drift 3D Voxel Clouds
    for (let c = 0; c < this.clouds.length; c++) {
      const cloud = this.clouds[c];
      cloud.mesh.position.x += cloud.speedX;

      // Wrap-around seamlessly
      if (cloud.mesh.position.x > cloud.rangeX) {
        cloud.mesh.position.x = -cloud.rangeX;
      }

      // Gentle vertical bobbing
      cloud.mesh.position.y += Math.sin(elapsedTime * 1.5 + c) * 0.005;
    }

    // 2. Animate Dynamic Sky Entities (Birds, Stars, Lanterns, Speeders)
    if (this.celestialMesh) {
      for (const child of this.celestialMesh.children) {
        const udata = child.userData;
        if (!udata || !udata.animType) continue;

        if (udata.animType === 'bird') {
          // Wing flap
          child.rotation.y = Math.sin(elapsedTime * 0.8 + udata.baseAngle) * 0.15;
          child.position.x += Math.sin(elapsedTime * udata.speed) * 0.02;
          child.position.y += Math.cos(elapsedTime * 1.2 + udata.baseAngle) * 0.01;

        } else if (udata.animType === 'gull') {
          // Circular soaring
          const angle = elapsedTime * 0.5 + udata.angle;
          child.position.x = Math.sin(angle) * udata.radius;
          child.position.z = -105 + Math.cos(angle) * (udata.radius * 0.4);
          child.position.y = udata.baseHeight + Math.sin(elapsedTime * 1.1 + udata.angle) * 1.5;
          child.rotation.y = -angle + Math.PI / 2;

        } else if (udata.animType === 'star') {
          // Twinkle pulse
          const op = 0.4 + Math.sin(elapsedTime * 3.5 + udata.phase) * 0.5;
          if ((child as THREE.Mesh).material) {
            ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.max(0.15, Math.min(1.0, op));
          }

        } else if (udata.animType === 'speeder') {
          // Fast cyber cruise
          child.position.x += udata.speed;
          if (child.position.x > udata.maxX) {
            child.position.x = udata.minX;
          }

        } else if (udata.animType === 'lantern') {
          // Gentle ascent with soft swaying
          child.position.y += udata.speed;
          child.position.x += Math.sin(elapsedTime * 1.2 + udata.seed) * 0.015;
          if (child.position.y > 45) {
            child.position.y = 8;
          }
        }
      }
    }
  }

  /**
   * Updates stateful 3D weather particles (rain, snow, sakura, sand, sea mist).
   */
  private updateWeatherParticles(elapsedTime: number, pz: number): void {
    for (let i = 0; i < this.weatherParticles.length; i++) {
      const p = this.weatherParticles[i];
      p.mesh.position.x += p.vx;
      p.mesh.position.y += p.vy;
      p.mesh.position.z += p.vz;
      p.mesh.rotation.x += p.rotX;
      p.mesh.rotation.y += p.rotY;

      // Recycle particles that hit ground or pass behind camera
      const isOutOfBounds =
        (p.vy < 0 && p.mesh.position.y < 0.1) ||
        (p.vy > 0 && p.mesh.position.y > 18) ||
        p.mesh.position.z > (pz + 12) ||
        p.mesh.position.z < (pz - 85);

      if (isOutOfBounds) {
        p.mesh.position.x = (Math.random() - 0.5) * 24;
        p.mesh.position.z = pz - 45 - Math.random() * 30;
        p.mesh.position.y = p.vy < 0 ? (10 + Math.random() * 8) : (0.2 + Math.random() * 1.5);
      }
    }
  }

  public setMap(map: MapDefinition): void {
    this.currentMap = map;
    this.scene.background = new THREE.Color(map.skyColor);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(map.fogColor);
      this.scene.fog.density = map.fogDensity;
    }
    this.dirLight.color.setHex(map.dirLightColor);
    this.hemiLight.color.setHex(map.ambientColor);
    this.hemiLight.groundColor.setHex(map.roadColor);

    if (this.materials['road'] instanceof THREE.MeshStandardMaterial) {
      this.materials['road'].color.setHex(map.roadColor);
    }
    if (this.materials['sidewalk'] instanceof THREE.MeshStandardMaterial) {
      this.materials['sidewalk'].color.setHex(map.sidewalkColor);
    }
    if (this.materials['curb'] instanceof THREE.MeshStandardMaterial) {
      this.materials['curb'].color.setHex(map.curbColor);
    }
    if (this.materials['curbBevel'] instanceof THREE.MeshStandardMaterial) {
      this.materials['curbBevel'].color.setHex(map.curbColor);
    }
    if (this.materials['grass'] instanceof THREE.MeshStandardMaterial) {
      this.materials['grass'].color.setHex(map.grassColor);
    }

    // Clear and rebuild segments for new biome
    while (this.roadGroup.children.length > 0) {
      this.roadGroup.remove(this.roadGroup.children[0]);
    }
    this.roadSegments = [];
    this.buildRoadSegments();
    this.buildSkyAndCloudsForMap();
    this.initWeatherForMap();
    const currentPz = this.playerGroup ? this.playerGroup.position.z : 0;
    this.resetTrack(currentPz);
  }

  public getCurrentMap(): MapDefinition {
    return this.currentMap;
  }

  public resetTrack(pz: number = 0): void {
    // Keep segments continuously anchored around player position
    for (let i = 0; i < this.numSegments; i++) {
      const seg = this.roadSegments[i];
      if (seg) {
        seg.position.z = (pz + this.segmentLength) - i * this.segmentLength;
      }
    }
  }

  public resetCamera(pz: number = 0): void {
    const isPortrait = this.camera.aspect < 0.88;
    this.camera.position.set(0, isPortrait ? 6.2 : 5.2, pz + (isPortrait ? 10.6 : 9.2));
    this.camera.lookAt(0, 1.9, pz - 11.5);
  }

  private buildRoadSegments(): void {
    for (let i = 0; i < this.numSegments; i++) {
      const seg = this.createSegment(i);
      seg.position.z = this.segmentLength - i * this.segmentLength;
      this.roadSegments.push(seg);
      this.roadGroup.add(seg);
    }
  }

  /**
   * Procedural 3D Voxel Dinosaur Player Character (Matches real Dino skins in UI & gameplay)
   */
  private createCharacterMesh(skin?: CharacterSkin): {
    playerGroup: THREE.Group;
    head: THREE.Group;
    torso: THREE.Mesh;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    leftLeg: THREE.Group;
    rightLeg: THREE.Group;
    hatGroup: THREE.Group;
    shadow: THREE.Mesh;
    megaSlapGlove: THREE.Mesh;
    tail?: THREE.Group;
  } {
    const s = skin || this.currentSkin || CHARACTER_SKINS[0];
    const dino = buildDinoCharacterMesh(s);

    this.playerShadow = dino.shadow;
    this.playerFocusGroup = new THREE.Group();
    this.scene.add(this.playerFocusGroup);

    // Retain hidden dummy references so existing interface properties remain valid
    const dummyRingGeo = new THREE.BufferGeometry();
    const dummyRingMat = new THREE.MeshBasicMaterial({ visible: false });
    this.playerFocusRing = new THREE.Mesh(dummyRingGeo, dummyRingMat);
    this.playerFocusRing.visible = false;

    const dummyArrowGeo = new THREE.BufferGeometry();
    const dummyArrowMat = new THREE.MeshBasicMaterial({ visible: false });
    this.playerFocusArrow = new THREE.Mesh(dummyArrowGeo, dummyArrowMat);
    this.playerFocusArrow.visible = false;

    // Floating Overhead Marker removed as requested (no yellow above character head)
    const overheadMarker = new THREE.Group();
    overheadMarker.visible = false;
    this.playerOverheadMarker = overheadMarker;
    this.playerOverheadDiamond = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ visible: false }));

    return {
      playerGroup: dino.rootGroup,
      head: dino.head,
      torso: dino.torso,
      leftArm: dino.leftArm,
      rightArm: dino.rightArm,
      leftLeg: dino.leftLeg,
      rightLeg: dino.rightLeg,
      hatGroup: dino.hatGroup,
      shadow: dino.shadow,
      megaSlapGlove: dino.megaSlapGlove,
      tail: dino.tail,
    };
  }

  public setSkin(skin: CharacterSkin): void {
    this.currentSkin = skin;
    if (this.playerGroup) {
      while (this.playerGroup.children.length > 0) {
        this.playerGroup.remove(this.playerGroup.children[0]);
      }
      const charBuild = this.createCharacterMesh(skin);
      while (charBuild.playerGroup.children.length > 0) {
        this.playerGroup.add(charBuild.playerGroup.children[0]);
      }
      this.playerHead = charBuild.head;
      this.playerTorso = charBuild.torso;
      this.playerLeftArm = charBuild.leftArm;
      this.playerRightArm = charBuild.rightArm;
      this.playerLeftLeg = charBuild.leftLeg;
      this.playerRightLeg = charBuild.rightLeg;
      this.playerHatGroup = charBuild.hatGroup;
      this.playerShadow = charBuild.shadow;
      this.megaSlapGlove = charBuild.megaSlapGlove;
      this.playerTail = charBuild.tail;
    }
  }

  public setCharacterFocus(enabled: boolean): void {
    this.characterFocusEnabled = enabled;
    if (this.playerFocusRing) this.playerFocusRing.visible = false;
    if (this.playerFocusArrow) this.playerFocusArrow.visible = false;
    if (this.playerOverheadMarker) this.playerOverheadMarker.visible = enabled;
    if (this.playerRimLight) this.playerRimLight.intensity = enabled ? 2.6 : 0.8;
  }

  public resize(width: number, height: number, _dpr: number = 1): void {
    this.width = width;
    this.height = height;
    const aspect = width / height;
    this.camera.aspect = aspect;

    // Dynamically scale vertical FOV for narrow portrait mobile screens so all 3 tracks & sidewalks remain in view
    if (aspect < 1.0) {
      this.camera.fov = Math.min(70, 50 + (1.0 - aspect) * 28);
    } else {
      this.camera.fov = 50;
    }
    this.camera.updateProjectionMatrix();

    // Full Native Resolution with high-DPI scaling capped at 2.0
    // Eliminates all blurriness and pixel stretching, rendering crystal clear character lines and text!
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(dpr);
  }

  private shakeEnabled: boolean = true;
  private reducedMotion: boolean = false;

  public setShakeEnabled(enabled: boolean): void {
    this.shakeEnabled = enabled;
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  public triggerShake(intensity: number = 6): void {
    if (!this.shakeEnabled || this.reducedMotion) {
      this.screenShake = 0;
      return;
    }
    this.screenShake = Math.max(this.screenShake, intensity * 0.18);
  }

  public triggerHitFreeze(frames: number = 2): void {
    this.hitFreeze = frames;
  }

  /**
   * Procedural 3D Voxel Intro Target Character (The Smug Boss)
   * Positioned directly in the middle of the road for the opening slap sequence
   */
  private createIntroVictimMesh(): THREE.Group {
    const group = new THREE.Group();

    // Shadow
    const shadowGeo = new THREE.PlaneGeometry(1.7, 1.7);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadow = new THREE.Mesh(shadowGeo, this.materials['shadow']);
    shadow.position.y = 0.02;
    group.add(shadow);

    // Flat materials
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xF2BE9B, roughness: 0.5, flatShading: true });
    const suitMat = new THREE.MeshStandardMaterial({ color: 0x7E22CE, roughness: 0.4, flatShading: true }); // Regal purple suit
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, roughness: 0.2, metalness: 0.6, flatShading: true });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x09090B, roughness: 0.1, metalness: 0.8, flatShading: true });
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x1E1B4B, roughness: 0.5, flatShading: true });
    const tieMat = new THREE.MeshStandardMaterial({ color: 0xEF4444, roughness: 0.4, flatShading: true });

    // Torso (Pompous purple suit with gold chain & red tie)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.15, 0.65), suitMat);
    torso.position.y = 1.35;
    torso.castShadow = true;
    group.add(torso);

    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.08), tieMat);
    tie.position.set(0, 1.45, 0.35);
    group.add(tie);

    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.7), goldMat);
    chain.position.set(0, 1.4, 0.02);
    group.add(chain);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.8), skinMat);
    head.position.y = 2.3;
    head.castShadow = true;
    group.add(head);

    // Sunglasses
    this.introVictimGlasses = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.16), glassMat);
    this.introVictimGlasses.position.set(0, 2.32, 0.42);
    group.add(this.introVictimGlasses);

    // Bowler/Fedora Hat
    this.introVictimHat = new THREE.Group();
    this.introVictimHat.position.set(0, 2.74, 0);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.1, 1.2), hatMat);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.5, 0.78), hatMat);
    crown.position.y = 0.28;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.12, 0.82), goldMat);
    band.position.y = 0.1;
    this.introVictimHat.add(brim, crown, band);
    group.add(this.introVictimHat);

    // Arms
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), suitMat);
    armL.position.set(-0.7, 1.35, 0);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), suitMat);
    armR.position.set(0.7, 1.35, 0);
    group.add(armL, armR);

    // Legs
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x312E81, roughness: 0.6, flatShading: true });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.78, 0.38), pantsMat);
    legL.position.set(-0.26, 0.4, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.78, 0.38), pantsMat);
    legR.position.set(0.26, 0.4, 0);
    group.add(legL, legR);

    group.visible = false;
    this.scene.add(group);
    return group;
  }

  /**
   * Main 3D Render Loop
   */
  public render(
    player: Player,
    bystanders: Bystander[],
    chasers: Chaser[],
    obstacles: Obstacle[],
    coins: Coin[],
    powerups: Powerup[],
    particles: Particle[],
    floatingTexts: FloatingText[],
    _shockwaves: Shockwave[],
    _chaosMultiplier: number,
    feverActive: boolean,
    _mobDistance: number,
    introVictim?: IntroVictim | null,
    introActive?: boolean,
    introPhase?: 'WINDUP' | 'SLAP_IMPACT' | 'BLAST_OFF' | 'DONE',
    fireBreath?: { active: boolean; timeLeft: number; targetX: number; targetY: number }
  ): void {
    if (this.hitFreeze > 0) {
      this.hitFreeze--;
      return;
    }

    const elapsedTime = (performance.now() - this.startTime) / 1000;

    // 1. Atmosphere Transitions
    if (feverActive) {
      this.scene.background = new THREE.Color(0x064e3b);
      (this.scene.fog as THREE.FogExp2).color.setHex(0x059669);
      this.playerPointLight.intensity = 4.0;
      this.playerPointLight.color.setHex(0x34d399);
      if (this.playerRimLight) {
        this.playerRimLight.intensity = 4.5;
        this.playerRimLight.color.setHex(0x6ee7b7);
      }
      if (this.playerFocusRing) {
        (this.playerFocusRing.material as THREE.MeshBasicMaterial).color.setHex(0x34d399);
      }
    } else {
      this.scene.background = new THREE.Color(this.currentMap.skyColor);
      (this.scene.fog as THREE.FogExp2).color.setHex(this.currentMap.fogColor);
      this.playerPointLight.intensity = 1.2;
      this.playerPointLight.color.setHex(this.currentMap.dirLightColor);
      if (this.playerRimLight) {
        this.playerRimLight.intensity = this.characterFocusEnabled ? 2.6 : 0.8;
        this.playerRimLight.color.setHex(0xfffaed);
      }
      if (this.playerFocusRing) {
        const ringCol = this.currentSkin ? (this.currentSkin.id === 'golden_champ' ? 0xf59e0b : (this.currentSkin.id === 'cyber_boxer' ? 0x06b6d4 : (this.currentSkin.id === 'market_ninja' ? 0x10b981 : 0x00f0ff))) : 0x00f0ff;
        (this.playerFocusRing.material as THREE.MeshBasicMaterial).color.setHex(ringCol);
        (this.playerFocusArrow.material as THREE.MeshBasicMaterial).color.setHex(ringCol);
      }
    }

    // Flame Mode repaints the air around the runner for ten seconds.
    const fireMode = (player.fireTime || 0) > 0;
    if (fireMode && !feverActive) {
      this.scene.background = new THREE.Color(0x2a1508);
      (this.scene.fog as THREE.FogExp2).color.setHex(0x7c2d12);
      this.playerPointLight.intensity = 2.6;
      this.playerPointLight.color.setHex(0xff7a18);
      if (this.playerRimLight) {
        this.playerRimLight.intensity = 3.4;
        this.playerRimLight.color.setHex(0xffb066);
      }
    }

    // 2. Map Player World Coordinates
    const px = player.x * SCALE_X;
    const pz = -player.y * SCALE_Y;
    const py = (player.z || 0) * SCALE_Z;

    this.playerGroup.position.set(px, py, pz);
    this.playerPointLight.position.set(px, py + 1.6, pz);

    this.playerFireAura.visible = fireMode;
    this.playerFireLight.visible = fireMode;
    if (fireMode) {
      this.playerFireAura.position.set(px, py, pz);
      this.playerFireLight.position.set(px, py + 1.6, pz - 0.3);
      this.playerFireLight.intensity = 3.1 + Math.sin(elapsedTime * 18) * 0.5;
      this.fireAuraFlames.forEach((flame, index) => {
        const pulse = 0.9 + Math.sin(elapsedTime * 11 + index * 1.7) * 0.22;
        flame.scale.set(pulse, 1.15 + pulse * 0.35, pulse);
        flame.rotation.y = elapsedTime * 2.4 + index;
      });
    }
    if (this.playerRimLight) {
      this.playerRimLight.position.set(px, py + 3.2, pz + 2.5);
    }

    // Update Ground Contact Shadow (anchored on asphalt road surface at y = 0.02)
    if (this.playerFocusGroup) {
      this.playerFocusGroup.position.set(px, 0.02, pz);
      if (this.playerFocusRing) {
        this.playerFocusRing.visible = false;
      }
      if (this.playerFocusArrow) {
        this.playerFocusArrow.visible = false;
      }

      // Scale shadow with jump height
      const shadowScale = Math.max(0.35, 1.0 - py * 0.18);
      this.playerShadow.scale.set(shadowScale, shadowScale, shadowScale);
      (this.playerShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.15, 0.45 - py * 0.12);
    }

    // Animate Overhead Hero Diamond Beacon
    if (this.playerOverheadMarker && this.playerOverheadDiamond) {
      this.playerOverheadMarker.position.y = 3.35 + Math.sin(elapsedTime * 5) * 0.08;
      this.playerOverheadDiamond.rotation.y = elapsedTime * 2.8;
      this.playerOverheadDiamond.rotation.x = Math.sin(elapsedTime * 3) * 0.2;
    }

    // 3. Dynamic Athletic Running Leg Movement & Slap Animations
    // The torso, head, and whole body frame move solidly without sideways sway or wobble.
    this.playerGroup.rotation.set(0, 0, 0);

    // Lock torso and head solidly to prevent any body wobble or swaying
    this.playerTorso.position.set(0, 1.38, 0);
    this.playerTorso.rotation.set(0, 0, 0);
    this.playerHead.position.set(0, 2.24, 0);
    this.playerHead.rotation.set(0, 0, 0);
    if (this.playerHatGroup) {
      this.playerHatGroup.position.set(0, 2.24, 0);
      this.playerHatGroup.rotation.set(0, 0, 0);
    }

    // Anchor leg hips solidly at their anatomical joint (y = 0.85)
    this.playerLeftLeg.position.set(-0.25, 0.85, 0);
    this.playerRightLeg.position.set(0.25, 0.85, 0);

    // Natural energetic running stride cycle driven by distance run & cadence
    const spd = player.speed && player.speed > 0.1 ? player.speed : 4.8;
    const isMoving = spd > 0.2;
    const runCycle = (player.y * 0.15) + (elapsedTime * 4.0);
    const legSwing = isMoving ? Math.sin(runCycle) * 0.82 : 0;

    // Both legs swing in natural reciprocating running stride
    this.playerLeftLeg.rotation.set(legSwing, 0, 0);
    this.playerRightLeg.rotation.set(-legSwing, 0, 0);

    // Dynamic 3D Voxel SLAP! Glove / Intro Windup / Runner Arms
    if (introActive && introPhase === 'WINDUP') {
      // Coil the tail like a whip: no boxing glove, the opening strike is a
      // full-body tail lash. Arms brace against the torso while it winds up.
      this.playerGroup.rotation.y = -0.32;
      this.playerRightArm.position.set(0.5, 1.4, -0.05);
      this.playerRightArm.rotation.set(0.55, 0.4, 0.3);
      this.playerLeftArm.position.set(-0.5, 1.4, -0.05);
      this.playerLeftArm.rotation.set(0.45, -0.4, -0.3);
      this.megaSlapGlove.visible = false;

      if (this.playerTail) {
        const coil = Math.sin(elapsedTime * 7) * 0.12;
        this.playerTail.scale.set(1.12, 1.12, 1.12);
        this.playerTail.rotation.y = -2.05 - coil;
        this.playerTail.rotation.x = -0.32;
      }
    } else if (player.isWhipping) {
      const swing = Math.sin(Math.min(1, player.whipProgress) * Math.PI);
      this.playerGroup.rotation.y = swing * Math.PI * 2;
      this.playerGroup.rotation.z = -swing * 0.16;
      this.playerLeftArm.position.set(-0.5, 1.4, 0);
      this.playerLeftArm.rotation.set(-0.2, 0, -0.5);
      this.playerRightArm.position.set(0.5, 1.4, 0);
      this.playerRightArm.rotation.set(-0.2, 0, 0.5);
      this.megaSlapGlove.visible = false;

      if (this.playerTail) {
        this.playerTail.scale.set(1.24, 1.24, 1 + swing * 1.35);
        this.playerTail.rotation.y = -2.3 + swing * 1.5;
        this.playerTail.rotation.x = -0.34 - swing * 0.22;
      }
    } else if (player.isSlapping) {
      const slapProgress = player.slapProgress;
      const isLeft = player.slapHand === 'left';
      const whipProgress = Math.sin(slapProgress * Math.PI);

      // Fast, powerful 360-degree Dino Tail-Whip Spin!
      const spin = Math.sin(slapProgress * Math.PI) * Math.PI * 2 * (isLeft ? -1 : 1);
      this.playerGroup.rotation.y = spin;

      if (this.playerTail) {
        // Dynamic Tail Reach Extension: Stretches out toward target during apex of whip
        const reachExt = 1 + whipProgress * 0.9;
        this.playerTail.scale.set(1.15, 1.15, reachExt);
        // Wide lateral whip swing that sweeps out to reach the roadside targets
        this.playerTail.rotation.y = (isLeft ? 1 : -1) * (1.75 + whipProgress * 0.95);
        this.playerTail.rotation.x = -0.22 - whipProgress * 0.25;
      }
      this.megaSlapGlove.visible = false;
    } else {
      this.playerGroup.rotation.y = 0;
      if (this.playerTail) {
        this.playerTail.scale.set(1, 1, 1);
        this.playerTail.rotation.y = isMoving ? Math.sin(runCycle * 2) * 0.38 : 0;
        this.playerTail.rotation.x = -0.12 + Math.sin(runCycle * 4) * 0.06;
      }
      // Natural athletic arms pumping opposite to legs while running
      const armSwing = isMoving ? Math.sin(runCycle) * 0.65 : 0;
      this.playerLeftArm.position.set(-0.55, 1.35, 0);
      this.playerLeftArm.rotation.set(-armSwing, 0, 0);
      this.playerRightArm.position.set(0.55, 1.35, 0);
      this.playerRightArm.rotation.set(armSwing, 0, 0);
      this.megaSlapGlove.visible = false;
    }

    // Recovery Invulnerability Flicker effect
    if (player.invulnerableTimer && player.invulnerableTimer > 0) {
      this.playerGroup.visible = Math.floor(elapsedTime * 24) % 2 === 0;
    } else {
      this.playerGroup.visible = true;
    }

    // 4. Infinite Looping Boulevard Track Segments with Auto-Recovery
    let maxZ = -Infinity;
    let minZ = Infinity;
    this.roadSegments.forEach((s) => {
      if (s.position.z > maxZ) maxZ = s.position.z;
      if (s.position.z < minZ) minZ = s.position.z;
    });

    // If segments ever become desynced from current player position (e.g. game restart or fast menu transition)
    if (maxZ < pz - this.segmentLength * 0.5 || minZ > pz + this.segmentLength * 2) {
      this.resetTrack(pz);
    } else {
      this.roadSegments.forEach((seg) => {
        if (seg.position.z > pz + this.segmentLength * 1.2) {
          let currentMinZ = pz;
          this.roadSegments.forEach((s) => {
            if (s.position.z < currentMinZ) currentMinZ = s.position.z;
          });
          seg.position.z = currentMinZ - this.segmentLength;
        }
      });
    }

    // 5. Follow Camera (Closer, high-clarity arcade follow framing)
    const isPortrait = this.camera.aspect < 0.88;
    let targetCamX = px * (isPortrait ? 0.35 : 0.48);
    let targetCamY = (isPortrait ? 6.2 : 5.2) + py * 0.35;
    let targetCamZ = pz + (isPortrait ? 10.6 : 9.2);
    let targetLookX = px * 0.35;
    let targetLookY = 1.9 + py * 0.4;
    let targetLookZ = pz - 11.5;

    if (introActive) {
      if (introPhase === 'WINDUP') {
        // Dramatic cinematic face-off angle right in front of the smug target
        targetCamX = 0;
        targetCamY = isPortrait ? 4.2 : 3.4;
        targetCamZ = pz + (isPortrait ? 9.2 : 7.8);
        targetLookX = 0;
        targetLookY = 1.85;
        targetLookZ = pz - 1.6;
      } else {
        // Smooth transition easing out as the victim flies away
        targetCamX = 0;
        targetCamY = isPortrait ? 6.2 : 5.2;
        targetCamZ = pz + (isPortrait ? 10.6 : 9.2);
        targetLookX = 0;
        targetLookY = 1.9;
        targetLookZ = pz - 8.0;
      }
    }

    // Apply Screen Shake
    if (this.screenShake > 0.01) {
      targetCamX += (Math.random() - 0.5) * this.screenShake;
      targetCamY += (Math.random() - 0.5) * this.screenShake;
      this.screenShake *= 0.88;
    }

    const camEase = introActive ? 0.20 : 0.18;
    this.camera.position.x += (targetCamX - this.camera.position.x) * camEase;
    this.camera.position.y += (targetCamY - this.camera.position.y) * camEase;
    this.camera.position.z += (targetCamZ - this.camera.position.z) * (camEase + 0.03);
    this.camera.lookAt(targetLookX, targetLookY, targetLookZ);

    // Track sunlight along road
    this.dirLight.position.set(px + 16, 32, pz + 22);
    this.dirLight.target.position.set(px, 0, pz - 12);
    this.dirLight.target.updateMatrixWorld();

    // 6. Update Entities
    this.renderObstacles(obstacles);
    this.renderBystanders(bystanders, player, elapsedTime);
    this.renderChasers(chasers, elapsedTime);
    this.renderCollectibles(coins, powerups, elapsedTime);
    this.renderParticlesAndTexts(particles, floatingTexts);
    this.renderFireBreath(player, obstacles, fireBreath);
    this.renderIntroVictim(introVictim, introActive);
    this.updateSkyAndClouds(elapsedTime, pz);
    this.updateWeatherParticles(elapsedTime, pz);

    // Render WebGL frame
    this.renderer.render(this.scene, this.camera);
  }

  private renderIntroVictim(victim?: IntroVictim | null, introActive?: boolean): void {
    if (!introActive || !victim) {
      this.introVictimGroup.visible = false;
      return;
    }

    this.introVictimGroup.visible = true;
    const vx = victim.x * SCALE_X;
    const vy = (victim.z || 0) * SCALE_Z;
    const vz = -victim.y * SCALE_Y;
    this.introVictimGroup.position.set(vx, vy, vz);
    this.introVictimGroup.rotation.set(victim.rotationX || 0, victim.rotationY || 0, victim.rotationZ || 0);

    if (victim.glassesFlew) {
      this.introVictimGlasses.position.y += 0.12;
      this.introVictimGlasses.position.z += 0.08;
      this.introVictimGlasses.rotation.x += 0.25;
      this.introVictimGlasses.rotation.y += 0.15;
    } else {
      this.introVictimGlasses.position.set(0, 2.32, 0.42);
      this.introVictimGlasses.rotation.set(0, 0, 0);
    }

    if (victim.hatFlew) {
      this.introVictimHat.position.y += 0.18;
      this.introVictimHat.position.x += 0.06;
      this.introVictimHat.rotation.z += 0.22;
      this.introVictimHat.rotation.x += 0.12;
    } else {
      this.introVictimHat.position.set(0, 2.74, 0);
      this.introVictimHat.rotation.set(0, 0, 0);
    }
  }

  private renderObstacles(obstacles: Obstacle[]): void {
    const activeIds = new Set<number>();

    for (const obs of obstacles) {
      activeIds.add(obs.id);
      let mesh = this.obstacleMeshes.get(obs.id);

      if (!mesh) {
        mesh = this.createObstacleMesh(obs);
        this.obstacleMeshes.set(obs.id, mesh);
        this.scene.add(mesh);
      }

      const oz = (obs.z || 0) * SCALE_Z;
      mesh.position.set(obs.x * SCALE_X, oz, -obs.y * SCALE_Y);
      // Rolling props spin around their own centre, not around the road, or a
      // quarter turn sinks half the mesh under the asphalt.
      const spin = mesh.userData.spin as THREE.Group | undefined;
      if (spin) {
        spin.rotation.x = obs.rotation || 0;
        mesh.rotation.x = 0;
      } else {
        mesh.rotation.x = obs.rotation || 0;
      }
      mesh.rotation.y = obs.rotationY || 0;
      mesh.rotation.z = obs.rotationZ || 0;

      // Tumbling physics rotation when hit
      if (obs.burning) {
        // It burns where it stands: shrink towards ash instead of tumbling,
        // and skip the shared-opacity knock-aside treatment.
        const burn = Math.max(0, Math.min(1, obs.burnProgress ?? 0));
        mesh.scale.setScalar(Math.max(0.001, 1 - burn));
        mesh.position.y = oz + burn * 0.6;
      } else if (obs.hit) {
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material && 'opacity' in child.material) {
            child.material.transparent = true;
            child.material.opacity = 0.85;
          }
        });
      }
    }

    for (const [id, mesh] of this.obstacleMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.obstacleMeshes.delete(id);
      }
    }
  }

  private createObstacleMesh(obs: Obstacle): THREE.Group {
    const group = new THREE.Group();

    if (obs.type === 'barrel' || obs.type === 'loop_boulder' || obs.type === 'crate') {
      // Chunky Voxel Wooden Fruit Crate stacked with fresh market fruit (replaces dark boulder/barrel).
      // Built on a pivot at the crate's own centre: the whole group is rotated
      // to roll, so the pivot has to sit where the mass sits or the spin drags
      // the crate through the road. 0.64 splits the difference between the box
      // lying flat (half-height 0.575) and standing on its end (half-depth 0.7).
      const PIVOT_Y = 0.64;
      const spin = new THREE.Group();
      spin.position.y = PIVOT_Y;
      group.add(spin);
      group.userData.spin = spin;

      const crateGeo = new THREE.BoxGeometry(1.7, 1.15, 1.4);
      const crate = new THREE.Mesh(crateGeo, this.materials['crateWood']);
      crate.castShadow = true;
      spin.add(crate);

      // Pixel Fruit Cubes on top
      const fruitGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
      const fruit1 = new THREE.Mesh(fruitGeo, this.materials['apple']);
      fruit1.position.set(-0.35, 1.25 - PIVOT_Y, -0.2);
      spin.add(fruit1);
      const fruit2 = new THREE.Mesh(fruitGeo, this.materials['orange']);
      fruit2.position.set(0.35, 1.25 - PIVOT_Y, 0.15);
      spin.add(fruit2);
      const fruit3 = new THREE.Mesh(fruitGeo, this.materials['apple']);
      fruit3.position.set(0, 1.35 - PIVOT_Y, 0);
      spin.add(fruit3);
    } else if (obs.type === 'spikes') {
      // Prehistoric Obsidian / Bone Spikes
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 });
      const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 1.2), baseMat);
      baseMesh.position.y = 0.1;
      baseMesh.castShadow = true;
      group.add(baseMesh);

      const spikeGeo = new THREE.ConeGeometry(0.22, 0.85, 5);
      const spikeMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.3,
        metalness: 0.5,
        flatShading: true,
      });
      const spikePositions = [-0.65, -0.32, 0, 0.32, 0.65];
      spikePositions.forEach((sx, idx) => {
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.set(sx, 0.52, (idx % 2 === 0 ? 0.15 : -0.15));
        spike.castShadow = true;
        group.add(spike);
      });
    } else if (obs.type === 'shifting_block') {
      // Heavy Mechanical Sliding Hazard Block with Caution Stripes & Hazard Light
      const blockGeo = new THREE.BoxGeometry(2.3, 1.4, 1.2);
      const blockMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.7,
        metalness: 0.3,
      });
      const blockMesh = new THREE.Mesh(blockGeo, blockMat);
      blockMesh.position.y = 0.7;
      blockMesh.castShadow = true;
      group.add(blockMesh);

      // Yellow caution face plate
      const plateGeo = new THREE.BoxGeometry(2.32, 0.45, 1.22);
      const plate = new THREE.Mesh(plateGeo, this.materials['orangeStripe']);
      plate.position.y = 0.7;
      group.add(plate);

      // Warning beacon light on top
      const beaconGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.32, 8);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = 1.55;
      group.add(beacon);
    } else if (obs.type === 'firewall') {
      // Fiery Stone Brazier Barrier with Leaping Flames
      const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.8), this.materials['crateWood']);
      baseMesh.position.y = 0.25;
      baseMesh.castShadow = true;
      group.add(baseMesh);

      const flameGeo = new THREE.ConeGeometry(0.28, 1.1, 6);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const flameCoreMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

      for (let i = -2; i <= 2; i++) {
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.set(i * 0.45, 0.95, 0);
        group.add(flame);
        const core = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.6, 6), flameCoreMat);
        core.position.set(i * 0.45, 0.7, 0);
        group.add(core);
      }
    } else if (obs.type === 'ramp' || obs.type === 'terminal_ramp') {
      // Stepped Voxel Jump Ramp with Glowing Neon Arrows
      const rampGeo = new THREE.BoxGeometry(2.3, 0.85, 2.6);
      rampGeo.rotateX(-0.28);
      const ramp = new THREE.Mesh(
        rampGeo,
        obs.type === 'terminal_ramp'
          ? new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.4, metalness: 0.2 })
          : this.materials['ramp']
      );
      ramp.position.y = 0.38;
      ramp.castShadow = true;
      group.add(ramp);

      // Pixel Arrow Cubes
      const arrowGeo = new THREE.BoxGeometry(0.24, 0.08, 0.24);
      arrowGeo.rotateX(-0.28);
      const arrowColor = obs.type === 'terminal_ramp' ? 0x6ee7b7 : 0xfef08a;
      for (let a = -2; a <= 2; a++) {
        const arrowCube = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: arrowColor }));
        arrowCube.position.set(a * 0.3, 0.7 - Math.abs(a) * 0.15, 0.2);
        group.add(arrowCube);
      }
    } else if (obs.type === 'cart') {
      // Voxel Market Pushcart with wooden wheels and striped awning
      const cartBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 1.3), this.materials['crateWood']);
      cartBody.position.y = 0.8;
      cartBody.castShadow = true;
      group.add(cartBody);

      // Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.15, 8);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheelL = new THREE.Mesh(wheelGeo, this.materials['wood']);
      wheelL.position.set(-1.05, 0.38, 0);
      group.add(wheelL);
      const wheelR = new THREE.Mesh(wheelGeo, this.materials['wood']);
      wheelR.position.set(1.05, 0.38, 0);
      group.add(wheelR);

      // Striped Awning Cover
      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.15, 1.4), this.materials['orangeStripe']);
      roof.position.y = 1.6;
      group.add(roof);
    } else if (obs.type === 'cafe_table') {
      // Bistro Café Table with Striped Umbrella and Coffee Mug
      const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 10), this.materials['wood']);
      tableTop.position.y = 0.85;
      tableTop.castShadow = true;
      group.add(tableTop);

      const tablePost = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.85, 8), this.materials['curb']);
      tablePost.position.y = 0.42;
      group.add(tablePost);

      // Parasol Canopy
      const umbrellaGeo = new THREE.ConeGeometry(1.3, 0.65, 8);
      const umbrella = new THREE.Mesh(umbrellaGeo, this.materials['orangeStripe']);
      umbrella.position.y = 1.95;
      umbrella.castShadow = true;
      group.add(umbrella);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 6), this.materials['whiteStripe']);
      pole.position.y = 1.45;
      group.add(pole);

      // Coffee Mug
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 6), this.materials['whiteStripe']);
      mug.position.set(0.3, 0.96, 0.2);
      group.add(mug);
    } else if (obs.type === 'watermelon') {
      // Market Watermelon Display Stand with Slices
      const stand = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 1.2), this.materials['crateWood']);
      stand.position.y = 0.28;
      stand.castShadow = true;
      group.add(stand);

      // Big Striped Watermelon
      const melonMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.35, flatShading: true });
      const melon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), melonMat);
      melon.position.set(-0.35, 0.82, 0);
      melon.scale.set(1.15, 0.95, 0.95);
      melon.castShadow = true;
      group.add(melon);

      // Cut Red Watermelon Slice
      const sliceMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25, flatShading: true });
      const slice = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.18, 8, 1, false, 0, Math.PI), sliceMat);
      slice.position.set(0.4, 0.72, 0);
      slice.rotation.z = Math.PI / 2;
      slice.castShadow = true;
      group.add(slice);
    } else if (obs.type === 'surf_rack') {
      // Tropical Surfboard Rack with 3 Colorful Boards
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85, flatShading: true });
      const rackFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 0.9), rackMat);
      rackFrame.position.y = 0.15;
      rackFrame.castShadow = true;
      group.add(rackFrame);

      const boardColors = [0x06b6d4, 0xf43f5e, 0xfacc15];
      for (let s = 0; s < 3; s++) {
        const boardMat = new THREE.MeshStandardMaterial({ color: boardColors[s], roughness: 0.3, flatShading: true });
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.48, 2.2, 0.14), boardMat);
        board.position.set(-0.6 + s * 0.6, 1.15, (s % 2 === 0 ? 0.08 : -0.08));
        board.rotation.z = (s - 1) * 0.08;
        board.castShadow = true;
        group.add(board);
      }
    } else if (obs.type === 'tiki_totem') {
      // Carved Tropical Tiki Totem Statue with Glowing Eyes
      const totemMat = new THREE.MeshStandardMaterial({ color: 0x5c2e0b, roughness: 0.9, flatShading: true });
      const totem = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.3, 1.1), totemMat);
      totem.position.y = 1.15;
      totem.castShadow = true;
      group.add(totem);

      // Glowing Eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.15), eyeMat);
      eyeL.position.set(-0.3, 1.6, 0.55);
      const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.15), eyeMat);
      eyeR.position.set(0.3, 1.6, 0.55);
      group.add(eyeL, eyeR);

      // Grimacing Teeth
      const teethMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.12), teethMat);
      mouth.position.set(0, 1.15, 0.55);
      group.add(mouth);
    } else if (obs.type === 'beach_lounger') {
      // Seaside Striped Cabana Beach Deck Chair
      const woodMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7, flatShading: true });
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, flatShading: true });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.35, 1.2), woodMat);
      frame.position.y = 0.25;
      frame.castShadow = true;
      group.add(frame);

      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 1.1), seatMat);
      seat.position.y = 0.42;
      group.add(seat);

      const backRest = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 0.14), seatMat);
      backRest.position.set(0, 0.75, -0.45);
      backRest.rotation.x = -0.35;
      backRest.castShadow = true;
      group.add(backRest);
    } else if (obs.type === 'coconut_crate') {
      // Tropical Tiki Coconut Crate
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.05, 1.3), this.materials['crateWood']);
      crate.position.y = 0.52;
      crate.castShadow = true;
      group.add(crate);

      // Coconuts
      const nutMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.95, flatShading: true });
      [[-0.35, -0.2], [0.35, -0.2], [-0.35, 0.2], [0.35, 0.2]].forEach(([nx, nz]) => {
        const nut = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 6), nutMat);
        nut.position.set(nx, 1.12, nz);
        group.add(nut);
      });
    } else if (obs.type === 'cactus_cluster') {
      // Desert Saguaro Cactus Hazard with Prickles
      const cactusMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85, flatShading: true });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 2.3, 8), cactusMat);
      stem.position.y = 1.15;
      stem.castShadow = true;
      group.add(stem);

      // Left Arm
      const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 6), cactusMat);
      armL.position.set(-0.55, 1.45, 0);
      armL.castShadow = true;
      group.add(armL);

      // Right Arm
      const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.95, 6), cactusMat);
      armR.position.set(0.55, 1.25, 0);
      armR.castShadow = true;
      group.add(armR);
    } else if (obs.type === 'dino_skull') {
      // Giant Prehistoric Dinosaur Horned Skull
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7, flatShading: true });
      const cranium = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.4), boneMat);
      cranium.position.y = 0.85;
      cranium.castShadow = true;
      group.add(cranium);

      // Left & Right Horns
      const hornGeo = new THREE.ConeGeometry(0.18, 1.1, 6);
      const hornL = new THREE.Mesh(hornGeo, boneMat);
      hornL.position.set(-0.6, 1.45, 0.35);
      hornL.rotation.z = -0.35;
      hornL.rotation.x = -0.25;
      const hornR = new THREE.Mesh(hornGeo, boneMat);
      hornR.position.set(0.6, 1.45, 0.35);
      hornR.rotation.z = 0.35;
      hornR.rotation.x = -0.25;
      group.add(hornL, hornR);
    } else if (obs.type === 'canyon_mesa') {
      // Stratified Sandstone Mesa Rock Barrier
      const rockMat1 = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.95, flatShading: true });
      const rockMat2 = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.95, flatShading: true });
      const baseRock = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 1.3), rockMat1);
      baseRock.position.y = 0.42;
      baseRock.castShadow = true;
      group.add(baseRock);

      const topRock = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.75, 1.0), rockMat2);
      topRock.position.set(0.1, 1.15, 0);
      topRock.castShadow = true;
      group.add(topRock);
    } else if (obs.type === 'holo_barrier') {
      // Cyber Neon Cyan Laser Forcefield Grid
      const postMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8, flatShading: true });
      const laserMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.75 });

      const postL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 0.3), postMat);
      postL.position.set(-1.0, 1.1, 0);
      postL.castShadow = true;
      const postR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 0.3), postMat);
      postR.position.set(1.0, 1.1, 0);
      postR.castShadow = true;
      group.add(postL, postR);

      // Glowing Horizontal Laser Beams
      for (let l = 0; l < 4; l++) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.08), laserMat);
        beam.position.set(0, 0.5 + l * 0.45, 0);
        group.add(beam);
      }
    } else if (obs.type === 'cyber_server') {
      // Blinking Mainframe Server Tower
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.4, metalness: 0.6, flatShading: true });
      const server = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 1.1), rackMat);
      server.position.y = 1.15;
      server.castShadow = true;
      group.add(server);

      // Blinking Status LEDs
      const ledMat1 = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const ledMat2 = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
      for (let r = 0; r < 5; r++) {
        const led1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.05), ledMat1);
        led1.position.set(-0.35, 0.5 + r * 0.35, 0.56);
        const led2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.05), ledMat2);
        led2.position.set(0.35, 0.5 + r * 0.35, 0.56);
        group.add(led1, led2);
      }
    } else if (obs.type === 'drone_hazard') {
      // Hovering Surveillance Hazard Drone
      const droneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.7, flatShading: true });
      const droneBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.9), droneMat);
      droneBody.position.y = 1.6;
      droneBody.castShadow = true;
      group.add(droneBody);

      // Red Scanner Eye
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      eye.position.set(0, 1.45, 0.4);
      group.add(eye);

      // Red Downward Scanning Beam
      const scanMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.35 });
      const scanCone = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.4, 6), scanMat);
      scanCone.position.set(0, 0.7, 0);
      group.add(scanCone);
    } else if (obs.type === 'ice_spikes') {
      // Jagged Translucent Glacial Ice Stalagmites
      const iceMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.15,
        metalness: 0.2,
        transparent: true,
        opacity: 0.85,
        flatShading: true,
      });
      const snowBase = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 1.2), this.materials['sidewalk']);
      snowBase.position.y = 0.12;
      group.add(snowBase);

      const spikePositions = [-0.6, -0.2, 0.25, 0.65];
      spikePositions.forEach((sx, idx) => {
        const h = 1.2 + (idx % 2) * 0.5;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.26, h, 5), iceMat);
        spike.position.set(sx, h / 2 + 0.15, (idx % 2 === 0 ? 0.1 : -0.1));
        spike.castShadow = true;
        group.add(spike);
      });
    } else if (obs.type === 'snow_bale') {
      // Packed Frozen Snow Rampart with Warning Flag
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9, flatShading: true });
      const fort = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.15, 1.2), snowMat);
      fort.position.y = 0.58;
      fort.castShadow = true;
      group.add(fort);

      // Ski Pole & Warning Pennant
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), this.materials['whiteStripe']);
      pole.position.set(0.7, 1.3, 0);
      group.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.04), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      flag.position.set(0.85, 1.9, 0);
      group.add(flag);
    } else if (obs.type === 'timber_sled') {
      // Nordic Alpine Husky Sled with Loaded Cargo
      const sledMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8, flatShading: true });
      const runnerL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 2.2), sledMat);
      runnerL.position.set(-0.7, 0.15, 0);
      const runnerR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 2.2), sledMat);
      runnerR.position.set(0.7, 0.15, 0);
      group.add(runnerL, runnerR);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 1.9), sledMat);
      deck.position.y = 0.35;
      deck.castShadow = true;
      group.add(deck);

      const sack = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 1.2), new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 }));
      sack.position.set(0, 0.8, -0.1);
      sack.castShadow = true;
      group.add(sack);
    } else if (obs.type === 'torii_gate') {
      // Vermilion Lacquered Japanese Torii Gate Barrier
      const toriiMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, flatShading: true });
      const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.3, 8), toriiMat);
      postL.position.set(-0.95, 1.15, 0);
      postL.castShadow = true;
      const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.3, 8), toriiMat);
      postR.position.set(0.95, 1.15, 0);
      postR.castShadow = true;
      group.add(postL, postR);

      // Top Crossbeam
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.32, 0.35), toriiMat);
      beam.position.set(0, 2.15, 0);
      beam.castShadow = true;
      group.add(beam);
    } else if (obs.type === 'stone_lantern') {
      // Traditional Granite Ishidoro Pagoda Garden Lantern
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9, flatShading: true });
      const lanternBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 1.1), stoneMat);
      lanternBase.position.y = 0.2;
      group.add(lanternBase);

      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.1, 6), stoneMat);
      pillar.position.y = 0.85;
      pillar.castShadow = true;
      group.add(pillar);

      // Lit Light Chamber
      const lightChamber = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
      lightChamber.position.y = 1.6;
      group.add(lightChamber);

      // Pagoda Flared Roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.45, 4), stoneMat);
      roof.position.y = 2.05;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);
    } else if (obs.type === 'zen_barrier') {
      // Golden Bamboo Screen Fence with Crimson Cord
      const bambooMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75, flatShading: true });
      for (let p = 0; p < 7; p++) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.7, 6), bambooMat);
        stalk.position.set(-0.9 + p * 0.3, 0.85, 0);
        stalk.castShadow = true;
        group.add(stalk);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.16), new THREE.MeshBasicMaterial({ color: 0x991b1b }));
      rail.position.set(0, 1.1, 0);
      group.add(rail);
    } else if (obs.type === 'cherry_wagon') {
      // Festive Cherry Blossom Festival Cart
      const cartMat = new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.5, flatShading: true });
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 1.3), cartMat);
      body.position.y = 0.75;
      body.castShadow = true;
      group.add(body);

      // Golden Wheels
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.7, flatShading: true });
      const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.15, 8);
      wheelGeo.rotateZ(Math.PI / 2);
      const wL = new THREE.Mesh(wheelGeo, wheelMat);
      wL.position.set(-1.05, 0.38, 0);
      const wR = new THREE.Mesh(wheelGeo, wheelMat);
      wR.position.set(1.05, 0.38, 0);
      group.add(wL, wR);

      // Pink Sakura Flower Bush on top
      const blossomMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.6, flatShading: true });
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 0), blossomMat);
      bush.position.set(0, 1.5, 0);
      bush.castShadow = true;
      group.add(bush);
    } else {
      // Voxel Construction Sawhorse Barricade
      const barGeo = new THREE.BoxGeometry(2.2, 0.48, 0.24);
      const bar = new THREE.Mesh(barGeo, this.materials['orangeStripe']);
      bar.position.y = 1.15;
      bar.castShadow = true;
      group.add(bar);

      const legGeo = new THREE.BoxGeometry(0.14, 1.3, 0.14);
      const legL = new THREE.Mesh(legGeo, this.materials['whiteStripe']);
      legL.position.set(-0.85, 0.65, 0);
      group.add(legL);
      const legR = new THREE.Mesh(legGeo, this.materials['whiteStripe']);
      legR.position.set(0.85, 0.65, 0);
      group.add(legR);
    }

    return group;
  }

  private renderBystanders(bystanders: Bystander[], player: Player, time: number): void {
    const activeIds = new Set<number>();

    for (const b of bystanders) {
      activeIds.add(b.id);
      let mesh = this.bystanderMeshes.get(b.id);

      if (!mesh) {
        mesh = this.createBystanderMesh(b);
        this.bystanderMeshes.set(b.id, mesh);
        this.scene.add(mesh);
      }

      const bx = b.x * SCALE_X;
      const bz = -b.y * SCALE_Y;
      mesh.position.set(bx, 0.23, bz);

      // Idlers face the street; walkers face the direction they are travelling.
      if (b.walking && b.walkSpeed !== 0) {
        mesh.rotation.y = b.walkSpeed > 0 ? Math.PI : 0;
      } else {
        mesh.rotation.y = b.x < 0 ? Math.PI / 2 : -Math.PI / 2;
      }

      // Walk cycle: the legs swing from the hip at a pace that matches how fast
      // the pedestrian is actually travelling along the curb.
      const walking = b.walking && !b.slapped && !this.reducedMotion;
      const stride = walking ? Math.sin(time * (6.2 + Math.abs(b.walkSpeed) * 3) + b.walkPhase) : 0;
      const leftLeg = mesh.getObjectByName('leftLeg');
      const rightLeg = mesh.getObjectByName('rightLeg');
      const leftArm = mesh.getObjectByName('leftArm');
      const rightArm = mesh.getObjectByName('rightArm');
      if (leftLeg && rightLeg) {
        leftLeg.rotation.x = stride * 0.42;
        rightLeg.rotation.x = -stride * 0.42;
      }
      if (leftArm && rightArm) {
        leftArm.rotation.x = -stride * 0.32;
        rightArm.rotation.x = stride * 0.32;
      }
      if (walking) {
        mesh.position.y = 0.23 + Math.abs(stride) * 0.035;
      }

      // Strike range indicator (Floating Voxel Exclamation/Diamond)
      const reticle = mesh.getObjectByName('reticle');
      if (reticle) {
        reticle.visible = !b.slapped && (b.inStrikeRange || false);
        if (reticle.visible) {
          reticle.position.y = 2.9 + Math.sin(time * 8) * 0.18;
          reticle.rotation.y = time * 4.5;
        }
      }

      // Hilarious 3D voxel ragdoll launch & spin when slapped!
      if (b.slapped) {
        mesh.rotation.x += 0.32;
        mesh.rotation.z += 0.42;
        mesh.position.y += 0.22;
      }
    }

    for (const [id, mesh] of this.bystanderMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.bystanderMeshes.delete(id);
      }
    }
  }

  private createBystanderMesh(b: Bystander): THREE.Group {
    const group = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: b.bodyColor, roughness: 0.6, flatShading: true });
    const shirtMat = new THREE.MeshStandardMaterial({ color: b.shirtColor, roughness: 0.5, flatShading: true });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, flatShading: true });

    // Voxel Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.96, 0.48), shirtMat);
    torso.position.y = 1.32;
    torso.castShadow = true;
    group.add(torso);

    // Voxel Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), skinMat);
    head.position.y = 2.06;
    head.castShadow = true;

    // Voxel Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), eyeMat);
    eyeL.position.set(-0.18, 0.06, 0.36);
    head.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), eyeMat);
    eyeR.position.set(0.18, 0.06, 0.36);
    head.add(eyeR);
    group.add(head);

    // Voxel Accessories
    if (b.accessory === 'fish') {
      // Voxel Chef Toque Hat
      const toque = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.45, 0.74), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }));
      toque.position.set(0, 2.55, 0);
      group.add(toque);

      // 3D Voxel Blue Fish
      const fishGroup = new THREE.Group();
      const fishBody = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.8), new THREE.MeshStandardMaterial({ color: 0x38bdf8, flatShading: true }));
      fishGroup.add(fishBody);
      const fishTail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.3), new THREE.MeshStandardMaterial({ color: 0x0284c7, flatShading: true }));
      fishTail.position.set(0, 0, -0.45);
      fishGroup.add(fishTail);
      fishGroup.position.set(0.5, 1.25, 0.3);
      group.add(fishGroup);
    } else if (b.accessory === 'phone') {
      // Voxel Smartphone
      const phone = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.38, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x9333ea, emissive: 0x06b6d4, emissiveIntensity: 0.6, flatShading: true })
      );
      phone.position.set(0.48, 1.6, 0.32);
      group.add(phone);
    } else if (b.accessory === 'fruit') {
      // Voxel Baker Cap & Croissant
      const bakerCap = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.22, 0.75), new THREE.MeshStandardMaterial({ color: 0xffedd5, flatShading: true }));
      bakerCap.position.y = 2.45;
      group.add(bakerCap);

      const croissant = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.36), new THREE.MeshStandardMaterial({ color: 0xd97706, flatShading: true }));
      croissant.position.set(0.44, 1.25, 0.28);
      group.add(croissant);
    } else if (b.accessory === 'hat') {
      // Voxel Executive Briefcase
      const briefcase = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.18), new THREE.MeshStandardMaterial({ color: 0x451a03, flatShading: true }));
      briefcase.position.set(0.55, 0.75, 0);
      group.add(briefcase);
    }

    // Voxel Arms — shoulder-pivoted so a walking pedestrian counter-swings.
    const armGeo = new THREE.BoxGeometry(0.2, 0.72, 0.2);
    armGeo.translate(0, -0.34, 0);

    const armL = new THREE.Group();
    armL.name = 'leftArm';
    armL.position.set(-0.46, 1.73, 0);
    const armLMesh = new THREE.Mesh(armGeo, shirtMat);
    armLMesh.castShadow = true;
    armL.add(armLMesh);
    group.add(armL);

    const armR = new THREE.Group();
    armR.name = 'rightArm';
    armR.position.set(0.46, 1.73, 0);
    const armRMesh = new THREE.Mesh(armGeo, shirtMat);
    armRMesh.castShadow = true;
    armR.add(armRMesh);
    group.add(armR);

    // Voxel Legs — grouped at the hip so walkers can take a step.
    const legGeo = new THREE.BoxGeometry(0.28, 0.82, 0.28);
    legGeo.translate(0, -0.41, 0);

    const legL = new THREE.Group();
    legL.name = 'leftLeg';
    legL.position.set(-0.22, 0.82, 0);
    const legLMesh = new THREE.Mesh(legGeo, pantsMat);
    legLMesh.castShadow = true;
    legL.add(legLMesh);
    group.add(legL);

    const legR = new THREE.Group();
    legR.name = 'rightLeg';
    legR.position.set(0.22, 0.82, 0);
    const legRMesh = new THREE.Mesh(legGeo, pantsMat);
    legRMesh.castShadow = true;
    legR.add(legRMesh);
    group.add(legR);

    // Floating Voxel Target Exclamation Indicator
    const reticleGroup = new THREE.Group();
    reticleGroup.name = 'reticle';
    reticleGroup.position.set(0, 2.9, 0);
    reticleGroup.visible = false;

    const exclTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.45, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xff4757 })
    );
    exclTop.position.y = 0.15;
    reticleGroup.add(exclTop);

    const exclDot = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xff4757 })
    );
    exclDot.position.y = -0.22;
    reticleGroup.add(exclDot);

    group.add(reticleGroup);

    return group;
  }

  private renderChasers(chasers: Chaser[], time: number): void {
    const activeIds = new Set<number>();

    for (const c of chasers) {
      activeIds.add(c.id);
      let mesh = this.chaserMeshes.get(c.id);

      if (!mesh) {
        mesh = this.createChaserMesh(c);
        this.chaserMeshes.set(c.id, mesh);
        this.scene.add(mesh);
      }

      mesh.position.set(c.x * SCALE_X, 0, -c.y * SCALE_Y);

      // Forward athletic lean towards runner (-Z)
      mesh.rotation.x = -0.18;

      // Athletic running stride and arm swing
      const stride = Math.sin(time * 12 + c.animOffset);
      const leftLeg = mesh.getObjectByName('leftLeg');
      const rightLeg = mesh.getObjectByName('rightLeg');
      const leftArm = mesh.getObjectByName('leftArm');
      const rightArm = mesh.getObjectByName('rightArm');

      if (leftLeg && rightLeg) {
        leftLeg.rotation.x = stride * 0.95;
        rightLeg.rotation.x = -stride * 0.95;
      }
      if (leftArm && rightArm) {
        leftArm.rotation.x = -stride * 0.85;
        rightArm.rotation.x = stride * 0.85;
      }

      // Pulsing fury steam voxel cube
      const steam = mesh.getObjectByName('steam');
      if (steam) {
        const sc = 1 + Math.sin(time * 10) * 0.35;
        steam.scale.set(sc, sc, sc);
      }
    }

    for (const [id, mesh] of this.chaserMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.chaserMeshes.delete(id);
      }
    }
  }

  private createChaserMesh(c: Chaser): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: c.shirtColor || 0xef4444, roughness: 0.5, flatShading: true });
    const skinMat = new THREE.MeshStandardMaterial({ color: c.bodyColor || 0xf4c29e, roughness: 0.6, flatShading: true });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, flatShading: true });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.54), mat);
    torso.position.y = 1.34;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.72), skinMat);
    head.position.y = 2.12;
    head.castShadow = true;

    // Furious Eyes facing forward (-Z)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), eyeMat);
    eyeL.position.set(-0.18, 0.06, -0.36);
    head.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), eyeMat);
    eyeR.position.set(0.18, 0.06, -0.36);
    head.add(eyeR);

    group.add(head);

    // Officer / inspector visor cap & golden badge
    const capMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4, flatShading: true });
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.78), capMat);
    cap.position.set(0, 2.52, 0);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.26), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
    visor.position.set(0, 2.45, -0.42);
    group.add(cap);
    group.add(visor);

    // Golden Officer / Star Badge on chest
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.06), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    badge.position.set(0.2, 1.45, -0.28);
    group.add(badge);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.24, 0.72, 0.24);
    armGeo.translate(0, -0.32, 0);

    const leftArm = new THREE.Group();
    leftArm.name = 'leftArm';
    leftArm.position.set(-0.52, 1.7, 0);
    const leftArmMesh = new THREE.Mesh(armGeo, mat);
    leftArm.add(leftArmMesh);
    group.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.name = 'rightArm';
    rightArm.position.set(0.52, 1.7, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, mat);
    rightArm.add(rightArmMesh);
    group.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.28, 0.85, 0.28);
    legGeo.translate(0, -0.4, 0);

    const leftLeg = new THREE.Group();
    leftLeg.name = 'leftLeg';
    leftLeg.position.set(-0.25, 0.85, 0);
    const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.add(leftLegMesh);
    group.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.name = 'rightLeg';
    rightLeg.position.set(0.25, 0.85, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.add(rightLegMesh);
    group.add(rightLeg);

    // Red Enraged Steam Voxel Cube
    const steamMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const steam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), steamMat);
    steam.name = 'steam';
    steam.position.set(0.25, 2.7, 0);
    group.add(steam);

    return group;
  }

  private renderCollectibles(coins: Coin[], powerups: Powerup[], time: number): void {
    const activeCoinIds = new Set<number>();

    for (const c of coins) {
      if (c.collected) continue;
      activeCoinIds.add(c.id);

      let mesh = this.coinMeshes.get(c.id);
      if (!mesh) {
        // Octagonal Voxel Gold Coin
        const coinGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.16, 8);
        coinGeo.rotateX(Math.PI / 2);
        mesh = new THREE.Group();
        const coinBody = new THREE.Mesh(coinGeo, this.materials['gold']);
        coinBody.castShadow = true;
        mesh.add(coinBody);

        // Center Pixel Hole / Star
        const centerHole = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.22, 0.18),
          new THREE.MeshBasicMaterial({ color: 0x92400e })
        );
        mesh.add(centerHole);

        this.coinMeshes.set(c.id, mesh);
        this.scene.add(mesh);
      }

      mesh.position.set(c.x * SCALE_X, 0.95 + Math.sin(time * 4 + c.bobPhase) * 0.2, -c.y * SCALE_Y);
      mesh.rotation.y = time * 3.8;
    }

    for (const [id, mesh] of this.coinMeshes.entries()) {
      if (!activeCoinIds.has(id)) {
        this.scene.remove(mesh);
        this.coinMeshes.delete(id);
      }
    }

    // Powerup Voxel Cans & Soap
    const activePuIds = new Set<number>();
    for (const pu of powerups) {
      if (pu.collected) continue;
      activePuIds.add(pu.id);

      let mesh = this.powerupMeshes.get(pu.id);
      if (!mesh) {
        const group = new THREE.Group();
        if (pu.type === 'fire') {
          // Voxel brazier: dark wooden handle under three stacked flame cubes.
          const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.16, 0.22, 0.62, 6),
            new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8, flatShading: true })
          );
          handle.position.y = -0.42;
          handle.castShadow = true;
          group.add(handle);

          const flameColors = [0xff5a1f, 0xff9d2e, 0xffe066];
          const flameSizes = [0.46, 0.34, 0.22];
          flameColors.forEach((color, index) => {
            const flame = new THREE.Mesh(
              new THREE.BoxGeometry(flameSizes[index], flameSizes[index], flameSizes[index]),
              new THREE.MeshBasicMaterial({ color })
            );
            flame.name = 'fireFlame';
            flame.position.set(0, -0.02 + index * 0.3, 0);
            group.add(flame);
          });

          const glow = new THREE.PointLight(0xff7a18, 2.6, 5.5, 2);
          glow.position.y = 0.2;
          group.add(glow);
        } else {
          const canGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.88, 8);
          const canMat = new THREE.MeshStandardMaterial({
            color: pu.type === 'soda' ? 0xef4444 : 0x06b6d4,
            roughness: 0.25,
            metalness: 0.75,
            flatShading: true,
          });
          const can = new THREE.Mesh(canGeo, canMat);
          can.castShadow = true;
          group.add(can);
        }

        mesh = group;
        this.powerupMeshes.set(pu.id, mesh);
        this.scene.add(mesh);
      }

      mesh.position.set(pu.x * SCALE_X, 1.15 + Math.sin(time * 3 + pu.bobPhase) * 0.25, -pu.y * SCALE_Y);
      mesh.rotation.y = time * 2.2;

      if (pu.type === 'fire') {
        mesh.children.forEach((child, index) => {
          if (child.name !== 'fireFlame') return;
          const flicker = 0.8 + Math.sin(time * 12 + index * 1.9) * 0.22;
          child.scale.set(flicker, flicker + 0.15, flicker);
          child.rotation.y = time * 3 + index;
        });
      }
    }

    for (const [id, mesh] of this.powerupMeshes.entries()) {
      if (!activePuIds.has(id)) {
        this.scene.remove(mesh);
        this.powerupMeshes.delete(id);
      }
    }
  }

  /**
   * Flame Mode's visible fire: a jet of flame streaming from the dino's mouth
   * to the prop it just breathed on, plus the flames licking any prop that is
   * still alight. Appended after the particle pass, which clears this group at
   * the start of every frame.
   */
  private renderFireBreath(
    player: Player,
    obstacles: Obstacle[],
    breath?: { active: boolean; timeLeft: number; targetX: number; targetY: number }
  ): void {
    const alight = obstacles.filter((o) => o.burning && (o.burnTime ?? 0) > 0);
    if (!breath?.active && alight.length === 0) return;

    if (!this.flameGeo) this.flameGeo = new THREE.BoxGeometry(1, 1, 1);
    if (!this.flameMats) {
      this.flameMats = [0xf97316, 0xfbbf24, 0xf59e0b, 0xef4444].map(
        (color) => new THREE.MeshBasicMaterial({ color })
      );
    }
    const geo = this.flameGeo;
    const mats = this.flameMats;
    const group = this.particleGroup;
    const time = performance.now() / 1000;

    // 1. The breath itself: puffs from the mouth out along the gap, flickering
    //    and shrinking as the jet runs out.
    if (breath?.active) {
      const life = Math.max(0, Math.min(1, breath.timeLeft / 0.28));
      const startX = player.x * SCALE_X;
      const startZ = -(player.y + 16) * SCALE_Y;
      const startY = 1.45 + (player.z || 0) * SCALE_Z;
      const endX = breath.targetX * SCALE_X;
      const endZ = -breath.targetY * SCALE_Y;
      const endY = 0.9;
      const puffs = 18;
      for (let i = 0; i < puffs; i++) {
        const t = i / (puffs - 1);
        const flick = 0.7 + 0.5 * Math.abs(Math.sin(time * 24 + i * 1.7));
        const size = (0.55 - 0.32 * t) * flick * life;
        if (size <= 0.02) continue;
        const mesh = new THREE.Mesh(geo, mats[(i + Math.floor(time * 20)) % mats.length]);
        mesh.position.set(
          startX + (endX - startX) * t + (Math.random() - 0.5) * 0.2,
          startY + (endY - startY) * t + (Math.random() - 0.5) * 0.28,
          startZ + (endZ - startZ) * t + (Math.random() - 0.5) * 0.2
        );
        mesh.scale.setScalar(size);
        mesh.rotation.set(Math.random(), Math.random(), Math.random());
        group.add(mesh);
      }
    }

    // 2. Props still alight: flame licking around them while they shrink.
    for (const obs of alight) {
      const burn = Math.max(0, Math.min(1, obs.burnProgress ?? 0));
      const halfW = Math.max(0.4, (obs.width || 46) * SCALE_X * 0.5);
      for (let i = 0; i < 9; i++) {
        const flick = 0.7 + 0.6 * Math.abs(Math.sin(time * 18 + i * 2.1));
        const size = (0.5 - 0.28 * burn) * flick;
        const mesh = new THREE.Mesh(geo, mats[(i + Math.floor(time * 16)) % mats.length]);
        mesh.position.set(
          obs.x * SCALE_X + (Math.random() - 0.5) * halfW * 1.7,
          0.3 + Math.random() * 1.0 + burn * 0.4,
          -obs.y * SCALE_Y + (Math.random() - 0.5) * 0.7
        );
        mesh.scale.setScalar(size);
        mesh.rotation.set(Math.random(), Math.random(), Math.random());
        group.add(mesh);
      }
    }
  }

  private renderParticlesAndTexts(particles: Particle[], floatingTexts: FloatingText[]): void {
    // 1. Render Voxel Spark Cubes & Pixel Confetti
    while (this.particleGroup.children.length > 0) {
      this.particleGroup.remove(this.particleGroup.children[0]);
    }

    const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);

    particles.slice(0, 8).forEach((p) => {
      const pColor = p.color ? new THREE.Color(p.color) : new THREE.Color(0xffd700);
      const partMesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: pColor }));
      partMesh.position.set(p.x * SCALE_X, 1.1 + (p.vy || 0) * 0.015, -p.y * SCALE_Y);
      this.particleGroup.add(partMesh);
    });


    // 2. Render 3D Floating Comic Popups in Retro Pixel Font ('Press Start 2P')
    const activeTextIds = new Set<number>();

    for (const ft of floatingTexts) {
      activeTextIds.add(ft.id);
      let sprite = this.floatingTextSprites.get(ft.id);

      if (!sprite) {
        sprite = this.createComicTextSprite(ft.text, ft.color || '#F59E0B');
        this.floatingTextSprites.set(ft.id, sprite);
        this.scene.add(sprite);
      }

      const opacity = ft.maxLife > 0 ? Math.max(0, Math.min(1, ft.life / ft.maxLife)) : 1;
      sprite.position.set(ft.x * SCALE_X, 2.6 + (1 - opacity) * 1.6, -ft.y * SCALE_Y);
      const sc = 2.4 * (ft.scale || 1);
      sprite.scale.set(sc, sc * 0.5, 1);
      (sprite.material as THREE.SpriteMaterial).opacity = opacity;
    }

    for (const [id, sprite] of this.floatingTextSprites.entries()) {
      if (!activeTextIds.has(id)) {
        this.scene.remove(sprite);
        sprite.material.dispose();
        this.floatingTextSprites.delete(id);
      }
    }
  }

  private createComicTextSprite(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 128);
      // Authentic Retro Pixel Font ('Press Start 2P')
      ctx.font = '700 22px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Thick pixelated black border stroke
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(text, 128, 64);

      // Bright pixel text fill
      ctx.fillStyle = color;
      ctx.fillText(text, 128, 64);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    return new THREE.Sprite(material);
  }

  public destroy(): void {
    this.renderer.dispose();
    Object.values(this.materials).forEach((mat) => mat.dispose());
    Object.values(this.sharedGeometries).forEach((geo) => geo.dispose());
    this.flameMats?.forEach((mat) => mat.dispose());
    this.flameMats = null;
    this.flameGeo?.dispose();
    this.flameGeo = null;
    for (const sprite of this.floatingTextSprites.values()) {
      sprite.material.dispose();
    }
    this.floatingTextSprites.clear();
  }
}
