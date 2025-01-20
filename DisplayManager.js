import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';


export class DisplayManager {
	#scene;
	#camera;
	#renderer;
	#displayQuad;
	#webGPUCanvas0;
	#webGPUCanvas1;
	#webGPUTexture0;
	#webGPUTexture1;
	#controler;
	#stats; 


	constructor() {
		this.#stats = new Stats()
		document.body.appendChild( this.#stats.dom );

		console.log("new DisplayManager")
		this.#renderer = new THREE.WebGLRenderer();

		this.#renderer.setSize(window.innerWidth, window.innerHeight);
		document.body.appendChild(this.#renderer.domElement);
		console.log(this.#renderer)

		this.#scene = new THREE.Scene();
		this.#scene.background = new THREE.Color(0x555555);

		this.#camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
		this.#controler = new OrbitControls(this.#camera, this.#render.domElement);
		// this.#camera.layers.enable(0);
		// this.#camera.layers.enable(1);
		window.addEventListener('resize', () => {
			this.#renderer.setSize(window.innerWidth, window.innerHeight);
			this.#camera.aspect = window.innerWidth / window.innerHeight;
			this.#camera.updateProjectionMatrix();
		});

		this.#webGPUCanvas0 = document.getElementById('webgpuCanvas0');
		this.#webGPUCanvas1 = document.getElementById('webgpuCanvas1');
		this.#webGPUTexture0 = new THREE.CanvasTexture(this.#webGPUCanvas0);
		this.#webGPUTexture1 = new THREE.CanvasTexture(this.#webGPUCanvas1);

		this.#drawCanvas(this.#webGPUCanvas0, "0");

		this.#initializeViewQuad();

		requestAnimationFrame(this.#animationLoop.bind(this))
	}

	/// placeholder for webgpu render
	#drawCanvas(canvas, text = "0") {
		// console.log(text);
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = '#444';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	  
		ctx.fillStyle = '#f00';
		ctx.font = '30px Arial';
		ctx.fillText(text, 50, 100);
	  
		ctx.strokeStyle = '#0f0';
		ctx.lineWidth = 10;
		ctx.strokeRect(50, 150, 400, 200);
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
					// float gradient = u_cameraPosition.y * 0.5 + 0.5;
					// gl_FragColor = vec4((texColor.xyz + vec3(vUv.x, gradient, 1.0 - vUv.y)) * 0.5, 1.0);
			 	 }
			`,
		  });

		this.#displayQuad = new THREE.Mesh(geometry, material);
		// this.#displayQuad.layers.disable(0);
		// this.#displayQuad.layers.enable(0);
		console.log(this.#displayQuad.layers)
		this.#scene.add(this.#displayQuad);
	}


	#animationLoop(t) {
		// console.log(t);
		this.#drawCanvas(this.#webGPUCanvas0, ""+t)
		this.#webGPUTexture0.needsUpdate = true;
		this.#render();
		this.#stats.update();
		requestAnimationFrame(this.#animationLoop.bind(this))
	}

	#render() {
		// console.log("render", this)
		this.#renderer.render(this.#scene, this.#camera);
	}
}