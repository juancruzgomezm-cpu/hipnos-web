import * as THREE from 'three';

// Frame added modes in the free canvas area. The original camera presets are untouched.
export function fitCameraToRect(position,target,fov,points,viewport,rect,maxDistance=13.7){
  const p=new THREE.Vector3(...position),t=new THREE.Vector3(...target);
  const direction=p.clone().sub(t).normalize();let distance=p.distanceTo(t);
  const cam=new THREE.PerspectiveCamera(fov,viewport.width/viewport.height,.02,80);
  const centreX=(rect.left+rect.right)/2,centreY=(rect.top+rect.bottom)/2;
  const availableW=Math.max(100,rect.right-rect.left),availableH=Math.max(100,rect.bottom-rect.top);
  for(let pass=0;pass<9;pass++){
    cam.fov=fov;cam.position.copy(p);cam.lookAt(t);cam.updateProjectionMatrix();cam.updateMatrixWorld(true);
    const projected=points.map(v=>new THREE.Vector3(...v).project(cam));
    const xs=projected.map(v=>(v.x*.5+.5)*viewport.width),ys=projected.map(v=>(-.5*v.y+.5)*viewport.height);
    const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    const factor=Math.max((right-left)/availableW,(bottom-top)/availableH);
    if(factor>1){
      const nextDistance=distance*factor*1.025;
      if(nextDistance>maxDistance){fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(fov/2))*nextDistance/maxDistance));distance=maxDistance;}
      else distance=nextDistance;
      p.copy(t).addScaledVector(direction,distance);continue;
    }
    const pixelsPerMetre=viewport.height/(2*Math.tan(THREE.MathUtils.degToRad(fov/2))*distance);
    const shift=new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,0).multiplyScalar(((left+right)/2-centreX)/pixelsPerMetre);
    shift.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,1),(centreY-(top+bottom)/2)/pixelsPerMetre);
    p.add(shift);t.add(shift);
    if(Math.abs((left+right)/2-centreX)<.25&&Math.abs((top+bottom)/2-centreY)<.25)break;
  }
  return{position:p.toArray(),target:t.toArray(),fov};
}

export function boxCorners(x,y,z){const points=[];for(const a of x)for(const b of y)for(const c of z)points.push([a,b,c]);return points;}
