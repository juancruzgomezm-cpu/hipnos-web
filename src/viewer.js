import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {gunzipSync} from 'fflate';
import {installHipnosInteractions} from './interactions.js';
import {installMinimalRoom} from './environment.js';
import {installDetailedSurfaces} from './surface_details.js';
import {installPremiumLighting} from './premium_lighting.js';
import {installPremiumRender} from './premium_render.js';
import {fitCameraToRect,boxCorners} from './camera_fit.js';
import {installWebExperience,loadProduct} from './web-experience.js';
const cfg=window.HIPNOS_CONFIG,host=document.querySelector('#stage'),status=document.querySelector('#status');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.setSize(host.clientWidth,host.clientHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;host.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#e4dfd5');
const camera=new THREE.PerspectiveCamera(cfg.fov,host.clientWidth/host.clientHeight,.02,80);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.075;controls.minDistance=.48;controls.maxDistance=14;controls.maxPolarAngle=Math.PI-.07;controls.autoRotateSpeed=.45;controls.screenSpacePanning=true;
camera.position.set(...cfg.camera);controls.target.set(...cfg.target);controls.update();
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#ded7cb',roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;floor.receiveShadow=true;scene.add(floor);
let root,motion=null,needsRender=true,interactions=null,surfaceDetails=null,lastRenderDuration=0,lastRenderAt=0;
const invalidate=()=>{needsRender=true;};
const environment=installMinimalRoom({scene,floor,camera,cfg,invalidate});
const lighting=installPremiumLighting({scene,renderer,invalidate});
lighting.setNight(false);
const rendering=installPremiumRender({renderer,scene,camera,light:lighting.key,invalidate});
const gpu=renderer.getContext();let fence=null,pendingFrame=false,fenceAt=0;
controls.addEventListener('change',invalidate);
function setView(position,target,fov=camera.fov){
 controls.autoRotate=false;document.querySelector('#spin').classList.remove('active');document.querySelector('#spin').setAttribute('aria-pressed','false');
 motion={from:camera.position.clone(),to:new THREE.Vector3(...position),targetFrom:controls.target.clone(),targetTo:new THREE.Vector3(...target),fovFrom:camera.fov,fovTo:fov,start:performance.now(),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?260:1150};invalidate();
}
function home(){
 const nav=document.querySelector('.explore-nav').getBoundingClientRect(),bar=document.querySelector('.panel').getBoundingClientRect();
 const points=[...boxCorners([-.968,.968],[.018,.901],[-1.114,1.114]),...boxCorners([cfg.hub[0]-.110,cfg.hub[0]+.110],[.019,.610],[cfg.hub[2]-.172,cfg.hub[2]+.172])];
 const compact=innerWidth<=700;
 const rect={left:compact?18:60,right:innerWidth-(compact?18:60),top:compact?210:185,bottom:bar.top-(compact?56:72)};
 const fitted=fitCameraToRect(cfg.camera,cfg.target,cfg.fov,points,{width:innerWidth,height:innerHeight},rect,13.7);
 setView(fitted.position,fitted.target,fitted.fov);document.querySelector('#camera-select').value='general';
}
document.querySelector('#reference').onclick=()=>{setView(cfg.camera,cfg.target,cfg.fov);document.querySelector('#camera-select').value='reference';};
document.querySelector('#hub').onclick=()=>{setView([cfg.hub[0]-.74,.83,cfg.hub[2]+1.02],[cfg.hub[0],.31,cfg.hub[2]],34);document.querySelector('#camera-select').value='hub';};
document.querySelector('#fabric').onclick=()=>{setView([-.61,.96,1.19],[-.18,.67,.70],34);document.querySelector('#camera-select').value='fabric';};
document.querySelector('#top').onclick=()=>{setView([-.05,4.9,.08],[0,.42,0],38);document.querySelector('#camera-select').value='top';};
document.querySelector('#spin').onclick=e=>{motion=null;controls.autoRotate=!controls.autoRotate;e.currentTarget.classList.toggle('active',controls.autoRotate);e.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate));invalidate();};
document.querySelector('#pillows').onchange=e=>{if(root)root.traverse(o=>{if(o.name.includes('Almohada'))o.visible=e.target.checked;});renderer.shadowMap.needsUpdate=true;invalidate();};
document.querySelector('#fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{});else window.HIPNOS_WEB?.toast('En iPhone: Compartir → Agregar a inicio para abrir a pantalla completa.');};
document.querySelector('#download').onclick=()=>{if(!window.HIPNOS_BUFFER)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([window.HIPNOS_BUFFER],{type:'model/gltf-binary'}));a.download='Hipnos_modelo_3D.glb';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);};
document.querySelector('#camera-select').onchange=e=>{const id=e.target.value;if(id==='general')interactions?interactions.go('general',home):home();else document.querySelector('#'+id).click();};
document.querySelector('#reset-camera').onclick=()=>{interactions?interactions.go('general',home):home();};
controls.addEventListener('start',()=>{motion=null;});
function loadPhase(text,amount){document.querySelector('#loading-text').textContent=text;document.querySelector('#load-progress').style.width=amount+'%';}
(async()=>{
 try{
  const buffer=await loadProduct(loadPhase);
  window.HIPNOS_BUFFER=buffer;loadPhase('Afinando los materiales…',47);
  const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(buffer,'',resolve,reject));
  root=gltf.scene;scene.add(root);renderer.shadowMap.needsUpdate=true;let meshes=0,triangles=0;
  root.traverse(o=>{if(o.isMesh){meshes++;triangles+=o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3;o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])for(const map of [m.map,m.normalMap,m.roughnessMap])if(map)map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}});
  surfaceDetails=await installDetailedSurfaces({root,scene,camera,renderer,invalidate});
  loadPhase('Preparando las cuatro capas…',78);
  interactions=installHipnosInteractions({scene,root,camera,controls,renderer,cfg,setView,home,invalidate});surfaceDetails.refineAdditions();
  window.HIPNOS_WEB=installWebExperience({THREE,scene,root,camera,controls,renderer,cfg,setView,home,invalidate,interactions});home();
  loadPhase('Hipnos está listo.',100);window.HIPNOS_READY={meshes,triangles};invalidate();
 }catch(err){status.textContent='No se pudo preparar el visor';loadPhase(err.message||String(err),0);document.querySelector('#load-retry').hidden=false;window.HIPNOS_ERROR=String(err);console.error(err);}
})();
let resizeTimer;
function resize(){camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();rendering.resize();invalidate();clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(interactions?.isActive())interactions.cameraForCurrent();else home();},180);}
window.addEventListener('resize',resize);
let lastShadow=0;
function frame(){
 requestAnimationFrame(frame);const now=performance.now();if(document.hidden)return;
 if(motion){const t=Math.min(1,(now-motion.start)/motion.duration),e=t*t*t*(t*(t*6-15)+10);camera.position.lerpVectors(motion.from,motion.to,e);controls.target.lerpVectors(motion.targetFrom,motion.targetTo,e);camera.fov=THREE.MathUtils.lerp(motion.fovFrom,motion.fovTo,e);camera.updateProjectionMatrix();needsRender=true;if(t===1)motion=null;}
 const changed=controls.update(),addedMotion=interactions?.update(now),lightMotion=lighting.update(now);environment.update();surfaceDetails?.update();window.HIPNOS_WEB?.update(now);
 if(addedMotion||lightMotion)pendingFrame=true;
 const due=pendingFrame&&now-lastRenderAt>=Math.max(1000/30,lastRenderDuration*1.5);
 let gpuReady=true;if(fence){const state=gpu.clientWaitSync(fence,0,0);gpuReady=state===gpu.ALREADY_SIGNALED||state===gpu.CONDITION_SATISFIED||state===gpu.WAIT_FAILED;if(gpuReady){rendering.measureGPU(now-fenceAt);gpu.deleteSync(fence);fence=null;}}
 if(gpuReady&&(needsRender||changed||controls.autoRotate||due)){
  if(addedMotion&&now-lastShadow>130){renderer.shadowMap.needsUpdate=true;lastShadow=now;}
  lastRenderDuration=rendering.render();lastRenderAt=performance.now();needsRender=false;pendingFrame=false;fence=gpu.fenceSync(gpu.SYNC_GPU_COMMANDS_COMPLETE,0);fenceAt=lastRenderAt;gpu.flush();
  window.HIPNOS_PRESENTATION={...interactions?.inspect(),theme:lighting.inspect().theme,themeProgress:lighting.inspect().transition,cameraTransition:!!motion,time:lastRenderAt};
  if(window.HIPNOS_READY&&!motion)document.querySelector('#loading').classList.add('hidden');
 }
}frame();
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='Se interrumpió la visualización. Recargá el archivo para continuar.';});
window.HIPNOS_INSPECT=()=>({ready:window.HIPNOS_READY,camera:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov,autoRotate:controls.autoRotate,renderCalls:renderer.info.render.calls,renderTriangles:renderer.info.render.triangles,pillowsVisible:document.querySelector('#pillows').checked,lighting:lighting.inspect(),quality:rendering.inspect()});
window.HIPNOS_PREMIUM={home,night:lighting.setNight,quality:rendering.setQuality,inspect:()=>({version:'2.1.0',lighting:lighting.inspect(),rendering:rendering.inspect(),cameraTransition:!!motion,geometryPreserved:window.HIPNOS_SURFACES?.inspect().originalGeometryPreserved,glbBytes:window.HIPNOS_BUFFER?.byteLength})};
