import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import nipplejs from 'https://esm.sh/nipplejs';

export class PlayerControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        this.speed = 10.0;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        
        this.clock = new THREE.Clock();

        if (!this.isMobile) {
            this.initDesktop();
        } else {
            this.initMobile();
        }
    }

    initDesktop() {
        this.controls = new PointerLockControls(this.camera, document.body);

        const instructions = document.getElementById('ui');
        
        document.addEventListener('click', () => {
            this.controls.lock();
        });

        this.controls.addEventListener('lock', () => {
            // instructions.style.display = 'none';
        });

        this.controls.addEventListener('unlock', () => {
            // instructions.style.display = '';
        });

        const onKeyDown = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = true; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = true; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = true; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = true; break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = false; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = false; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = false; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
    }

    initMobile() {
        // Look Controls (Right side)
        const lookZone = document.createElement('div');
        lookZone.style.cssText = 'position:absolute; top:0; right:0; width:50%; height:100%; touch-action:none; z-index:10;';
        document.body.appendChild(lookZone);

        let lastTouchX = 0;
        let lastTouchY = 0;

        lookZone.addEventListener('touchstart', (e) => {
            lastTouchX = e.touches[0].pageX;
            lastTouchY = e.touches[0].pageY;
        });

        lookZone.addEventListener('touchmove', (e) => {
            const touchX = e.touches[0].pageX;
            const touchY = e.touches[0].pageY;
            
            const deltaX = (touchX - lastTouchX) * 0.005;
            const deltaY = (touchY - lastTouchY) * 0.005;

            this.camera.rotation.y -= deltaX;
            // Clamp vertical look
            const pitch = this.camera.rotation.x - deltaY;
            this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

            lastTouchX = touchX;
            lastTouchY = touchY;
        });

        // Move Controls (Left side nipple)
        const moveZone = document.createElement('div');
        moveZone.style.cssText = 'position:absolute; bottom:50px; left:50px; width:100px; height:100px; z-index:10;';
        document.body.appendChild(moveZone);

        const manager = nipplejs.create({
            zone: moveZone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white'
        });

        manager.on('move', (evt, data) => {
            if (data.vector) {
                // Joystick input is y-up, we need z-forward (negative z)
                // Forward (y=1) -> -Z
                // Right (x=1) -> +X
                
                // Determine if we should move based on vector strength
                this.moveForward = data.vector.y > 0.2;
                this.moveBackward = data.vector.y < -0.2;
                this.moveRight = data.vector.x > 0.2;
                this.moveLeft = data.vector.x < -0.2;
            }
        });

        manager.on('end', () => {
            this.moveForward = false;
            this.moveBackward = false;
            this.moveLeft = false;
            this.moveRight = false;
        });
    }

    update(delta) {
        if (!delta) return;
        
        // Retarding force
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;

        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();

        if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * 100.0 * delta;
        if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * 100.0 * delta;

        // Apply movement respecting camera direction
        if (this.isMobile) {
            // Simplified mobile movement logic
             const speed = this.speed * delta * 2;
             if (this.moveForward) this.camera.translateZ(-speed);
             if (this.moveBackward) this.camera.translateZ(speed);
             if (this.moveLeft) this.camera.translateX(-speed);
             if (this.moveRight) this.camera.translateX(speed);
        } else {
             this.controls.moveRight(-this.velocity.x * delta);
             this.controls.moveForward(-this.velocity.z * delta);
        }

        // Height clamp
        if (this.camera.position.y < 2) this.camera.position.y = 2;
        if (this.camera.position.y > 20) this.camera.position.y = 20;
    }
}

