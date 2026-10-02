import test from 'node:test';
import assert from 'node:assert/strict';
import G from './holodeck-ground.js';
import { mapOrigin } from './holodeck-map.js';
const c = {text:'No objection was raised'};
const p = {question:'Were objections recorded?',workspace:'Council',sources:[{id:'minutes',title:'June minutes'}],frame:'minutes'};
test('a failed source search and legacy author verdict cannot declare ownership',()=>{
  assert.equal(G.declaration({...c,g:{verdict:'author'}}),null);
});
test('explicit ownership survives exactly the words declared; editing invalidates it',()=>{
  const declaration=G.declare(c,'analysis','Mara','My interpretation',p);
  assert.ok(G.declaration({...c,declaration}));
  assert.equal(G.declaration({...c,text:'Nobody ever objected',declaration}),null);
  p.sources.push({id:'later'});
  assert.equal(declaration.position.sources.length,1);
});
test('absence needs an owner, documented search, corpus and question',()=>{
  for(const [giver,note,position] of [['','searched June minutes',p],['Mara','',p],['Mara','searched June minutes',{sources:[]}],['Mara','searched June minutes',{sources:[{id:'a'}],question:''}]]) {
    assert.equal(G.declaration({...c,declaration:G.declare(c,'absence',giver,note,position)}),null);
  }
  const d=G.declare(c,'absence','Mara','Searched objection in June 2026 minutes',p);
  assert.ok(G.declaration({...c,declaration:d}));
  assert.match(G.summary(d),/June minutes/);
});
test('automatic center is explained and selecting another center wins',()=>{
  const adj=new Map([['A',new Set(['B','C'])],['B',new Set(['A'])],['C',new Set(['A'])]]);
  assert.equal(mapOrigin(['B','A','C'],adj,null).name,'A');
  assert.match(mapOrigin(['B','A','C'],adj,null).reason,/most visible/);
  assert.equal(mapOrigin(['B','A','C'],adj,'B').name,'B');
  assert.match(mapOrigin(['B'],new Map(),null).reason,/no connections/);
});
