import * as THREE from 'three';
import {surfaceAssets} from './surface_assets.js';

// Surface-only extension. No loaded vertex, normal, UV, index, transform,
// camera, light or interaction source is rewritten. Fine seams are children
// of the existing piping, so the original despiece moves them automatically.
export async function installDetailedSurfaces({root,scene,camera,renderer,invalidate}) {
  const loader=new THREE.TextureLoader();
  const maps={};
  const anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  await Promise.all(Object.entries(surfaceAssets).map(async ([name,url])=>{
    const texture=await loader.loadAsync(url);
    texture.name='Hipnos · '+name;texture.colorSpace=THREE.NoColorSpace;
    texture.wrapS=texture.wrapT=name.startsWith('pillow_tension')?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;
    texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
    texture.generateMipmaps=true;texture.anisotropy=anisotropy;maps[name]=texture;
  }));
  const settings={
    cover:{tile:.08,strength:.52,rough:.83,blend:.76,variation:1.20,original:.40,shadow:.00030,sheen:.34},
    cotton:{tile:.08,strength:.46,rough:.92,blend:.62,variation:.85,original:.48,pillow:true,sheen:.22},
    linen:{tile:.10,strength:.55,rough:.88,blend:.66,variation:.85,original:.48,sheen:.28},
    backing:{tile:.08,strength:.48,rough:.94,blend:.72,variation:.70,original:.32},
    wadding:{tile:.08,strength:.56,rough:.96,blend:.72,variation:.65,original:.32},
    hub:{tile:.04,strength:.40,rough:.49,blend:.75,variation:.70,original:1},
    polymer:{tile:.05,strength:.50,blend:.18,variation:.85,original:1},
    metal:{tile:.06,strength:.38,blend:.18,variation:.85,original:1},
    embroidery:{tile:.012,strength:.47,rough:.87,blend:.63,variation:.70,original:1,embroidery:true}
  };
  const states=new WeakMap();
  const counts={};
  const sourceMeshes=[];
  root.traverse(o=>{if(o.isMesh)sourceMeshes.push(o);});
  const geometryBaseline=sourceMeshes.map(o=>({object:o,geometry:o.geometry,position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()}));

  const declarations=`
    varying vec3 hpPosition;
    varying vec3 hpObjectNormal;
    varying vec2 hpOriginalUV;
    uniform sampler2D hpNormal;
    uniform sampler2D hpSurface;
    uniform sampler2D hpPillowNormal;
    uniform vec4 hpDetail;
    uniform vec4 hpFinish;
    uniform vec2 hpExtra;
    vec3 hpMappedNormal(vec3 base,vec3 mapNormal,vec2 st0,vec2 st1,vec3 q0,vec3 q1) {
      vec3 q1perp=cross(q1,base),q0perp=cross(base,q0);
      vec3 T=q1perp*st0.x+q0perp*st1.x;
      vec3 B=q1perp*st0.y+q0perp*st1.y;
      float determinant=max(dot(T,T),dot(B,B));
      float scale=determinant==0.0?0.0:inversesqrt(determinant);
      mapNormal.xy*=hpDetail.y;
      return normalize(mat3(T*scale,B*scale,base)*mapNormal);
    }
  `;
  function apply(material,kind) {
    if(!material?.isMeshStandardMaterial)return material;
    const profile=settings[kind];
    let state=states.get(material);
    if(state?.kind===kind)return material;
    if(!state){
      state={before:material.onBeforeCompile,key:material.customProgramCacheKey.bind(material),clone:material.clone.bind(material),roughness:material.roughness,kind:null};
      states.set(material,state);
    }
    state.kind=kind;
    const roughCenter=kind==='cover'?235/255:kind==='cotton'?244/255:kind==='linen'?241/255:kind==='backing'?246/255:kind==='wadding'?246/255:kind==='hub'?225/255:kind==='metal'?220/255:kind==='polymer'?231/255:239/255;
    material.userData.hipnosSurface=kind;
    material.onBeforeCompile=(shader,webglRenderer)=>{
      state.before(shader,webglRenderer);
      Object.assign(shader.uniforms,{
        hpNormal:{value:maps[kind+'_normal']},hpSurface:{value:maps[kind+'_surface']},hpPillowNormal:{value:maps.pillow_tension_normal},
        hpDetail:{value:new THREE.Vector4(profile.tile,profile.strength,profile.original,profile.blend)},
        hpFinish:{value:new THREE.Vector4(profile.rough??state.roughness,roughCenter,profile.variation,profile.embroidery?1:0)},
        hpExtra:{value:new THREE.Vector2(profile.pillow?1:0,profile.shadow||0)}
      });
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 hpPosition;\nvarying vec3 hpObjectNormal;\nvarying vec2 hpOriginalUV;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhpPosition=transformed; hpObjectNormal=objectNormal; hpOriginalUV=uv;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+declarations);
      // A receiver-only depth correction removes dotted self-shadow acne
      // on the existing millimetric channels. Lights, casters and shadows on
      // the floor or on other components retain their original settings.
      shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',THREE.ShaderChunk.shadowmap_pars_fragment.replace('shadowCoord.z += shadowBias;','shadowCoord.z += shadowBias - hpExtra.y;'));
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        vec3 hpWeights=pow(abs(normalize(hpObjectNormal)),vec3(8.0));
        hpWeights/=max(hpWeights.x+hpWeights.y+hpWeights.z,0.00001);
        vec3 hpP=hpPosition/hpDetail.x;
        vec2 hpUVx=hpP.zy, hpUVy=hpP.xz, hpUVz=hpP.xy;
        vec3 hpDPdx=dFdx(hpP),hpDPdy=dFdy(hpP);
        vec3 hpViewDx=dFdx(-vViewPosition),hpViewDy=dFdy(-vViewPosition);
        vec2 hpPillowDx=dFdx(hpOriginalUV/vec2(4.15,2.52));
        vec2 hpPillowDy=dFdy(hpOriginalUV/vec2(4.15,2.52));
        float hpFootprint=max(length(hpDPdx),length(hpDPdy));
        float hpResolution=1.0-smoothstep(0.004,0.011,hpFootprint);
        float hpRough=hpFinish.y;
        if(hpResolution>0.001){hpRough=textureGrad(hpSurface,hpUVx,hpDPdx.zy,hpDPdy.zy).g*hpWeights.x+textureGrad(hpSurface,hpUVy,hpDPdx.xz,hpDPdy.xz).g*hpWeights.y+textureGrad(hpSurface,hpUVz,hpDPdx.xy,hpDPdy.xy).g*hpWeights.z;}
        roughnessFactor=clamp(mix(roughnessFactor,hpFinish.x+(hpRough-hpFinish.y)*hpFinish.z,hpDetail.w),0.075,0.995);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float hpMacro=sin(hpPosition.x*11.2+hpPosition.z*5.8)*sin(hpPosition.z*9.1-hpPosition.x*4.6);
        diffuseColor.rgb*=1.0+hpMacro*(hpFinish.x>0.75?0.037:0.006);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor*=mix(1.0,0.10,hpFinish.w);');
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        normal=normalize(mix(nonPerturbedNormal,normal,hpDetail.z));
        vec3 hpBase=normal;
        if(hpResolution>0.001){
          vec3 hpNX=textureGrad(hpNormal,hpUVx,hpDPdx.zy,hpDPdy.zy).xyz*2.0-1.0;
          vec3 hpNY=textureGrad(hpNormal,hpUVy,hpDPdx.xz,hpDPdy.xz).xyz*2.0-1.0;
          vec3 hpNZ=textureGrad(hpNormal,hpUVz,hpDPdx.xy,hpDPdy.xy).xyz*2.0-1.0;
          vec3 hpFine=normalize(hpMappedNormal(hpBase,hpNX,hpDPdx.zy,hpDPdy.zy,hpViewDx,hpViewDy)*hpWeights.x+
                                hpMappedNormal(hpBase,hpNY,hpDPdx.xz,hpDPdy.xz,hpViewDx,hpViewDy)*hpWeights.y+
                                hpMappedNormal(hpBase,hpNZ,hpDPdx.xy,hpDPdy.xy,hpViewDx,hpViewDy)*hpWeights.z);
          normal=normalize(mix(hpBase,hpFine,hpResolution));
        }
        if(hpExtra.x>0.5){
          vec2 hpPillowUV=hpOriginalUV/vec2(4.15,2.52)+0.5;
          vec3 hpCrease=textureGrad(hpPillowNormal,hpPillowUV,hpPillowDx,hpPillowDy).xyz*2.0-1.0;
          normal=normalize(mix(normal,hpMappedNormal(normal,hpCrease,hpPillowDx,hpPillowDy,hpViewDx,hpViewDy),0.65));
        }
      `);
    };
    material.customProgramCacheKey=()=>state.key()+'|hipnos-surface-r170-v3|'+kind;
    // Three.js does not copy onBeforeCompile during clone(). Carry the finish
    // into the existing transparent hub ghosts and the original layer copies.
    material.clone=()=>{const cloned=state.clone();apply(cloned,state.kind);return cloned;};
    material.needsUpdate=true;counts[kind]=(counts[kind]||0)+1;
    return material;
  }
  function refineObject(object,kind,separate=false) {
    if(!object.isMesh)return;
    const list=Array.isArray(object.material)?object.material:[object.material];
    const next=list.map(m=>{
      if(settings[kind].sheen&&!m.isMeshPhysicalMaterial){
        // Use Three.js' native cloth BRDF. All original color, UV, texture,
        // roughness and metalness inputs are copied without modification.
        const cloth=new THREE.MeshPhysicalMaterial();
        THREE.MeshStandardMaterial.prototype.copy.call(cloth,m);
        cloth.defines={STANDARD:'',PHYSICAL:''};m=cloth;
      }
      if(settings[kind].sheen){
        m.sheen=settings[kind].sheen;m.sheenColor.copy(m.color);
        m.sheenColorMap=m.map;m.sheenRoughness=.94;
      }
      return apply(separate?m.clone():m,kind);
    });
    object.material=Array.isArray(object.material)?next:next[0];
  }
  for(const object of sourceMeshes){
    const name=object.name;
    if(name.startsWith('Bordado'))refineObject(object,'embroidery',true);
    else if(name.startsWith('Cover'))refineObject(object,'cover');
    else if(name.startsWith('Base_tapizada'))refineObject(object,'linen');
    else if(name.includes('Almohada')&&!name.includes('costura'))refineObject(object,'cotton');
    else if(name.startsWith('Hub')&&!name.includes('LED'))refineObject(object,'hub');
    else if(name.includes('Ribete')||name.includes('Costura')||name.includes('costura'))refineObject(object,'embroidery',true);
  }

  const stitchMeshes=[];
  const tinyStitch=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.00112,0,0),new THREE.Vector3(0,.00011,0),new THREE.Vector3(.00112,0,0)
  ]),4,.00010,5,false);
  const dummy=new THREE.Object3D();
  function addStitches(object,points,closed=true) {
    const material=Array.isArray(object.material)?object.material[0]:object.material;
    const curve=new THREE.CatmullRomCurve3(points,closed,'centripetal');
    const number=Math.floor(curve.getLength()/.0039);
    const stitches=new THREE.InstancedMesh(tinyStitch,material,number);
    stitches.name='Puntadas individuales';stitches.userData.surfaceDetail=true;
    const up=new THREE.Vector3(0,1,0),axis=new THREE.Vector3(1,0,0),basis=new THREE.Matrix4();
    for(let i=0;i<number;i++){
      const t=(i+.5)/number,tangent=curve.getTangentAt(t).normalize();
      const p=curve.getPointAt(t);
      if(Math.abs(tangent.y)>.9){up.set(Math.sign(p.x)||1,0,0);}else up.set(0,1,0);
      axis.crossVectors(tangent,up).normalize();up.crossVectors(axis,tangent).normalize();
      dummy.position.copy(p).addScaledVector(up,.00115);dummy.quaternion.setFromRotationMatrix(basis.makeBasis(tangent,up,axis));
      dummy.scale.set(1,1,1);dummy.updateMatrix();stitches.setMatrixAt(i,dummy.matrix);
    }
    stitches.castShadow=false;stitches.receiveShadow=true;object.add(stitches);stitchMeshes.push(stitches);
  }
  function roundedPath(a,b,r,y,scale=1) {
    const pts=[];
    for(const [cx,cz,from] of [[a-r,b-r,0],[-a+r,b-r,Math.PI/2],[-a+r,-b+r,Math.PI],[a-r,-b+r,Math.PI*1.5]]){
      for(let i=0;i<=24;i++){const angle=from+i/24*Math.PI/2;pts.push(new THREE.Vector3((cx+r*Math.cos(angle))*scale,y,(cz+r*Math.sin(angle))*scale));}
    }
    return pts;
  }
  for(const object of sourceMeshes){
    if(object.name.startsWith('Ribete_superior'))addStitches(object,roundedPath(.9,1.03,.078,.715,1.002));
    if(object.name.startsWith('Ribete_inferior'))addStitches(object,roundedPath(.886,1.016,.075,.371));
    if(object.name.includes('Almohada')&&object.name.includes('costura')){
      // The pillow's exact piping cross sections are recovered from the
      // existing position buffer, without guessing or remodeling its outline.
      const a=object.geometry.attributes.position,points=[];
      const groups=new Map();
      for(let i=0;i<a.count;i++){
        const key=Math.round(a.getX(i)*6000)+','+Math.round(a.getZ(i)*6000);
        let v=groups.get(key);if(!v){v={x:0,z:0,n:0};groups.set(key,v);}v.x+=a.getX(i);v.z+=a.getZ(i);v.n++;
      }
      // The actual piped seam is almost planar. Sort its projections around
      // its own centroid and downsample before arclength sampling.
      object.geometry.computeBoundingBox();const bounds=object.geometry.boundingBox,center=bounds.getCenter(new THREE.Vector3());
      const sorted=[...groups.values()].map(v=>new THREE.Vector3(v.x/v.n,center.y,v.z/v.n)).sort((a,b)=>Math.atan2(a.z-center.z,a.x-center.x)-Math.atan2(b.z-center.z,b.x-center.x));
      for(let i=0;i<sorted.length;i+=Math.max(1,Math.floor(sorted.length/180)))points.push(sorted[i]);
      if(points.length>12)addStitches(object,points);
    }
  }

  function refineAdditions(){
    const inside=scene.getObjectByName('Interior ilustrativo del hub');
    inside?.traverse(o=>{
      if(!o.isMesh)return;
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        if(!m.isMeshStandardMaterial||m.emissiveIntensity>1||m.emissive?.getHex()>0)continue;
        const kind=m.metalness>.65?'metal':'polymer';apply(m,kind);
      }
    });
    const layers=scene.getObjectByName('Despiece del cover');
    layers?.traverse(o=>{
      if(!o.isMesh)return;
      let parent=o;while(parent&&parent.parent!==layers)parent=parent.parent;
      const index=parent?.userData.layer;
      const list=Array.isArray(o.material)?o.material:[o.material];
      for(const material of list){
        if(!material.isMeshStandardMaterial||material.emissive?.getHex()>0)continue;
        const kind=index===1?'wadding':index===0||index===3?'backing':material.metalness>.65?'metal':'polymer';
        apply(material,kind);
        if(index===2&&material.isMeshPhysicalMaterial){material.clearcoatRoughness=.48;material.thickness=.0018;}
      }
    });
    renderer.shadowMap.needsUpdate=true;invalidate();
  }
  window.HIPNOS_SURFACES={inspect:()=>({ready:true,anisotropy,maps:Object.keys(maps).length,profiles:{...counts},stitches:stitchMeshes.reduce((n,o)=>n+o.count,0),originalMeshes:sourceMeshes.length,originalGeometryPreserved:geometryBaseline.every(b=>b.object.geometry===b.geometry),transformsPreserved:geometryBaseline.every(b=>b.object.position.equals(b.position)&&b.object.quaternion.equals(b.quaternion)&&b.object.scale.equals(b.scale))})};
  const center=new THREE.Vector3();
  function update(){
    let changed=false;
    for(const mesh of stitchMeshes){
      mesh.parent.geometry.boundingBox?.getCenter(center);
      if(!mesh.parent.geometry.boundingBox){mesh.parent.geometry.computeBoundingBox();mesh.parent.geometry.boundingBox.getCenter(center);}
      mesh.parent.localToWorld(center);
      const distance=Math.max(.01,camera.position.distanceTo(center));
      const pixels=.00224*renderer.domElement.height/(2*distance*Math.tan(camera.fov*Math.PI/360));
      // Subpixel stitching is represented by the same textile finish. Full
      // 3D stitches return automatically as soon as the camera resolves them.
      const visible=pixels>.65;
      if(mesh.visible!==visible){mesh.visible=visible;changed=true;}
    }
    if(changed)invalidate();return changed;
  }
  update();invalidate();return{refineAdditions,update};
}
