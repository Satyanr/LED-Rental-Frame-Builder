import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {HOLLOW, tubeAnchor, validateCloth} from './project.js';

const objectMatrix = data => new THREE.Matrix4().compose(new THREE.Vector3(...data.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation.map(THREE.MathUtils.degToRad),'XYZ')),new THREE.Vector3(1,1,1));
export function clothPinnedCorners(source,byId) {
  const {clothCorners,clothPins}=validateCloth(source),inverse=objectMatrix(source).invert();
  return clothCorners.map((corner,i)=>{
    const pin=clothPins[i];if(!pin)return corner;
    const target=byId.get(pin.targetId);if(!target)return corner;
    const anchor=tubeAnchor(target,pin),point=new THREE.Vector3(...anchor.position);
    point.z+=(HOLLOW/2+.003)*pin.side;
    return point.applyMatrix4(objectMatrix(target)).applyMatrix4(inverse).toArray();
  });
}
export function clothSurfacePoint(data,u,v) {
  const [tl,tr,br,bl]=data.clothCorners.map(p=>new THREE.Vector3(...p));
  const top=tl.clone().lerp(tr,u),bottom=bl.clone().lerp(br,u),point=top.clone().lerp(bottom,v);
  const normal=new THREE.Vector3().crossVectors(bl.clone().sub(tl),tr.clone().sub(tl)).normalize();
  if(normal.lengthSq()<1e-12)normal.set(0,0,1);
  const envelope=Math.sin(Math.PI*u)*Math.sin(Math.PI*v),sag=data.clothSag??0;
  point.addScaledVector(normal,sag*envelope*(.5+.5*Math.sin(6*Math.PI*u)));point.y-=sag*.25*envelope;
  return point;
}
export function clothGeometry(data) {
  const geometry=new THREE.PlaneGeometry(1,1,24,24),position=geometry.attributes.position;
  for(let y=0;y<=24;y++)for(let x=0;x<=24;x++)position.setXYZ(y*25+x,...clothSurfacePoint(data,x/24,y/24).toArray());
  position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export function wheelMountPose(source,target) {
  const {axis,position}=tubeAnchor(target,source.mount);
  const targetRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...target.rotation.map(THREE.MathUtils.degToRad),'XYZ'));
  const localRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),axis===0?0:-Math.PI/2);
  const local=new THREE.Vector3(...position).add(new THREE.Vector3(0,-(HOLLOW+source.height)/2,0).applyQuaternion(localRotation));
  const world=local.applyQuaternion(targetRotation).add(new THREE.Vector3(...target.position));
  const rotation=new THREE.Euler().setFromQuaternion(targetRotation.multiply(localRotation),'XYZ');
  return {position:world.toArray(),rotation:[rotation.x,rotation.y,rotation.z].map(THREE.MathUtils.radToDeg)};
}

export function mergedMemberGeometry(members) {
  const geometries=members.map(member=>memberGeometry(member).translate(...(member.position??[0,0,0])));
  try{return mergeGeometries(geometries,false);}finally{geometries.forEach(g=>g.dispose());}
}

export function tieVisualPoints(source,target) {
  const {axis,position}=tubeAnchor(target,source.tie);
  const matrix=data=>new THREE.Matrix4().compose(new THREE.Vector3(...data.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation.map(THREE.MathUtils.degToRad),'XYZ')),new THREE.Vector3(1,1,1));
  const sourceMatrix=matrix(source),targetMatrix=matrix(target),radius=HOLLOW/2+.006;
  const start=new THREE.Vector3(source.width*.08,source.height*.4,-source.depth*.1).applyMatrix4(sourceMatrix);
  const localEnd=[...position];localEnd[2]-=radius;
  const end=new THREE.Vector3(...localEnd).applyMatrix4(targetMatrix);
  const cross=axis===0?1:0;
  const loop=[[0,-radius],[radius,-radius],[radius,radius],[-radius,radius],[-radius,-radius]].map(([a,z])=>{
    const point=[...position];point[cross]+=a;point[2]+=z;return new THREE.Vector3(...point).applyMatrix4(targetMatrix).toArray();
  });
  return {start:start.toArray(),end:end.toArray(),loop};
}

// Geometry stays inside each member's supplied dimensions, including the rope.
export function memberGeometry(member) {
  if(member.geometry==='cloth')return clothGeometry(member);
  if(member.geometry==='strut'){
    const start=new THREE.Vector3(...member.start),end=new THREE.Vector3(...member.end),direction=end.clone().sub(start);
    const geometry=new THREE.CylinderGeometry(member.radius,member.radius,direction.length(),8);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));
    return geometry.translate(...start.add(end).multiplyScalar(.5).toArray());
  }
  if(member.geometry==='wheel')return new THREE.CylinderGeometry(.5,.5,1,32).rotateX(Math.PI/2).scale(...member.size);
  if(member.geometry==='rope'){
    const path=new THREE.CurvePath(),points=member.points.map(p=>new THREE.Vector3(...p));
    if(points.every(p=>p.distanceToSquared(points[0])<1e-14))return new THREE.SphereGeometry(member.radius,8,6).translate(...member.points[0]);
    if(member.closed)points.push(points[0]);
    for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(points[i-1],points[i]));
    return new THREE.TubeGeometry(path,Math.max(24,points.length*6),member.radius,6,!!member.closed);
  }
  if(member.geometry==='cylinder')return new THREE.CylinderGeometry(member.size[0]/2,member.size[0]/2,member.size[1],16).scale(1,1,member.size[2]/member.size[0]);
  if(member.geometry==='rounded')return new RoundedBoxGeometry(...member.size,2,Math.min(...member.size)*.08);
  return new THREE.BoxGeometry(...member.size);
}

export function fitMeshesToDimensions(meshes,size) {
  const bounds=new THREE.Box3();
  for(const mesh of meshes){mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox.clone().translate(mesh.position));}
  const center=bounds.getCenter(new THREE.Vector3()),extent=bounds.getSize(new THREE.Vector3());
  const scale=new THREE.Vector3(...size).divide(extent);
  for(const mesh of meshes){mesh.position.sub(center).multiply(scale);mesh.scale.copy(scale);}
}

export function concreteTexture() {
  const size=64,pixels=new Uint8Array(size*size*4);let seed=321;
  for(let i=0;i<size*size;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const shade=185+(seed%43);pixels.set([shade,shade,shade-3,255],i*4);
  }
  const texture=new THREE.DataTexture(pixels,size,size);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(3,3);texture.needsUpdate=true;return texture;
}
