import { Loader } from "./loader.js";

const cubeVertexSize = 4 * 10; // Byte size of one cube vertex.
const cubePositionOffset = 0;
const cubeColorOffset = 4 * 4; // Byte offset of cube vertex color attribute.
const cubeUVOffset = 4 * 8;
const cubeVertexCount = 36;


const cubeVertexArray = new Float32Array([
	// float4 position, float4 color, float2 uv,
	1, -1, 1, 1,   1, 0, 1, 1,  0, 1,
	-1, -1, 1, 1,  0, 0, 1, 1,  1, 1,
	-1, -1, -1, 1, 0, 0, 0, 1,  1, 0,
	1, -1, -1, 1,  1, 0, 0, 1,  0, 0,
	1, -1, 1, 1,   1, 0, 1, 1,  0, 1,
	-1, -1, -1, 1, 0, 0, 0, 1,  1, 0,

	1, 1, 1, 1,    1, 1, 1, 1,  0, 1,
	1, -1, 1, 1,   1, 0, 1, 1,  1, 1,
	1, -1, -1, 1,  1, 0, 0, 1,  1, 0,
	1, 1, -1, 1,   1, 1, 0, 1,  0, 0,
	1, 1, 1, 1,    1, 1, 1, 1,  0, 1,
	1, -1, -1, 1,  1, 0, 0, 1,  1, 0,

	-1, 1, 1, 1,   0, 1, 1, 1,  0, 1,
	1, 1, 1, 1,    1, 1, 1, 1,  1, 1,
	1, 1, -1, 1,   1, 1, 0, 1,  1, 0,
	-1, 1, -1, 1,  0, 1, 0, 1,  0, 0,
	-1, 1, 1, 1,   0, 1, 1, 1,  0, 1,
	1, 1, -1, 1,   1, 1, 0, 1,  1, 0,

	-1, -1, 1, 1,  0, 0, 1, 1,  0, 1,
	-1, 1, 1, 1,   0, 1, 1, 1,  1, 1,
	-1, 1, -1, 1,  0, 1, 0, 1,  1, 0,
	-1, -1, -1, 1, 0, 0, 0, 1,  0, 0,
	-1, -1, 1, 1,  0, 0, 1, 1,  0, 1,
	-1, 1, -1, 1,  0, 1, 0, 1,  1, 0,

	1, 1, 1, 1,    1, 1, 1, 1,  0, 1,
	-1, 1, 1, 1,   0, 1, 1, 1,  1, 1,
	-1, -1, 1, 1,  0, 0, 1, 1,  1, 0,
	-1, -1, 1, 1,  0, 0, 1, 1,  1, 0,
	1, -1, 1, 1,   1, 0, 1, 1,  0, 0,
	1, 1, 1, 1,    1, 1, 1, 1,  0, 1,

	1, -1, -1, 1,  1, 0, 0, 1,  0, 1,
	-1, -1, -1, 1, 0, 0, 0, 1,  1, 1,
	-1, 1, -1, 1,  0, 1, 0, 1,  1, 0,
	1, 1, -1, 1,   1, 1, 0, 1,  0, 0,
	1, -1, -1, 1,  1, 0, 0, 1,  0, 1,
	-1, 1, -1, 1,  0, 1, 0, 1,  1, 0,
]);



export class WebGPURenderer {
	#canvas;
	
    constructor(gpu, adapter, device, context, canvas) {
		this.#canvas = canvas;
        this.gpu = gpu;
        this.adapter = adapter;
        this.device = device;
        this.context = context;

	}

	static async create( canvas ) {
		const gpu = navigator.gpu;
		if(!gpu) {
			throw new Error("WebGPU not supported on this browser.");
		}

		const adapter = await gpu.requestAdapter();
		if(!adapter) {
			throw new Error("No appropriate GPUAdapter found.");
		}
		
		const requiredFeatures = ['bgra8unorm-storage'];
		const device = await adapter.requestDevice({requiredFeatures});
		
		const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
		const context = canvas.getContext("webgpu");
		console.log(gpu, adapter, device, context, canvas)
		context.configure({
			device: device,
			format: canvasFormat,
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING,
		});

		const renderer = new WebGPURenderer(gpu, adapter, device, context, canvas);

		await renderer.#initializeResources();
		await renderer.#intializePipelines();

		return renderer;
	}

	render( mvpMatrix ) {
		// console.log("webgpu rendering")
		this.device.queue.writeBuffer(
			this.uniformBuffer,
			0,
			mvpMatrix,
		);
		

		const commandEncoder = this.device.createCommandEncoder();
        this.colorAttachment.view = this.context.getCurrentTexture().createView();
		const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [this.colorAttachment],
            depthStencilAttachment: this.depthStencilAttachment,
        });
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
		renderPass.draw(cubeVertexCount);
        renderPass.end();
		this.device.queue.submit([commandEncoder.finish()]);

	}

	async #initializeResources( ) {
		console.log("initializing resources")
		/// cube vertex buffer
		this.vertexBuffer = this.device.createBuffer({
			size: cubeVertexArray.byteLength,
			usage: GPUBufferUsage.VERTEX,
			mappedAtCreation: true,
		});
		new Float32Array(this.vertexBuffer.getMappedRange()).set(cubeVertexArray);
		this.vertexBuffer.unmap();
		

	 	this.depthTexture = this.device.createTexture({
			size: [this.#canvas.width, this.#canvas.height],
			format: 'depth24plus',
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});

		const uniformBufferSize = 4 * 16; // 4x4 matrix
		this.uniformBuffer = this.device.createBuffer({
		  size: uniformBufferSize,
		  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
	}

	async #intializePipelines() {
		console.log("initializing pipelines")
		const code = await new Loader().loadText("./shaders/cube.wgsl");
        const shaderModule = this.device.createShaderModule({code});

		const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                // uniform buffer
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {},
                },
            ]
        });

		const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [
                bindGroupLayout, // @group 0
            ]
        });

		this.pipeline = this.device.createRenderPipeline({
			layout: pipelineLayout,
			vertex: {
				module: shaderModule,
				entryPoint: "vertex",
				buffers: [{
					arrayStride: cubeVertexSize,
					attributes: [
					{
						// position
						shaderLocation: 0,
						offset: cubePositionOffset,
						format: 'float32x4',
					},
					{
						// uv
						shaderLocation: 1,
						offset: cubeUVOffset,
						format: 'float32x2',
					},
					],
				},],
			},
			fragment: {
				module: shaderModule,
				entryPoint: "fragment",
				targets: [{
					format: this.gpu.getPreferredCanvasFormat(),
				},],
			},
			primitive: {
				topology: 'triangle-list',
				cullMode: 'back',
			},
		  
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'less',
				format: 'depth24plus',
			},
		});

		this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {binding: 0, resource: {buffer: this.uniformBuffer}},
            ]
        });


		this.colorAttachment = {
            view: null,
            clearValue: {r: 0.3, g: 0.3, b: 0.3, a: 1},
            loadOp: 'clear',
            loadValue: {r: 0.3, g: 0.3, b: 0.3, a: 1},
            storeOp: 'store'
        };

		this.depthStencilAttachment = {
            view: this.depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'discard',
        };
	}
}	