"use client";
import { useEffect, useRef } from "react";

declare module 'three';

export default function ThreeAnimeBG({ children }: { children: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // --- Three.js animated background ---
    let renderer: any, scene: any, camera: any, animId: number;
    import('three').then((THREE: any) => {
      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x232526, 0.7);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 5;
      // Add animated glowing spheres
      const spheres: any[] = [];
      for (let i = 0; i < 18; i++) {
        const geometry = new THREE.SphereGeometry(Math.random() * 0.25 + 0.18, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: 0x3bc9db, emissive: 0x38d9a9, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.3 });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 4
        );
        scene.add(sphere);
        spheres.push(sphere);
      }
      // Lighting
      const ambient = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambient);
      const point = new THREE.PointLight(0x3bc9db, 1.2, 100);
      point.position.set(0, 0, 6);
      scene.add(point);
      // Animate
      function animate() {
        animId = requestAnimationFrame(animate);
        spheres.forEach((s, i) => {
          s.position.x += Math.sin(Date.now() * 0.0003 + i) * 0.002;
          s.position.y += Math.cos(Date.now() * 0.0002 + i) * 0.002;
          s.rotation.x += 0.002 + i * 0.0001;
          s.rotation.y += 0.002 - i * 0.0001;
        });
        renderer.render(scene, camera);
      }
      animate();
      // Resize
      const handleResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', handleResize);
      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', handleResize);
        renderer.dispose();
      };
    });
    // --- Anime.js entry animation ---
    import('animejs').then((anime: any) => {
      anime.default({
        targets: mainRef.current,
        opacity: [0, 1],
        translateY: [40, 0],
        duration: 1200,
        easing: 'easeOutExpo',
        delay: 200,
      });
    });
  }, []);
  return (
    <>
      <canvas
        ref={canvasRef}
        id="three-bg-canvas"
        style={{
          position: 'fixed',
          zIndex: 0,
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
      <div ref={mainRef} id="main-content-fadein" style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        {children}
      </div>
      <style jsx global>{`
        #three-bg-canvas { filter: blur(1.5px) brightness(0.95); }
      `}</style>
    </>
  );
} 