import * as THREE from 'three';

// The room is independent of the GLB and the exploration state machine.
// Existing product lighting, camera presets and controls are left intact.
export function installMinimalRoom({scene,floor,camera,cfg,invalidate}) {
  const room=new THREE.Group();room.name='Entorno arquitectónico · Hipnos';scene.add(room);
  const height=6,length=14,thickness=.12,ground=floor.position.y;
  // Headboard end is negative Z in the preserved GLB. The main wall is
  // parallel to that end, with 37 cm clearance behind the upholstered base.
  const corner=new THREE.Vector3(2.30,ground,-1.48);
  const right=new THREE.Vector3(-1,0,0);
  const inward=new THREE.Vector3(0,0,1);
  const up=new THREE.Vector3(0,1,0);

  // Seamless, deterministic plaster/microcement grain. These are material
  // maps, not a photograph used as scenery or a substitute for geometry.
  function grainMaps(tileWidth,tileHeight) {
    const size=512,color=new Uint8Array(size*size*4),bump=color.slice(),rough=color.slice();
    const hash=(x,y)=>{let h=Math.imul(x+17,374761393)^Math.imul(y+41,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
    function noise(x,y,period) {
      const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
      const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
      const h=(a,b)=>hash((a%period+period)%period,(b%period+period)%period);
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(ix,iy),h(ix+1,iy),sx),THREE.MathUtils.lerp(h(ix,iy+1),h(ix+1,iy+1),sx),sy);
    }
    for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const broad=noise(x/size*8,y/size*8,8)-.5;
      const detail=noise(x/size*48,y/size*48,48)-.5;
      const fine=hash(x,y)-.5,i=(y*size+x)*4;
      const tone=Math.round(249+broad*5+detail*2+fine);
      const relief=Math.round(128+broad*52+detail*19+fine*6);
      const r=Math.round(243+broad*10+detail*6);
      for(let c=0;c<3;c++){color[i+c]=tone;bump[i+c]=relief;rough[i+c]=r;}
      color[i+3]=bump[i+3]=rough[i+3]=255;
    }
    function map(data,isColor=false) {
      const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
      t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(tileWidth/1.4,tileHeight/1.4);
      t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;
      if(isColor)t.colorSpace=THREE.SRGBColorSpace;
      t.needsUpdate=true;return t;
    }
    return {map:map(color,true),bumpMap:map(bump),roughnessMap:map(rough)};
  }
  const floorMaps=grainMaps(200,200),wallMaps=grainMaps(length,height);
  const originalFloorMaterial=floor.material;
  floor.name='Piso · microcemento gris cálido mate';
  floor.material=new THREE.MeshStandardMaterial({name:'Microcemento mate',color:'#b8b0a3',roughness:.98,metalness:0,bumpScale:.0013,...floorMaps});
  floor.receiveShadow=true;

  const backMaterial=new THREE.MeshStandardMaterial({name:'Pared blanco cálido',color:'#f0e9df',roughness:.98,metalness:0,bumpScale:.0006,...wallMaps});
  const sideMaterial=new THREE.MeshStandardMaterial({name:'Pared beige',color:'#d7cbb9',roughness:.98,metalness:0,bumpScale:.0006,...wallMaps});
  // Diffuse room bounce is baked into the architectural receivers only.
  // It neither emits light nor changes the product's existing illumination.
  const bounce=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);bounce.needsUpdate=true;
  floor.material.lightMap=backMaterial.lightMap=sideMaterial.lightMap=bounce;
  floor.material.lightMapIntensity=.10;backMaterial.lightMapIntensity=.42;sideMaterial.lightMapIntensity=.10;
  // Filter the existing shadow map only on the floor and walls. The product
  // keeps its original shadow shader, lights and 2048 px shadow map.
  const shadowSource=THREE.ShaderChunk.shadowmap_pars_fragment;
  const start=shadowSource.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )');
  const end=shadowSource.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )',start);
  const samples=[[-.94,-.39],[.94,-.76],[-.09,-.92],[.34,.29],[-.92,.46],[-.82,-.87],[-.38,.28],[.97,.76],[.44,-.98],[.54,-.47],[-.26,-.42],[.79,.19],[-.24,.99],[-.81,.91],[.20,.78],[.14,-.14]];
  const filtered='#elif defined( SHADOWMAP_TYPE_PCF_SOFT )\nvec2 roomTexel=18.0/shadowMapSize;\nshadow=('+samples.map(([x,y])=>'texture2DCompare(shadowMap,shadowCoord.xy+roomTexel*vec2('+x.toFixed(3)+','+y.toFixed(3)+'),shadowCoord.z)').join('+')+')/16.0;\n';
  const softShadowChunk=shadowSource.slice(0,start)+filtered+shadowSource.slice(end);
  for(const material of [floor.material,backMaterial,sideMaterial]) {
    material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',softShadowChunk);};
    material.customProgramCacheKey=()=>'hipnos-room-shadow-18px-r170';
  }
  const shadows=new THREE.Group();shadows.name='Sombras de contacto del entorno';room.add(shadows);

  function contactShadow(name,center,width,depth,radius,opacity,softness) {
    const pad=softness*2.5,planeWidth=width+pad*2,planeDepth=depth+pad*2;
    const material=new THREE.ShaderMaterial({name:'Oclusión de contacto · '+name,transparent:true,depthWrite:false,uniforms:{dimensions:{value:new THREE.Vector2(width,depth)},plane:{value:new THREE.Vector2(planeWidth,planeDepth)},radius:{value:radius},opacity:{value:opacity},softness:{value:softness}},
      vertexShader:'varying vec2 uvContact; void main(){ uvContact=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:'varying vec2 uvContact; uniform vec2 dimensions; uniform vec2 plane; uniform float radius; uniform float opacity; uniform float softness; void main(){vec2 p=abs((uvContact-.5)*plane)-(dimensions*.5-radius);float d=length(max(p,0.0))+min(max(p.x,p.y),0.0)-radius;float a=opacity*(1.0-smoothstep(-softness,softness,d));gl_FragColor=vec4(0.0,0.0,0.0,a);}'
    });
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(planeWidth,planeDepth),material);
    mesh.name=name;mesh.rotation.x=-Math.PI/2;mesh.position.set(center[0],ground+.0007,center[1]);mesh.renderOrder=1;shadows.add(mesh);return mesh;
  }
  contactShadow('Contacto bajo la base',[0,0],1.88,2.17,.14,.16,.085);
  contactShadow('Contacto bajo el hub',[cfg.hub[0],cfg.hub[2]],.204,.325,.044,.23,.033);

  const walls=[];
  function wall(name,along,normal,material) {
    const group=new THREE.Group();group.name=name;room.add(group);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(length,height,thickness),material);
    mesh.name=name+' · volumen';
    const localX=normal.clone().cross(up).negate();
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(localX,up,normal));
    mesh.position.copy(corner).addScaledVector(along,length*.5).addScaledVector(normal,-thickness*.5).addScaledVector(up,height*.5);
    mesh.receiveShadow=true;mesh.castShadow=false;group.add(mesh);
    // Soft floor/wall junction without a skirting board or decoration.
    const depth=.16,across=normal.clone();
    const floorX=along.clone(),floorY=up.clone().cross(floorX);
    const reverse=floorY.dot(across)<0;
    const footMaterial=new THREE.ShaderMaterial({name:'Sombra suave del encuentro',transparent:true,depthWrite:false,uniforms:{reverse:{value:reverse?1:0}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv; uniform float reverse; void main(){float t=mix(vUv.y,1.0-vUv.y,reverse);float a=.13*pow(1.0-t,3.0);gl_FragColor=vec4(0.0,0.0,0.0,a);}' });
    const foot=new THREE.Mesh(new THREE.PlaneGeometry(length,depth),footMaterial);
    foot.name=name+' · encuentro con piso';
    foot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(floorX,floorY,up));
    foot.position.copy(corner).addScaledVector(along,length*.5).addScaledVector(across,depth*.5);foot.position.y=ground+.0005;foot.renderOrder=1;group.add(foot);
    walls.push({group,normal});return group;
  }
  wall('Pared posterior · blanco cálido',right,inward,backMaterial);
  wall('Pared lateral · beige',inward,right,sideMaterial);

  // Cut away only the wall behind which the camera moves. OrbitControls is
  // unchanged, and the architectural envelope never blocks the product.
  function update() {
    let changed=false;
    for(const {group,normal} of walls){const visible=camera.position.clone().sub(corner).dot(normal)>0;if(group.visible!==visible){group.visible=visible;changed=true;}}
    if(changed)invalidate();return changed;
  }
  update();invalidate();
  window.HIPNOS_ENVIRONMENT={inspect:()=>({corner:corner.toArray(),wallHeight:height,wallLength:length,wallThickness:thickness,walls:walls.map(({group,normal})=>({name:group.name,visible:group.visible,normal:normal.toArray(),cameraInside:camera.position.clone().sub(corner).dot(normal)>0})),floor:{color:floor.material.color.getHexString(),roughness:floor.material.roughness,bumpScale:floor.material.bumpScale,y:ground},originalFloorMaterial:originalFloorMaterial.uuid,lightsUnchanged:true})};
  return {update};
}
