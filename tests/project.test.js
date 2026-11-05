import test from 'node:test';
import assert from 'node:assert/strict';
import {HOLLOW, MAX_FRAMES, DEFAULT_SETTINGS, dimension, normalizeDegrees, snapValue, validateProject, makeProject} from '../src/project.js';

const frame = () => ({id:'frame-01',name:'Frame 01',width:1,height:2,position:[0,1,0],rotation:[0,90,0]});
const project = () => makeProject([frame()],DEFAULT_SETTINGS,null);

test('JSON round trip preserves dimensions, position, rotation and fixed hollow',()=>{
  const source=project();const parsed=validateProject(JSON.parse(JSON.stringify(source)));
  assert.deepEqual(parsed.frames,source.frames);assert.deepEqual(parsed.settings,DEFAULT_SETTINGS);assert.equal(source.hollow.width,HOLLOW);assert.equal(source.hollow.height,.04);
});
test('invalid dimensions and nonfinite input are rejected',()=>{
  for(const value of [0,-1,.09,50.01,NaN,Infinity,'2',null])assert.throws(()=>dimension(value));
  assert.equal(dimension(.1),.1);assert.equal(dimension(50),50);
});
test('bad project never passes schema validation',()=>{
  for(const mutate of [
    p=>p.version=2,p=>p.units='mm',p=>p.hollow.width=.06,p=>p.frames[0].position=[0,1],
    p=>p.frames[0].rotation=[0,Infinity,0],p=>p.frames[0].position=[501,0,0],
    p=>p.frames.push({...frame()}),p=>p.frames=Array.from({length:MAX_FRAMES+1},(_,i)=>({...frame(),id:String(i)}))
  ]){const p=project();mutate(p);assert.throws(()=>validateProject(p));}
});
test('blank project works and untrusted labels remain plain text',()=>{
  assert.deepEqual(validateProject(makeProject([],DEFAULT_SETTINGS,null)).frames,[]);
  const p=project();p.frames[0].name='<img src=x onerror=alert(1)>';assert.equal(validateProject(p).frames[0].name,p.frames[0].name);
});
test('step snap works symmetrically and large rotations preserve orientation',()=>{
  assert.ok(Math.abs(snapValue(.36,.1)-.4)<1e-10);assert.ok(Math.abs(snapValue(-.36,.1)+.4)<1e-10);
  assert.equal(normalizeDegrees(450),90);assert.equal(normalizeDegrees(-450),-90);assert.equal(normalizeDegrees(360),0);
});
test('unknown settings fall back to allowed values',()=>{
  const p=project();p.settings={snap:'yes',positionStep:0,rotationStep:1,space:'scale',grid:'yes',dimensions:8};
  assert.deepEqual(validateProject(p).settings,DEFAULT_SETTINGS);
});
test('camera only restored with finite valid parameters',()=>{
  const p=project();p.camera={view:'top',type:'orthographic',position:[0,10,0],target:[0,0,0],up:[0,0,-1],span:6};
  assert.deepEqual(validateProject(p).camera,p.camera);p.camera.span=-1;assert.equal(validateProject(p).camera,null);
});
