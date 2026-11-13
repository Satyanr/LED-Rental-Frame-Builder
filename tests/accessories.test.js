import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {HOLLOW,WHEEL_PRESET,RIGGING_DEPTH,DEFAULT_SETTINGS,objectMembers,objectSummary,validateProject,makeProject,cloneObjects,tubeAnchor} from '../src/project.js';
import {memberGeometry,mergedMemberGeometry,fitMeshesToDimensions,wheelMountPose} from '../src/geometry.js';

const frame=(extra={})=>({id:'frame',type:'frame',width:2,height:2,braceSpacingMm:1000,position:[0,1,0],rotation:[0,0,0],...extra});
const wheel=(extra={})=>({id:'wheel',type:'wheel',...WHEEL_PRESET,position:[0,.09,1],rotation:[0,0,0],...extra});
const rigging=(extra={})=>({id:'rigging',type:'rigging',width:3,height:2,position:[3,1,0],rotation:[0,0,0],...extra});
const saved=objects=>makeProject(objects,DEFAULT_SETTINGS,null);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('wheel, rigging, mount and all creation settings round trip alongside ballast and old frames',()=>{
  const objects=[frame(),wheel({mount:{targetId:'frame',memberIndex:1,t:.2}}),rigging()];
  const p=makeProject(objects,DEFAULT_SETTINGS,null,undefined,undefined,{type:'ballast',shape:'rectangle',accessory:'rigging'},undefined,{width:.2,height:.3,depth:.12},{width:5,height:3});
  const restored=validateProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(restored.frames,p.frames);assert.equal(restored.palette.accessory,'rigging');
  assert.deepEqual(restored.wheelTemplate,{width:.2,height:.3,depth:.12});assert.deepEqual(restored.riggingTemplate,{length:3});
  const legacy=saved([frame()]);delete legacy.wheelTemplate;delete legacy.riggingTemplate;
  assert.deepEqual(validateProject(legacy).wheelTemplate,WHEEL_PRESET);
  assert.equal(validateProject(legacy).frames.length,1);
});

test('invalid dimensions, accessory templates and mount targets are rejected before import',()=>{
  for(const change of [{depth:0},{depth:NaN},{height:Infinity},{width:'120'},{tie:{targetId:'frame',memberIndex:1,t:.5}}])assert.throws(()=>saved([frame(),wheel(change)]));
  for(const change of [{width:.59},{height:0},{braceSpacingMm:1000},{mount:{targetId:'frame',memberIndex:1,t:.5}}])assert.throws(()=>saved([frame(),rigging(change)]));
  for(const change of [{targetId:'missing'},{targetId:'wheel'},{targetId:'rigging'},{memberIndex:5},{t:1.1},{t:NaN}])assert.throws(()=>saved([frame(),rigging(),wheel({mount:{targetId:'frame',memberIndex:1,t:.5,...change}})]));
  for(const change of [{wheelTemplate:{width:.12,height:.18,depth:0}},{riggingTemplate:{width:.5,height:2}}])assert.throws(()=>validateProject({...saved([frame()]),...change}));
});

test('rendered wheels and trusses have exact outside bounds and empty truss centres',()=>{
  for(const data of [wheel(),wheel({width:.4,height:.6,depth:.3}),rigging(),rigging({width:.6,height:.6}),rigging({width:50,height:50})]){
    const group=new THREE.Group(),members=objectMembers(data);
    if(data.type==='rigging')group.add(new THREE.Mesh(mergedMemberGeometry(members)));
    else for(const member of members){const mesh=new THREE.Mesh(memberGeometry(member));mesh.position.fromArray(member.position??[0,0,0]);group.add(mesh);}
    const depth=data.depth??RIGGING_DEPTH;
    fitMeshesToDimensions(group.children,[data.width,data.height,depth]);
    group.position.y=data.height/2;group.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3());
    close(size.x,data.width);close(size.y,data.height);close(size.z,depth);close(bounds.min.y,0);
    if(data.type==='rigging'){
      const ray=new THREE.Raycaster(new THREE.Vector3(0,data.height/2,1),new THREE.Vector3(0,0,-1));
      assert.equal(ray.intersectObject(group,true).length,0);
    }
    group.children.forEach(m=>{m.geometry.dispose();m.material.dispose();});
  }
});

test('wheel mounting plate contacts the hollow exactly after arbitrary target rotations and resizes',()=>{
  for(const target of [frame(),frame({width:4,height:3,position:[1,2,-3],rotation:[30,40,50]}),frame({type:'hollow',width:HOLLOW,height:2.5,braceSpacingMm:0,rotation:[90,15,35]})]){
    for(const memberIndex of target.type==='hollow'?[0]:[0,1,2,3,4])for(const t of [0,.25,1]){
      const source=wheel({mount:{targetId:target.id,memberIndex,t}}),pose=wheelMountPose(source,target),anchor=tubeAnchor(target,source.mount);
      const rotation=new THREE.Euler(...pose.rotation.map(THREE.MathUtils.degToRad),'XYZ');
      const plate=new THREE.Vector3(0,source.height/2,0).applyEuler(rotation).add(new THREE.Vector3(...pose.position));
      const contact=[...anchor.position];contact[anchor.axis===0?1:0]-=HOLLOW/2;
      const expected=new THREE.Vector3(...contact).applyEuler(new THREE.Euler(...target.rotation.map(THREE.MathUtils.degToRad),'XYZ')).add(new THREE.Vector3(...target.position));
      assert.ok(plate.distanceTo(expected)<1e-8);
    }
  }
});

test('copy remaps wheel mounts with the target and releases missing targets',()=>{
  const source=saved([frame({groupId:'group'}),wheel({groupId:'group',mount:{targetId:'frame',memberIndex:1,t:.8}}),rigging()]).frames;
  const copies=cloneObjects(source,source);assert.equal(copies[1].mount.targetId,copies[0].id);assert.equal(copies[1].groupId,copies[0].groupId);
  assert.equal(cloneObjects([source[1]],source)[0].mount.targetId,'frame');
  assert.ok(!cloneObjects([source[1]],[])[0].mount);
  const summary=objectSummary([...source,...copies,wheel({depth:.2})]);
  assert.equal(summary.total,7);assert.equal(summary.bySize.filter(i=>i.type==='wheel').length,2);assert.equal(summary.bySize.find(i=>i.type==='rigging').quantity,2);
});
