# Domain glossary

Shared vocabulary for OneStop. Terms are defined here; field-level types live in
[docs/CONTRACTS.md](docs/CONTRACTS.md), product direction in [PROJECT.md](PROJECT.md).

This file is a glossary only. No implementation detail, no schema, no code.

## Core dial

One of the deterministic requirements the renter sets directly: personal rent cap, rent
allocation, bedrooms, minimum bathrooms, property types, maximum walking time, required
included utilities, must-have amenities. Every core dial is evaluated by reproducible
arithmetic against a sourced fact. A core dial can only be satisfied by evidence; an
unknown never passes. See also **Niche query**, which is not a core dial.

## Core miss

A home that fails at least one core dial. A core miss is a fact about the home, not a
judgement about its worth — the product deliberately keeps core misses visible rather
than discarding them. Distinct from a home whose core dials are merely **unknown**.

## Core closeness

How near a **core miss** is to satisfying the renter's stated requirements. Compares the
number of failed core dials first, then the size of each overage relative to what was
asked for. Used to order homes inside the **niche group**. Core closeness is computed,
never estimated, and never supplied by a model.

## Mitigation

A reason a **core miss** may be tolerable to this renter — a bus route that serves the
destination despite a long walk, an included utility that offsets rent. A mitigation is
presented alongside the miss and never removes it: the failed dial stays failed, the home
stays a core miss, and the overage stays visible. A mitigation changes what the renter
understands, not what the requirement said.

## Niche group

The highlighted set shown above the ordinary results: every home whose **niche verdict**
is a match, ordered by **core closeness**. It sits on top of the existing result list and
does not replace, reorder, or remove anything below it. A home appearing in the niche
group also remains in its normal position in the list.

## Niche query

A requirement the renter expresses in plain language that no **core dial** can express —
"close to a Chinese supermarket", "far from a railroad". Open-ended by design. A niche
query never overrides, relaxes, or silently satisfies a core dial; it selects and
highlights, it does not requalify.

## Niche verdict

The per-home answer to a **niche query**: whether the home matches, why, and which
**provenance tier** the answer rests on. A niche verdict is a property of the home and the
query together, so it survives changes to the core dials. It is never merged into the
home's core evaluation and can never change whether a home meets the stated requirements.

## Provenance tier

What a **niche verdict** rests on, in descending order of verifiability:

- **Listing data** — a fact already recorded in the snapshot, with its source and
  observation date.
- **Model assessment** — the model's own judgement, carrying no source and no
  observation date. Labelled as such wherever it is shown.

A niche verdict always declares its tier. The two are never presented as equivalent, and
a model assessment is never described as a measurement. Distinct from the evidence states
used for sourced facts, which a niche verdict does not enter.
