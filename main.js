import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DisplayManager } from './DisplayManager.js';



let activeVR = false;



const display = new DisplayManager();
await display.initializeWebGPURenderers();
display.start()
