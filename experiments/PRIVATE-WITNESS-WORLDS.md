# Private Witness Worlds — first falsification experiment

Branch experiment testing whether the Fold can outsource reasoning over possible worlds while keeping the correspondence to witnessed reality local.

## Hypotheses

1. Naive chaff made by perturbing the real world will leak which member is real.
2. Exchangeable chaff sampled from the same distribution will make the privileged index hard to distinguish.
3. A counterfactual lattice can remove the privileged index entirely: remote computation evaluates all worlds, and the local Fold applies the private witness key afterward.
4. If the outbound lattice is conditioned on witnessed values, those invariant values leak structurally.
5. A full blind lattice can eliminate that witness-value leakage at an exponential world-count cost.

## Attack model

The synthetic world distribution has 12 correlated Boolean observations generated from three latent variables plus noisy derived relations.

The attacker is intentionally strong: it knows the true generative distribution and scores every exported world by exact likelihood. It then chooses the most likely world as the real one.

Each chaff ensemble contains five worlds, so chance top-1 identification is 20%.

## Results

Main run: 50,000 ensembles, seed 1592594996.

| Arm | Attacker top-1 |
| --- | ---: |
| Naive perturbations of the real world | 88.23% |
| Exchangeable worlds | 20.306% |
| Chance | 20% |

Stability check over 10 seeds x 20,000 ensembles:

| Arm | Mean | SD | Min | Max |
| --- | ---: | ---: | ---: | ---: |
| Naive perturbations | 88.293% | 0.188% | 88.105% | 88.635% |
| Exchangeable worlds | 20.021% | 0.159% | 19.710% | 20.290% |

The control falsifies naive "make several nearby fake worlds" chaff. A knowledgeable attacker identifies the real member almost nine times out of ten.

Exchangeability survives this attack: likelihood gives essentially no information about which member was privileged.

## Counterfactual-lattice utility

The utility assay generates random Boolean reasoning problems and asks whether a conclusion is entailed, refuted, or unresolved over worlds compatible with local evidence. It also asks which unknown dimensions are actually decisive: dimensions whose change can flip the conclusion.

### Witness-conditioned lattice

5,000 trials:

- exact standing: 100%
- exact decisive-dimension recovery: 100%
- mean worlds: 9.3064
- median worlds: 8
- maximum worlds: 16

But this construction leaks the values held fixed across every world. It protects the unknown dimensions, not the full witness key.

### Blind full lattice

The stronger construction exports every assignment of six sensitive Boolean dimensions. Nothing about the private witness state is used to construct the outbound set. Remote reasoning evaluates every world; only afterward does the local Fold apply the witness key and select the compatible results.

2,000 trials:

- exact standing after local witness intersection: 100%
- exact decisive-dimension recovery: 100%
- outbound worlds per job: 64

For a fixed task/formula, the outbound world set and remote result table are identical for every possible actual/witness value. This is a genuine non-interference property with respect to the private witness values in this toy model: there is no privileged remote world to identify.

## What survived

The interesting architecture is not "hide the true world among plausible fakes."

It is:

1. export a witness-independent counterfactual space;
2. let an untrusted reasoner compute conditional consequences over that space;
3. keep the correspondence between those worlds and witnessed experience local;
4. locally intersect remote results with the witness key;
5. use changes across worlds to identify which still-unknown observations would actually matter.

The remote reasoner determines conditional structure. It does not determine which conditions obtain.

## What failed / remains open

- Naive neighboring chaff leaks badly.
- A witness-conditioned ensemble reveals its invariant constraints.
- Full lattices grow as 2^k for k Boolean dimensions. Six dimensions cost 64 worlds; 12 cost 4,096; 20 cost 1,048,576. This is the immediate scaling problem.
- This first assay uses an exact Boolean evaluator as the remote-reasoner control. It does NOT yet establish that a small/open/frontier LLM can reliably reason over the opaque world representation.
- Predicate/formula structure itself is still disclosed. The assay protects the private witness assignment, not every semantic fact.
- Auxiliary information, cross-request correlation, provider logging, and adaptive oracle attacks are not exercised here.

## Next experiment

Replace the exact evaluator with the same world packets sent to:

1. tiny local WebLLM/Ollama;
2. medium local model;
3. open hosted model;
4. frontier model.

For each measure:

- per-world reasoning accuracy;
- decisive-variable recovery;
- sensitivity to opaque predicate names;
- token cost;
- batching/compression;
- whether any model tries to infer a privileged world when none exists.

Then test reductions of the 2^k lattice:

- covering arrays;
- BDD/SAT-derived boundary worlds;
- pairwise counterfactuals;
- adaptive world generation;
- compositional shard sets.

The pass condition is not simply fewer worlds. A reduced set must preserve standing and decisive-variable recovery while keeping the outbound set independent of the private witness values.
