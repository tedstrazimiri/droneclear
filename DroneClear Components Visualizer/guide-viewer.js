/* ═══════════════════════════════════════════════════════════
   guide-viewer.js — Three.js STL/3MF viewer wrapper
   ═══════════════════════════════════════════════════════════ */

const _stlViewers = {};  // containerId → { scene, camera, renderer, controls, animId }

/**
 * Initialise (or re-initialise) an STL viewer inside the given container.
 * @param {string} containerId  DOM id of the container div
 * @param {string} stlUrl       URL to the .stl file
 */
function initSTLViewer(containerId, stlUrl) {
    // Clean up previous instance
    destroySTLViewer(containerId);

    const container = document.getElementById(containerId);
    if (!container || typeof THREE === 'undefined') return;

    const width = container.clientWidth;
    const height = container.clientHeight || 400;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 100);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 50, 50);
    scene.add(dirLight);
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-30, -20, -30);
    scene.add(dirLight2);

    // Load STL
    const loader = new THREE.STLLoader();
    loader.load(stlUrl, (geometry) => {
        const material = new THREE.MeshPhongMaterial({
            color: 0xda291c,       // DroneClear accent red
            specular: 0x444444,
            shininess: 40,
        });
        const mesh = new THREE.Mesh(geometry, material);

        // Auto-centre and scale
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const centre = new THREE.Vector3();
        box.getCenter(centre);
        mesh.position.sub(centre);

        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 60 / maxDim;
        mesh.scale.setScalar(scale);

        scene.add(mesh);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
    }, undefined, (err) => {
        console.warn('STL load error:', err);
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding-top:180px;">Failed to load 3D model</p>';
    });

    // Animate
    let animId;
    function animate() {
        animId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Responsive resize
    const ro = new ResizeObserver(entries => {
        const { width: w, height: h } = entries[0].contentRect;
        if (w > 0 && h > 0) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }
    });
    ro.observe(container);

    _stlViewers[containerId] = { scene, camera, renderer, controls, animId, ro };
}

/**
 * Destroy an STL viewer instance and free resources.
 */
function destroySTLViewer(containerId) {
    const viewer = _stlViewers[containerId];
    if (!viewer) return;

    cancelAnimationFrame(viewer.animId);
    viewer.ro?.disconnect();
    viewer.controls?.dispose();
    viewer.renderer?.dispose();

    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';

    delete _stlViewers[containerId];
}
