import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';

// Softbox illumination and reflections, independent of the product meshes.
export function installPremiumLighting({scene,renderer,invalidate}) {
  RectAreaLightUniformsLib.init();
  const rig=new THREE.Group();rig.name='Hipnos · iluminación de producto';scene.add(rig);
  const key=new THREE.DirectionalLight('#fff0da',1.65);key.position.set(-2.8,4.2,2.6);key.target.position.set(0,.48,0);key.castShadow=true;
  key.shadow.camera.left=-3.1;key.shadow.camera.right=3.1;key.shadow.camera.top=3.1;key.shadow.camera.bottom=-3.1;key.shadow.camera.near=.1;key.shadow.camera.far=12;
  key.shadow.mapSize.set(2048,2048);key.shadow.normalBias=.0024;key.shadow.bias=-.00006;key.shadow.radius=5;key.shadow.blurSamples=8;rig.add(key,key.target);
  function area(name,position,target,color,intensity,width,height){const light=new THREE.RectAreaLight(color,intensity,width,height);light.name=name;light.position.set(...position);light.lookAt(...target);rig.add(light);return light;}
  const main=area('Ventana lateral suave',[-2.7,2.1,1.4],[0,.7,0],'#fff2df',7.2,2.5,3.1);
  const fill=area('Relleno neutro',[2.1,2.4,3.5],[0,.6,0],'#e9eff6',3.6,3.0,2.5);
  const rim=area('Reflejo de canto',[1.35,2.4,-.95],[-.4,.6,.3],'#fff6e8',5.1,1.8,2.0);
  const hub=area('Reflejo suave del hub',[-2.0,1.2,-.2],[-1.1,.3,-1.0],'#f5e8d6',2.2,.65,1.4);
  const ambient=new THREE.HemisphereLight('#f5f2ec','#77786c',.20);rig.add(ambient);
  const reflectionRoom=new THREE.Scene();
  const enclosure=new THREE.Mesh(new THREE.BoxGeometry(14,10,14),new THREE.MeshBasicMaterial({color:'#827e74',side:THREE.BackSide}));reflectionRoom.add(enclosure);
  function card(position,size,value,color){const m=new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(value),side:THREE.DoubleSide}));m.position.set(...position);m.lookAt(0,.6,0);reflectionRoom.add(m);}
  card([-4,2,1],[3.8,5],4.2,'#fff1df');card([3,3,3],[3,4],1.65,'#eaf2fa');card([1.6,3,-3],[2,3.5],2.4,'#fff8ee');card([0,5,0],[5,4],.8,'#f9f6ec');
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(reflectionRoom,.06);scene.environment=environment.texture;scene.environmentIntensity=.52;pmrem.dispose();
  reflectionRoom.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  const floor=scene.getObjectByName('Piso · microcemento gris cálido mate');
  const walls=['Pared posterior · blanco cálido · volumen','Pared lateral · beige · volumen'].map(n=>scene.getObjectByName(n));
  const receivers=[floor,...walls].filter(Boolean);
  receivers.forEach(o=>{o.material.lightMapIntensity=.035;o.material.needsUpdate=true;});
  const finish=[['#afa798','#373b3a'],['#ece6db','#383c3c'],['#d2c5b3','#333838']].map(pair=>pair.map(c=>new THREE.Color(c)));
  let target=0,value=0,last=performance.now();
  document.body.dataset.theme='day';
  const lights=[key,main,fill,rim,hub,ambient],day=[1.65,7.2,3.6,5.1,2.2,.20],night=[.80,3.6,2.3,2.6,3.5,.12];
  const colors=lights.map(l=>l.color.clone()),nightColors=['#f1dcc4','#f2dfc9','#ced9e2','#f0e1cb','#efddc2','#d8dedc'].map(c=>new THREE.Color(c));
  const dayBG=new THREE.Color('#e4dfd5'),nightBG=new THREE.Color('#262b28');
  function setNight(on){target=on?1:0;document.body.dataset.theme=on?'night':'day';const b=document.querySelector('#daynight');b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'Activar ambiente diurno':'Activar ambiente nocturno');invalidate();}
  document.querySelector('#daynight').onclick=()=>setNight(target===0);
  function update(now){const dt=Math.min(.06,(now-last)/1000);last=now;const before=value;value=THREE.MathUtils.damp(value,target,5.5,dt);if(Math.abs(value-target)<.001)value=target;if(value===before)return false;
    lights.forEach((l,i)=>{l.intensity=THREE.MathUtils.lerp(day[i],night[i],value);l.color.copy(colors[i]).lerp(nightColors[i],value);});
    receivers.forEach((o,i)=>o.material.color.copy(finish[i][0]).lerp(finish[i][1],value));
    scene.background.copy(dayBG).lerp(nightBG,value);scene.environmentIntensity=THREE.MathUtils.lerp(.52,.46,value);renderer.toneMappingExposure=THREE.MathUtils.lerp(1.15,1.30,value);invalidate();return true;
  }
  receivers.forEach((o,i)=>o.material.color.copy(finish[i][0]));scene.background.copy(dayBG);renderer.toneMappingExposure=1.15;
  renderer.shadowMap.type=THREE.VSMShadowMap;renderer.shadowMap.needsUpdate=true;
  return {update,setNight,key,inspect:()=>({theme:target?'night':'day',transition:value,areaLights:4,shadowSize:key.shadow.mapSize.x,environment:'softbox PMREM'})};
}
