import test from 'node:test';
import assert from 'node:assert/strict';
import {bahrainDate,formatDate,formatMoney,requireBahrainWorkspace,DEMO_STORAGE_KEY} from './locale.js';
import {blankState,demoState} from './finance.js';

test('Bahrain civil date crosses midnight and month boundary at UTC+3',()=>{
 assert.equal(bahrainDate(new Date('2026-10-31T20:59:59Z')),'2026-10-31');
 assert.equal(bahrainDate(new Date('2026-10-31T21:00:00Z')),'2026-11-01');
 assert.equal(formatDate('2026-10-15'),'15 Oct');
});
test('all workspaces use BHD and money always includes three decimal places',()=>{
 assert.equal(blankState().currency,'BHD');assert.equal(demoState().currency,'BHD');
 assert.match(formatMoney(0.001),/BHD\s*0\.001/);
 assert.match(formatMoney(1250.5),/BHD\s*1,250\.500/);
 assert.match(formatMoney(-0.001),/0\.001/);
 assert.notEqual(DEMO_STORAGE_KEY,'northline-demo');
 assert.throws(()=>requireBahrainWorkspace({...blankState(),currency:'USD'}),/preserved/);
});
