import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {fitCameraToRect,boxCorners} from './camera_fit.js';

// Exploded shells reuse every original triangle, normal and UV. The original
// meshes remain untouched and return at exactly 0%; additions are illustrative
// mechanical details, not a manufacturing CAD or a validated plumbing design.
export function installHubExploration({scene,root,inside,hubObjects,componentGroups,cfg,camera,controls,setView,invalidate,onShift,componentInfo,extraGroups=[]}){
  const $=id=>document.getElementById(id),rig=new THREE.Group();rig.name='HIPNOS • carcasa desglosada';scene.add(rig);
  const nativeVisibility=new Map(hubObjects.map(o=>[o,o.visible]));
  const entries=[],registry=new Map(),materialStore=new Map(),faded=new Map();
  const shift=new THREE.Vector3(),stageOffset=new THREE.Vector3(-.46,0,0);
  let opening=0,selected=null,isolation=false,active=false,lastLabelUpdate=0;const isolationVisibility=new Map();
  const partition={originalTriangles:0,panelTriangles:0};
  const parts=[
    ['shell-front','Panel frontal',[.275,0,.245]],['shell-back','Panel posterior',[0,0,-.220]],
    ['shell-left','Lateral izquierdo',[-.235,0,0]],['shell-right','Lateral derecho',[.235,0,0]],
    ['shell-top','Tapa superior',[0,.195,0]],['shell-base','Base y apoyo',[0,0,0]]
  ];
  const smooth=x=>{const t=THREE.MathUtils.clamp(x,0,1);return t*t*(3-2*t);};
  for(const [id,label,vector] of parts){const g=new THREE.Group();g.name=label;g.userData.hubComponentID=id;rig.add(g);entries.push({id,label,group:g,vector:new THREE.Vector3(...vector),fraction:0});}
  const part=id=>entries.find(e=>e.id===id);
  root.updateMatrixWorld(true);
  function compactGeometry(source,triangleIndices){
    const g=new THREE.BufferGeometry(),mapping=new Map(),vertices=[],indices=[];
    for(const index of triangleIndices){if(!mapping.has(index)){mapping.set(index,vertices.length);vertices.push(index);}indices.push(mapping.get(index));}
    for(const [name,a] of Object.entries(source.attributes)){
      const values=new a.array.constructor(vertices.length*a.itemSize);
      vertices.forEach((index,i)=>{for(let k=0;k<a.itemSize;k++)values[i*a.itemSize+k]=a.array[index*a.itemSize+k];});
      g.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize,a.normalized));
    }
    g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  function addCopy(source,geometry,entry){
    const mats=(Array.isArray(source.material)?source.material:[source.material]).map(m=>{const c=m.clone();c.side=THREE.DoubleSide;return c;});
    const o=new THREE.Mesh(geometry,Array.isArray(source.material)?mats:mats[0]);o.name=source.name+' • '+entry.label;o.applyMatrix4(source.matrixWorld);o.castShadow=true;o.receiveShadow=true;entry.group.add(o);return o;
  }
  for(const o of hubObjects){
    if(/carcasa/i.test(o.name)){
      const a=o.geometry.attributes.position,n=o.geometry.attributes.normal,indices=o.geometry.index?.array||Uint32Array.from({length:a.count},(_,i)=>i);
      const sets=new Map(entries.map(e=>[e.id,[]]));const normalMatrix=new THREE.Matrix3().getNormalMatrix(o.matrixWorld),p=new THREE.Vector3(),norm=new THREE.Vector3();
      for(let i=0;i<indices.length;i+=3){
        p.set(0,0,0);norm.set(0,0,0);
        for(let k=0;k<3;k++){const j=indices[i+k];p.add(new THREE.Vector3().fromBufferAttribute(a,j).applyMatrix4(o.matrixWorld));if(n)norm.add(new THREE.Vector3().fromBufferAttribute(n,j).applyMatrix3(normalMatrix));}
        p.multiplyScalar(1/3);norm.normalize();let id;
        if(Math.abs(norm.y)>.70)id=norm.y>0?'shell-top':'shell-base';
        else if(Math.abs(norm.x)>.67)id=norm.x<0?'shell-left':'shell-right';
        else if(Math.abs(norm.z)>.67)id=norm.z<0?'shell-back':'shell-front';
        else {const x=(p.x-cfg.hub[0])/.108,z=(p.z-cfg.hub[2])/.172;id=Math.abs(x)>Math.abs(z)?x<0?'shell-left':'shell-right':z<0?'shell-back':'shell-front';}
        sets.get(id).push(indices[i],indices[i+1],indices[i+2]);
      }
      partition.originalTriangles+=indices.length/3;
      for(const [id,list] of sets)if(list.length){addCopy(o,compactGeometry(o.geometry,list),part(id));partition.panelTriangles+=list.length/3;}
    }else{
      const id=/tapa/i.test(o.name)?'shell-top':/base/i.test(o.name)?'shell-base':'shell-front';addCopy(o,o.geometry.clone(),part(id));
    }
  }
  // Thin inner liners give the detached surfaces physical wall thickness.
  // They are hidden with the presentation rig at 0%, preserving the exterior.
  const liner=new THREE.MeshStandardMaterial({color:'#303532',metalness:.17,roughness:.56});
  const linerSpecs={
    'shell-front':[[.188,.518,.0025],[cfg.hub[0],.300,cfg.hub[2]+.163]],
    'shell-back':[[.188,.518,.0025],[cfg.hub[0],.300,cfg.hub[2]-.164]],
    'shell-left':[[.0025,.518,.304],[cfg.hub[0]-.098,.300,cfg.hub[2]]],
    'shell-right':[[.0025,.518,.304],[cfg.hub[0]+.098,.300,cfg.hub[2]]]
  };
  for(const [id,[size,position]] of Object.entries(linerSpecs)){
    const m=new THREE.Mesh(new RoundedBoxGeometry(...size,2,.0008),liner);m.name='Cara interior de la carcasa';m.position.set(...position);m.castShadow=true;m.receiveShadow=true;part(id).group.add(m);
  }
  for(const e of entries)registry.set(e.id,{id:e.id,category:'shell',name:e.label,objects:[e.group],function:'Superficie original de la carcasa, separada de forma reversible para permitir la exploración.',relation:'Al cerrar recupera exactamente la malla y el acabado exterior originales.'});
  const categoryNames={pumps:'Bomba',block:'Bloque de aluminio',peltier:'Módulo Peltier',sink:'Disipador',fans:'Ventilador',sensors:'Sensor de temperatura',hydraulics:'Conductos hidráulicos'};
  for(const [category,groups] of componentGroups){
    groups.forEach((g,i)=>{
      const pair=groups.length===2,id=pair?`${category}-${i===0?'left':'right'}`:category,info=componentInfo[category]||[g.name,'Parte de la arquitectura mecánica del hub.',''];
      const name=pair?`${categoryNames[category]||info[0]} · lado ${i===0?'izquierdo':'derecho'}`:info[0];
      g.userData.hubComponentID=id;registry.set(id,{id,category,name,objects:[g],function:info[1],relation:info[2]||'Integrado en el conjunto del hub.'});
    });
  }
  const selector=$('hub-component-select');selector.innerHTML='<option value="">Elegí una pieza o tocala en el modelo</option>';
  for(const r of registry.values()){const option=document.createElement('option');option.value=r.id;option.textContent=r.name;selector.append(option);}
  function choices(key){if(registry.has(key))return[registry.get(key)];return [...registry.values()].filter(r=>r.category===key);}
  function bounds(key){const b=new THREE.Box3();scene.updateMatrixWorld(true);for(const r of choices(key))for(const g of r.objects)b.union(new THREE.Box3().setFromObject(g));return b;}
  function rect(){const panel=$('explore-panel').getBoundingClientRect(),nav=document.querySelector('.explore-nav').getBoundingClientRect(),bar=document.querySelector('.panel').getBoundingClientRect();return innerWidth<=700?{left:24,right:innerWidth-24,top:nav.bottom+18,bottom:panel.top-20}:{left:30,right:panel.left-30,top:nav.bottom+25,bottom:bar.top-40};}
  function focus(key){
    const box=bounds(key);if(box.isEmpty())return;const centre=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    const distance=Math.max(.12,size.length()*2.1),position=centre.clone().add(new THREE.Vector3(-.48,.32,.82).normalize().multiplyScalar(distance));
    const points=boxCorners([box.min.x-.004,box.max.x+.004],[box.min.y-.004,box.max.y+.004],[box.min.z-.004,box.max.z+.004]);
    const fit=fitCameraToRect(position.toArray(),centre.toArray(),34,points,{width:innerWidth,height:innerHeight},rect());
    controls.minDistance=.055;camera.near=.003;camera.updateProjectionMatrix();setView(fit.position,fit.target,fit.fov);
  }
  function storeMaterials(){for(const parent of [inside,rig])parent.traverse(o=>{if(o.isMesh&&!materialStore.has(o))materialStore.set(o,o.material);});}
  function restoreMaterials(){for(const [o,m] of materialStore)o.material=m;}
  function materialsFor(o,base,selectedMesh){
    if(selectedMesh)return base;
    if(!faded.has(o)){
      const list=(Array.isArray(base)?base:[base]).map(m=>{const c=m.clone();if(m.userData.hydraulicWater){c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey;}c.transparent=true;c.opacity=m.opacity*.38;c.depthWrite=false;return c;});
      faded.set(o,Array.isArray(base)?list:list[0]);
    }return faded.get(o);
  }
  function idOf(o){let p=o;while(p){if(p.userData.hubComponentID)return p.userData.hubComponentID;p=p.parent;}return null;}
  function updateSelection(){
    storeMaterials();const allowed=new Set(choices(selected).map(r=>r.id));
    for(const [o,m] of materialStore)o.material=selected&&!isolation?materialsFor(o,m,allowed.has(idOf(o))):m;
    for(const r of registry.values())for(const g of r.objects)g.visible=!isolation||allowed.has(r.id)||r.category==='hydraulics'&&allowed.has(idOf(g));
    $('isolate-component').disabled=!selected||opening<.28;$('isolate-component').setAttribute('aria-pressed',String(isolation));$('isolate-component').textContent=isolation?'Mostrar sistema':'Aislar componente';
    for(const b of document.querySelectorAll('[data-component]')){const is=b.dataset.component===selected||choices(selected).some(r=>r.category===b.dataset.component);b.classList.toggle('selected',is);b.disabled=opening<.28;}
    selector.disabled=opening<.28;selector.value=registry.has(selected)?selected:'';
    invalidate();
  }
  const outline=new THREE.Box3Helper(new THREE.Box3(),new THREE.Color('#c2ccb4'));outline.material.transparent=true;outline.material.opacity=.45;outline.visible=false;scene.add(outline);
  function select(key,move=true){
    if(opening<.28||!choices(key).length)return;
    selected=key;const records=choices(key),info=componentInfo[key],single=records.length===1?records[0]:null;
    $('component-name').textContent=single?single.name:info?.[0]||records.map(r=>r.name).join(' + ');
    $('component-function').textContent=single?single.function:info?.[1]||records[0].function;
    $('component-relation').textContent=single?single.relation:info?.[2]||records[0].relation;
    $('component-detail').classList.remove('info-changing');void $('component-detail').offsetWidth;$('component-detail').classList.add('info-changing');
    outline.box.copy(bounds(key).expandByScalar(.004));outline.visible=true;updateSelection();if(move)focus(key);
  }
  function clear(){selected=null;setIsolation(false);restoreMaterials();updateSelection();outline.visible=false;$('component-name').textContent='Arquitectura del hub';$('component-function').textContent='Seleccioná una pieza para conocer su función y acercar la cámara.';$('component-relation').textContent='Los componentes conservan su montaje; se separa la carcasa para permitir la exploración.';}
  function setIsolation(on){
    isolation=!!on&&!!selected;
    if(isolation){root.traverse(o=>{if(o.isMesh&&!hubObjects.includes(o)){if(!isolationVisibility.has(o))isolationVisibility.set(o,o.visible);o.visible=false;}});for(const g of extraGroups){if(!isolationVisibility.has(g))isolationVisibility.set(g,g.visible);g.visible=false;}}
    else {for(const [o,v] of isolationVisibility)o.visible=o.name.includes('Almohada')?$('pillows').checked:v;isolationVisibility.clear();}
    updateSelection();if(isolation)focus(selected);
  }
  function applyOpening(value){
    opening=THREE.MathUtils.clamp(value,0,1);const prior=shift.x;shift.copy(stageOffset).multiplyScalar(smooth(opening/.28));
    for(let i=0;i<entries.length;i++){const e=entries[i];e.fraction=smooth((opening-.26-i*.025)/(1-.26-i*.025));e.group.position.copy(shift).addScaledVector(e.vector,e.fraction);}
    inside.position.set(cfg.hub[0]+shift.x,shift.y,cfg.hub[2]+shift.z);
    const show=active&&opening>.00001;rig.visible=show;inside.visible=show;
    for(const [o,v] of nativeVisibility)o.visible=!show&&v;
    if(Math.abs(prior-shift.x)>.000001)onShift?.(shift);
    $('hub-opening').value=String(Math.round(opening*100));$('hub-opening-value').textContent=Math.round(opening*100)+' %';
    selector.disabled=opening<.28;for(const b of document.querySelectorAll('[data-component]'))b.disabled=opening<.28;
    if(selected){outline.box.copy(bounds(selected).expandByScalar(.004));outline.visible=show&&!isolation;}
    if(opening<.28&&selected)clear();
  }
  function setActive(on){active=!!on;if(!on){clear();applyOpening(0);rig.visible=false;inside.visible=false;controls.minDistance=.48;camera.near=.02;camera.updateProjectionMatrix();}else{clear();applyOpening(opening);}}
  function overviewBounds(full=true){
    if(full){return boxCorners([cfg.hub[0]-.81,cfg.hub[0]+.107],[.015,.82],[cfg.hub[2]-.41,cfg.hub[2]+.44]);}
    const points=[];scene.updateMatrixWorld(true);for(const e of entries){const b=new THREE.Box3().setFromObject(e.group);if(!b.isEmpty())points.push(...boxCorners([b.min.x,b.max.x],[b.min.y,b.max.y],[b.min.z,b.max.z]));}return points.length?points:boxCorners([cfg.hub[0]-.11,cfg.hub[0]+.11],[.019,.61],[cfg.hub[2]-.172,cfg.hub[2]+.172]);
  }
  function screenTag(element,world){
    const p=world.clone().project(camera),x=(p.x*.5+.5)*innerWidth,y=(-p.y*.5+.5)*innerHeight,r=rect();
    element.style.left=(x+16)+'px';element.style.top=y+'px';element.style.visibility=p.z>1||p.z< -1||x<r.left||x>r.right-50||y<r.top||y>r.bottom?'hidden':'visible';
  }
  function updateLabels(){
    const now=performance.now();if(now-lastLabelUpdate<90)return;lastLabelUpdate=now;
    const overview=active&&opening>.82&&!isolation&&!selected&&!$('flow-full').checked;
    $('hub-tags').classList.toggle('hidden',!overview);
    if(overview)for(const el of document.querySelectorAll('[data-hub-tag]')){const b=bounds(el.dataset.hubTag);if(!b.isEmpty())screenTag(el,b.getCenter(new THREE.Vector3()));}
    const el=$('hub-selected-tag');el.classList.toggle('hidden',!active||!selected||opening<.28);if(active&&selected){el.textContent=$('component-name').textContent;screenTag(el,bounds(selected).getCenter(new THREE.Vector3()));}
  }
  function pick(object){const id=idOf(object);if(id&&registry.has(id)){select(id);return true;}return false;}
  function exportData(){
    const geometries={},materials=[],materialIds=new Map(),nodes=[];scene.updateMatrixWorld(true);
    function matID(m){if(materialIds.has(m))return materialIds.get(m);const id=materials.length;materials.push({name:m.name||m.userData.hipnosSurface||'Material',color:m.color?.toArray()||[1,1,1],metalness:m.metalness||0,roughness:m.roughness??.5,opacity:m.opacity,transparent:m.transparent,transmission:m.transmission||0,ior:m.ior||1.5,emissive:m.emissive?.toArray(),emissiveIntensity:m.emissiveIntensity||0,surfaceProfile:m.userData.hipnosSurface||null});materialIds.set(m,id);return id;}
    for(const parent of [inside,rig,...extraGroups])parent.traverse(o=>{
      if(!o.isMesh||o.userData.runtimeFlow)return;const g=o.geometry;
      if(!geometries[g.uuid])geometries[g.uuid]={position:Array.from(g.attributes.position.array),normal:g.attributes.normal?Array.from(g.attributes.normal.array):null,uv:g.attributes.uv?Array.from(g.attributes.uv.array):null,index:g.index?Array.from(g.index.array):Array.from({length:g.attributes.position.count},(_,i)=>i)};
      const m=materialStore.get(o)||o.material,mi=(Array.isArray(m)?m:[m]).map(matID);const entry=entries.find(e=>{let p=o;while(p){if(p===e.group)return true;p=p.parent;}return false;});
      const base=o.matrixWorld.clone();const delta=entry?entry.group.position:parent===inside?shift:new THREE.Vector3();base.elements[12]-=delta.x;base.elements[13]-=delta.y;base.elements[14]-=delta.z;
      let hydraulic=o;while(hydraulic&&!hydraulic.userData.hydraulicSection)hydraulic=hydraulic.parent;
      const count=o.isInstancedMesh?o.count:1;for(let i=0;i<count;i++){const world=base.clone();if(o.isInstancedMesh){const instance=new THREE.Matrix4();o.getMatrixAt(i,instance);world.multiply(instance);}nodes.push({name:o.name||parent.name,geometry:g.uuid,materials:mi,matrix:world.toArray(),component:idOf(o)||(![inside,rig].includes(parent)?'circuits':'frame'),shellPart:entry?.id||null,hydraulicSection:hydraulic?.userData.hydraulicSection||null,side:hydraulic?.userData.side??null});}
    });
    return {version:'2.1.0',hubCentre:[...cfg.hub],stageOffset:stageOffset.toArray(),shellParts:entries.map(e=>({id:e.id,direction:e.vector.toArray()})),components:[...registry.values()].map(({id,category,name,function:fn,relation})=>({id,category,name,function:fn,relation})),partition:{...partition},geometries,materials,nodes};
  }
  function inspect(){return {opening,active,selected,isolation,unassignedMeshes:unassigned.length,stageShift:shift.toArray(),shellParts:entries.map(e=>({id:e.id,fraction:e.fraction,offset:e.group.position.toArray()})),partition:{...partition,preserved:partition.originalTriangles===partition.panelTriangles},components:[...registry.values()].map(({id,category,name})=>({id,category,name})),originalExteriorVisible:hubObjects.every(o=>o.visible===nativeVisibility.get(o)),pickableComponents:registry.size};}
  function details(){scene.updateMatrixWorld(true);return [...registry.values()].map(r=>{const b=bounds(r.id),meshes=[];for(const g of r.objects)g.traverse(o=>{if(!o.isMesh||o.userData.runtimeFlow)return;let p=o,v=true;while(p){if(!p.visible)v=false;p=p.parent;}const m=Array.isArray(o.material)?o.material[0]:o.material;const centre=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());meshes.push({visible:v,centre:centre.toArray(),opacity:m.opacity,materialType:m.type});});return {id:r.id,bounds:[b.min.toArray(),b.max.toArray()],meshes};});}
  rig.visible=false;selector.onchange=e=>select(e.target.value);$('isolate-component').onclick=()=>setIsolation(!isolation);
  $('hub-overview').onclick=()=>{clear();window.HIPNOS_EXPLORATION?.cameraForHub?.();};
  for(const el of document.querySelectorAll('[data-hub-tag]'))el.onclick=()=>select(el.dataset.hubTag);
  const unassigned=[];for(const parent of [inside,rig])parent.traverse(o=>{if(o.isMesh&&!idOf(o))unassigned.push(o);});
  clear();window.HIPNOS_HUB={inspect,details,select,isolate:setIsolation,exportData};
  return {applyOpening,setActive,select,clear,setIsolation,isIsolated:()=>isolation,pick,rig,registry,overviewBounds,updateLabels,inspect,exportData,shift};
}
