import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DEFAULT_SETTINGS,RIGGING_DEPTH,defaultClothCorners,objectMembers,objectSummary,makeProject,validateProject,cloneObjects,tubeAnchor,validateClothTemplate} from '../src/project.js';
import {mergedMemberGeometry,clothGeometry,clothSurfacePoint,clothPinnedCorners} from '../src/geometry.js';
const frame=(extra={})=>({id:'frame',name:'Frame',type:'frame',width:2,height:2,position:[1,1,0],rotation:[0,0,0],braceSpacingMm:1000,...extra});
const cloth=(extra={})=>({id:'cloth',name:'Kain',type:'cloth',width:2,height:2,position:[0,1,.1],rotation:[0,0,0],...extra});
const segment=(extra={})=>({id:'truss',name:'Rigging batang',type:'rigging',riggingKind:'segment',width:RIGGING_DEPTH,height:2,position:[0,1,0],rotation:[0,0,0],...extra});
const saved=frames=>makeProject(frames,DEFAULT_SETTINGS,null);
const pin=(extra={})=>({targetId:'frame',memberIndex:0,t:.2,side:1,...extra});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('rigging is one square truss segment with exact fixed section and custom length',()=>{
  for(const length of [.1,.5,2,50]){
    const geometry=mergedMemberGeometry(objectMembers(segment({height:length})));geometry.computeBoundingBox();
    const size=geometry.boundingBox.getSize(new THREE.Vector3());close(size.x,.29);close(size.y,length);close(size.z,.29);
    const members=objectMembers(segment({height:length}));assert.equal(members.filter(m=>m.radius===.025).length,4);
    assert.ok(members.every(m=>m.start.slice(0,1).every(n=>Math.abs(n)<.15)&&Math.abs(m.end[2])<.15));geometry.dispose();
  }
  for(const extra of [{width:.3},{height:0},{height:Infinity},{riggingKind:'triangle'},{braceSpacingMm:1000}])assert.throws(()=>saved([segment(extra)]));
  const p=validateProject(JSON.parse(JSON.stringify(saved([segment()]))));assert.equal(p.frames[0].riggingKind,'segment');assert.deepEqual(p.riggingTemplate,{length:2});
  assert.equal(objectSummary([segment(),segment({rotation:[90,0,0]}),segment({height:3})]).bySize.length,2);
});

test('old closed rigging stays intact while its creation form becomes a segment length',()=>{
  const p=saved([segment({riggingKind:'legacy-frame',width:3,height:2})]);delete p.frames[0].riggingKind;p.riggingTemplate={width:3,height:2};
  const restored=validateProject(p);assert.equal(restored.frames[0].riggingKind,'legacy-frame');assert.equal(restored.frames[0].width,3);assert.deepEqual(restored.riggingTemplate,{length:2});
});

test('cloth shape, four independent pins, style and creation template round trip',()=>{
  const objects=[frame(),cloth({clothCorners:[[-1,1,0],[1.2,1,.3],[1,-1,.5],[-1,-.7,-.1]],clothPins:[pin(),pin({t:.8}),null,null],clothColor:'#bbaa88',clothSag:.15})];
  const p=makeProject(objects,DEFAULT_SETTINGS,null,undefined,undefined,{type:'ballast',shape:'rectangle',accessory:'cloth'},undefined,undefined,{length:3},{width:3,height:2,color:'#112233',sag:.2});
  const restored=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(restored.frames,p.frames);assert.equal(restored.palette.accessory,'cloth');assert.deepEqual(restored.clothTemplate,{width:3,height:2,color:'#112233',sag:.2});
  const old=saved([frame()]);delete old.clothTemplate;assert.deepEqual(validateProject(old).clothTemplate,validateClothTemplate());
});

test('invalid cloth geometry, pins, styles and non-cloth cloth fields are rejected',()=>{
  for(const extra of [{clothCorners:[]},{clothCorners:[[0,0,0],null,[0,0,0],[0,0,0]]},{clothCorners:[[Infinity,0,0],[0,0,0],[0,0,0],[0,0,0]]},{clothPins:[]},{clothPins:[pin({targetId:'missing'}),null,null,null]},{clothPins:[pin({side:0}),null,null,null]},{clothPins:[pin({memberIndex:8}),null,null,null]},{clothColor:'red'},{clothColor:'#fff'},{clothSag:-1},{clothSag:NaN},{clothSag:5.1}])assert.throws(()=>saved([frame(),cloth(extra)]));
  assert.throws(()=>saved([frame({clothCorners:defaultClothCorners(2,2)})]));
});

test('cloth pins keep exact surface contact after both object transforms and frame resize',()=>{
  for(const target of [frame(),frame({width:4,height:3,rotation:[35,60,80]}),frame({type:'hollow',width:.04,height:3,braceSpacingMm:0,rotation:[0,0,90]})]){
    const pins=[pin(),pin({t:.8}),pin({memberIndex:target.type==='hollow'?0:1,side:-1}),null];
    const source=saved([target,cloth({position:[-1,2,.5],rotation:[10,30,50],clothPins:pins})]).frames[1];
    const points=clothPinnedCorners(source,new Map([[target.id,target]]));
    for(let i=0;i<3;i++){
      const actual=new THREE.Vector3(...points[i]).applyEuler(new THREE.Euler(...source.rotation.map(THREE.MathUtils.degToRad),'XYZ')).add(new THREE.Vector3(...source.position));
      const anchor=tubeAnchor(target,pins[i]),expected=new THREE.Vector3(...anchor.position);expected.z+=.023*pins[i].side;
      expected.applyEuler(new THREE.Euler(...target.rotation.map(THREE.MathUtils.degToRad),'XYZ')).add(new THREE.Vector3(...target.position));
      assert.ok(actual.distanceTo(expected)<1e-8);
    }
    assert.deepEqual(points[3],source.clothCorners[3]);
  }
});

test('deformed cloth geometry interpolates every corner, stays finite and responds to waves',()=>{
  const data=saved([cloth({clothCorners:[[-1,1,0],[1,1,.3],[.8,-1,.5],[-1,-.5,0]],clothSag:.2})]).frames[0],geometry=clothGeometry(data);
  for(const [i,vertex] of [0,24,624,600].entries())assert.ok(new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,vertex).distanceTo(new THREE.Vector3(...data.clothCorners[i]))<1e-6);
  for(const name of ['position','normal'])assert.ok([...geometry.attributes[name].array].every(Number.isFinite));
  assert.ok(clothSurfacePoint(data,.4,.4).distanceTo(clothSurfacePoint({...data,clothSag:0},.4,.4))>.01);
  geometry.dispose();
});

test('copy remaps all cloth targets together and releases unavailable external targets',()=>{
  const source=saved([frame({groupId:'g'}),cloth({groupId:'g',clothPins:[pin(),pin({memberIndex:1}),null,null]})]).frames;
  const copies=cloneObjects(source,source);assert.equal(copies[1].clothPins[0].targetId,copies[0].id);assert.equal(copies[1].clothPins[1].targetId,copies[0].id);
  assert.equal(cloneObjects([source[1]],source)[0].clothPins[0].targetId,'frame');assert.deepEqual(cloneObjects([source[1]],[])[0].clothPins,[null,null,null,null]);
  copies[1].clothCorners[0][0]=99;assert.notEqual(source[1].clothCorners[0][0],99);
  assert.equal(objectSummary([source[1],{...source[1],clothColor:'#ffffff'}]).bySize.length,2);
});
