import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

export function installPremiumRender({renderer,scene,camera,light,invalidate}) {
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
  const composer=new EffectComposer(renderer,target);
  const beauty=new RenderPass(scene,camera);
  const ao=new SSAOPass(scene,camera,1,1,12);ao.kernelRadius=.115;ao.minDistance=.00018;ao.maxDistance=.028;
  // Keep the AO contribution restrained, so graphite remains readable.
  const nativeOverride=ao.overrideVisibility.bind(ao);
  ao.overrideVisibility=()=>{nativeOverride();scene.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];if(o.userData.surfaceDetail||materials.some(m=>m.transparent))o.visible=false;});};
  ao.ssaoMaterial.fragmentShader=ao.ssaoMaterial.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - occlusion ), 1.0 );','gl_FragColor = vec4( vec3( 1.0 - occlusion * 0.62 ), 1.0 );');
  composer.addPass(beauty);composer.addPass(ao);composer.addPass(new OutputPass());
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const software=debug?/swiftshader|llvmpipe|software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):false;
  let requested='auto',profile='',slowFrames=0,adapted=false;
  const compact=()=>window.innerWidth<=700;
  function apply(balanced){profile=balanced?'balanced':'high';const ratio=Math.min(window.devicePixelRatio||1,balanced?1.3:1.8);renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);renderer.setSize(window.innerWidth,window.innerHeight);composer.setSize(window.innerWidth,window.innerHeight);
    ao.enabled=!balanced;beauty.enabled=true;
    // SSAOPass multiplies AO into the preceding beauty render; normals omit explanatory
    // transparencies, particles and sewing instances which are not occluders.
    const shadowSize=balanced?1024:2048;if(light.shadow.mapSize.x!==shadowSize){light.shadow.map?.dispose();light.shadow.map=null;light.shadow.mapPass?.dispose();light.shadow.mapPass=null;light.shadow.mapSize.set(shadowSize,shadowSize);renderer.shadowMap.needsUpdate=true;}
    invalidate();
  }
  function setQuality(value){requested=value;adapted=false;slowFrames=0;apply(value==='balanced'||value==='auto'&&(compact()||software));}
  document.querySelector('#quality').onchange=e=>setQuality(e.target.value);
  function resize(){apply(requested==='balanced'||requested==='auto'&&(compact()||adapted||software));}
  function measureGPU(ms){if(requested==='auto'&&profile==='high'&&ms>100){slowFrames++;if(slowFrames>=3){adapted=true;apply(true);}}}
  function render(){const started=performance.now();composer.render();const elapsed=performance.now()-started;
    if(requested==='auto'&&!compact()&&profile==='high'){slowFrames=elapsed>45?slowFrames+1:Math.max(0,slowFrames-1);if(slowFrames>=10){adapted=true;apply(true);}}
    return elapsed;
  }
  setQuality('auto');
  return {render,resize,setQuality,measureGPU,inspect:()=>({requested,profile,ambientOcclusion:ao.enabled,pixelRatio:renderer.getPixelRatio(),toneMapping:'ACES',antialiasSamples:4,softwareRenderer:software})};
}
