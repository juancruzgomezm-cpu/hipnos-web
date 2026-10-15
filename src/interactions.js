import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {fitCameraToRect,boxCorners} from './camera_fit.js';
import {createHydraulics} from './hydraulics.js';
import {installHubExploration} from './hub_exploration.js';
import {installHydraulicConnections} from './hydraulic_connections.js';

// Product buffers are preserved; presentation and reversible exploration are refined.
export function installHipnosInteractions({scene,root,camera,controls,renderer,cfg,setView,home,invalidate}){
  const $=id=>document.getElementById(id);
  const mobile=()=>window.innerWidth<=700;
  const standard=options=>new THREE.MeshStandardMaterial(options);
  const metal=standard({color:'#aeb1ac',metalness:.86,roughness:.29});
  const brushed=standard({color:'#818a88',metalness:.82,roughness:.38});
  const graphite=standard({color:'#343935',metalness:.38,roughness:.47});
  const rubber=standard({color:'#181c1a',roughness:.88});
  const ceramic=standard({color:'#e9e9e1',metalness:.06,roughness:.38});
  const brass=standard({color:'#a89260',metalness:.82,roughness:.35});
  const silicon=new THREE.MeshPhysicalMaterial({color:'#d7ddd6',roughness:.37,metalness:0,transparent:true,opacity:.52,depthWrite:false,clearcoat:.16,clearcoatRoughness:.50});
  const cold=new THREE.Color('#719ba8'),warm=new THREE.Color('#c39c68'),neutral=new THREE.Color('#a6ada3');
  const materials={cold:standard({color:cold,emissive:cold,emissiveIntensity:.06,roughness:.29,metalness:.04}),warm:standard({color:warm,emissive:warm,emissiveIntensity:.06,roughness:.29,metalness:.04})};
  let dimensionalScale=[1,1];
  const additions=new THREE.Group();additions.name='HIPNOS • interacciones añadidas';scene.add(additions);
  const inside=new THREE.Group();inside.name='Interior ilustrativo del hub';inside.position.set(cfg.hub[0],0,cfg.hub[2]);inside.visible=false;additions.add(inside);
  const thermal=new THREE.Group();thermal.name='Dos microclimas independientes';thermal.visible=false;additions.add(thermal);
  const layers=new THREE.Group();layers.name='Despiece del cover';layers.visible=false;additions.add(layers);
  const componentGroups=new Map();const fanRotors=[];const heatFlows=[];
  const water=createHydraulics({invalidate});const external=new THREE.Group();external.name='Circuitos completos • suministro y retorno';additions.add(external);external.visible=true;
  const channelLayer=new THREE.Group();channelLayer.name='Circuitos del cover • conductos reales';additions.add(channelLayer);channelLayer.visible=false;
  const internalRoutes=[[],[]],coverRoutes=[],externalRoutes=[],tankVolumes=[[],[]];let hubExplorer=null,waterView=false,fullPathEnabled=false;
  const coverGhosts=new Map();
  let top,topRim;const hubObjects=[],pillows=[],coverObjects=[];
  root.traverse(o=>{
    if(!o.isMesh)return;
    if(o.name.startsWith('Hub'))hubObjects.push(o);
    if(o.name.startsWith('Cover_superior')||o.name.startsWith('Cover superior'))top=o;
    if(o.name.startsWith('Ribete_superior')||o.name.startsWith('Ribete superior'))topRim=o;
    if(o.name.includes('Almohada'))pillows.push(o);
    if(o.name.includes('Cover')||o.name.includes('Ribete')||o.name.includes('Bordado'))coverObjects.push(o);
  });
  // GLTFLoader sanitizes punctuation but leaves recognizable object-name prefixes.
  if(!top)top=coverObjects.find(o=>o.name.includes('superior')&&o.geometry.attributes.position.count>100000);
  if(!topRim)topRim=coverObjects.find(o=>o.name.includes('Ribete')&&o.name.includes('superior'));
  if(!top)throw new Error('No se encontró la superficie original del cover.');
  const sourceTopMaterial=Array.isArray(top.material)?top.material[0]:top.material;
  const moving=[top,...(topRim?[topRim]:[]),...pillows];
  const baseline=new Map();root.traverse(o=>{if(o.isMesh)baseline.set(o,{position:o.position.clone(),material:o.material,castShadow:o.castShadow,receiveShadow:o.receiveShadow,renderOrder:o.renderOrder});});


  function group(parent,name,component){const g=new THREE.Group();g.name=name;if(component){g.userData.component=component;if(!componentGroups.has(component))componentGroups.set(component,[]);componentGroups.get(component).push(g);}parent.add(g);return g;}
  function mesh(parent,geometry,material,position=[0,0,0],name=''){
    const m=new THREE.Mesh(geometry,material);m.name=name;m.position.set(...position);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function box(parent,size,position,material=metal,r=.003,name=''){
    return mesh(parent,new RoundedBoxGeometry(...size,3,Math.min(r,...size.map(v=>v*.44))),material,position,name);
  }
  function cylinder(parent,radius,length,position,material=metal,axis='y',radiusTop=radius){
    const m=mesh(parent,new THREE.CylinderGeometry(radiusTop,radius,length,40,1),material,position);
    if(axis==='z')m.rotation.x=Math.PI/2;else if(axis==='x')m.rotation.z=Math.PI/2;return m;
  }
  function torus(parent,radius,tube,position,material=metal,axis='z'){
    const m=mesh(parent,new THREE.TorusGeometry(radius,tube,6,48),material,position);if(axis==='y')m.rotation.x=Math.PI/2;else if(axis==='x')m.rotation.y=Math.PI/2;return m;
  }
  function bolts(parent,points,axis='y',r=.0023){
    const geometry=new THREE.CylinderGeometry(r,r,.0022,12);const screws=new THREE.InstancedMesh(geometry,brushed,points.length);const dummy=new THREE.Object3D();
    points.forEach((p,i)=>{dummy.position.set(...p);dummy.rotation.set(axis==='z'?Math.PI/2:0,0,axis==='x'?Math.PI/2:0);dummy.updateMatrix();screws.setMatrixAt(i,dummy.matrix);});screws.castShadow=true;parent.add(screws);
    points.forEach(p=>{const slot=box(parent,[r*1.35,.00028,.0004],[...p],rubber,.0001);if(axis==='z'){slot.rotation.x=Math.PI/2;slot.position.z+=.00125;}else slot.position.y+=.00125;});
  }
  function fitting(parent,p,axis='y'){
    cylinder(parent,.0063,.010,p,brass,axis,.0058);
    for(let i=0;i<3;i++){const q=p.slice();q[axis==='y'?1:axis==='z'?2:0]+=-.007+i*.005;torus(parent,.006,.0007,q,brushed,axis);}
  }
  function smoothCurve(points){return new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');}
  function tube(parent,curve,r,material,segments=90){return mesh(parent,new THREE.TubeGeometry(curve,segments,r,12,false),material);}
  // Two compact hydraulic/thermoelectric assemblies inside the existing shell.
  const frame=group(inside,'Chasis de montaje','frame');
  box(frame,[.168,.008,.276],[0,.041,0],graphite,.004);
  box(frame,[.168,.006,.271],[0,.553,0],brushed,.002);
  for(const x of [-.078,.078])for(const z of [-.123,.123])box(frame,[.005,.501,.005],[x,.298,z],brushed,.0006);
  for(const y of [.059,.384])box(frame,[.166,.007,.008],[0,y,-.124],metal,.001);
  box(frame,[.163,.005,.093],[0,.0805,-.018],brushed,.001);
  for(const x of [-.069,.069])for(const z of [-.047,.014])box(frame,[.010,.033,.010],[x,.0615,z],graphite,.001);
  box(frame,[.163,.003,.088],[0,.1725,-.012],brushed,.001);
  for(const x of [-.070,.070])box(frame,[.016,.011,.095],[x,.3745,-.080],brushed,.001);
  bolts(frame,[[-.061,.047,-.114],[.061,.047,-.114],[-.061,.047,.114],[.061,.047,.114]]);
  const tank=group(inside,'Depósito dividido • dos cámaras estancas','tank');
  const tankShell=new THREE.MeshPhysicalMaterial({color:'#dde4df',roughness:.25,metalness:.02,transparent:true,opacity:.26,depthWrite:false,clearcoat:.6});
  box(tank,[.159,.153,.096],[0,.460,-.073],tankShell,.012);
  box(tank,[.003,.141,.084],[0,.460,-.073],ceramic,.001);
  box(tank,[.158,.006,.096],[0,.383,-.073],graphite,.002);
  for(let i=0;i<2;i++){
    const x=i===0?-.040:.040,color=i===0?cold:warm;
    const water=new THREE.MeshPhysicalMaterial({color,roughness:.08,transparent:true,opacity:.32,depthWrite:false,clearcoat:.7});
    const volume=box(tank,[.065,.115,.078],[x,.447,-.073],water,.009);tankVolumes[i].push(volume);
    const meniscus=box(tank,[.069,.001,.080],[x,.506,-.073],new THREE.MeshPhysicalMaterial({color,transparent:true,opacity:.42,roughness:.09,depthWrite:false}),.0004);tankVolumes[i].push(meniscus);
    cylinder(tank,.010,.009,[x,.541,-.073],graphite);torus(tank,.009,.001,[x,.546,-.073],rubber,'y');
    for(let k=0;k<8;k++){const a=k/8*Math.PI*2;box(tank,[.001,.006,.003],[x+.010*Math.cos(a),.542,-.073+.010*Math.sin(a)],brushed,.0003);}
    fitting(tank,[x,.379,-.073]);
    for(let mark=0;mark<5;mark++)box(tank,[.011,.0009,.0005],[x-.014,.409+.020*mark,-.0237],brushed,.0002);
  }
  bolts(tank,[[-.068,.535,-.106],[.068,.535,-.106],[-.068,.535,-.040],[.068,.535,-.040]]);
  for(let side=0;side<2;side++){
    const x=side===0?-.043:.043,circuitMat=side===0?materials.cold:materials.warm,color=side===0?cold:warm;
    const pump=group(inside,`Bomba ${side+1} • motor e impulsor`,'pumps');
    box(pump,[.070,.006,.078],[x,.086,-.020],rubber,.005);
    box(pump,[.053,.012,.058],[x,.095,-.015],rubber,.002);
    cylinder(pump,.023,.052,[x,.122,-.036],graphite,'z');
    torus(pump,.023,.0016,[x,.122,-.061],brushed);
    cylinder(pump,.0215,.005,[x,.122,-.064],brushed,'z');
    cylinder(pump,.0055,.003,[x,.122,-.067],rubber,'z');
    box(pump,[.055,.052,.035],[x,.127,.010],graphite,.009);
    cylinder(pump,.022,.008,[x,.127,.031],brushed,'z');
    torus(pump,.020,.001,[x,.127,.036],rubber);
    cylinder(pump,.010,.005,[x,.127,.037],graphite,'z');
    bolts(pump,[[-.030+x,.090,-.048],[.030+x,.090,-.048],[-.030+x,.090,.009],[.030+x,.090,.009]]);
    fitting(pump,[x,.159,.010]);fitting(pump,[x,.122,-.074],'z');
    box(pump,[.013,.013,.021],[x,.112,.046],rubber,.002);
    const thermalBlock=group(inside,`Bloque de intercambio ${side+1}`,'block');
    box(thermalBlock,[.067,.100,.017],[x,.298,-.015],metal,.004);
    box(thermalBlock,[.052,.010,.016],[x,.243,-.015],brushed,.001);
    const peltier=group(inside,`Módulo Peltier ${side+1}`,'peltier');
    box(peltier,[.050,.059,.001],[x,.298,-.006],ceramic,.0002);
    box(peltier,[.050,.059,.003],[x,.298,-.004],ceramic,.0008);
    box(peltier,[.048,.057,.0008],[x,.298,-.0016],brushed,.0002);
    fitting(thermalBlock,[x-.016,.249,-.021]);fitting(thermalBlock,[x+.016,.350,-.021]);
    bolts(thermalBlock,[[x-.028,.258,-.005],[x+.028,.258,-.005],[x-.028,.339,-.005],[x+.028,.339,-.005]],'z',.0018);
    const sink=group(inside,`Disipador ${side+1} • aletas de aluminio`,'sink');
    box(sink,[.075,.115,.009],[x,.298,.006],brushed,.002);
    const fins=new THREE.InstancedMesh(new RoundedBoxGeometry(.0017,.112,.050,2,.0006),metal,19),dummy=new THREE.Object3D();
    for(let k=0;k<19;k++){dummy.position.set(x-.034+k*.0038,.298,.035);dummy.updateMatrix();fins.setMatrixAt(k,dummy.matrix);}fins.castShadow=true;fins.receiveShadow=true;sink.add(fins);
    const fan=group(inside,`Ventilador ${side+1} • palas curvadas`,'fans');
    const outer=new THREE.Shape();const w=.077,h=.085,r=.006;
    outer.moveTo(-w/2+r,-h/2);outer.lineTo(w/2-r,-h/2);outer.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);outer.lineTo(w/2,h/2-r);outer.quadraticCurveTo(w/2,h/2,w/2-r,h/2);outer.lineTo(-w/2+r,h/2);outer.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);outer.lineTo(-w/2,-h/2+r);outer.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
    const hole=new THREE.Path();hole.absarc(0,0,.0335,0,Math.PI*2,true);outer.holes.push(hole);
    const housing=mesh(fan,new THREE.ExtrudeGeometry(outer,{depth:.013,bevelEnabled:true,bevelThickness:.001,bevelSize:.001,bevelSegments:2,curveSegments:32}),graphite,[x,.298,.071]);
    torus(fan,.033,.0016,[x,.298,.086],brushed);
    const rotor=group(fan,'Rotor');rotor.position.set(x,.298,.079);fanRotors.push(rotor);
    cylinder(rotor,.010,.012,[0,0,0],graphite,'z');cylinder(rotor,.0068,.002,[0,0,.008],brushed,'z');
    for(let blade=0;blade<9;blade++){
      const vertices=[],indices=[];const rows=9,cols=4;
      for(let j=0;j<=rows;j++)for(let k=0;k<=cols;k++){
        const t=j/rows,u=k/cols,rad=.009+.021*t,angle=blade/9*Math.PI*2+.72*t+.43*(u-.5)*(1+.25*t);
        vertices.push(rad*Math.cos(angle),rad*Math.sin(angle),.003*(u-.5)+.002*Math.sin(t*Math.PI));
      }
      for(let j=0;j<rows;j++)for(let k=0;k<cols;k++){const a=j*(cols+1)+k;indices.push(a,a+1,a+cols+2,a,a+cols+2,a+cols+1);}
      const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geom.setIndex(indices);geom.computeVertexNormals();
      const bladeMaterial=graphite.clone();bladeMaterial.side=THREE.DoubleSide;mesh(rotor,geom,bladeMaterial);
    }
    for(const rad of [.019,.026,.032])torus(fan,rad,.00065,[x,.298,.089],brushed);
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      const spoke=box(fan,[.063,.0013,.0013],[x,.298,.090],brushed,.0004);spoke.rotation.z=a;
    }
    bolts(fan,[[x-.030,.264,.087],[x+.030,.264,.087],[x-.030,.332,.087],[x+.030,.332,.087]],'z',.002);
    for(const dx of [-.030,.030])for(const y of [.264,.332])cylinder(fan,.0028,.014,[x+dx,y,.065],brushed,'z');
    // One directed loop per user: reservoir -> pump -> block -> cover -> reservoir.
    const hydraulics=group(inside,`Conexiones hidráulicas ${side+1}`,'hydraulics');
    const outboard=side===0?-.076:.076;
    const routes=[
      {order:0,points:[[x,.379,-.073],[x,.339,-.101],[outboard,.228,-.102],[x,.159,-.095],[x,.122,-.074]]},
      {order:1,points:[[x,.122,-.074],[x,.122,-.033],[x,.127,.010],[x,.159,.010]]},
      {order:2,points:[[x,.159,.010],[outboard,.187,.040],[outboard,.221,.018],[x-.016,.244,-.021]]},
      {order:3,points:[[x-.016,.244,-.021],[x-.016,.270,-.015],[x+.016,.326,-.015],[x+.016,.350,-.021]]},
      {order:4,points:[[x+.016,.350,-.021],[outboard,.365,-.059],[outboard,.357,-.123],[x,.340,-.165]]},
      {order:8,points:[[x,.387,-.165],[outboard,.443,-.123],[x,.493,-.120],[x,.493,-.109]]},
      {order:9,points:[[x,.493,-.109],[x,.477,-.073],[x,.405,-.073],[x,.379,-.073]]}
    ];
    for(const route of routes){const curve=smoothCurve(route.points);internalRoutes[side].push(water.add(hydraulics,curve,{side,order:route.order,radius:.0044,segments:85,name:`Agua ${side+1} • tramo ${route.order+1}`}));}
    fitting(hydraulics,[x,.340,-.165],'z');fitting(hydraulics,[x,.387,-.165],'z');
    const sensor=group(inside,`Sensor de temperatura ${side+1}`,'sensors');
    cylinder(sensor,.0065,.008,[x+.016,.350,-.021],brushed);box(sensor,[.009,.007,.010],[x+.016,.357,-.021],graphite,.001);
    const sensorWire=smoothCurve([[x+.019,.360,-.021],[outboard,.366,-.065],[outboard,.208,-.053],[side===0?-.038:.038,.197,-.015]]);tube(sensor,sensorWire,.00075,rubber,55);
    const support=group(frame,`Soporte ${side+1}`);box(support,[.075,.006,.112],[x,.235,.006],graphite,.002);
  }

  // Control and power occupy the free bay between the pump deck and thermal deck.
  const pcb=group(inside,'Placa electrónica y microcontrolador','controller');
  const boardMaterial=standard({color:'#284b45',metalness:.12,roughness:.66});
  box(pcb,[.151,.0017,.078],[0,.191,-.012],boardMaterial,.002);
  for(const x of [-.065,.065])for(const z of [-.043,.020]){cylinder(pcb,.0025,.016,[x,.182,z],brass);cylinder(pcb,.002,.002,[x,.193,z],brushed);}
  box(pcb,[.020,.004,.020],[-.017,.194,-.014],graphite,.001);
  for(let i=0;i<12;i++){box(pcb,[.001,.0006,.003],[-.026+i*.0017,.193,-.026],brushed,.0001);box(pcb,[.001,.0006,.003],[-.026+i*.0017,.193,-.002],brushed,.0001);}
  for(let i=0;i<4;i++){box(pcb,[.010,.002,.006],[.022+i*.017,.193,-.030],graphite,.0006);box(pcb,[.006,.0015,.004],[.008+i*.022,.193,.008],ceramic,.0005);}
  for(const x of [-.055,.048]){cylinder(pcb,.005,.011,[x,.198,-.007],brushed);box(pcb,[.011,.009,.009],[x,.197,.017],ceramic,.001);}
  const traceMaterial=standard({color:'#a69b64',metalness:.75,roughness:.42});
  for(let i=0;i<10;i++){const pts=[[ -.062+i*.008,.1922,-.041],[-.062+i*.008,.1922,-.030],[-.047+i*.008,.1922,-.018]];tube(pcb,smoothCurve(pts),.00020,traceMaterial,12);}
  const power=group(inside,'Fuente de alimentación y conexiones','power');
  for(const x of [-.057,.057])for(const z of [-.106,-.080])box(power,[.014,.0075,.014],[x,.04875,z],rubber,.002);
  box(power,[.144,.033,.046],[0,.069,-.095],graphite,.003);box(power,[.119,.0008,.035],[0,.086,-.095],brushed,.0005);
  for(let i=0;i<16;i++)box(power,[.005,.0007,.013],[-.052+i*.007,.0866,-.095],rubber,.0002);
  box(power,[.027,.016,.012],[-.052,.073,-.125],rubber,.002);box(power,[.018,.015,.014],[.052,.070,-.063],ceramic,.001);
  for(const x of [-.064,.064])cylinder(power,.002,.002,[x,.087,-.095],brushed);
  const harness=group(power,'Arnés eléctrico de montaje');
  for(const x of [-.061,.061])tube(harness,smoothCurve([[x,.082,-.066],[x,.106,-.084],[x,.161,-.054],[x,.191,-.033]]),.0012,rubber,38);

  // The overlay shares the original surface buffer. No vertex or PBR map of the GLB is edited.
  const overlayMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,uniforms:{uLeft:{value:28},uRight:{value:16},uOpacity:{value:0},uTime:{value:0},uCold:{value:cold},uWarm:{value:warm},uNeutral:{value:neutral}},vertexShader:`varying vec3 vSurface;void main(){vSurface=position;vec3 p=position+normal*.0011;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying vec3 vSurface;uniform float uLeft,uRight,uOpacity,uTime;uniform vec3 uCold,uWarm,uNeutral;void main(){float left=1.-smoothstep(-.018,.018,vSurface.x);float temp=mix(uRight,uLeft,left);float delta=(temp-22.)/6.;vec3 col=mix(uNeutral,delta<0.?uCold:uWarm,abs(delta));float edge=(1.-smoothstep(.73,.90,abs(vSurface.x)))*(1.-smoothstep(.88,1.03,abs(vSurface.z)));float pulse=1.;float alpha=(.025+.21*abs(delta))*edge*pulse*uOpacity;gl_FragColor=vec4(col,alpha);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
  const overlay=new THREE.Mesh(top.geometry,overlayMaterial);overlay.name='Superposición térmica translúcida';overlay.frustumCulled=false;overlay.renderOrder=4;thermal.add(overlay);
  function mapCorner(x,z){const A=.9,B=1.03,r=.078;if(Math.abs(x)>A-r&&Math.abs(z)>B-r){const u=(Math.abs(x)-A+r)/r,v=(Math.abs(z)-B+r)/r;return [Math.sign(x)*(A-r+r*u*Math.sqrt(1-v*v/2)),Math.sign(z)*(B-r+r*v*Math.sqrt(1-u*u/2))];}return[x,z];}
  function surfaceHeight(x,z){const y=-z,A=.9,B=1.03,r=.078,qx=Math.abs(x)-(A-r),qy=Math.abs(y)-(B-r),edge=Math.max(0,-(Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r));return .735+.0065*Math.max(0,1-(x/A)**2)*Math.max(0,1-(y/B)**2)-.014*Math.exp(-edge/.024)+.0073*(.5+.5*Math.cos(2*Math.PI*(y-.66*x)/.032))**.78*(1-Math.exp(-edge/.022))+.0003*Math.sin(37*x+19*y)*Math.sin(9*y-5*x);}
  function serpentine(x0,x1,y,followSurface=false){
    const path=new THREE.CurvePath(),n=12,space=(x1-x0)/(n-1),end=.886;
    const point=(x,z)=>new THREE.Vector3(x,followSurface?surfaceHeight(x,z)+y:y,z);
    for(let i=0;i<n;i++){
      const x=x0+i*space,from=i%2===0?-end:end,to=-from;
      if(followSurface){const p=[];for(let j=0;j<=30;j++)p.push(point(x,THREE.MathUtils.lerp(from,to,j/30)));path.add(new THREE.CatmullRomCurve3(p));}
      else path.add(new THREE.LineCurve3(point(x,from),point(x,to)));
      if(i<n-1){const p=[];for(let j=0;j<=18;j++){const angle=Math.PI-Math.PI*j/18;p.push(point(x+space/2+space/2*Math.cos(angle),to+Math.sign(to)*space/2*Math.sin(angle)));}path.add(new THREE.CatmullRomCurve3(p));}
    }return path;
  }
  const tempTargets=[28,16],shownTemps=[28,16];const heatLines=[];
  for(let side=0;side<2;side++){
    const x0=side===0?-.813:.065,x1=side===0?-.065:.813;
    const canonical=water.add(channelLayer,serpentine(x0,x1,.6892),{side,radius:.0038,segments:1800,section:'cover',order:6});coverRoutes.push(canonical);
    const surface=water.add(thermal,serpentine(x0,x1,.0068,true),{side,radius:.0030,segments:1800,section:'surface',canonical:false});surface.source=canonical;heatLines.push(surface.core);heatFlows.push(surface);
  }
  const connections=installHydraulicConnections({external,channelLayer,water,inside,cfg,materials:{graphite,brushed,rubber}});
  function updateExternal(){connections.update(hubExplorer?.inspect().opening||0);invalidate();}
  window.HIPNOS_HYDRAULIC_CONNECTIONS=connections;

  // Four full-size solid layers. Layer 1 is the original textile mesh, raised without remodeling it.
  function slabGeometry(thickness,quilt=0){
    const nx=90,nz=104,pos=[],uv=[],idx=[];
    for(let layer=0;layer<2;layer++)for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
      const [x,z]=mapCorner(-.9+1.8*i/nx,-1.03+2.06*j/nz);
      const edge=Math.min(.9-Math.abs(x),1.03-Math.abs(z));const bump=quilt*Math.sin(x*37+z*13)*Math.sin(z*29-x*7)*Math.min(1,edge/.025);
      pos.push(x,(layer===0?thickness/2:-thickness/2)+(layer===0?bump:0),z);uv.push(x*5,-z*5);
    }
    const s=(nx+1)*(nz+1);
    for(let layer=0;layer<2;layer++)for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
      const a=layer*s+j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;idx.push(...(layer===0?[a,c,b,b,c,d]:[a,b,c,b,d,c]));
    }
    const rim=[...Array(nx+1).keys(),...Array.from({length:nz},(_,j)=>(j+1)*(nx+1)+nx),...Array.from({length:nx},(_,i)=>nz*(nx+1)+nx-1-i),...Array.from({length:nz-1},(_,j)=>(nz-1-j)*(nx+1))];
    for(let i=0;i<rim.length;i++){const a=rim[i],b=rim[(i+1)%rim.length];idx.push(a,b,a+s,b,b+s,a+s);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
  }
  function outline(y){const pts=[];const n=55;for(let edge=0;edge<4;edge++)for(let i=0;i<n;i++){const t=i/n;const p=edge===0?[-.9+1.8*t,-1.03]:edge===1?[.9,-1.03+2.06*t]:edge===2?[.9-1.8*t,1.03]:[-.9,1.03-2.06*t];const q=mapCorner(...p);pts.push(new THREE.Vector3(q[0],y,q[1]));}return pts;}
  const layerGroups=[],layerPickables=[],layerOutlines=[];
  const layerHeights=[.717,.705,.683,.658],offsets=[.720,.505,.295,.107];
  const surfaceBackingMat=sourceTopMaterial.clone();surfaceBackingMat.roughness=.87;
  const pillowMaterial=pillows.length?(Array.isArray(pillows[0].material)?pillows[0].material[0]:pillows[0].material):ceramic;
  const waddingMaterial=new THREE.MeshPhysicalMaterial({color:'#e2dfd2',roughness:.97,metalness:0,normalMap:pillowMaterial.normalMap,normalScale:new THREE.Vector2(.5,.5),sheen:.75,sheenColor:new THREE.Color('#f3ede1'),sheenRoughness:.95});
  const filmMaterial=new THREE.MeshPhysicalMaterial({color:'#b6bab3',roughness:.39,metalness:.02,transparent:true,opacity:.73,depthWrite:false,clearcoat:.32,side:THREE.DoubleSide});
  const baseTextileMaterial=sourceTopMaterial.clone();baseTextileMaterial.roughness=.94;
  const layerMaterials=[surfaceBackingMat,waddingMaterial,filmMaterial,baseTextileMaterial],thickness=[.006,.020,.0018,.004];
  for(let i=0;i<4;i++){
    const g=group(layers,`Capa ${i+1}`);g.position.y=layerHeights[i];g.userData.layer=i;layerGroups.push(g);
    const m=mesh(g,slabGeometry(thickness[i],i===1?.0006:0),layerMaterials[i]);m.userData.layer=i;layerPickables.push(m);
    const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(outline(thickness[i]/2+.002)),new THREE.LineBasicMaterial({color:'#b6bead',transparent:true,opacity:.6}));line.visible=false;g.add(line);layerOutlines.push(line);
  }
  const fibers=new THREE.InstancedMesh(new THREE.TorusGeometry(.0028,.00023,3,8,Math.PI),waddingMaterial,1100),fiberDummy=new THREE.Object3D();
  let seed=912;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
  for(let i=0;i<1100;i++){fiberDummy.position.set((rand()-.5)*1.70,.0101,(rand()-.5)*1.96);fiberDummy.rotation.set(0,rand()*Math.PI*2,0);fiberDummy.scale.setScalar(.7+rand()*.6);fiberDummy.updateMatrix();fibers.setMatrixAt(i,fiberDummy.matrix);}layerGroups[1].add(fibers);
  for(let side=0;side<2;side++){
    const x0=side===0?-.813:.065,x1=side===0?-.065:.813,curve=serpentine(x0,x1,.0062);
    const record=water.add(layerGroups[2],curve,{side,radius:.0038,segments:1600,section:'layers',canonical:false});record.source=coverRoutes[side];
    for(const t of [0,1]){const p=curve.getPointAt(t).toArray();fitting(layerGroups[2],[p[0],p[1],p[2]],'z');}
  }
  water.finalize();
  const selectedOutline=new THREE.Box3Helper(new THREE.Box3(),new THREE.Color('#c2ccb4'));selectedOutline.material.transparent=true;selectedOutline.material.opacity=.5;selectedOutline.visible=false;additions.add(selectedOutline);

  const layerInfo=[
    ['Superficie textil','53 % algodón · 47 % poliéster','La superficie en contacto con el descanso aporta comodidad y protege el conjunto.'],
    ['Guata acolchada','100 % poliéster','El acolchado suaviza el apoyo y ayuda a distribuir la presión sobre el sistema térmico.'],
    ['Sistema térmico','Película de TPU poliéter · conductos de silicona','Los conductos transportan agua por dos circuitos independientes para intercambiar calor en cada lado.'],
    ['Base textil','100 % poliéster','La base sostiene las capas y aporta estabilidad al cubrecolchón sobre el colchón.']
  ];
  const componentInfo={
    pumps:['Bombas de circulación','Cada bomba impulsa el agua de un circuito independiente.','Depósito → bomba → bloque de intercambio → cover → depósito.'],
    tank:['Depósito dividido','Dos cámaras estancas mantienen separados los volúmenes de agua.','Cada cámara alimenta una bomba y recibe el retorno de ese mismo lado.'],
    block:['Bloques de aluminio','Transfieren calor entre el agua y los módulos termoeléctricos.','Cada bloque pertenece a un circuito y se apoya sobre un módulo Peltier.'],
    peltier:['Módulos Peltier reversibles','El intercambio termoeléctrico permite enfriar o calentar el agua.','Están montados entre los bloques de aluminio y los disipadores.'],
    sink:['Disipadores de aluminio','Sus aletas amplían la superficie de intercambio térmico.','Los ventiladores renuevan el aire a través de las aletas.'],
    fans:['Ventiladores','Mueven aire a través de los disipadores.','Trabajan junto con el conjunto termoeléctrico de cada circuito.'],
    controller:['Placa electrónica y microcontrolador','Coordina bombas, módulos termoeléctricos, ventiladores y lectura de sensores.','Recibe los ajustes del control y regula los dos circuitos por separado.'],
    sensors:['Sensores de temperatura','Leen la temperatura en la salida de cada bloque de intercambio.','Envían la medición a la placa para regular ese circuito.'],
    power:['Fuente de alimentación','Proporciona corriente continua regulada al sistema.','Alimenta la electrónica, las bombas y los conjuntos termoeléctricos.'],
    hydraulics:['Dos circuitos hidráulicos','Los volúmenes de agua permanecen separados durante todo el recorrido.','El color responde gradualmente a la temperatura de demostración de cada lado.'],
    frame:['Chasis y montaje','Sostiene los componentes mediante bastidores, soportes y tornillería.','Mantiene la organización mecánica durante la apertura de la carcasa.']
  };
  hubExplorer=installHubExploration({scene,root,inside,hubObjects,componentGroups,cfg,camera,controls,setView,invalidate,onShift:updateExternal,componentInfo,extraGroups:[external,channelLayer]});
  let mode='general',pending=null,progress=0,tween=null,selectedLayer=0,selectedComponent='hydraulics';
  let returnAction=null;let lastTime=performance.now();let closedChoice=true;
  let flowEnabled=true,overlayEnabled=true,lastShadow=0;
  const layerProgress=[0,0,0,0];
  function refreshInfo(id){const card=$(id);card.classList.remove('info-changing');void card.offsetWidth;card.classList.add('info-changing');}
  function setFlow(on){flowEnabled=!!on;for(const id of ['flow-hub','flow-thermal','flow-enabled'])$(id).checked=flowEnabled;water.set({running:flowEnabled});invalidate();}
  for(const id of ['flow-hub','flow-thermal','flow-enabled'])$(id).onchange=e=>setFlow(e.target.checked);
  $('thermal-overlay').onchange=e=>{overlayEnabled=e.target.checked;applyProgress();invalidate();};
  $('circuit-select').onchange=e=>{water.set({mask:e.target.value});applyProgress();};
  $('flow-speed').oninput=e=>{const value=Number(e.target.value);water.set({speed:value});$('flow-speed-value').textContent=value.toLocaleString('es-AR')+'×';};
  $('flow-arrows').onchange=e=>water.set({arrows:e.target.checked});
  $('flow-full').onchange=e=>{fullPathEnabled=e.target.checked;applyProgress();if(mode==='hub')cameraFor(fullPathEnabled?'circuits':'hub');};
  let openingCameraTimer;
  $('hub-opening').oninput=e=>{if(mode!=='hub')return;tween=null;pending=null;returnAction=null;progress=Number(e.target.value)/100;applyProgress();invalidate();clearTimeout(openingCameraTimer);openingCameraTimer=setTimeout(()=>cameraFor('hub'),130);};
  $('hub-explore').onclick=()=>{if(mode==='hub'){hubExplorer.clear();pending=null;beginTween(1);cameraFor('hub');}else go('hub');};
  $('hub-assemble').onclick=()=>{hubExplorer.clear();go('general');};
  $('circuits-view').onclick=()=>{const on=!waterView;go('general',()=>{waterView=on;if(on){setFlow(true);$('water-controls').open=true;}setPanel();applyProgress();on?cameraFor('circuits'):home();});};
  const modeSettings={
    hub:['01 · INTERIOR DEL HUB','El corazón de Hipnos','Explorá los componentes y seguí sus dos circuitos de agua.'],
    thermal:['02 · DOS MICROCLIMAS','Tu lado. Tu temperatura.','Dos temperaturas que se ajustan de forma independiente.'],
    layers:['03 · CUATRO CAPAS','El cover, por dentro','Seleccioná una capa para conocer su composición y función.']
  };
  function setPanel(){
    document.body.dataset.exploreMode=mode;document.body.dataset.flowView=String(waterView);$('explore-panel').classList.toggle('hidden',mode==='general'&&!waterView);$('water-controls').classList.toggle('hidden',mode==='general'&&!waterView);$('circuits-view').classList.toggle('active',waterView);$('circuits-view').setAttribute('aria-pressed',String(waterView));
    document.querySelectorAll('.explore-nav button').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
    for(const [id,m] of [['hub-details','hub'],['temperature-controls','thermal'],['layer-controls','layers'],['layer-tags','layers']])$(id).classList.toggle('hidden',mode!==m);
    $('hotspots').classList.toggle('hidden',mode!=='general'||waterView);
    if(mode!=='general'||waterView){const info=modeSettings[mode]||['DOS CIRCUITOS INDEPENDIENTES','El agua conecta todo','Seguí el suministro y retorno de cada lado.'];$('mode-eyebrow').textContent=info[0];$('mode-title').textContent=info[1];$('mode-intro').textContent=info[2];$('explore-panel').scrollTop=0;}
    $('camera-select').value=mode==='general'?'general':'explore';
    $('camera-select').querySelector('[value=explore]').textContent={hub:'Interior',thermal:'Microclimas',layers:'Despiece'}[mode]||'Exploración';
    $('status').textContent=mode==='general'?'Arrastrá para girar · Rueda o dos dedos para acercar':mode==='hub'?'Giralo para inspeccionar el interior':mode==='thermal'?'Dos circuitos · Dos temperaturas independientes':'Seleccioná una capa · Girá para inspeccionar';
  }
  function selectLayer(i,focus=true){
    i=THREE.MathUtils.clamp(i,0,3);selectedLayer=i;const info=layerInfo[i];
    $('layer-name').textContent=info[0];$('layer-composition').textContent=info[1];$('layer-function').textContent=info[2];
    refreshInfo('layer-detail');
    document.querySelectorAll('[data-layer]').forEach(b=>{b.classList.toggle('selected',Number(b.dataset.layer)===i);b.setAttribute('aria-pressed',String(Number(b.dataset.layer)===i));});
    layerOutlines.forEach((l,k)=>l.visible=k===i);
    if(focus&&mode==='layers'&&!tween){
      const h=layerHeights[i]+offsets[i],nav=document.querySelector('.explore-nav').getBoundingClientRect(),panel=$('explore-panel').getBoundingClientRect(),bar=document.querySelector('.panel').getBoundingClientRect();
      const rect=mobile()?{left:24,right:innerWidth-24,top:nav.bottom+18,bottom:panel.top-22}:{left:32,right:panel.left-30,top:nav.bottom+30,bottom:bar.top-40};
      const points=boxCorners([-.94,.94],[h-.035,h+.035],[-1.06,1.06]);
      const fitted=fitCameraToRect([-2.6,h+1.8,3.4],[0,h,.02],38,points,{width:innerWidth,height:innerHeight},rect,controls.maxDistance*.98);
      setView(fitted.position,fitted.target,fitted.fov);
    }
    invalidate();
  }
  function selectComponent(key){selectedComponent=key;hubExplorer.select(key);}
  function beginTween(target){tween={from:progress,to:target,start:performance.now(),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?300:mode==='hub'?target===0?1900:2600:target===0?1200:1650};invalidate();}
  function cameraFor(m){
    // Preserve existing general framing. Extra views are confined to the new modes.
    const compact=mobile()||(window.innerHeight<560&&window.innerWidth<1100);
    function focus(position,target,fov){
      {
        const panel=$('explore-panel').getBoundingClientRect(),nav=document.querySelector('.explore-nav').getBoundingClientRect();
        const legacy=document.querySelector('.panel').getBoundingClientRect();
        const rect=mobile()?{left:14,right:window.innerWidth-14,top:nav.bottom+14,bottom:panel.top-14}:{left:14,right:panel.left-18,top:nav.bottom+30,bottom:legacy.top-35};
        const hubBounds=mode==='hub'?hubExplorer.overviewBounds():boxCorners([cfg.hub[0]-.110,cfg.hub[0]+.110],[.019,.610],[cfg.hub[2]-.172,cfg.hub[2]+.172]);
        const bedBounds=boxCorners([-.968*dimensionalScale[0],.968*dimensionalScale[0]],[.018,m==='layers'?1.621:.901],[-1.114*dimensionalScale[1],1.114*dimensionalScale[1]]);
        const points=m==='hub'?hubBounds:[...bedBounds,...hubBounds];
        const fitted=fitCameraToRect(position,target,fov,points,{width:window.innerWidth,height:window.innerHeight},rect,controls.maxDistance*.98);
        setView(fitted.position,fitted.target,fitted.fov);
      }
    }
    if(m==='hub'){
      hubExplorer.clear();controls.minDistance=.48;camera.near=.02;camera.updateProjectionMatrix();
      if(compact)focus([cfg.hub[0]-1.28,1.22,cfg.hub[2]+1.70],[cfg.hub[0]-.46,.360,cfg.hub[2]],42);
      else focus([cfg.hub[0]-1.15,1.02,cfg.hub[2]+1.38],[cfg.hub[0]-.46,.360,cfg.hub[2]],35);
    }else if(m==='circuits'){
      focus([-3.30,3.25,4.25],[-.20,.60,-.10],38);
    }else if(m==='thermal'){
      if(compact)focus([0,7.35,.90],[0,.56,.62],42);
      else focus([-.12,5.52,1.35],[.36,.70,.12],40);
    }else if(m==='layers'){
      if(compact)focus([-4.15,2.75,4.96],[-.15,.29,.22],56);
      else focus([-3.0,2.95,4.0],[.38,1.06,.02],35);
    }
  }
  function activate(next){
    mode=next;progress=0;pending=null;waterView=false;setPanel();
    inside.visible=next==='hub';thermal.visible=next==='thermal';layers.visible=next==='layers';
    hubExplorer.setActive(next==='hub');selectedOutline.visible=false;
    if(next==='layers')selectLayer(selectedLayer,false);
    renderer.shadowMap.needsUpdate=true;cameraFor(next);beginTween(1);
  }
  function restore(){
    for(const [o,b] of baseline){o.position.copy(b.position);o.material=b.material;o.castShadow=b.castShadow;o.receiveShadow=b.receiveShadow;o.renderOrder=b.renderOrder;}
    hubExplorer.setActive(false);inside.visible=false;thermal.visible=false;layers.visible=false;selectedOutline.visible=false;
    mode='general';progress=0;tween=null;renderer.shadowMap.needsUpdate=true;setPanel();applyProgress();invalidate();
  }
  function go(next,action=null){
    closeChoice();returnAction=action;clearTimeout(openingCameraTimer);if(next==='general'){waterView=false;hubExplorer.clear();}
    if(mode==='general'){
      if(next==='general'){setPanel();applyProgress();if(action)action();else home();return;}
      activate(next);return;
    }
    if(next===mode){pending=null;cameraFor(mode);beginTween(1);return;}
    pending=next;beginTween(0);
    if(next==='general'&&!action)home();
  }
  function closeChoice(){closedChoice=true;$('cover-choice').classList.add('hidden');}
  function showChoice(x,y){
    closedChoice=false;const box=$('cover-choice');box.classList.remove('hidden');box.style.left=Math.max(12,Math.min(window.innerWidth-266,x-90))+'px';box.style.top=Math.max(135,Math.min(window.innerHeight-270,y-35))+'px';
  }
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.mode)));
  document.querySelectorAll('[data-layer]').forEach(b=>b.addEventListener('click',()=>selectLayer(Number(b.dataset.layer))));
  document.querySelectorAll('[data-component]').forEach(b=>b.addEventListener('click',()=>selectComponent(b.dataset.component)));
  $('back-general').onclick=()=>go('general');$('assemble').onclick=()=>go('general');
  $('hotspot-hub').onclick=()=>go('hub');$('hotspot-cover').onclick=e=>showChoice(e.clientX||window.innerWidth/2,e.clientY||window.innerHeight/2);
  $('choice-thermal').onclick=()=>go('thermal');$('choice-layers').onclick=()=>go('layers');$('choice-close').onclick=closeChoice;
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!closedChoice)closeChoice();else if(mode!=='general'||waterView)go('general');}});
  // Keep every legacy view button and its exact original camera parameters.
  for(const id of ['reference','hub','fabric','top']){const original=$(id).onclick;$(id).onclick=e=>{if(mode==='general'){closeChoice();waterView=false;setPanel();applyProgress();original(e);}else go('general',()=>original(e));};}
  function setTemperature(side,value){
    tempTargets[side]=THREE.MathUtils.clamp(Number(value),16,28);const id=side===0?'left':'right';
    for(const prefix of ['temp','demo']){$(prefix+'-'+id).value=String(tempTargets[side]);$(prefix+'-'+id+'-value').textContent=tempTargets[side]+' °C';}
    const c=water.colorFor(tempTargets[side]);document.querySelector(`[data-side="${id}"]`).style.setProperty('--thermal-color','#'+c.getHexString());invalidate();
  }
  for(let side=0;side<2;side++)for(const prefix of ['temp','demo'])$(prefix+'-'+(side===0?'left':'right')).oninput=e=>setTemperature(side,e.target.value);
  function temperatureColor(t){return water.colorFor(t);}
  const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();let down=null;let pointerCount=0;
  renderer.domElement.addEventListener('pointerdown',e=>{pointerCount++;down=pointerCount===1?{x:e.clientX,y:e.clientY,time:performance.now(),id:e.pointerId}:null;});
  renderer.domElement.addEventListener('pointercancel',()=>{pointerCount=Math.max(0,pointerCount-1);down=null;});
  renderer.domElement.addEventListener('pointerup',e=>{
    pointerCount=Math.max(0,pointerCount-1);const start=down;down=null;
    if(!start||start.id!==e.pointerId||Math.hypot(e.clientX-start.x,e.clientY-start.y)>7||performance.now()-start.time>650)return;
    if(tween)return;
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    if(mode==='layers'){
      const picks=[top,...layerPickables];const hit=raycaster.intersectObjects(picks,false)[0];if(hit)selectLayer(hit.object===top?0:hit.object.userData.layer);return;
    }
    if(mode==='hub'){
      const hits=raycaster.intersectObjects([inside,hubExplorer.rig],true);for(const hit of hits){let p=hit.object,visible=true;while(p){if(!p.visible){visible=false;break;}p=p.parent;}if(!visible)continue;if(hubExplorer.pick(hit.object))break;}return;
    }
    if(mode==='thermal')return;
    const hits=raycaster.intersectObjects([...hubObjects,...coverObjects],false);
    const hit=hits.find(h=>h.object.visible);if(!hit){closeChoice();return;}
    if(hubObjects.includes(hit.object))go('hub');else showChoice(e.clientX,e.clientY);
  });
  controls.addEventListener('start',()=>closeChoice());
  let previousPortrait=window.innerHeight>=window.innerWidth;
  let previousCompact=mobile()||(window.innerHeight<560&&window.innerWidth<1100);
  window.addEventListener('resize',()=>{
    const portrait=window.innerHeight>=window.innerWidth,compact=mobile()||(window.innerHeight<560&&window.innerWidth<1100);
    if(mode!=='general'&&(portrait!==previousPortrait||compact!==previousCompact))requestAnimationFrame(()=>cameraFor(mode));
    previousPortrait=portrait;previousCompact=compact;
  });
  function screenPoint(vector,button){
    const p=vector.clone().project(camera);const x=(p.x*.5+.5)*window.innerWidth,y=(-p.y*.5+.5)*window.innerHeight;
    const left=x+'px',top=y+'px',visibility=p.z>1||p.z< -1||x<10||x>window.innerWidth-10||y<125||y>window.innerHeight-85?'hidden':'visible';
    if(button.style.left!==left)button.style.left=left;if(button.style.top!==top)button.style.top=top;if(button.style.visibility!==visibility)button.style.visibility=visibility;
  }
  function syncAnchors(){
    if(mode==='general'){
      screenPoint(new THREE.Vector3(cfg.hub[0],.647,cfg.hub[2]),$('hotspot-hub'));
      screenPoint(new THREE.Vector3(.57,.770,.42),$('hotspot-cover'));
    }else if(mode==='layers'){
      const tags=document.querySelectorAll('#layer-tags button');for(let i=0;i<4;i++)screenPoint(new THREE.Vector3(.92,layerHeights[i]+offsets[i]*layerProgress[i],.36),tags[i]);
    }
  }
  function applyProgress(){
    if(mode==='hub')hubExplorer.applyOpening(progress);
    connections.update(mode==='hub'?progress:0);
    const full=mode==='general'&&waterView||mode==='hub'&&fullPathEnabled;
    external.visible=mode!=='layers'&&!hubExplorer.isIsolated();channelLayer.visible=full&&!hubExplorer.isIsolated();
    for(const o of coverObjects){if(o===top||o.name.startsWith('Cover_lateral')||o.name.startsWith('Cover lateral')){if(full){if(!coverGhosts.has(o)){const list=(Array.isArray(baseline.get(o).material)?baseline.get(o).material:[baseline.get(o).material]).map(m=>{const c=m.clone();c.transparent=true;c.opacity=o===top?.22:.36;c.depthWrite=false;return c;});coverGhosts.set(o,Array.isArray(baseline.get(o).material)?list:list[0]);}o.material=coverGhosts.get(o);}else if(coverGhosts.has(o))o.material=baseline.get(o).material;}}
    if(mode==='thermal'){
      overlayMaterial.uniforms.uOpacity.value=overlayEnabled?progress:0;
      heatLines.forEach(m=>{m.material.opacity=.56*progress;});
    }
    if(mode==='layers'){
      for(let i=0;i<4;i++){
        const t=THREE.MathUtils.clamp((progress-i*.065)/(1-i*.065),0,1);layerProgress[i]=t*t*(3-2*t);
        layerGroups[i].position.y=layerHeights[i]+offsets[i]*layerProgress[i];
      }
      for(const o of moving)o.position.y=baseline.get(o).position.y+offsets[0]*layerProgress[0];
      layers.visible=progress>.005;
    }
    if(performance.now()-lastShadow>110){renderer.shadowMap.needsUpdate=true;lastShadow=performance.now();}
  }
  function update(now){
    const dt=Math.min(.06,(now-lastTime)/1000);lastTime=now;let dirty=false;
    if(tween){const t=Math.min(1,(now-tween.start)/tween.duration),e=t*t*(3-2*t);progress=THREE.MathUtils.lerp(tween.from,tween.to,e);applyProgress();dirty=true;
      if(t===1){const end=tween.to;tween=null;renderer.shadowMap.needsUpdate=true;if(end===0){const next=pending,action=returnAction;pending=null;returnAction=null;restore();if(next&&next!=='general')activate(next);else if(action)action();}}
    }
    for(let side=0;side<2;side++){
      shownTemps[side]=THREE.MathUtils.damp(shownTemps[side],tempTargets[side],1.15,dt);const c=temperatureColor(shownTemps[side]);
      for(const m of tankVolumes[side])m.material.color.copy(c);
    }
    overlayMaterial.uniforms.uLeft.value=shownTemps[0];overlayMaterial.uniforms.uRight.value=shownTemps[1];
    if(mode==='hub'&&progress>.01){for(let i=0;i<fanRotors.length;i++)fanRotors[i].rotation.z=now*.0018*(i===0?1:-1);dirty=true;}
    const flowing=water.update(dt,shownTemps,mode!=='general'||waterView||external.visible);dirty=dirty||flowing||shownTemps.some((v,i)=>Math.abs(v-tempTargets[i])>.005);
    hubExplorer.updateLabels();
    syncAnchors();return dirty;
  }
  function fingerprint(){
    const data=[];root.traverse(o=>{if(o.isMesh){const mm=Array.isArray(o.material)?o.material:[o.material];data.push({name:o.name,position:o.position.toArray(),rotation:o.quaternion.toArray(),scale:o.scale.toArray(),geometry:o.geometry.uuid,material:mm.map(m=>({uuid:m.uuid,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,color:m.color?.toArray(),roughness:m.roughness,metalness:m.metalness,map:m.map?.uuid,normalMap:m.normalMap?.uuid})),castShadow:o.castShadow,receiveShadow:o.receiveShadow,renderOrder:o.renderOrder});}});return JSON.stringify(data);
  }
  const originalFingerprint=fingerprint();selectLayer(0,false);setPanel();
  window.HIPNOS_SET_DIMENSIONS=(sx,sz)=>{dimensionalScale=[sx,sz];for(const g of [thermal,layers,channelLayer])g.scale.set(sx,1,sz);connections.setDimensions(sx,sz);renderer.shadowMap.needsUpdate=true;invalidate();};
  window.HIPNOS_EXPLORATION={go,setTemperature,setFlow,selectLayer,selectComponent,cameraForHub:()=>cameraFor(fullPathEnabled?'circuits':'hub'),inspect:()=>({mode,pending,progress,layerProgress:[...layerProgress],flowEnabled,overlayEnabled,transitioning:!!tween,temperatures:[...tempTargets],shownTemperatures:[...shownTemps],selectedLayer,selectedComponent:hubExplorer.inspect().selected,visibleModes:{hub:inside.visible,thermal:thermal.visible,layers:layers.visible},flowPhase:water.inspect().routes.find(r=>r.section==='hub')?.phase,thermalFlowPhase:heatFlows[0].phase,water:water.inspect(),hub:hubExplorer.inspect(),waterView,fullPathEnabled,originalRestored:mode==='general'&&fingerprint()===originalFingerprint,movedSurface:top.position.y-baseline.get(top).position.y,hubOpacity:1,addedMeshes:(()=>{let n=0;additions.traverse(o=>{if(o.isMesh)n++;});return n;})()}),project:(p)=>{const v=new THREE.Vector3(...p).project(camera);return[(v.x*.5+.5)*window.innerWidth,(-v.y*.5+.5)*window.innerHeight];}};
  return{update,go,cameraFor,cameraForCurrent:()=>cameraFor(waterView||mode==='hub'&&fullPathEnabled?'circuits':mode),inspect:window.HIPNOS_EXPLORATION.inspect,isActive:()=>mode!=='general'||waterView};
}
