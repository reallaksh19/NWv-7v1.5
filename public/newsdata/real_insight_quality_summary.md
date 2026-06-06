# Real Insight Snapshot Quality

- Status: **PASS**
- Reason: -
- Grade: `C`
- Parents: `10`
- Average angles: `1.6`
- Average temporal tiers: `1.5`
- Average evolution roles: `1.8`
- Base report share: `0.09523809523809523`
- Multi-angle parents: `6`
- Weak parents: `0`
- Story count: `694`
- Source groups: `11`
- Content hash: `d2bdf603e76bda5a`

## Top parents

| # | Headline | Children | Angles | Weak | Score |
|---:|---|---:|---|---|---:|
| 1 | Maharashtra government acquires Mumbai’s iconic Air India building in ₹1,601 crore deal | 3 | fact_update, regional_followup | NO | 0.7367143876382675 |
| 2 | With No National Security Experience, Bill Pulte To Replace Tulsi Gabbard | 2 | base_report, official_response | NO | 0.7199133864516649 |
| 3 | Karnataka’s new Deputy CM was once an athlete, then a scientist | 2 | regional_followup, official_response | NO | 0.6581766666666666 |
| 4 | CBSE re-evaluation portal goes live after delays; students report glitches | 2 | official_response, market_reaction | NO | 0.6632467197849983 |
| 5 | Ukrainian drones hit St Petersburg as Putin's flagship economic forum opens | 2 | base_report, regional_followup | NO | 0.5492732802150018 |
| 6 | U.S. President Trump confirms he called Netanyahu ‘crazy’ in phone call | 2 | regional_followup, official_response | NO | 0.5285933333333332 |
| 7 | CJI administers oath of office to five new Supreme Court judges; strength rises to 37 | 2 | official_response | NO | 0.6971633864516651 |
| 8 | Over two lakh applicants paid $100,000 for H-1B visas: DHS Secretary Mullin | 2 | fact_update | NO | 0.6965633864516649 |
| 9 | DK Shivakumar to take oath as Karnataka CM; Dalit leader G Parameshwara the next DCM | 2 | regional_followup | NO | 0.6814967197849984 |
| 10 | 'Singam' K Annamalai: BJP's Tamil Nadu Star Rose Fast, Fell Faster | 2 | market_reaction | NO | 0.6701467197849983 |

## Real Snapshot Ratchet Gate

- Status: **FAIL**
- Gate version: `real-insight-snapshot-ratchet-v1`
- Grade: `C`
- Score: `76`
- Parents: `10`
- Average angles: `1.6`
- Average temporal tiers: `1.5`
- Average evolution roles: `1.8`
- Base report share: `0.095`
- Multi-angle parents: `6`
- Top parent angles: `2`
- Top parent children: `3`

### Failed gates

- **Average temporal tier count** — actual `1.5`, required `>= 1.8`. Fix: C+E output should cover multiple event-time tiers, not only source buckets.

### Passed gates

- Real snapshot grade floor: `C` / `A/B/C`
- Parent cluster count: `10` / `>= 3`
- Average visible angle count: `1.6` / `>= 1.4`
- Average evolution role count: `1.8` / `>= 1.6`
- Base report share: `0.095` / `<= 0.55`
- Multi-angle parent count: `6` / `>= 1`
- Top parent angle count: `2` / `>= 2`
- Top parent child depth: `3` / `>= 2`
- Weak parent ratio: `0` / `<= 0.5`
