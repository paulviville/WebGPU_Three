import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { WebGPUStereoRenderer } from './WebGPUStereoRenderer.js';
import { WebGPURenderer } from './WebGPURenderer.js';

import { XRButton } from 'three/addons/webxr/XRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';


export class DisplayManager {
	#scene;
	#camera;
	#renderer;
	#displayQuadL;
	#displayQuadR;
	#webGPUStereoCanvas;
	#webGPUStereoTexture;
	#controler;
	#stats;
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

		const canvas = this.#renderer.domElement
		document.body.appendChild(canvas);
		console.log(this.#renderer)
		document.body.appendChild( VRButton.createButton( this.#renderer ) );



		this.#renderer.xr.addEventListener('sessionstart', () => {
			console.log('VR session started');
			this.webGPUStereoRenderer.mono = false;
			this.activeVR = true;
		});

		this.#renderer.xr.addEventListener('sessionend', () => {
			console.log('VR session ended');
			this.webGPUStereoRenderer.mono = true;
			this.activeVR = false;
		});


		this.#scene = new THREE.Scene();
		this.#scene.background = new THREE.Color(0x555555);

		this.#camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
		this.#camera.position.set( 1, 1, 3 );
		this.#camera.layers.enable(1);

		this.#controler = new OrbitControls(this.#camera, canvas);

		this.#webGPUStereoCanvas = document.getElementById('webgpuCanvas');
		this.#webGPUStereoTexture = new THREE.CanvasTexture(this.#webGPUStereoCanvas);

		this.#initializeViewQuad();
	}

	#initializeViewQuad() {
		const geometry0 = new THREE.PlaneGeometry(2, 2);
		const uvs0 = geometry0.attributes.uv.array;
		uvs0[2] = 0.5;
		uvs0[6] = 0.5;

		const geometry1 = new THREE.PlaneGeometry(2, 2);
		const uvs1 = geometry1.attributes.uv.array;
		uvs1[0] = 0.5;
		uvs1[4] = 0.5;

		const material = new THREE.ShaderMaterial({
			uniforms: {
			  u_texture: { value: this.#webGPUStereoTexture },
			},
			vertexShader: `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				uniform sampler2D u_texture;
				varying vec2 vUv;
				void main() {
					vec4 texColor = texture2D(u_texture, vUv);
					gl_FragColor = texColor;
			 	}
			`,
		});

		this.#displayQuadL = new THREE.Mesh(geometry0, material);
		this.#displayQuadL.layers.disable(0);
		this.#displayQuadL.layers.enable(1);

		this.#displayQuadR = new THREE.Mesh(geometry1, material);
		this.#displayQuadR.layers.disable(0);
		this.#displayQuadR.layers.enable(2);

		this.#scene.add(this.#displayQuadL);
		this.#scene.add(this.#displayQuadR);
	}

	async initializeWebGPURenderers() {
		this.#webGPUStereoCanvas.width = 1680 * 2;
		this.#webGPUStereoCanvas.height = 1760;
		this.webGPUStereoRenderer = await WebGPUStereoRenderer.create(this.#webGPUStereoCanvas);
	}

	model = new THREE.Matrix4();
	mvp = new THREE.Matrix4();
	cameraMVP= {
		L: new Float32Array(16),
		R: new Float32Array(16),
	}

	#animationLoop(t) {
		this.model.makeRotationAxis(new THREE.Vector3(0, 0, 1).normalize(), t /2000);
		
		if(!this.activeVR) {

			this.mvp.copy(this.#camera.projectionMatrix).multiply(this.#camera.matrixWorldInverse).multiply(this.model);
			this.mvp.toArray(this.cameraMVP.L);
		}

		else {
			const cameras = this.#renderer.xr.getCamera().cameras

			this.mvp.copy(cameras[0].projectionMatrix).multiply(cameras[0].matrixWorldInverse).multiply(this.model);
			this.mvp.toArray(this.cameraMVP.L);
			this.mvp.copy(cameras[1].projectionMatrix).multiply(cameras[1].matrixWorldInverse).multiply(this.model);
			this.mvp.toArray(this.cameraMVP.R);
		}

		this.webGPUStereoRenderer.render(this.cameraMVP.L, this.cameraMVP.R);
		this.#webGPUStereoTexture.needsUpdate = true;

		this.#render();
		this.#stats.update();
	}

	#render() {
		this.#renderer.render(this.#scene, this.#camera);
	}

	start() {
		this.#renderer.setAnimationLoop(this.#animationLoop.bind(this));
	}
}