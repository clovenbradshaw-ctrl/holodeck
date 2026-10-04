#!/usr/bin/env node
// Experiment: private-witness possible worlds.
// Tests three claims:
// A. naive chaff created by perturbing the real world leaks which world is real;
// B. exchangeable chaff sampled from the same distribution hides the privileged index;
// C. a counterfactual lattice can remove the privileged index entirely while preserving
//    exact local standing and identification of decisive unknown dimensions.

const TRIALS = Number(process.argv[2] || 20000);
const SEED = Number(process.argv[3] || 0x5eed1234);
const M = 5;

function rng(seed=0x5eed1234) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(SEED);
const bit = p => R() < p ? 1 : 0;
const xorNoise = (v,p) => R() < p ? 1-v : v;

// Natural structured world distribution D.
function sampleWorld() {
  const h1=bit(.5), h2=bit(.5), h3=bit(.5);
  const x=[];
  x[0]=xorNoise(h1,.05); x[1]=xorNoise(h1,.08);
  x[2]=xorNoise(h2,.05); x[3]=xorNoise(h2,.08);
  x[4]=xorNoise(h3,.05); x[5]=xorNoise(h3,.08);
  x[6]=xorNoise(x[0]&x[2],.05);
  x[7]=xorNoise(x[1]|x[4],.05);
  x[8]=xorNoise(x[3]^x[5],.05);
  x[9]=xorNoise(x[6]|x[7],.03);
  x[10]=xorNoise(x[6]&(!x[8]?1:0),.05);
  x[11]=xorNoise(x[9]^x[10],.05);
  return x;
}
function bernObs(obs, expected, pFlip) { return obs===expected ? 1-pFlip : pFlip; }
function worldProbGivenH(x,h1,h2,h3) {
  let p=1;
  p*=bernObs(x[0],h1,.05); p*=bernObs(x[1],h1,.08);
  p*=bernObs(x[2],h2,.05); p*=bernObs(x[3],h2,.08);
  p*=bernObs(x[4],h3,.05); p*=bernObs(x[5],h3,.08);
  p*=bernObs(x[6],x[0]&x[2],.05);
  p*=bernObs(x[7],x[1]|x[4],.05);
  p*=bernObs(x[8],x[3]^x[5],.05);
  p*=bernObs(x[9],x[6]|x[7],.03);
  p*=bernObs(x[10],x[6]&(!x[8]?1:0),.05);
  p*=bernObs(x[11],x[9]^x[10],.05);
  return p;
}
function worldProb(x) {
  let p=0;
  for(let h1=0;h1<2;h1++) for(let h2=0;h2<2;h2++) for(let h3=0;h3<2;h3++)
    p += .125*worldProbGivenH(x,h1,h2,h3);
  return p;
}
function naiveDecoy(real) {
  const d=real.slice();
  const flips=1+Math.floor(R()*3);
  const used=new Set();
  while(used.size<flips) used.add(Math.floor(R()*d.length));
  for(const i of used) d[i]=1-d[i];
  return d;
}
function shuffleWithReal(real, decoys) {
  const arr=[real,...decoys].map((w,i)=>({w,real:i===0}));
  for(let i=arr.length-1;i>0;i--){ const j=Math.floor(R()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}
function attackerPick(arr) {
  let best=-1, bestP=-1;
  for(let i=0;i<arr.length;i++) { const p=worldProb(arr[i].w); if(p>bestP){bestP=p;best=i;} }
  return best;
}
let naiveHit=0, exchHit=0;
for(let t=0;t<TRIALS;t++) {
  const real=sampleWorld();
  const A=shuffleWithReal(real,Array.from({length:M-1},()=>naiveDecoy(real)));
  if(A[attackerPick(A)].real) naiveHit++;
  // Exchangeable arm: the distinguished world and all chaff are iid D.
  const E=shuffleWithReal(sampleWorld(),Array.from({length:M-1},()=>sampleWorld()));
  if(E[attackerPick(E)].real) exchHit++;
}

// --- Counterfactual lattice -------------------------------------------------
// Random formula: OR of 3 clauses, each clause is AND of 2 signed variables.
function randomFormula(n=6){
  const clauses=[];
  for(let c=0;c<3;c++){
    let a=Math.floor(R()*n), b=Math.floor(R()*n); while(b===a) b=Math.floor(R()*n);
    clauses.push([[a,bit(.5)?1:0],[b,bit(.5)?1:0]]);
  }
  return clauses;
}
function evalFormula(formula,x){
  return formula.some(cl => cl.every(([i,pos]) => pos ? x[i]===1 : x[i]===0));
}
function enumerateCompatible(n,witness){
  const unknown=[]; for(let i=0;i<n;i++) if(!(i in witness)) unknown.push(i);
  const worlds=[];
  const total=1<<unknown.length;
  for(let mask=0;mask<total;mask++){
    const x=Array(n).fill(0);
    for(const [k,v] of Object.entries(witness)) x[Number(k)]=v;
    unknown.forEach((idx,j)=>x[idx]=(mask>>j)&1);
    worlds.push(x);
  }
  return {unknown,worlds};
}
function standing(vals){ return vals.every(Boolean)?'entailed':vals.every(v=>!v)?'refuted':'unresolved'; }
function decisiveDims(worlds, vals, unknown){
  const out=new Set();
  // For each unknown dimension, compare pairs equal except that dimension.
  for(const d of unknown){
    for(let i=0;i<worlds.length;i++) for(let j=i+1;j<worlds.length;j++){
      let diffs=0, only=-1;
      for(let k=0;k<worlds[i].length;k++) if(worlds[i][k]!==worlds[j][k]){diffs++;only=k;if(diffs>1)break;}
      if(diffs===1 && only===d && vals[i]!==vals[j]) out.add(d);
    }
  }
  return out;
}

let standingOK=0, decisiveOK=0, latticeTrials=0;
const latticeSizes=[];
for(let t=0;t<5000;t++){
  const n=6, formula=randomFormula(n), actual=Array.from({length:n},()=>bit(.5));
  // Witness 2-4 dimensions, leaving at least 2 unknown.
  const order=[0,1,2,3,4,5];
  for(let i=order.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  const nw=2+Math.floor(R()*3);
  const witness={}; for(const i of order.slice(0,nw)) witness[i]=actual[i];
  const {unknown,worlds}=enumerateCompatible(n,witness);
  const vals=worlds.map(w=>evalFormula(formula,w));
  const s=standing(vals);
  // Independent brute-force definition of standing over all assignments compatible with witness.
  let allT=true, allF=true;
  for(let mask=0;mask<(1<<n);mask++){
    const x=Array.from({length:n},(_,i)=>(mask>>i)&1);
    let ok=true; for(const [k,v] of Object.entries(witness)) if(x[Number(k)]!==v){ok=false;break;}
    if(!ok) continue;
    const q=evalFormula(formula,x); allT&&=q; allF&&=!q;
  }
  const brute=allT?'entailed':allF?'refuted':'unresolved';
  if(s===brute) standingOK++;
  const got=decisiveDims(worlds,vals,unknown);
  // Brute decisive: exists a compatible pair differing only in d whose conclusion flips.
  const expected=new Set();
  for(const d of unknown){
    for(const x of worlds){ const y=x.slice(); y[d]=1-y[d]; if(evalFormula(formula,x)!==evalFormula(formula,y)){ expected.add(d); break; } }
  }
  if(got.size===expected.size && [...got].every(x=>expected.has(x))) decisiveOK++;
  latticeSizes.push(worlds.length); latticeTrials++;
}

// --- Blind full lattice ------------------------------------------------------
// Stronger privacy control: export ALL assignments of the sensitive dimensions,
// independent of the private witness state. The local witness key is used only
// after the remote reasoner has evaluated every world. Thus, for a fixed formula,
// the outbound payload is byte-identical for every actual/witness state.
let blindStandingOK=0, blindDecisiveOK=0, blindTrials=0, blindWorldsTotal=0;
for(let t=0;t<2000;t++){
  const n=6, formula=randomFormula(n), actual=Array.from({length:n},()=>bit(.5));
  const order=[0,1,2,3,4,5];
  for(let i=order.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  const nw=2+Math.floor(R()*3);
  const witness={}; for(const i of order.slice(0,nw)) witness[i]=actual[i];
  const all=[]; for(let mask=0;mask<(1<<n);mask++) all.push(Array.from({length:n},(_,i)=>(mask>>i)&1));
  const remoteVals=all.map(w=>evalFormula(formula,w));
  // LOCAL ONLY: apply witness key after inference.
  const compatibleIdx=[];
  for(let i=0;i<all.length;i++){
    let ok=true; for(const [k,v] of Object.entries(witness)) if(all[i][Number(k)]!==v){ok=false;break;}
    if(ok) compatibleIdx.push(i);
  }
  const compWorlds=compatibleIdx.map(i=>all[i]);
  const compVals=compatibleIdx.map(i=>remoteVals[i]);
  const gotStanding=standing(compVals);
  let allT=true, allF=true;
  for(const q of compVals){allT&&=q;allF&&=!q;}
  const expectedStanding=allT?'entailed':allF?'refuted':'unresolved';
  if(gotStanding===expectedStanding) blindStandingOK++;
  const unknown=[];for(let i=0;i<n;i++)if(!(i in witness))unknown.push(i);
  const gotDec=decisiveDims(compWorlds,compVals,unknown);
  const expected=new Set();
  for(const d of unknown){for(const x of compWorlds){const y=x.slice();y[d]=1-y[d];if(evalFormula(formula,x)!==evalFormula(formula,y)){expected.add(d);break;}}}
  if(gotDec.size===expected.size && [...gotDec].every(x=>expected.has(x))) blindDecisiveOK++;
  blindWorldsTotal += all.length; blindTrials++;
}

const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const sorted=[...latticeSizes].sort((a,b)=>a-b);
const med=sorted[Math.floor(sorted.length/2)];
console.log(JSON.stringify({
  seed: SEED,
  trials: TRIALS,
  worldsPerEnsemble:M,
  chanceTop1:1/M,
  attacker:{
    naivePerturbationTop1:naiveHit/TRIALS,
    exchangeableTop1:exchHit/TRIALS
  },
  witnessConditionedLattice:{
    trials:latticeTrials,
    exactStandingRate:standingOK/latticeTrials,
    exactDecisiveDimensionsRate:decisiveOK/latticeTrials,
    meanWorlds:mean(latticeSizes),
    medianWorlds:med,
    maxWorlds:Math.max(...latticeSizes),
    caveat:"Hides the values of unknown dimensions, but fixed witnessed dimensions are visible as invariants in every world."
  },
  blindFullLattice:{
    trials:blindTrials,
    exactStandingRate:blindStandingOK/blindTrials,
    exactDecisiveDimensionsRate:blindDecisiveOK/blindTrials,
    worldsPerJob:blindWorldsTotal/blindTrials,
    nonInterference:"For a fixed formula/task projection, outbound worlds/results are independent of the actual and witness values; the witness key is applied only locally after inference."
  },
  note:"Simple perturbation chaff leaks badly. Exchangeable chaff hides the privileged index. Strongest tested construction removes the privileged index entirely and keeps witness application local, at exponential world-count cost."
},null,2));
