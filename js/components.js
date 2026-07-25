// Komponen untuk mengatur Loading Screen
AFRAME.registerComponent('loading-manager', {
    init: function () {
        const loadingScreen = document.getElementById('loading-screen');
        // A-Frame memancarkan event 'loaded' ketika scene dan semua assets selesai dimuat
        this.el.addEventListener('loaded', () => {
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }
        });
    }
});

// Komponen untuk fitur melompat dengan tabrakan langit-langit
AFRAME.registerComponent('jump-ability', {
    init: function () {
        this.isJumping = false;
        this.velocity = 0;
        this.gravity = -0.008;
        this.jumpStrength = 0.12;
        this.groundLevel = 1.6;

        // Menambahkan batas langit-langit. 
        // Atap ada di Y = 2.2, kita atur batas kepala di 2.0 agar tidak tembus.
        this.ceilingLevel = 2.0;

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.isJumping) {
                this.isJumping = true;
                this.velocity = this.jumpStrength;
            }
        });
    },
    tick: function () {
        if (this.isJumping) {
            let pos = this.el.object3D.position;
            this.velocity += this.gravity;
            pos.y += this.velocity;

            // 1. Cek Tabrakan Atap (Mentok ke atas)
            if (pos.y >= this.ceilingLevel) {
                pos.y = this.ceilingLevel; // Tahan posisi kepala di bawah atap
                this.velocity = -0.01; // Langsung berikan daya jatuh (pantulan)
            }

            // 2. Cek Mendarat (Mentok ke lantai)
            if (pos.y <= this.groundLevel) {
                pos.y = this.groundLevel;
                this.isJumping = false;
                this.velocity = 0;
            }
        }
    }
});

// Komponen untuk mendeteksi status pointer lock dan mengontrol UI overlay
AFRAME.registerComponent('pointer-lock-overlay', {
    schema: {
        overlayEl: { type: 'selector', default: '#pointer-lock-instructions' }
    },
    init: function () {
        const overlay = this.data.overlayEl;
        if (!overlay) return;

        // Handler perubahan status pointer lock
        this.onPointerLockChange = () => {
            const canvas = this.el.sceneEl.canvas;
            if (!canvas) return;

            const isLocked = document.pointerLockElement === canvas ||
                document.mozPointerLockElement === canvas;

            if (isLocked) {
                overlay.classList.add('hidden');
            } else {
                // HANYA tunjukan overlay pointer lock jika popup detail pertandingan sedang tertutup
                const matchPopup = document.querySelector('#match-details-popup');
                if (matchPopup && matchPopup.classList.contains('hidden')) {
                    overlay.classList.remove('hidden');
                } else if (!matchPopup) {
                    overlay.classList.remove('hidden');
                }
            }
        };

        document.addEventListener('pointerlockchange', this.onPointerLockChange);
        document.addEventListener('mozpointerlockchange', this.onPointerLockChange);

        // Ketika overlay diklik, sembunyikan overlay, minta kunci kursor, dan putar audio
        overlay.addEventListener('click', () => {
            overlay.classList.add('hidden');
            const canvas = this.el.sceneEl.canvas;
            if (canvas) {
                try {
                    canvas.requestPointerLock();
                } catch (e) {
                    console.warn('Pointer lock request failed or not supported:', e);
                }
            }

            // Putar audio secara otomatis setelah interaksi pengguna (klik mulai)
            const anthem = document.getElementById('anthem');
            if (anthem && anthem.paused) {
                // Set volume nyaman (15% agar tidak terlalu keras dan nyaman didengar sebagai latar belakang)
                anthem.volume = 0.15;
                anthem.play().catch(err => {
                    console.warn('Gagal memutar audio otomatis karena batasan browser:', err);
                });
            }
        });
    },
    remove: function () {
        document.removeEventListener('pointerlockchange', this.onPointerLockChange);
        document.removeEventListener('mozpointerlockchange', this.onPointerLockChange);
    }
});

// Komponen untuk merender anak tangga Anfield secara prosedural
AFRAME.registerComponent('anfield-stairs', {
    schema: {
        steps: { type: 'int', default: 18 },
        width: { type: 'number', default: 2.2 },
        height: { type: 'number', default: 0.18 },
        depth: { type: 'number', default: 0.3 },
        color: { type: 'color', default: '#3a3a3a' }
    },
    init: function () {
        const data = this.data;
        for (let i = 0; i < data.steps; i++) {
            const step = document.createElement('a-box');
            step.setAttribute('width', data.width);
            step.setAttribute('height', data.height);
            step.setAttribute('depth', data.depth);
            step.setAttribute('color', data.color);
            step.setAttribute('roughness', '0.85');
            step.setAttribute('shadow', 'receive: true; cast: true');

            // Posisi menurun tangga
            // Mulai di Z = -1.0
            const zPos = -1.0 - (i * data.depth) - (data.depth / 2);
            const yPos = -(i * data.height) - (data.height / 2);

            step.setAttribute('position', `${0} ${yPos} ${zPos}`);
            this.el.appendChild(step);
        }
    }
});

// Komponen untuk mendeteksi ketinggian kamera berdasarkan lereng tangga (gravitasi lorong)
AFRAME.registerComponent('tunnel-gravity', {
    init: function () {
        this.groundLevel = 0;
    },
    tick: function () {
        let pos = this.el.object3D.position;
        let z = pos.z;
        let targetGround = 0;

        // Hitung ketinggian berdasarkan koordinat Z pemain
        if (z >= -1) {
            // Landing Atas
            targetGround = 0;
        } else if (z < -1 && z >= -6.4) {
            // Lereng Tangga (Z = -1 ke Z = -6.4)
            // Panjang Z: 5.4m, Tinggi turun: 3.24m (18 anak tangga * 0.18m)
            let ratio = (z - (-1)) / -5.4; // 0 di Z=-1, 1 di Z=-6.4
            targetGround = -3.24 * ratio;
        } else {
            // Landing Bawah
            targetGround = -3.24;
        }

        // Terapkan ke komponen jump-ability jika ada
        let jumpComp = this.el.components['jump-ability'];
        if (jumpComp) {
            jumpComp.groundLevel = targetGround + 1.6;
            // Jika tidak melompat, set ketinggian kamera langsung ke level tanah + tinggi mata (1.6m)
            if (!jumpComp.isJumping) {
                pos.y = targetGround + 1.6;
            }
        } else {
            pos.y = targetGround + 1.6;
        }
    }
});
// UPDATE: Komponen wall-collision dengan fisika kotak (Bounding Box)
AFRAME.registerComponent('wall-collision', {
    init: function () {
        this.playerRadius = 0.3;
    },
    tick: function () {
        let pos = this.el.object3D.position;
        let r = this.playerRadius;

        // 1. BATAS TERLUAR RUANGAN
        if (pos.z > 2 - r) pos.z = 2 - r; // Mentok tangga atas (spawn)

        if (pos.x < -9.8 + r) pos.x = -9.8 + r; // Mentok dinding kiri ruangan
        if (pos.x > 9.8 - r) pos.x = 9.8 - r; // Mentok dinding kanan ruangan

        // 2. LOGIKA LORONG & DINDING PINTU MASUK
        if (pos.z > -10) {
            // Jika sedang berada DI DALAM lorong tangga
            if (pos.x < -1.1 + r) pos.x = -1.1 + r;
            if (pos.x > 1.1 - r) pos.x = 1.1 - r;
        } else {
            // Jika sedang berada DI DALAM ruangan Trophy Room (Z <= -10)
            // Cek jika mencoba mundur menabrak dinding di samping kiri/kanan pintu
            if (pos.x < -1.1 + r || pos.x > 1.1 - r) {
                if (pos.z > -10 - r) {
                    pos.z = -10 - r; // Dorong kembali ke dalam ruangan
                }
            }
        }

        // 3. BATAS RUANG GANTI (Locker Room: Z = -30 hingga -44, X = -10 hingga 10)
        // Pintu masuk ada di sayap kanan: X=7, Z=-30
        if (pos.z < -30) {
            // Sudah masuk Ruang Ganti
            if (pos.z < -43.8 + r) pos.z = -43.8 + r; // Dinding belakang locker room
            if (pos.x < -7.8 + r) pos.x = -7.8 + r;  // Dinding kiri locker room
            if (pos.x > 7.8 - r) pos.x = 7.8 - r;    // Dinding kanan locker room
        }
        // Di zona transisi (Z antara -29.8 dan -30.2), cek hanya bisa masuk dari celah pintu di X=6 hingga X=8
        if (pos.z <= -29.8 && pos.z > -30.2) {
            const inDoorX = pos.x > 6.0 && pos.x < 8.0;
            if (!inDoorX && pos.z < -29.8) {
                pos.z = -29.8; // Blokir jika bukan di area pintu
            }
        }

        // 4. FUNGSI DETEKSI TABRAKAN KOTAK (Sekat Partisi)
        // Fungsi ini mencegah pemain menembus dinding dari sisi mana pun
        function checkBoxCollision(boxX, boxZ, boxW, boxD) {
            let minX = boxX - boxW / 2 - r;
            let maxX = boxX + boxW / 2 + r;
            let minZ = boxZ - boxD / 2 - r;
            let maxZ = boxZ + boxD / 2 + r;

            // Jika posisi pemain berada di dalam kotak partisi
            if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
                // Hitung jarak ke setiap sisi permukaan dinding
                let dLeft = pos.x - minX;
                let dRight = maxX - pos.x;
                let dFront = pos.z - minZ;
                let dBack = maxZ - pos.z;

                // Cari sisi terdekat untuk mendorong pemain keluar
                let minD = Math.min(dLeft, dRight, dFront, dBack);

                if (minD === dLeft) pos.x = minX;
                else if (minD === dRight) pos.x = maxX;
                else if (minD === dFront) pos.z = minZ;
                else if (minD === dBack) pos.z = maxZ;
            }
        }

        // 5. TERAPKAN TABRAKAN KE 4 SEKAT PARTISI TROPHY ROOM
        checkBoxCollision(-4, -13, 0.2, 6);  // Partisi Kiri (Depan)
        checkBoxCollision(-4, -25, 0.2, 10); // Partisi Kiri (Belakang)
        checkBoxCollision(4, -13, 0.2, 6);   // Partisi Kanan (Depan)
        checkBoxCollision(4, -25, 0.2, 10);  // Partisi Kanan (Belakang)
    }
});

// Komponen Pintu Otomatis (Sensor Jarak - Proximity Based)
AFRAME.registerComponent('auto-door', {
    schema: {
        triggerDistance: { type: 'number', default: 2.5 }
    },
    init: function () {
        this.isOpen = false;
        this.doorSpeed = 4;
        this.currentRotation = 0;
        this.doorWorldPos = new THREE.Vector3();
    },
    tick: function () {
        let playerEl = document.querySelector('a-camera');
        if (!playerEl) return;

        let playerPos = playerEl.object3D.position;

        // Ambil posisi dunia dari entity pintu itu sendiri
        this.el.object3D.getWorldPosition(this.doorWorldPos);

        // Hitung jarak horizontal (X dan Z saja) antara pemain dan engsel pintu
        const dx = playerPos.x - this.doorWorldPos.x;
        const dz = playerPos.z - this.doorWorldPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Buka jika cukup dekat, tutup jika sudah menjauh
        this.isOpen = dist < this.data.triggerDistance;

        // Animasikan Putaran Engsel
        if (this.isOpen && this.currentRotation > -90) {
            this.currentRotation -= this.doorSpeed;
        } else if (!this.isOpen && this.currentRotation < 0) {
            this.currentRotation += this.doorSpeed;
        }

        this.el.object3D.rotation.y = THREE.MathUtils.degToRad(this.currentRotation);
    }
});

// KOMPONEN UNTUK POPUP INFO PERTANDINGAN
AFRAME.registerComponent('match-info', {
    schema: {
        title: { type: 'string', default: '' },
        desc: { type: 'string', default: '' },
        imgSrc: { type: 'string', default: '' },
        date: { type: 'string', default: '' },
        opponent: { type: 'string', default: '' },
        score: { type: 'string', default: '' },
        venue: { type: 'string', default: '' }
    },
    init: function () {
        let el = this.el;
        let data = this.data;

        // Inisialisasi event listener close popup sekali saja di tingkat window/document jika belum ada
        if (!window.hasMatchPopupInitialized) {
            window.hasMatchPopupInitialized = true;
            
            const matchPopup = document.querySelector('#match-details-popup');
            if (matchPopup) {
                const closeBtn = matchPopup.querySelector('.close-btn');
                const closePopup = () => {
                    matchPopup.classList.add('hidden');
                    // Coba lock pointer kembali
                    const canvas = document.querySelector('a-scene').canvas;
                    if (canvas) {
                        try {
                            canvas.requestPointerLock();
                        } catch (e) {
                            console.warn('Pointer lock failed on popup close:', e);
                        }
                    }
                };

                if (closeBtn) {
                    closeBtn.addEventListener('click', closePopup);
                }

                // Tutup dengan ESC
                window.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && !matchPopup.classList.contains('hidden')) {
                        closePopup();
                    }
                });
            }
        }

        // 'click' akan terpanggil otomatis setelah titik tengah menatap gambar selama 2 detik
        el.addEventListener('click', function () {
            const matchPopup = document.querySelector('#match-details-popup');
            const popupTitle = document.querySelector('#match-title');
            const popupDesc = document.querySelector('#match-desc');
            const popupImg = document.querySelector('#match-img');
            const popupDate = document.querySelector('#match-date');
            const popupOpponent = document.querySelector('#match-opponent');
            const popupScore = document.querySelector('#match-score');
            const popupVenue = document.querySelector('#match-venue');

            if (matchPopup && popupTitle && popupDesc && popupImg) {
                // Isi konten popup
                popupTitle.textContent = data.title;
                popupDesc.textContent = data.desc;
                popupImg.src = data.imgSrc;
                popupImg.alt = data.title;
                
                if (popupDate) popupDate.textContent = data.date;
                if (popupOpponent) popupOpponent.textContent = data.opponent;
                if (popupScore) popupScore.textContent = data.score;
                if (popupVenue) popupVenue.textContent = data.venue;
                
                // Munculkan popup
                matchPopup.classList.remove('hidden');
                
                // Lepaskan pointer lock agar user bisa memakai kursor mouse
                try {
                    document.exitPointerLock();
                } catch (e) {
                    console.warn('Failed to exit pointer lock:', e);
                }
            }
        });
    }
});

// KOMPONEN UNTUK POPUP INFO TROPHY/PIALA (Dengan Render 3D)
AFRAME.registerComponent('trophy-info', {
    schema: {
        modelId: { type: 'string', default: '' },
        modelType: { type: 'string', default: 'gltf' }, // gltf atau obj
        modelScale: { type: 'string', default: '1 1 1' },
        title: { type: 'string', default: '' },
        desc: { type: 'string', default: '' }
    },
    init: function () {
        let el = this.el;
        let data = this.data;

        // Inisialisasi event listener close popup piala
        if (!window.hasTrophyPopupInitialized) {
            window.hasTrophyPopupInitialized = true;
            
            const trophyPopup = document.querySelector('#trophy-details-popup');
            if (trophyPopup) {
                const closeBtn = trophyPopup.querySelector('.close-btn');
                const closePopup = () => {
                    trophyPopup.classList.add('hidden');
                    
                    // Lakukan pembersihan (cleanup) WebGL renderer agar tidak bocor memori
                    if (typeof window.cleanupTrophyViewer === 'function') {
                        window.cleanupTrophyViewer();
                        window.cleanupTrophyViewer = null;
                    }
                    
                    // Coba lock pointer kembali
                    const canvas = document.querySelector('a-scene').canvas;
                    if (canvas) {
                        try {
                            canvas.requestPointerLock();
                        } catch (e) {
                            console.warn('Pointer lock failed on popup close:', e);
                        }
                    }
                };

                if (closeBtn) {
                    closeBtn.addEventListener('click', closePopup);
                }

                // Tutup dengan ESC
                window.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && !trophyPopup.classList.contains('hidden')) {
                        closePopup();
                    }
                });
            }
        }

        // Ketika piala ditatap (diklik oleh fuse reticle)
        el.addEventListener('click', function () {
            const trophyPopup = document.querySelector('#trophy-details-popup');
            const popupTitle = document.querySelector('#trophy-popup-title');
            const popupDesc = document.querySelector('#trophy-popup-desc');
            const canvasContainer = document.querySelector('#trophy-canvas-container');

            if (trophyPopup && popupTitle && popupDesc && canvasContainer) {
                // Terapkan judul & deskripsi
                popupTitle.textContent = data.title;
                popupDesc.textContent = data.desc;

                // Cari path src dari asset item
                const assetEl = document.querySelector('#' + data.modelId);
                if (assetEl) {
                    const modelSrc = assetEl.getAttribute('src');
                    const isOBJ = data.modelType === 'obj';
                    
                    // Bersihkan viewer sebelumnya jika ada
                    if (typeof window.cleanupTrophyViewer === 'function') {
                        window.cleanupTrophyViewer();
                        window.cleanupTrophyViewer = null;
                    }

                    // Tampilkan popup terlebih dahulu agar container memiliki ukuran lebar & tinggi yang valid (clientWidth > 0)
                    trophyPopup.classList.remove('hidden');

                    // Jalankan viewer 3D kustom menggunakan Three.js
                    setTimeout(() => {
                        window.cleanupTrophyViewer = initTrophy3DViewer(
                            canvasContainer, 
                            modelSrc, 
                            isOBJ, 
                            data.modelScale
                        );
                    }, 50);
                } else {
                    console.error('Asset piala tidak ditemukan dengan ID:', data.modelId);
                    trophyPopup.classList.remove('hidden');
                }

                // Lepaskan pointer lock agar user bisa memakai kursor mouse
                try {
                    document.exitPointerLock();
                } catch (e) {
                    console.warn('Failed to exit pointer lock:', e);
                }
            }
        });
    }
});

// FUNGSI RENDERER THREE.JS KUSTOM UNTUK DETAIL PIALA 3D BERPUTAR
function initTrophy3DViewer(containerEl, modelSrc, isOBJ, modelScaleString) {
    // 1. Bersihkan kontainer
    containerEl.innerHTML = '';

    // 2. Buat elemen Canvas baru
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    containerEl.appendChild(canvas);

    // 3. Setup Ukuran & Three.js
    const width = containerEl.clientWidth || 300;
    const height = containerEl.clientHeight || 280;

    const scene = new THREE.Scene();

    // Kamera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 3);

    // Renderer (dengan alpha transparent agar warna glassmorphic di belakang menyatu)
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Pencahayaan
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(2, 4, 3);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-2, -4, -3);
    scene.add(dirLight2);

    let loadedObject = null;

    // Load Model menggunakan loader dari THREE
    if (isOBJ) {
        let objLoader;
        if (THREE.OBJLoader) {
            objLoader = new THREE.OBJLoader();
        } else if (AFRAME.THREE.OBJLoader) {
            objLoader = new AFRAME.THREE.OBJLoader();
        } else {
            const sceneEl = document.querySelector('a-scene');
            const objSystem = sceneEl && sceneEl.systems['obj-model'];
            objLoader = objSystem && objSystem.getLoader ? objSystem.getLoader() : null;
        }

        if (!objLoader) {
            console.error('THREE.OBJLoader tidak tersedia di A-Frame rilis ini.');
            return null;
        }

        objLoader.load(modelSrc, function (obj) {
            // Set material emas/silver kustom agar piala OBJ (Europa League) mengkilap & mewah
            obj.traverse(function (child) {
                if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                        color: 0xd4af37, // Warna Emas
                        metalness: 0.8,
                        roughness: 0.2
                    });
                }
            });

            // Buat Wrapper Group agar piala berputar tepat di poros tengah geometrinya
            const wrapper = new THREE.Group();
            scene.add(wrapper);
            loadedObject = wrapper; // Kita putar wrapper ini di loop animasi

            // Hitung ukuran dan titik tengah geometri
            const box = new THREE.Box3().setFromObject(obj);
            const center = new THREE.Vector3();
            box.getCenter(center);
            const size = new THREE.Vector3();
            box.getSize(size);

            // Geser model asli ke dalam wrapper agar titik pusat geometrinya berada di (0,0,0) lokal wrapper
            obj.position.set(-center.x, -center.y, -center.z);
            wrapper.add(obj);

            // Normalisasi ukuran agar fit di dalam viewport popup secara konsisten
            const maxDim = Math.max(size.x, size.y, size.z);
            const scaleFactor = 1.3 / maxDim;
            wrapper.scale.set(scaleFactor, scaleFactor, scaleFactor);
        });
    } else {
        let gltfLoader;
        if (THREE.GLTFLoader) {
            gltfLoader = new THREE.GLTFLoader();
        } else if (AFRAME.THREE.GLTFLoader) {
            gltfLoader = new AFRAME.THREE.GLTFLoader();
        } else {
            const sceneEl = document.querySelector('a-scene');
            const gltfSystem = sceneEl && sceneEl.systems['gltf-model'];
            gltfLoader = gltfSystem && gltfSystem.getLoader ? gltfSystem.getLoader() : null;
        }

        if (!gltfLoader) {
            console.error('THREE.GLTFLoader tidak tersedia di A-Frame rilis ini.');
            return null;
        }

        gltfLoader.load(modelSrc, function (gltf) {
            const modelScene = gltf.scene;

            // Buat Wrapper Group agar piala berputar tepat di poros tengah geometrinya
            const wrapper = new THREE.Group();
            scene.add(wrapper);
            loadedObject = wrapper; // Kita putar wrapper ini di loop animasi

            // Hitung ukuran dan titik tengah geometri
            const box = new THREE.Box3().setFromObject(modelScene);
            const center = new THREE.Vector3();
            box.getCenter(center);
            const size = new THREE.Vector3();
            box.getSize(size);

            // Geser model asli ke dalam wrapper agar titik pusat geometrinya berada di (0,0,0) lokal wrapper
            modelScene.position.set(-center.x, -center.y, -center.z);
            wrapper.add(modelScene);

            // Normalisasi ukuran agar fit di dalam viewport popup secara konsisten
            const maxDim = Math.max(size.x, size.y, size.z);
            const scaleFactor = 1.3 / maxDim;
            wrapper.scale.set(scaleFactor, scaleFactor, scaleFactor);
        });
    }

    // Loop Animasi
    let animationFrameId;
    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        if (loadedObject) {
            loadedObject.rotation.y += 0.015; // Animasi berputar 360 derajat secara perlahan
        }
        renderer.render(scene, camera);
    }
    animate();

    // Observasi perubahan ukuran kontainer (responsive resize)
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const w = entry.contentRect.width;
            const h = entry.contentRect.height;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }
    });
    resizeObserver.observe(containerEl);

    // Kembalikan fungsi pembersihan
    return function cleanup() {
        cancelAnimationFrame(animationFrameId);
        resizeObserver.disconnect();
        if (renderer) {
            renderer.dispose();
        }
        scene.clear();
    };
}

// KOMPONEN UNTUK MENGHITUNG DAN MENAMPILKAN FPS SECARA REAL-TIME
AFRAME.registerComponent('fps-counter-system', {
    init: function () {
        this.fpsValueEl = document.getElementById('fps-value');
        this.fpsDotEl = document.querySelector('.fps-dot');
        this.lastTime = performance.now();
        this.frameCount = 0;
    },
    tick: function () {
        this.frameCount++;
        let now = performance.now();
        if (now >= this.lastTime + 1000) {
            let fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
            if (this.fpsValueEl) {
                this.fpsValueEl.textContent = fps;
            }
            if (this.fpsDotEl) {
                // Hapus kelas status lama
                this.fpsDotEl.classList.remove('warning', 'danger');
                if (fps < 30) {
                    this.fpsDotEl.classList.add('danger');
                } else if (fps < 45) {
                    this.fpsDotEl.classList.add('warning');
                }
            }
            this.frameCount = 0;
            this.lastTime = now;
        }
    }
});

// KOMPONEN UNTUK MENCEGAH RETICLE MENEMBUS TEMBOK / SEKAT (RAYCAST OCCLUSION)
AFRAME.registerComponent('raycast-occlusion-filter', {
    init: function () {
        const self = this;
        const originalEmit = this.el.emit.bind(this.el);

        // Override fungsi emit bawaan pada elemen kursor untuk memotong event sebelum ditangkap komponen cursor A-Frame
        this.el.emit = function (name, detail, bubbles) {
            if (name === 'raycaster-intersection') {
                const els = detail.els;
                if (els && els.length > 0) {
                    const targetEl = els[0];
                    
                    // Jika target terdekat yang ditabrak oleh raycaster adalah tembok/penghalang (.raycast-obstacle),
                    // maka kita kosongkan detail elemen agar komponen cursor bawaan menganggap tidak menatap apa-apa.
                    // Ini secara instan mencegah animasi mengecil (fuse) pada tembok.
                    if (targetEl && targetEl.classList && typeof targetEl.classList.contains === 'function') {
                        if (!targetEl.classList.contains('clickable')) {
                            detail.els = [];
                            detail.intersections = [];
                            
                            // Reset status fuse kursor secara instan jika sebelumnya aktif
                            const cursor = self.el.components.cursor;
                            if (cursor) {
                                try {
                                    if (typeof cursor.clearFuse === 'function') {
                                        cursor.clearFuse();
                                    }
                                } catch (err) {}
                                cursor.intersectedEl = null;
                            }
                        }
                    }
                }
            }
            
            // Jalankan emit asli untuk event lainnya atau jika tidak terhalang
            return originalEmit(name, detail, bubbles);
        };
    }
});

// KOMPONEN UNTUK MENANGGULANGI PEMUTARAN VIDEO DI TEMBOK (MUTED AUTOPLAY + INTERACTIVE SOUND ON CLICK)
AFRAME.registerComponent('video-screen', {
    schema: {
        videoEl: { type: 'selector' }
    },
    init: function () {
        const video = this.data.videoEl;
        const el = this.el;
        if (!video) return;

        // Atur video agar berputar secara hening (muted) dan berulang (loop) secara default
        video.muted = true;
        video.loop = true;

        // Putar video secara otomatis ketika tombol "Mulai Menjelajah" diklik oleh user
        const startBtn = document.querySelector('#pointer-lock-instructions');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                video.play().catch(err => {
                    console.warn('Autoplay video terhambat browser:', err);
                });
            });
        }

        // Interaksi klik untuk menjeda/memutar dan mengaktifkan/menonaktifkan suara video
        el.addEventListener('click', () => {
            if (video.paused || video.muted) {
                // Jika video terjeda atau sedang hening, putar dengan suara aktif
                video.muted = false;
                video.volume = 0.5; // Volume suara video
                
                if (video.paused) {
                    video.play().catch(err => console.warn(err));
                }
                
                // Redupkan volume musik latar (anthem) agar tidak bertabrakan dengan suara video
                const anthem = document.getElementById('anthem');
                if (anthem) {
                    anthem.volume = 0.04;
                }
            } else {
                // Jika suara sedang aktif, matikan suara video kembali
                video.muted = true;
                
                // Kembalikan volume musik latar (anthem) ke normal
                const anthem = document.getElementById('anthem');
                if (anthem) {
                    anthem.volume = 0.15;
                }
            }
        });
    }
});

// KOMPONEN UNTUK MELEMPAR BOLA KETIKA KLIK KIRI MOUSE (SOCCER BALL SHOOTER)
AFRAME.registerComponent('ball-shooter', {
    init: function () {
        this.shootBall = this.shootBall.bind(this);
        window.addEventListener('mousedown', this.shootBall);
    },
    shootBall: function (evt) {
        // Hanya tembak jika tombol kiri mouse diklik (button == 0)
        if (evt.button !== 0) return;

        // Jangan tembak jika welcome overlay masih aktif
        const overlay = document.querySelector('#pointer-lock-instructions');
        if (overlay && !overlay.classList.contains('hidden')) return;

        // Jangan tembak jika popup piala atau pertandingan sedang terbuka
        const trophyPopup = document.querySelector('#trophy-details-popup');
        const matchPopup = document.querySelector('#match-details-popup');
        if (trophyPopup && !trophyPopup.classList.contains('hidden')) return;
        if (matchPopup && !matchPopup.classList.contains('hidden')) return;

        // Ambil kamera
        const cameraEl = document.querySelector('a-camera');
        if (!cameraEl) return;

        // Buat bola baru
        const ball = document.createElement('a-sphere');
        ball.setAttribute('radius', '0.14');
        
        // Desain bola premium: Merah Mengkilap dengan Segmen Emas berkilau
        ball.setAttribute('material', 'color: #c8102e; metalness: 0.8; roughness: 0.15;');
        // Tambahkan efek bayangan
        ball.setAttribute('shadow', 'cast: true; receive: true');
        
        // Set komponen fisika bola
        ball.setAttribute('ball-physics', '');
        
        // Masukkan bola ke dalam scene
        this.el.appendChild(ball);
    },
    remove: function () {
        window.removeEventListener('mousedown', this.shootBall);
    }
});

// KOMPONEN FISIKA BOLA (GRAVITASI, PANTULAN LANTAI & DINDING SEKAT)
AFRAME.registerComponent('ball-physics', {
    init: function () {
        this.radius = 0.14;
        this.gravity = -9.8;
        this.restitution = 0.65; // Kelentingan pantulan (65%)
        this.lifeTime = 5.0; // Detik sebelum bola hilang
        this.age = 0;

        const cameraEl = document.querySelector('a-camera');
        if (!cameraEl) return;

        // 1. Tentukan posisi awal (tepat di posisi kamera pemain)
        const pos = new THREE.Vector3();
        cameraEl.object3D.getWorldPosition(pos);
        // Geser sedikit ke depan agar tidak menabrak kamera sendiri
        const dir = new THREE.Vector3();
        cameraEl.object3D.getWorldDirection(dir);
        dir.multiplyScalar(-1); // Negasikan karena direction bawaan Three.js menghadap belakang
        pos.addScaledVector(dir, 0.4);

        this.el.object3D.position.copy(pos);

        // 2. Tentukan kecepatan awal (ke arah pandangan kamera)
        const speed = 18; // Kecepatan lemparan (m/s)
        this.velocity = dir.clone().multiplyScalar(speed);
        
        // Berikan sedikit dorongan ke atas agar bola melengkung indah saat melayang
        this.velocity.y += 2.5; 
    },
    tick: function (time, timeDelta) {
        const dt = timeDelta / 1000;
        if (dt <= 0 || dt > 0.1) return; // Abaikan lag/frame-drop besar

        this.age += dt;
        if (this.age >= this.lifeTime) {
            // Efek mengecil sebelum hilang agar transisi halus
            const scale = this.el.object3D.scale;
            if (scale.x > 0.05) {
                const shrinkFactor = 1 - dt * 5;
                scale.multiplyScalar(shrinkFactor);
            } else {
                if (this.el.parentNode) {
                    this.el.parentNode.removeChild(this.el);
                }
            }
            return;
        }

        const pos = this.el.object3D.position;
        const vel = this.velocity;
        const r = this.radius;

        // 1. Terapkan gravitasi ke kecepatan vertikal (Y)
        vel.y += this.gravity * dt;

        // 2. Update posisi berdasarkan kecepatan
        pos.x += vel.x * dt;
        pos.y += vel.y * dt;
        pos.z += vel.z * dt;

        // 3. Deteksi lantai dinamis (karena ada tanjakan tangga)
        let groundY = -3.24;
        const z = pos.z;
        if (z >= -1) {
            groundY = 0;
        } else if (z < -1 && z >= -6.4) {
            let ratio = (z - (-1)) / -5.4;
            groundY = -3.24 * ratio;
        }

        // Pantulan Lantai
        if (pos.y < groundY + r) {
            pos.y = groundY + r;
            vel.y = -vel.y * this.restitution;
            // Gesekan lantai (floor friction)
            vel.x *= 0.95;
            vel.z *= 0.95;
        }

        // 4. Pantulan Dinding Batas Luar
        if (pos.x < -7.8 + r) { pos.x = -7.8 + r; vel.x = -vel.x * this.restitution; }
        if (pos.x > 7.8 - r) { pos.x = 7.8 - r; vel.x = -vel.x * this.restitution; }
        if (pos.z < -43.8 + r) { pos.z = -43.8 + r; vel.z = -vel.z * this.restitution; } // Dinding belakang locker room
        if (pos.z > 2.0 - r) { pos.z = 2.0 - r; vel.z = -vel.z * this.restitution; }

        // 5. Pantulan Sekat Partisi Kiri & Kanan (checkBoxCollision)
        const self = this;
        function checkPartitionBounce(boxX, boxZ, boxW, boxD) {
            let minX = boxX - boxW / 2 - r;
            let maxX = boxX + boxW / 2 + r;
            let minZ = boxZ - boxD / 2 - r;
            let maxZ = boxZ + boxD / 2 + r;

            if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
                let dLeft = pos.x - minX;
                let dRight = maxX - pos.x;
                let dFront = pos.z - minZ;
                let dBack = maxZ - pos.z;

                let minD = Math.min(dLeft, dRight, dFront, dBack);

                if (minD === dLeft) { pos.x = minX; vel.x = -vel.x * self.restitution; }
                else if (minD === dRight) { pos.x = maxX; vel.x = -vel.x * self.restitution; }
                else if (minD === dFront) { pos.z = minZ; vel.z = -vel.z * self.restitution; }
                else if (minD === dBack) { pos.z = maxZ; vel.z = -vel.z * self.restitution; }
            }
        }

        // Jalankan uji pantulan sekat
        checkPartitionBounce(-4, -13, 0.2, 6);
        checkPartitionBounce(-4, -25, 0.2, 10);
        checkPartitionBounce(4, -13, 0.2, 6);
        checkPartitionBounce(4, -25, 0.2, 10);
    }
});

// ============================================================
// KOMPONEN LOKER PEMAIN LIVERPOOL (Liverpool Locker)
// Membangun satu unit loker lengkap secara prosedural.
// Penggunaan: <a-entity liverpool-locker="playerName: SALAH; playerNumber: 11; isGK: false"></a-entity>
// Posisi & rotasi ditentukan dari luar pada elemen <a-entity> pemanggil.
// ============================================================
AFRAME.registerComponent('liverpool-locker', {
    schema: {
        playerName: { type: 'string', default: 'PLAYER' },
        playerNumber: { type: 'string', default: '0' },
        isGK: { type: 'boolean', default: false }
    },
    init: function () {
        const data = this.data;
        const el = this.el;
        const jerseyColor = data.isGK ? '#1a1a2e' : '#c8102e'; // Merah atau hitam (GK)
        const nameTagColor = '#ffffff';
        const accentColor = '#d4af37'; // Emas Liverpool

        // --- 1. PAPAN BELAKANG LOKER (Panel kayu gelap) ---
        const backPanel = document.createElement('a-box');
        backPanel.setAttribute('width', '0.85');
        backPanel.setAttribute('height', '1.8');
        backPanel.setAttribute('depth', '0.08');
        backPanel.setAttribute('color', '#3b2a1f'); // Warna kayu mahoni gelap
        backPanel.setAttribute('roughness', '0.85');
        backPanel.setAttribute('metalness', '0.05');
        backPanel.setAttribute('position', '0 0.9 0');
        // Shadow dihapus untuk performa (FPS drop)
        el.appendChild(backPanel);

        // --- 2. BINGKAI EMAS PANEL ---
        const frame = document.createElement('a-box');
        frame.setAttribute('width', '0.9');
        frame.setAttribute('height', '1.85');
        frame.setAttribute('depth', '0.05');
        frame.setAttribute('color', accentColor);
        frame.setAttribute('metalness', '0.7');
        frame.setAttribute('roughness', '0.2');
        frame.setAttribute('position', '0 0.9 -0.02');
        el.appendChild(frame);

        // --- 3. JERSEY (menggunakan SVG + a-plane) ---
        const jerseySVG = this._buildJerseySVG(jerseyColor, data.playerNumber, data.playerName, data.isGK);
        const jerseyDataURL = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(jerseySVG)));

        const jerseyPlane = document.createElement('a-plane');
        jerseyPlane.setAttribute('width', '0.62');
        jerseyPlane.setAttribute('height', '0.75');
        jerseyPlane.setAttribute('src', jerseyDataURL);
        jerseyPlane.setAttribute('position', '0 1.18 0.05');
        jerseyPlane.setAttribute('material', 'transparent: true; alphaTest: 0.1; shader: flat');
        jerseyPlane.setAttribute('shadow', 'cast: false');
        el.appendChild(jerseyPlane);

        // --- 4. PAPAN NAMA PEMAIN (merah di bawah panel) ---
        const nameTag = document.createElement('a-box');
        nameTag.setAttribute('width', '0.82');
        nameTag.setAttribute('height', '0.22');
        nameTag.setAttribute('depth', '0.06');
        nameTag.setAttribute('color', jerseyColor);
        nameTag.setAttribute('metalness', '0.0');
        nameTag.setAttribute('roughness', '1.0');
        nameTag.setAttribute('position', '0 1.75 0.05');
        nameTag.setAttribute('shadow', 'cast: false');
        el.appendChild(nameTag);

        // Teks nama di papan nama
        const nameText = document.createElement('a-text');
        nameText.setAttribute('value', data.playerName);
        nameText.setAttribute('color', nameTagColor);
        nameText.setAttribute('align', 'center');
        nameText.setAttribute('width', '0.75');
        nameText.setAttribute('wrap-count', Math.max(10, data.playerName.length + 1).toString());
        nameText.setAttribute('position', '0 1.75 0.09');
        nameText.setAttribute('font', 'mozillavr');
        el.appendChild(nameText);

        // --- 5. BANGKU / KURSI KAYU ---
        const bench = document.createElement('a-box');
        bench.setAttribute('width', '0.85');
        bench.setAttribute('height', '0.06');
        bench.setAttribute('depth', '0.38');
        bench.setAttribute('color', '#5a3e28'); // Kayu lebih terang
        bench.setAttribute('roughness', '0.9');
        bench.setAttribute('metalness', '0.0');
        bench.setAttribute('position', '0 0.38 0.22');
        el.appendChild(bench);

        // Bantalan kursi (merah)
        const cushion = document.createElement('a-box');
        cushion.setAttribute('width', '0.80');
        cushion.setAttribute('height', '0.05');
        cushion.setAttribute('depth', '0.35');
        cushion.setAttribute('color', jerseyColor);
        cushion.setAttribute('roughness', '0.8');
        cushion.setAttribute('position', '0 0.42 0.22');
        el.appendChild(cushion);

        // --- 6. RAK SEPATU (di bawah bangku) ---
        // Sepatu kiri
        const shoeL = document.createElement('a-box');
        shoeL.setAttribute('width', '0.1');
        shoeL.setAttribute('height', '0.07');
        shoeL.setAttribute('depth', '0.22');
        shoeL.setAttribute('color', '#222222');
        shoeL.setAttribute('roughness', '0.7');
        shoeL.setAttribute('metalness', '0.1');
        shoeL.setAttribute('position', '-0.15 0.035 0.22');
        el.appendChild(shoeL);

        // Sepatu kanan
        const shoeR = document.createElement('a-box');
        shoeR.setAttribute('width', '0.1');
        shoeR.setAttribute('height', '0.07');
        shoeR.setAttribute('depth', '0.22');
        shoeR.setAttribute('color', '#222222');
        shoeR.setAttribute('roughness', '0.7');
        shoeR.setAttribute('metalness', '0.1');
        shoeR.setAttribute('position', '0.15 0.035 0.22');
        el.appendChild(shoeR);

        // Tali sepatu (karet pendek aksen warna)
        const laceL = document.createElement('a-box');
        laceL.setAttribute('width', '0.09');
        laceL.setAttribute('height', '0.02');
        laceL.setAttribute('depth', '0.06');
        laceL.setAttribute('color', '#f8f8f8');
        laceL.setAttribute('position', '-0.15 0.075 0.17');
        el.appendChild(laceL);
        const laceR = document.createElement('a-box');
        laceR.setAttribute('width', '0.09');
        laceR.setAttribute('height', '0.02');
        laceR.setAttribute('depth', '0.06');
        laceR.setAttribute('color', '#f8f8f8');
        laceR.setAttribute('position', '0.15 0.075 0.17');
        el.appendChild(laceR);

        // --- 7. GANTUNGAN JERSEY (Kait emas di panel atas) ---
        const hook = document.createElement('a-cylinder');
        hook.setAttribute('radius', '0.015');
        hook.setAttribute('height', '0.14');
        hook.setAttribute('color', accentColor);
        hook.setAttribute('metalness', '0.8');
        hook.setAttribute('roughness', '0.1');
        hook.setAttribute('rotation', '90 0 0');
        hook.setAttribute('position', '0 1.68 0.04');
        el.appendChild(hook);
    },

    // Fungsi helper untuk membangun string SVG jersey
    _buildJerseySVG: function(jerseyColor, number, name, isGK) {
        const stripeColor = isGK ? '#16213e' : '#a50024'; // Stripe gelap untuk jersey
        const textColor = '#ffffff';
        const accentColor = isGK ? '#f0c040' : '#ffffff';
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 230" width="200" height="230">
  <defs>
    <linearGradient id="jerseyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${jerseyColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${stripeColor};stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Bentuk Baju (T-Shirt) -->
  <!-- Tubuh Utama -->
  <path d="M 55 55 L 20 75 L 35 100 L 55 88 L 55 200 L 145 200 L 145 88 L 165 100 L 180 75 L 145 55 C 135 45 125 40 120 38 C 115 36 100 32 100 32 C 100 32 85 36 80 38 C 75 40 65 45 55 55 Z" fill="url(#jerseyGrad)" stroke="${accentColor}" stroke-width="2"/>
  <!-- Lengan Kiri -->
  <path d="M 55 55 L 20 75 L 35 100 L 55 88 Z" fill="${jerseyColor}" stroke="${accentColor}" stroke-width="1.5"/>
  <!-- Lengan Kanan -->
  <path d="M 145 55 L 180 75 L 165 100 L 145 88 Z" fill="${jerseyColor}" stroke="${accentColor}" stroke-width="1.5"/>
  <!-- Stripe vertikal tengah (seperti LFC) -->
  <rect x="94" y="55" width="12" height="145" fill="${stripeColor}" opacity="0.35"/>
  <!-- Kerah -->
  <path d="M 85 38 Q 100 50 115 38" fill="none" stroke="${accentColor}" stroke-width="3" stroke-linecap="round"/>
  <!-- Nama Pemain (Kecil di atas nomor) -->
  <text x="100" y="110" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="${textColor}" letter-spacing="2">${name}</text>
  <!-- Nomor Punggung (Besar) -->
  <text x="100" y="175" font-family="Arial Black, sans-serif" font-size="60" font-weight="900" text-anchor="middle" fill="${textColor}" opacity="0.95">${number}</text>
  <!-- Badge Liverpool sederhana (lingkaran merah-putih) di dada kiri -->
  <circle cx="72" cy="75" r="11" fill="${textColor}" opacity="0.9"/>
  <circle cx="72" cy="75" r="8" fill="${jerseyColor}"/>
  <text x="72" y="79" font-family="Arial Black" font-size="7" font-weight="900" text-anchor="middle" fill="${textColor}">LFC</text>
</svg>`;
    }
});

// KOMPONEN UNTUK POPUP WEBAR & AR CARD INTERAKTIF
AFRAME.registerComponent('webar-info', {
    init: function () {
        let el = this.el;

        // Inisialisasi event handler close popup WebAR sekali saja
        if (!window.hasWebARPopupInitialized) {
            window.hasWebARPopupInitialized = true;

            const webarPopup = document.querySelector('#webar-details-popup');
            if (webarPopup) {
                const closeBtn = webarPopup.querySelector('.close-btn');
                const closePopup = () => {
                    webarPopup.classList.add('hidden');
                    const canvas = document.querySelector('a-scene')?.canvas;
                    if (canvas) {
                        try {
                            canvas.requestPointerLock();
                        } catch (e) {
                            console.warn('Pointer lock failed on WebAR popup close:', e);
                        }
                    }
                };

                if (closeBtn) {
                    closeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        closePopup();
                    });
                }

                // Tutup via ESC key
                window.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && !webarPopup.classList.contains('hidden')) {
                        closePopup();
                    }
                });
            }
        }

        // Buka popup ketika diklik atau ditatap 2 detik (gaze cursor)
        el.addEventListener('click', function () {
            const webarPopup = document.querySelector('#webar-details-popup');
            if (webarPopup) {
                // Exit pointer lock saat popup muncul
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                webarPopup.classList.remove('hidden');
            }
        });
    }
});

// ==============================================
// 9. LOGIKA TELEPORTASI PANORAMA 360 ANFIELD
// ==============================================

// Variabel global untuk menyimpan posisi & rotasi galeri sebelum teleportasi
let previousPlayerPosition = null;
let previousPlayerRotation = null;

AFRAME.registerComponent('panorama-teleport', {
    init: function () {
        this.el.addEventListener('click', () => {
            // Berpindah ke file HTML scene baru
            window.location.href = 'panorama.html';
        });
    }
});

AFRAME.registerComponent('panorama-teleport-back', {
    init: function () {
        this.el.addEventListener('click', () => {
            // Kembali ke galeri utama
            window.location.href = 'index.html';
        });
    }
});

// ==============================================
// 10. LOGIKA SPATIAL VIDEO (Putar & Bersuara saat dekat)
// ==============================================
AFRAME.registerComponent('spatial-video', {
    schema: {
        videoEl: { type: 'selector' },
        distance: { type: 'number', default: 3.5 }
    },
    tick: function () {
        if (!this.data.videoEl) return;
        
        let camera = document.querySelector('a-camera');
        if (!camera) return;
        
        // Hitung jarak dari pemain ke layar video
        let cameraPos = camera.object3D.position;
        let screenPos = new THREE.Vector3();
        this.el.object3D.getWorldPosition(screenPos);
        
        let dist = cameraPos.distanceTo(screenPos);
        
        // Jika pemain dalam radius jarak, putar video dan hidupkan suara (unmute)
        if (dist < this.data.distance) {
            if (this.data.videoEl.paused) {
                this.data.videoEl.play().catch(e => console.warn('Browser auto-play prevented:', e));
            }
            this.data.videoEl.muted = false;
        } else {
            // Jika pemain menjauh, pause video dan mute
            if (!this.data.videoEl.paused) {
                this.data.videoEl.pause();
            }
            this.data.videoEl.muted = true;
        }
    }
});