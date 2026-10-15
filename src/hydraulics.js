import * as THREE from 'three';

// The same arclength clock drives the supply, cover and return of each closed
// circuit. Pausing freezes this clock; resuming never jumps to wall-clock time.
export function createHydraulics({invalidate}) {
  const routes=[],circuits=[[],[]],totals=[1,1];
  const state={running:true,speed:1,mask:'both',arrows:false,distance:0,temperatures:[28,16]};
  const cold=new THREE.Color('#6496af'),warm=new THREE.Color('#bd8058'),neutral=new THREE.Color('#9ea9a6');
  const flowWarm=new THREE.Color('#b54e43'),flowCold=new THREE.Color('#457fa7');
  const beadGeometry=new THREE.SphereGeometry(1,7,5);
  const arrowGeometry=new THREE.ConeGeometry(1,3.5,7);arrowGeometry.rotateX(Math.PI/2);
  const dummy=new THREE.Object3D(),point=new THREE.Vector3(),tangent=new THREE.Vector3(),axis=new THREE.Vector3(0,0,1);
  function colorFor(t){return neutral.clone().lerp(t<22?cold:warm,Math.abs(t-22)/6);}
  function flowColorFor(t){return neutral.clone().lerp(t<22?flowCold:flowWarm,Math.abs(t-22)/6);}
  function sample(curve,n=1100){
    const pts=new Float32Array((n+1)*3),directions=new Float32Array((n+1)*3);
    for(let i=0;i<=n;i++){curve.getPointAt(i/n,point);curve.getTangentAt(i/n,tangent);point.toArray(pts,i*3);tangent.toArray(directions,i*3);}
    return {pts,directions,n};
  }
  function at(cache,t,vector,field='pts'){
    const q=THREE.MathUtils.clamp(t,0,1)*cache.n,i=Math.min(cache.n-1,Math.floor(q)),f=q-i,a=cache[field];
    vector.set(THREE.MathUtils.lerp(a[i*3],a[(i+1)*3],f),THREE.MathUtils.lerp(a[i*3+1],a[(i+1)*3+1],f),THREE.MathUtils.lerp(a[i*3+2],a[(i+1)*3+2],f));return vector;
  }
  function add(parent,curve,{side,radius=.0044,segments=100,name='',section='hub',canonical=true,order=0}={}){
    const g=new THREE.Group();g.name=name||`Circuito ${side+1} • ${section}`;g.userData.hydraulicSection=section;g.userData.side=side;parent.add(g);
    const col=flowColorFor(state.temperatures[side]);
    const wallMaterial=new THREE.MeshPhysicalMaterial({color:'#d5e3e1',metalness:0,roughness:.19,ior:1.43,thickness:radius*.30,transmission:.20,transparent:true,opacity:.30,depthWrite:false,clearcoat:.40,clearcoatRoughness:.23,side:THREE.DoubleSide});
    const coreMaterial=new THREE.MeshPhysicalMaterial({color:col,metalness:0,roughness:.10,ior:1.333,thickness:radius*1.3,transmission:.10,transparent:true,opacity:.78,depthWrite:false,clearcoat:.32,clearcoatRoughness:.15,emissive:col,emissiveIntensity:.018});
    const uniforms={hyDistance:{value:0},hyOffset:{value:0},hyLength:{value:1}};
    coreMaterial.userData.hydraulicWater=true;
    coreMaterial.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 hyUV;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhyUV=uv;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 hyUV; uniform float hyDistance,hyOffset,hyLength;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float hyWave=sin((hyUV.x*hyLength+hyOffset-hyDistance)*125.6637);
        float hyReflection=.96+.035*hyWave+.012*sin(hyUV.y*18.8496);
        diffuseColor.rgb*=hyReflection;
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=.94+.06*cos((hyUV.x*hyLength+hyOffset-hyDistance)*125.6637);');
    };
    coreMaterial.customProgramCacheKey=()=> 'hipnos-water-arclength-v1';
    const wall=new THREE.Mesh(new THREE.TubeGeometry(curve,segments,radius,12,false),wallMaterial);
    const core=new THREE.Mesh(new THREE.TubeGeometry(curve,segments,radius*.68,10,false),coreMaterial);
    wall.name='Silicona • pared de espesor definido';core.name='Agua • volumen interior';wall.castShadow=false;core.castShadow=false;wall.renderOrder=4;core.renderOrder=5;g.add(wall,core);
    const beadMat=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.12,roughness:.15,transparent:true,opacity:.72,depthWrite:false});
    const arrowMat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.72,depthWrite:false});
    const beads=new THREE.InstancedMesh(beadGeometry,beadMat,180),arrows=new THREE.InstancedMesh(arrowGeometry,arrowMat,64);
    for(const o of [beads,arrows]){o.frustumCulled=false;o.castShadow=false;o.renderOrder=6;o.userData.runtimeFlow=true;g.add(o);}beads.count=0;arrows.count=0;
    const data={group:g,curve,side,radius,segments,section,canonical,order,wall,core,beads,arrows,uniforms,length:curve.getLength(),offset:0,source:null,cache:sample(curve,section==='hub'?240:2400),phase:0};
    uniforms.hyLength.value=data.length;routes.push(data);if(canonical)circuits[side].push(data);return data;
  }
  function finalize(){for(let side=0;side<2;side++){circuits[side].sort((a,b)=>a.order-b.order);let sum=0;for(const r of circuits[side]){r.offset=sum;sum+=r.length;}totals[side]=Math.max(.001,sum);}for(const r of routes){if(r.source)r.offset=r.source.offset;r.uniforms.hyOffset.value=r.offset;}}
  function replaceCurve(r,curve){
    r.curve=curve;r.length=curve.getLength();r.cache=sample(curve,r.section==='hub'?160:900);
    for(const [o,rad,radial] of [[r.wall,r.radius,12],[r.core,r.radius*.68,10]]){const old=o.geometry;o.geometry=new THREE.TubeGeometry(curve,r.segments,rad,radial,false);old.dispose();}
    r.uniforms.hyLength.value=r.length;
  }
  function update(dt,shownTemps,active=true){
    state.temperatures=[...shownTemps];if(state.running&&active)state.distance+=Math.max(0,dt)*.14*state.speed;
    for(const r of routes){
      const visible=state.mask==='both'||(state.mask==='left'?0:1)===r.side;r.group.visible=visible;
      const c=flowColorFor(shownTemps[r.side]);r.core.material.color.copy(c);r.core.material.emissive.copy(c);r.beads.material.color.copy(c);r.beads.material.emissive.copy(c);r.arrows.material.color.copy(c);
      const source=r.source||r,total=totals[r.side],globalDistance=state.distance%total;
      r.phase=globalDistance/total;r.uniforms.hyDistance.value=state.distance;
      if(!active||!visible)continue;
      let count=0,arrowCount=0;const spacing=.145,number=Math.min(170,Math.ceil(total/spacing)),arrowNumber=Math.min(60,Math.ceil(total/.60));
      function place(position,object,index,size,isArrow){
        const local=(position-source.offset)/source.length;
        at(r.cache,local,point);dummy.position.copy(point);
        if(isArrow){at(r.cache,local,tangent,'directions').normalize();dummy.quaternion.setFromUnitVectors(axis,tangent);}else {at(r.cache,local,tangent,'directions').normalize();dummy.quaternion.setFromUnitVectors(axis,tangent);}
        dummy.scale.set(size,size,size*(isArrow?1:2));dummy.updateMatrix();object.setMatrixAt(index,dummy.matrix);
      }
      for(let i=0;i<number;i++){const p=(globalDistance+i*total/number)%total;if(p>=source.offset&&p<source.offset+source.length)place(p,r.beads,count++,r.radius*.32,false);}
      if(state.arrows)for(let i=0;i<arrowNumber;i++){const p=(globalDistance+i*total/arrowNumber)%total;if(p>=source.offset&&p<source.offset+source.length)place(p,r.arrows,arrowCount++,r.radius*.57,true);}
      r.beads.count=count;r.arrows.count=arrowCount;r.beads.instanceMatrix.needsUpdate=true;r.arrows.instanceMatrix.needsUpdate=true;r.arrows.visible=state.arrows;
    }
    return active&&state.running;
  }
  function set(options){Object.assign(state,options);state.speed=THREE.MathUtils.clamp(state.speed,.25,2);invalidate();}
  function inspect(){
    const continuity=circuits.map(list=>list.map((r,i)=>{const next=list[(i+1)%list.length];const a=r.group.localToWorld(r.curve.getPointAt(1)),b=next.group.localToWorld(next.curve.getPointAt(0));return a.distanceTo(b);}));
    return {running:state.running,speed:state.speed,mask:state.mask,arrows:state.arrows,distance:state.distance,temperatures:[...state.temperatures],closedCircuitLengths:[...totals],closedCircuitGaps:continuity,routes:routes.map(r=>({side:r.side,section:r.section,length:r.length,offset:r.offset,canonical:r.canonical,visible:r.group.visible,phase:r.phase,particles:r.beads.count,arrows:r.arrows.count,start:r.curve.getPointAt(0).toArray(),end:r.curve.getPointAt(1).toArray()}))};
  }
  return {add,finalize,replaceCurve,update,set,inspect,colorFor,flowColorFor,routes,state};
}
