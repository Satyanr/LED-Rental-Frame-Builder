import test from 'node:test';
import assert from 'node:assert/strict';
import {HOLLOW, MAX_FRAMES, DEFAULT_SETTINGS, dimension, braceSpacing, braceOffsetsMm, frameMembers, normalizeDegrees, snapValue, validateProject, makeProject} from '../src/project.js';

const frame = () => ({id:'frame-01',name:'Frame 01',width:1,height:2,braceSpacingMm:0,position:[0,1,0],rotation:[0,90,0]});
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

test('2000 x 2000 mm at 1000 mm creates one full-width internal tube at mid-height',()=>{
  const members=frameMembers(2,2,1000);
  assert.equal(members.length,5);assert.deepEqual(braceOffsetsMm(2,1000),[1000]);
  assert.deepEqual(members[4],{size:[1.92,.04,.04],position:[0,0,0]});
  const leftInner=-1+.04,rightInner=1-.04;
  assert.equal(members[4].position[0]-members[4].size[0]/2,leftInner);
  assert.equal(members[4].position[0]+members[4].size[0]/2,rightInner);
});
test('spacing repeats up the height and never duplicates outer perimeter tubes',()=>{
  assert.deepEqual(braceOffsetsMm(3,1000),[1000,2000]);
  assert.deepEqual(braceOffsetsMm(2,500),[500,1000,1500]);
  assert.deepEqual(braceOffsetsMm(2,2000),[]);
  assert.deepEqual(braceOffsetsMm(2,3000),[]);
  assert.deepEqual(braceOffsetsMm(2,1990),[]);
  assert.equal(frameMembers(2,2,0).length,4);
});
test('legacy projects open with no middle tubes and new projects preserve spacing and transforms',()=>{
  const legacy=project();delete legacy.frames[0].braceSpacingMm;
  assert.equal(validateProject(legacy).frames[0].braceSpacingMm,0);
  const p=project();p.frames[0].braceSpacingMm=1000;
  const result=validateProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(result.frames,p.frames);assert.equal(frameMembers(result.frames[0].width,result.frames[0].height,result.frames[0].braceSpacingMm).length,5);
});
test('invalid and excessive middle-tube spacing are rejected before geometry is built',()=>{
  for(const value of [-1,1,99,NaN,Infinity,'1000',null,50001])assert.throws(()=>braceSpacing(value));
  assert.equal(braceSpacing(0),0);assert.equal(braceSpacing(1000),1000);
  assert.throws(()=>braceOffsetsMm(50,100),/200/);
  const p=project();p.frames=Array.from({length:8},(_,i)=>({...frame(),id:String(i),height:20.1,braceSpacingMm:100}));
  assert.throws(()=>validateProject(p),/1500/);
});
