import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { WebGPURenderer } from './WebGPURenderer.js';

import { XRButton } from 'three/addons/webxr/XRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';


export class DisplayManager {
	#scene;
	#camera;
	#renderer;
	#displayQuad0;
	#displayQuad1;
	#webGPUCanvas0;
	#webGPUCanvas1;
	#webGPUTexture0;
	#webGPUTexture1;
	#controler;
	#stats;
	#webGPURenderer0;
	#webGPURenderer1;

	activeVR = false;

	constructor() {
		this.#stats = new Stats()
		document.body.appendChild( this.#stats.dom );

		console.log("new DisplayManager")
		this.#renderer = new THREE.WebGLRenderer({antialias: true});
		this.#renderer.autoClear = false;
		this.#renderer.setPixelRatio( window.devicePixelRatio );
		this.#renderer.setSize( window.innerWidth, window.innerHeight );
		this.#renderer.xr.enabled = true;
		this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.#renderer.toneMappingExposure = 1;

		this.#renderer.setSize(window.innerWidth, window.innerHeight);
		const canvas = this.#renderer.domElement
		document.body.appendChild(canvas);
		console.log(this.#renderer)
		document.body.appendChild( VRButton.createButton( this.#renderer ) );



		this.#renderer.xr.addEventListener('sessionstart', () => {
			console.log('VR session started');
			this.activeVR = true; // Enable controller input when VR is active
		});

		this.#renderer.xr.addEventListener('sessionend', () => {
			console.log('VR session ended');
			this.activeVR = false; // Disable controller input when VR is inactive
		});


		this.#scene = new THREE.Scene();
		this.#scene.background = new THREE.Color(0x555555);

		this.#camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
		this.#camera.position.set( 1, 1, 3 );

		this.#controler = new OrbitControls(this.#camera, canvas);
		console.log(this.#controler)
		// this.#camera.layers.enable(0);
		this.#camera.layers.enable(1);
		// window.addEventListener('resize', () => {
		// 	this.#renderer.setSize(window.innerWidth, window.innerHeight);
		// 	this.#camera.aspect = window.innerWidth / window.innerHeight;
		// 	this.#camera.updateProjectionMatrix();
		// });

		this.#webGPUCanvas0 = document.getElementById('webgpuCanvas0');
		this.#webGPUCanvas1 = document.getElementById('webgpuCanvas1');
		this.#webGPUTexture0 = new THREE.CanvasTexture(this.#webGPUCanvas0);
		this.#webGPUTexture1 = new THREE.CanvasTexture(this.#webGPUCanvas1);


		this.#initializeViewQuad();
		// this.initializeWebGPURenderer();
		// requestAnimationFrame(this.#animationLoop.bind(this))
	}

	#initializeViewQuad() {
		const geometry = new THREE.PlaneGeometry(2, 2);
		const material = new THREE.ShaderMaterial({
			uniforms: {
			  u_texture: { value: this.#webGPUTexture0 },
			  u_cameraPosition: { value: new THREE.Vector3() },
			},
			vertexShader: `
			  varying vec2 vUv;
			  void main() {
				vUv = uv;
				gl_Position = vec4(position, 1.0);
			  }
			`,
			fragmentShader: `
    			uniform vec3 u_cameraPosition;
				uniform sampler2D u_texture;
				varying vec2 vUv;
				void main() {
					vec4 texColor = texture2D(u_texture, vUv);
					gl_FragColor = texColor;
			 	 }
			`,
		  });

		  const material2 = new THREE.ShaderMaterial({
			uniforms: {
			  u_texture: { value: this.#webGPUTexture1 },
			  u_cameraPosition: { value: new THREE.Vector3() },
			},
			vertexShader: `
			  varying vec2 vUv;
			  void main() {
				vUv = uv;
				gl_Position = vec4(position, 1.0);
			  }
			`,
			fragmentShader: `
    			uniform vec3 u_cameraPosition;
				uniform sampler2D u_texture;
				varying vec2 vUv;
				void main() {
					vec4 texColor = texture2D(u_texture, vUv);
					gl_FragColor = texColor;
			 	 }
			`,
		  });

		this.#displayQuad0 = new THREE.Mesh(geometry, material);
		this.#displayQuad0.layers.disable(0);
		this.#displayQuad0.layers.enable(1);

		this.#displayQuad1 = new THREE.Mesh(geometry, material2);
		this.#displayQuad1.layers.disable(0);
		this.#displayQuad1.layers.enable(2);
		// console.log(this.#displayQuad0.layers)
		this.#scene.add(this.#displayQuad0);
		this.#scene.add(this.#displayQuad1);
	}

	async initializeWebGPURenderers() {
		this.#webGPUCanvas0.width = window.innerWidth;
		this.#webGPUCanvas0.height = window.innerHeight;
		this.#webGPURenderer0 = await WebGPURenderer.create(this.#webGPUCanvas0);

		this.#webGPUCanvas1.width = window.innerWidth;
		this.#webGPUCanvas1.height = window.innerHeight;
		this.#webGPURenderer1 = await WebGPURenderer.create(this.#webGPUCanvas1);
	}

	#animationLoop(t) {

		if(!this.activeVR) {
			this.#camera.updateMatrixWorld();
			const mvp = this.#camera.projectionMatrix.clone().multiply(this.#camera.matrixWorldInverse);
			const MVP = new Float32Array(mvp.toArray());
			const INV_MVP = new Float32Array(mvp.invert().toArray());




			this.#webGPURenderer0.render(MVP);
			this.#webGPUTexture0.needsUpdate = true;
			// this.#webGPURenderer1.render(MVP);
			// this.#webGPUTexture1.needsUpdate = true;
			this.#render();
		}

		else {
			const cameras = this.#renderer.xr.getCamera().cameras
			// console.log(cameras)
			cameras[0].updateMatrixWorld();
			cameras[1].updateMatrixWorld();
			let mvp = cameras[0].projectionMatrix.clone().multiply(cameras[0].matrixWorldInverse);
			let MVP = new Float32Array(mvp.toArray());
			let INV_MVP = new Float32Array(mvp.invert().toArray());

			this.#webGPURenderer0.render(MVP);
			this.#webGPUTexture0.needsUpdate = true;

			mvp = cameras[1].projectionMatrix.clone().multiply(cameras[1].matrixWorldInverse);
			MVP = new Float32Array(mvp.toArray());
			INV_MVP = new Float32Array(mvp.invert().toArray());


			this.#webGPURenderer1.render(MVP);
			this.#webGPUTexture1.needsUpdate = true;
			this.#render();
		}
		this.#stats.update();
		// requestAnimationFrame(this.#animationLoop.bind(this))
	}

	#render() {
		// console.log("render", this)
		this.#renderer.render(this.#scene, this.#camera);
	}

	start() {
		this.#renderer.setAnimationLoop(this.#animationLoop.bind(this));
		// requestAnimationFrame(this.#animationLoop.bind(this))
	}
}