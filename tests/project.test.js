import test from 'node:test';
import assert from 'node:assert/strict';
import {HOLLOW, LED_DEPTH, LED_BEZEL, MAX_FRAMES, DEFAULT_SETTINGS, dimension, braceSpacing, braceOffsetsMm, frameMembers, ledMembers, objectMembers, objectSummary, frameSummary, normalizeDegrees, snapValue, validateProject, makeProject} from '../src/project.js';

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

test('export preserves per-object spacing and a different Add Frame template across real JSON serialization',()=>{
  const frames=[{...frame(),braceSpacingMm:500},{...frame(),id:'second',braceSpacingMm:1000}];
  const template={width:2,height:3,braceSpacingMm:750};
  const serialized=JSON.stringify(makeProject(frames,DEFAULT_SETTINGS,null,template));
  const parsed=validateProject(JSON.parse(serialized));
  assert.deepEqual(parsed.frames.map(f=>f.braceSpacingMm),[500,1000]);
  assert.deepEqual(parsed.frameTemplate,template);
  assert.deepEqual(parsed.frames.map(f=>braceOffsetsMm(f.height,f.braceSpacingMm).length),[3,1]);
});
test('old JSON restores Add Frame from the first frame when the template was not saved',()=>{
  const p=project();delete p.frameTemplate;p.frames[0].braceSpacingMm=1000;
  assert.deepEqual(validateProject(p).frameTemplate,{width:1,height:2,braceSpacingMm:1000});
});
test('counts 20 frames of 2x2 and 10 of 2x1, independent of orientation, rotation and brace spacing',()=>{
  const frames=[...Array.from({length:20},(_,i)=>({...frame(),id:`square-${i}`,width:2,height:2,braceSpacingMm:i%2?1000:0})),...Array.from({length:10},(_,i)=>({...frame(),id:`rectangle-${i}`,width:i%2?1:2,height:i%2?2:1}))];
  assert.deepEqual(frameSummary(frames),{total:30,bySize:[{width:2,height:2,quantity:20},{width:2,height:1,quantity:10}]});
  const data=makeProject(frames,DEFAULT_SETTINGS,null);assert.deepEqual(data.summary,frameSummary(frames));
  data.summary.total=999;assert.equal(frameSummary(validateProject(data).frames).total,30);
});
test('counts respond to duplicate, deletion, resize and an empty scene',()=>{
  const frames=[frame()];frames.push({...frame(),id:'copy'});assert.equal(frameSummary(frames).bySize[0].quantity,2);
  frames[1].width=2;assert.equal(frameSummary(frames).bySize.length,2);
  frames.pop();assert.equal(frameSummary(frames).total,1);
  assert.deepEqual(frameSummary([]),{total:0,bySize:[]});
});

test('old v1.2 files without object types open as frames with inferred shapes',()=>{
  const legacy=project();delete legacy.frames[0].type;delete legacy.frames[0].shape;
  delete legacy.ledTemplate;delete legacy.palette;
  const p=validateProject(legacy);
  assert.equal(p.frames[0].type,'frame');assert.equal(p.frames[0].shape,'rectangle');
  assert.deepEqual(p.ledTemplate,{width:1,height:.5});assert.deepEqual(p.palette,{type:'frame',shape:'rectangle'});
});

test('square and rectangular frames preserve their shapes without changing perimeter geometry',()=>{
  const p=project();p.frames=[{...frame(),type:'frame',shape:'square',width:2,height:2},{...frame(),id:'rectangle',type:'frame',shape:'rectangle',width:3,height:1}];
  const parsed=validateProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(parsed.frames.map(f=>f.shape),['square','rectangle']);
  assert.equal(objectMembers(parsed.frames[0]).length,4);assert.equal(objectMembers(parsed.frames[1]).length,4);
  p.frames[0].height=1;assert.throws(()=>validateProject(p),/kotak/);
});

test('hollow straight member keeps a fixed 40 x 40 section and custom length',()=>{
  const hollow={...frame(),type:'hollow',width:HOLLOW,height:3.25};
  assert.deepEqual(objectMembers(hollow),[{size:[.04,3.25,.04],position:[0,0,0]}]);
  const parsed=validateProject(makeProject([hollow],DEFAULT_SETTINGS,null));
  assert.equal(parsed.frames[0].width,HOLLOW);assert.equal(parsed.frames[0].height,3.25);
  assert.deepEqual(parsed.frameTemplate,{width:1,height:2,braceSpacingMm:0});
  for(const change of [{width:.05},{braceSpacingMm:1000},{height:.09}])assert.throws(()=>makeProject([{...hollow,...change}],DEFAULT_SETTINGS,null));
});

test('LED presets and custom sizes have exact outside bounds and 2 mm bezels',()=>{
  for(const [width,height] of [[1,.5],[.5,.5],[1.28,.72],[.1,.1],[50,50]]){
    const [body,...screens]=ledMembers(width,height);
    assert.deepEqual(body.size,[width,height,LED_DEPTH]);assert.equal(screens.length,2);
    for(const screen of screens){
      assert.ok(Math.abs((width-screen.size[0])/2-LED_BEZEL)<1e-12);
      assert.ok(Math.abs((height-screen.size[1])/2-LED_BEZEL)<1e-12);
      assert.equal(Math.abs(screen.position[2]),LED_DEPTH/2+.0005);
    }
  }
  assert.throws(()=>ledMembers(.05,.5));assert.throws(()=>ledMembers(1,NaN));
});

test('two adjacent LED cabinets each retain a bezel at their shared boundary',()=>{
  const width=1,height=.5;
  const screen=ledMembers(width,height)[1];
  const firstRight=screen.size[0]/2,secondLeft=width-screen.size[0]/2;
  assert.ok(Math.abs(secondLeft-firstRight-2*LED_BEZEL)<1e-12);
});

test('mixed objects round trip types, dimensions, transforms, custom LED template and palette',()=>{
  const objects=[{...frame(),type:'frame',shape:'rectangle',braceSpacingMm:1000},{...frame(),id:'tube',type:'hollow',width:HOLLOW,height:2.5},{...frame(),id:'screen',type:'led',width:1.28,height:.72,position:[2,.36,.1],rotation:[0,45,0]}];
  const source=makeProject(objects,DEFAULT_SETTINGS,null,{width:2,height:3,braceSpacingMm:750},{width:1.28,height:.72},{type:'led',shape:'hollow'});
  const parsed=validateProject(JSON.parse(JSON.stringify(source)));
  assert.deepEqual(parsed.frames,source.frames);assert.deepEqual(parsed.ledTemplate,{width:1.28,height:.72});
  assert.deepEqual(parsed.palette,{type:'led',shape:'hollow'});assert.equal(source.summary.total,1);assert.equal(source.objectsSummary.total,3);
});

test('material summary separates equal-size frames and screens and counts hollow lengths',()=>{
  const objects=[frame(),{...frame(),id:'led',type:'led'},{...frame(),id:'tube',type:'hollow',width:HOLLOW},{...frame(),id:'copy',type:'led',width:2,height:1}];
  const summary=objectSummary(objects);
  assert.equal(summary.total,4);assert.equal(summary.bySize.length,3);
  assert.equal(summary.bySize.find(x=>x.type==='led').quantity,2);
  assert.deepEqual(frameSummary(objects),frameSummary([frame()]));
  assert.equal(objectSummary(objects.slice(0,-1)).bySize.find(x=>x.type==='led').quantity,1);
});

test('invalid object types, screen braces and LED templates are rejected before import',()=>{
  for(const change of [{type:'unsupported'},{type:'led',braceSpacingMm:500},{type:'led',width:0},{type:'frame',shape:'triangle'}]){
    const p=project();Object.assign(p.frames[0],change);assert.throws(()=>validateProject(p));
  }
  for(const value of [null,[],{width:0,height:.5},{width:1,height:'500'},{width:Infinity,height:.5}]){
    const p=project();p.ledTemplate=value;assert.throws(()=>validateProject(p));
  }
});
