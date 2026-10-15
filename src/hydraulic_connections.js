import * as THREE from 'three';

// Only the hydraulic connections are added here. All original product meshes,
// channel curves, mechanical components, cameras and controls stay unchanged.
export function installHydraulicConnections({external,channelLayer,water,inside,cfg,materials}){
  const records=[],connectors=[],bedSockets=[];let sizeX=1,sizeZ=1;
  const bedX=-.700,portZ=-1.038,bedTipZ=portZ-.030;
  const ease=t=>{const v=THREE.MathUtils.clamp(t,0,1);return v*v*(3-2*v);};
  const vector=p=>new THREE.Vector3(...p);
  const path=()=>new THREE.CurvePath();
  const line=(p,a,b)=>p.add(new THREE.LineCurve3(vector(a),vector(b)));
  const cubic=(p,a,b,c,d)=>p.add(new THREE.CubicBezierCurve3(vector(a),vector(b),vector(c),vector(d)));
  function reverse(p){const q=path();for(const c of [...p.curves].reverse())q.add(c.isLineCurve3?new THREE.LineCurve3(c.v2.clone(),c.v1.clone()):new THREE.CubicBezierCurve3(c.v3.clone(),c.v2.clone(),c.v1.clone(),c.v0.clone()));return q;}
  function socket(parent,position,axis,kind){
    const g=new THREE.Group();g.name=kind==='hub'?'Acople hidráulico del hub':'Acople posterior del cover';g.position.set(...position);parent.add(g);
    // Annular profiles leave a real bore for the liquid instead of a solid cap.
    const hub=kind==='hub',length=hub?.026:.030,inner=.00305,rad=hub?.0072:.0056;
    const profiles=[
      {material:materials.graphite,points:[[inner,0],[rad,0],[rad,.004],[rad*.90,.006],[rad*.90,length-.009],[.00465,length-.006],[.00465,length],[inner,length],[inner,0]]},
      {material:materials.brushed,points:[[inner,.005],[rad*1.025,.005],[rad*1.025,.007],[inner,.007],[inner,.005]]},
      {material:materials.rubber,points:[[inner,length-.005],[.00515,length-.005],[.00515,length-.003],[inner,length-.003],[inner,length-.005]]}
    ];
    for(const {material,points} of profiles){const m=new THREE.Mesh(new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(...p)),24),material);m.name='Acople • cuerpo hueco y junta';m.castShadow=true;m.receiveShadow=true;g.add(m);}
    if(axis==='-z')g.rotation.x=-Math.PI/2;else g.rotation.z=Math.PI/2;
    return g;
  }
  function pose(opening,origin=inside.getWorldPosition(new THREE.Vector3())){return {x:origin.x,z:origin.z,back:ease((opening-.285)/.715),angle:new THREE.Euler().setFromQuaternion(inside.getWorldQuaternion(new THREE.Quaternion()),'YXZ').y};}
  function ports(side,returning,p){
    const x=side===0?-.043:.043,y=returning?.387:.340;
    const rank=side*2+(returning?1:0),bedY=.462+rank*.012;
    const rot=(dx,dz)=>[p.x+dx*Math.cos(p.angle||0)-(-dz)*Math.sin(p.angle||0),y,p.z-dx*Math.sin(p.angle||0)+dz*Math.cos(p.angle||0)];
    const frame=rot(x,-.165),seat=rot(x,-.178-.220*p.back),tip=rot(x,-.204-.220*p.back);
    return {rank,bedY,frame,seat,tip,bed:[bedX*sizeX,bedY,bedTipZ*sizeZ]};
  }
  function exterior(side,returning,p){
    const a=ports(side,returning,p),q=path(),[sx,sy,sz]=a.tip;
    // The whole exterior bundle stays behind the head of the bed. Each hose
    // leaves the existing hub rear port and enters the cover along its rear normal.
    const bx=bedX*sizeX,bz=bedTipZ*sizeZ;
    const bendZ=Math.min(sz,bz)-.075-a.rank*.012;
    const A=a.tip,B=[sx+.075,sy+.025,bendZ],C=[bx,a.bedY,bz-.075];
    cubic(q,A,[sx-Math.sin(p.angle||0)*.035,sy,sz-Math.cos(p.angle||0)*.035],[sx+.030,sy+.015,bendZ],B);
    cubic(q,B,[sx+.165,sy+.035,bendZ],[bx,a.bedY,bz-.150-a.rank*.012],C);
    line(q,C,a.bed);
    return returning?reverse(q):q;
  }
  function bedFeeder(side,returning,p){
    const a=ports(side,returning,p),q=path(),innerX=bedX-.016+a.rank*.011,headZ=-.968-a.rank*.014;
    const channelX=returning?(side===0?-.065:.813):(side===0?-.813:.065),y=.6892;
    const direction=Math.sign(channelX-innerX),A=[bedX,a.bedY,bedTipZ],C=[innerX,a.bedY+.030,headZ-.014];
    cubic(q,A,[bedX,a.bedY,portZ+.012],[innerX,a.bedY+.012,headZ-.014],C);
    const D=[innerX,.659,headZ-.014],E=[innerX+direction*.030,y,headZ];line(q,C,D);
    cubic(q,D,[innerX,.683,headZ-.014],[innerX+direction*.006,y,headZ],E);
    const F=[channelX-direction*.030,y,headZ],H=[channelX,y,headZ+.030];line(q,E,F);
    cubic(q,F,[channelX-direction*.012,y,headZ],[channelX,y,headZ+.012],H);line(q,H,[channelX,y,-.886]);
    return returning?reverse(q):q;
  }
  function coupling(side,returning,p){const a=ports(side,returning,p),q=path();line(q,a.frame,a.tip);return returning?reverse(q):q;}
  const builders={
    'hub-outlet-coupling':(s,p)=>coupling(s,false,p),'external-supply':(s,p)=>exterior(s,false,p),
    'cover-supply-connection':(s,p)=>bedFeeder(s,false,p),'cover-return-connection':(s,p)=>bedFeeder(s,true,p),
    'external-return':(s,p)=>exterior(s,true,p),'hub-return-coupling':(s,p)=>coupling(s,true,p)
  };
  const descriptions=[
    ['hub-outlet-coupling',4.5,external,70],['external-supply',5,external,480],
    ['cover-supply-connection',5.5,channelLayer,420],['cover-return-connection',6.5,channelLayer,420],
    ['external-return',7,external,480],['hub-return-coupling',7.5,external,70]
  ];
  const firstPose=pose(0);
  for(let side=0;side<2;side++){
    for(const [section,order,parent,segments] of descriptions){const r=water.add(parent,builders[section](side,firstPose),{side,radius:section.startsWith('cover')?.0038:.0044,segments,section,order,name:`Circuito ${side+1} • ${section}`});if(parent===external)r.wall.castShadow=true;records.push(r);}
    for(const returning of [false,true]){
      const a=ports(side,returning,firstPose),r=records.find(r=>r.side===side&&r.section===(returning?'external-return':'external-supply'));
      const hub=socket(r.group,a.seat,'-z','hub');hub.userData.hydraulicMount='hub';connectors.push({group:hub,side,returning});
      const bed=socket(r.group,[bedX,a.bedY,portZ],'-z','bed');bed.userData.hydraulicMount='cover';bedSockets.push({group:bed,side,returning});
    }
  }
  let lastKey='',currentOpening=0;
  function update(opening=0){
    const p=pose(opening),key=[p.x,p.z,p.back,p.angle,sizeX,sizeZ].map(v=>v.toFixed(7)).join(':');if(key===lastKey)return false;
    lastKey=key;currentOpening=opening;
    for(const r of records)if(!r.section.startsWith('cover'))water.replaceCurve(r,builders[r.section](r.side,p));
    for(const c of connectors){c.group.position.set(...ports(c.side,c.returning,p).seat);c.group.quaternion.setFromEuler(new THREE.Euler(-Math.PI/2,0,0)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.angle));}
    for(const c of bedSockets)c.group.position.set(bedX*sizeX,ports(c.side,c.returning,p).bedY,portZ*sizeZ);
    water.finalize();return true;
  }
  function inspect(){const p=pose(currentOpening);return {existingBedConnector:[bedX*sizeX,.480,portZ*sizeZ],connectionLocation:'rear',opening:currentOpening,connections:records.map(r=>({side:r.side,section:r.section,order:r.order,radius:r.radius,length:r.length,start:r.curve.getPointAt(0).toArray(),end:r.curve.getPointAt(1).toArray()})),ports:[0,1].flatMap(s=>[false,true].map(ret=>({side:s,returning:ret,...ports(s,ret,p)})))};}
  function serializeGeometry(g){return {position:Array.from(g.attributes.position.array),normal:g.attributes.normal?Array.from(g.attributes.normal.array):null,uv:g.attributes.uv?Array.from(g.attributes.uv.array):null,index:g.index?Array.from(g.index.array):Array.from({length:g.attributes.position.count},(_,i)=>i)};}
  function exportData(){
    const geometries={},mats=[],matIds=new Map(),nodes=[],morphs={};external.updateMatrixWorld(true);channelLayer.updateMatrixWorld(true);
    function materialId(m){if(matIds.has(m))return matIds.get(m);const i=mats.length;matIds.set(m,i);mats.push({name:m.name||m.userData.hipnosSurface||'Material',color:m.color.toArray(),metalness:m.metalness||0,roughness:m.roughness??.5,opacity:m.opacity,transparent:m.transparent,transmission:m.transmission||0,ior:m.ior||1.5,emissive:m.emissive?.toArray(),emissiveIntensity:m.emissiveIntensity||0,surfaceProfile:m.userData.hipnosSurface||null});return i;}
    const poses={stage:{x:cfg.hub[0]-.46,z:cfg.hub[2],back:0},rear:{x:cfg.hub[0],z:cfg.hub[2],back:1},open:{x:cfg.hub[0]-.46,z:cfg.hub[2],back:1}};
    for(const r of records)r.group.traverse(o=>{
      if(!o.isMesh||o.userData.runtimeFlow)return;
      const id=o.geometry.uuid;geometries[id]=serializeGeometry(o.geometry);
      const owner=connectors.find(c=>{let a=o;while(a){if(a===c.group)return true;a=a.parent;}return false;});
      nodes.push({name:o.name||r.group.name,geometry:id,materials:[materialId(o.material)],matrix:o.matrixWorld.toArray(),component:'circuits',shellPart:null,hydraulicSection:r.section,side:r.side,connectionMount:owner?'hub':o===r.wall||o===r.core?'hose':'cover'});
      if(!r.section.startsWith('cover')&&(o===r.wall||o===r.core)){
        morphs[id]={};for(const [label,p] of Object.entries(poses)){const g=new THREE.TubeGeometry(builders[r.section](r.side,p),r.segments,o===r.wall?r.radius:r.radius*.68,o===r.wall?12:10,false);morphs[id][label]=Array.from(g.attributes.position.array);g.dispose();}
      }
    });
    return {hubCentre:[...cfg.hub],existingBedConnector:[bedX*sizeX,.480,portZ*sizeZ],connectionLocation:'rear',geometries,materials:mats,nodes,morphs};
  }
  function setDimensions(x,z){sizeX=x;sizeZ=z;update(currentOpening);}
  update(0);return {setDimensions,update,inspect,exportData,records,builders,pose,ports};
}
