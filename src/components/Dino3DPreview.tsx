import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CharacterSkin } from '../game/types.ts';
import { buildDinoCharacterMesh, DinoMeshComponents } from '../game/DinoMeshBuilder.ts';
import { t } from '../game/i18n.ts';
import { RotateCw } from 'lucide-react';

interface Dino3DPreviewProps {
  skin: CharacterSkin;
  className?: string;
}

export const Dino3DPreview: React.FC<Dino3DPreviewProps> = ({ skin, className = '' }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animId: number;
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 280;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 2.2, 5.8);
    camera.lookAt(0, 1.4, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xfffaed, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffedd5, 2.8);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const rimLight = new THREE.PointLight(new THREE.Color(skin.bodyColor), 2.2, 10);
    rimLight.position.set(-3, 3, -3);
    scene.add(rimLight);

    // Pedestal
    const pedestalGeo = new THREE.CylinderGeometry(1.4, 1.5, 0.22, 24);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x181411,
      roughness: 0.4,
      metalness: 0.6,
      flatShading: true,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.11;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const ringGeo = new THREE.TorusGeometry(1.42, 0.04, 8, 32);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(skin.bodyColor) });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.01;
    scene.add(ring);

    // Build Dino Mesh
    const dino: DinoMeshComponents = buildDinoCharacterMesh(skin);
    scene.add(dino.rootGroup);

    // Slight angle so front snout and face are visible
    let currentRotationY = -0.55;
    let isDragging = false;
    let previousMouseX = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      previousMouseX = e.clientX;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMouseX;
      previousMouseX = e.clientX;
      currentRotationY += deltaX * 0.018;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Render loop
    const clock = new THREE.Clock();
    const animate = () => {
      const time = clock.getElapsedTime();

      // Gentle auto rotation when not dragging
      if (!isDragging) {
        currentRotationY += 0.008;
      }
      dino.rootGroup.rotation.y = currentRotationY;

      // Subtle dynamic idle breathing & tail wiggles
      dino.torso.position.y = 1.38 + Math.sin(time * 3) * 0.03;
      dino.head.position.y = 2.18 + Math.sin(time * 3) * 0.02;
      dino.tail.rotation.y = Math.sin(time * 2.8) * 0.18;
      dino.leftArm.rotation.x = Math.sin(time * 3) * 0.08;
      dino.rightArm.rotation.x = -Math.sin(time * 3) * 0.08;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
    };
  }, [skin]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center select-none overflow-hidden touch-none ${className}`}
    >
      <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-2 right-2 pointer-events-none flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-full text-[10px] text-[#FED7AA] backdrop-blur-xs border border-white/10">
        <RotateCw className="w-3 h-3 text-[#FACC15] animate-spin" style={{ animationDuration: '8s' }} />
        <span>{t('Drag to rotate')}</span>
      </div>
    </div>
  );
};
