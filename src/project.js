// Project format is deliberately independent of Three.js and the DOM.
export const HOLLOW = 0.04;
export const MAX_FRAMES = 300;
export const LIMIT_POSITION = 500;
export const DEFAULT_SETTINGS = Object.freeze({snap:false, positionStep:0.1, rotationStep:15, grid:true, dimensions:true, space:'world'});
export const POSITION_STEPS = [0.01, 0.05, 0.1, 0.25, 0.5, 1];
export const ROTATION_STEPS = [5, 15, 45, 90];
export function uid() { return globalThis.crypto?.randomUUID?.() ?? `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }
export function numeric(value, min, max, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} harus antara ${min} dan ${max}.`);
  return value;
}
export function dimension(value, label='Dimensi') { return numeric(value, 0.1, 50, `${label} (meter)`); }
export function normalizeDegrees(value) { return ((value + 180) % 360 + 360) % 360 - 180; }
export function snapValue(value, step) { return Math.round(value / step) * step; }
export function validateFrame(frame, index=0) {
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) throw new Error(`Data frame ${index+1} tidak valid.`);
  const triplet = (value, bound, label) => {
    if (!Array.isArray(value) || value.length !== 3) throw new Error(`${label} frame ${index+1} harus berisi X, Y, Z.`);
    return value.map(n => numeric(n, -bound, bound, label));
  };
  const name = typeof frame.name === 'string' ? frame.name.trim().slice(0,60) : '';
  return {
    id: typeof frame.id === 'string' && frame.id.length > 0 && frame.id.length < 100 ? frame.id : uid(),
    name: name || `Frame ${String(index+1).padStart(2,'0')}`,
    width:dimension(frame.width, 'Lebar'), height:dimension(frame.height, 'Tinggi'),
    position:triplet(frame.position, LIMIT_POSITION, 'Posisi'),
    rotation:triplet(frame.rotation, 36000, 'Rotasi').map(normalizeDegrees),
  };
}
export function validateProject(data) {
  if (!data || typeof data !== 'object' || data.app !== 'led-rental-frame-builder' || data.version !== 1 || data.units !== 'meters') throw new Error('Format proyek tidak didukung. Pilih JSON dari LED Rental Frame Builder versi 1.');
  if (data.hollow?.width !== HOLLOW || data.hollow?.height !== HOLLOW) throw new Error('Proyek harus memakai profil hollow tetap 40 × 40 mm.');
  if (!Array.isArray(data.frames) || data.frames.length > MAX_FRAMES) throw new Error(`Proyek maksimal ${MAX_FRAMES} frame.`);
  const frames = data.frames.map(validateFrame);
  if (new Set(frames.map(f => f.id)).size !== frames.length) throw new Error('ID frame di proyek tidak boleh duplikat.');
  const s = data.settings || {};
  const settings = {
    snap:typeof s.snap === 'boolean' ? s.snap : false,
    positionStep:POSITION_STEPS.includes(s.positionStep) ? s.positionStep : 0.1,
    rotationStep:ROTATION_STEPS.includes(s.rotationStep) ? s.rotationStep : 15,
    grid:typeof s.grid === 'boolean' ? s.grid : true,
    dimensions:typeof s.dimensions === 'boolean' ? s.dimensions : true,
    space:s.space === 'local' ? 'local' : 'world',
  };
  let camera = null;
  const c = data.camera;
  if (c && ['iso','front','back','left','right','top','custom'].includes(c.view) && ['perspective','orthographic'].includes(c.type)) {
    const vector = v => Array.isArray(v) && v.length===3 && v.every(n => typeof n==='number' && Number.isFinite(n) && Math.abs(n)<=10000);
    if (vector(c.position) && vector(c.target) && vector(c.up) && Math.hypot(...c.up)>0.5 && Math.hypot(...c.up)<1.5 && Math.hypot(...c.position.map((v,i)=>v-c.target[i]))>0.01 && typeof c.span==='number' && c.span>=0.1 && c.span<=5000) camera = {view:c.view, type:c.type, position:[...c.position], target:[...c.target], up:[...c.up], span:c.span};
  }
  return {frames, settings, camera};
}
export function makeProject(frames, settings, camera) {
  return {app:'led-rental-frame-builder', version:1, units:'meters', hollow:{width:HOLLOW,height:HOLLOW}, frames, settings:{...settings}, camera};
}
