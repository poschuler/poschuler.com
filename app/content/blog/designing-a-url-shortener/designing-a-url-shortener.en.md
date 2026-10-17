---
type: 'post'
title: 'Designing a URL shortener'
description: 'System design of a URL shortener: how to generate unique codes nobody can guess, how many characters to use, and how to scale the reads.'
tags: ['system-design', 'software-architecture', 'backend']
publishedAt: '2026-10-16'
repository: 'https://github.com/poschuler/url-shortener/tree/v1.0.0'
draft: true
---

We design a URL shortener and go through the decisions that matter: how to generate the code, how many characters to use and which ones, and how to handle scale. Grab the code for an implementation in Node.js and TypeScript, built with hexagonal architecture, from the [repository](https://github.com/poschuler/url-shortener/tree/v1.0.0).

## 1. Requirements and estimates

### Functional requirements

- An unauthenticated user can create a short link from a target URL.
- A visitor can follow the short link and be redirected to the target URL.

### Non-functional requirements

- **A read:write ratio of at least 100:1.** Every link created is expected to be followed around 100 times, which makes the read path the critical one.
- **Availability over consistency.** A link that was just created may be unavailable for a few seconds, for example when it is read from a replica that is behind. A redirect that fails is not acceptable.
- **Redirect latency under 200 ms, measured at the server.** The latency the visitor perceives also depends on the network.
- **Unpredictable codes.** Knowing one link does not let you work out any other.
- **At least 1 billion URLs.**

### Estimates

**Writes per second.** The requirement asks for 1 billion URLs but does not say over how long. We assume 5 years, which is about 158 million seconds (5 × 365 × 86,400):

```text
1 billion URLs ÷ 158 million seconds ≈ 6.3 writes/s
```

That is the average, and traffic does not arrive evenly through the day. We assume the peak is 10 times the average: ~63 writes/s.

**Reads per second.** With a 100:1 ratio, multiply by 100: ~630 reads/s on average and ~6,300/s at peak. That is very little for a database, and Postgres handles the average on its own. So the cache is not there for the volume, but for the 200 ms latency and for the peak.

**Storage.** Each record holds the 7-character code, the target URL and the creation date. A URL can be up to 2,048 characters long, but most are much shorter. Adding what the database spends per row and per index, we round it to ~500 bytes per record:

```text
1 billion × 500 bytes = 500 GB
```

**Cache.** There is no need to keep 500 GB in memory. The 80/20 rule suggests caching 20% of the links, but that is already 100 GB. A better way to size it is to cache only what was visited during the day, with a 24-hour TTL. A day brings ~54 million redirects (630 × 86,400). In the worst case, each one goes to a different link:

```text
54 million × 500 bytes ≈ 27 GB
```

That is a ceiling, not the real figure. A popular link is visited thousands of times but takes up a single entry in the cache.

### Out of scope

- Authentication and link owners.
- Editing, deleting and expiring links: a link is permanent.
- Deduplication: shortening the same URL twice gives two different codes.
- Checking the target URL for abuse (phishing, malware).
- Click analytics.
- Custom codes.

## 2. Data model and API

### Entities

- **Link:** a short code and a target URL.

### The `link` table

| Column       | Type      | Notes                                |
| ------------ | --------- | ------------------------------------ |
| `short_code` | text      | PK, 7 characters from `[0-9a-zA-Z]` |
| `target_url` | text      | Target URL                           |
| `created_at` | timestamp |                                      |

### API

**`POST /links` → `201 Created`**

- Request: `{ "targetUrl": string }`
- Response: `{ "shortCode", "shortUrl", "targetUrl", "createdAt" }`
- `400` if the URL is not valid, `429` if the rate limit is exceeded.

**`GET /{shortCode}` → `302 Found`**, with the header `Location: <targetUrl>`.

- `404` if the code does not exist, `400` if it is not shaped like a code, and `429` if the rate limit is exceeded.

## 3. Deep dives

### 3.1 301 vs 302

- **301 (Moved Permanently):** the browser caches the redirect with no expiry, and later visits never reach the server. There is less load, but you lose for good the ability to disable an abusive link (phishing, malware) or to count clicks.
- **302 (Found):** every visit goes through the server. Disabling links and counting clicks are out of scope, but a 302 lets you add them later without trouble.
- **Decision:** 302, because it is the option you can take back. Moving to a 301 later is easy, but going back to a 302 does nothing for the browsers that already stored the 301. The cache absorbs the extra load and, optionally, a CDN does too.

### 3.2 Generating IDs: why a token range

The alternatives we ruled out:

- **A hash of the URL:** truncated to 7 characters, it collides, and it also gives the same URL the same code, which is exactly the deduplication we left out.
- **UUID or Snowflake:** unique without coordination, but 128 or 64 bits do not fit in 7 base62 characters (~41 bits).
- **Random codes:** every write has to check the database for a collision, and collisions get more likely as the number of records grows.
- **One ID per write from the database:** the simplest option, but it adds a round trip to the database every time a link is created.

Decision: **a token range**.

- A Postgres sequence hands out blocks of 1,000 IDs: each `nextval()` reserves a whole block, and it is atomic across every instance.
- Each instance works through its block in memory. When 20% is left, it asks for the next one in the background, so no write ever waits for the database: the sequence is queried once every 1,000 links.
- **Why not Redis `INCRBY`:** it is atomic and fast, but in this design Redis is only a cache and persists nothing. If it restarts, the counter goes back to zero and hands out IDs that already exist. The counter needs to be as durable as the links, and Postgres already is.
- **Trade-off:** when an instance restarts, the IDs left in its block are lost. That is acceptable because no ID is ever repeated and the space is huge.
- The numeric ID is never exposed as it is: it goes through a permutation and then an encoding.

```text
sequence (blocks of 1,000) → numeric ID → Feistel permutation → base62 → 7-character code
```

### 3.3 Alphabet: why base62

- **Base62:** `[0-9a-zA-Z]`, 62 characters that a URL takes without any encoding. With the 7 characters justified in 3.4, it gives ~3.5 trillion combinations: with 1 billion links, 1 random code in 3,500 exists.
- **Base64:** adds `+` and `/`. The `/` separates path segments, and in some contexts the `+` is read as a space. The URL-safe variant swaps them for `-` and `_`, which work but read worse: in an underlined link, the `_` disappears.
- **Base58:** drops the characters that look alike (`0/O`, `I/l`), which helps when someone copies the code by hand. With 7 characters it gives ~2.2 trillion combinations, which would also be enough. We ruled it out because links are copied and pasted, and base62 gives more space at the same length.
- **Base36:** lowercase letters and digits only, so the code can be read out loud without spelling out capitals. With 7 characters it gives ~78 billion combinations: with 1 billion links, 1 random code in 78 exists. We ruled it out because it would need 8 characters to match the sparseness of base62.
- **Decision:** base62, the largest alphabet a URL accepts without encoding.

### 3.4 Length: why 7 characters

- **6 characters:** 62⁶ ≈ 56.8 billion combinations. Enough for 1 billion URLs, but they would fill 1.8% of the space: 1 random code in 57 exists.
- **7 characters:** as we saw in 3.3, 1 in 3,500.
- **Decision:** 7 characters. The reason is not capacity but **sparseness**: one more character makes guessing a code 60 times more expensive (see 3.5).

### 3.5 Predictability: a Feistel permutation

- **Problem:** if codes are sequential (`0000001`, `0000002`…), anyone can walk every existing link, including the ones nobody shared with them, and find out how many links the service holds along the way.
- **First idea, ruled out:** multiply the ID by a large number P, modulo 62⁷. The codes look random, but two consecutive codes differ by exactly P. Shortening two URLs in a row is enough for an attacker to recover P and walk everything.
- **Solution:** before encoding, the ID goes through a Feistel network with a secret key.

**How a Feistel network works.** It builds a reversible permutation out of a function that is not reversible. The ID is split into two halves, left and right; here, 42 bits split into two halves of 21. Then the same operation, called a round, is repeated several times:

```text
left'  = right
right' = left XOR f(right, round key)
```

`f` is a mixing function: it takes a half and the round key and returns a value that looks random. XOR compares two numbers bit by bit, giving 1 where the bits differ and 0 where they match. For example, 5 XOR 6 is `0101 XOR 0110 = 0011`, which is 3. It has one property that matters here: applying the same XOR twice leaves everything as it was.

**An example with small numbers.** Say the IDs are 8 bits instead of 42, split into two 4-bit halves (0 to 15). We use two rounds, with the keys 3 and 6, and a simple mixing function:

```text
f(x, k) = (x² + k) mod 16
```

We encrypt the ID **5**. In 8 bits it is `0000 0101`, so left = 0 and right = 5:

```text
               left   right
start            0      5
round 1 (k=3)    5      0 XOR f(5, 3)  = 0 XOR 12 = 12
round 2 (k=6)   12      5 XOR f(12, 6) = 5 XOR 6  = 3
```

The two halves are joined back into one number. The left half holds the 4 high bits, so each unit of it is worth 16: 12 × 16 + 3 = **195**.

Doing the same with the next IDs:

```text
ID 5  →  195
ID 6  →  113
ID 7  →   65
```

The IDs go up one at a time, but the results jump around with no visible pattern. With the multiplication from the first idea, they always moved by P.

**Going back.** We start from 195 (12, 3) and run the rounds in reverse. The left half at each step is the right half of the step before, so we know which value `f` was called with:

```text
               left                               right
end              12                                  3
round 2 (k=6)     3 XOR f(12, 6) = 3 XOR 6   = 5    12
round 1 (k=3)    12 XOR f(5, 3)  = 12 XOR 12 = 0     5
```

We are back at (0, 5), which is **5**. This shows why it works: `f` is not reversible, since `f(0, 3)` and `f(4, 3)` both give 3. The network is reversible anyway, because it never needs to invert `f`, only to compute it again. That is why two different IDs never produce the same code, and there is no need to ask the database whether a code is unique.

**Where the key comes in.** Without the keys 3 and 6, nobody can compute `f`, and without `f` there is no way to get from one code to another. In the real design, the secret key is 128 bits long and is split into four round keys, one per round. Four rounds is the usual minimum for no visible pattern to remain between the ID and the code. With a single round, for instance, the right half would move to the left untouched. Seeing two consecutive codes gives nothing away: unlike the multiplication, there is no fixed difference to find.

- **Permutation plus sparseness:** permuting is not enough if the space is nearly full. With the occupancy from 3.4, an attacker needs ~3,500 attempts per hit, and the read rate limit (300 per minute per IP) brings that down to one link every ~12 minutes per IP. This is obfuscation, not access control: whoever has a link can open it.
- **Implementation detail:** 62⁷ is not a power of 2 (≈ 2^41.7). Feistel works on 42 bits, so a result can land outside the range. The fix is *cycle walking*: the permutation is applied again until the result is below 62⁷, about 1.25 times on average.
- **Trade-off:** the key, the mixing function, the number of rounds and the order of the alphabet can never change once links exist. Changing any of them remaps every ID and can produce codes that collide with the ones already stored. And `f` is not cryptographic: HMAC-SHA256 was ruled out because it defends against an attacker this project does not expect.

## 4. Scalability

- **Cache (Redis)** [in the repo]: cache-aside on the read path. Since links never change, there is nothing to invalidate. If Redis goes down, reads go to Postgres: slower, but they do not fail.
- **Separate reads and writes** [in the repo]: two processes from the same codebase that scale independently.
- **Read replicas** [evolution]: cache misses go to replicas, in line with availability over consistency.
- **Autoscaling** [evolution]: the processes hold no state, so load rules can add more of them. It scales the processes, not the database.
- **CDN** [evolution]: caching the 302s at the edge lowers the latency the visitor perceives, at the cost of those visits no longer reaching the server.
- **Sharding** [evolution]: at ~500 GB it is not needed. If it ever is, the partition key would be `short_code`, which the permutation spreads evenly.

## 5. Final design

![Container diagram of the URL shortener](https://raw.githubusercontent.com/poschuler/url-shortener/refs/tags/v1.0.0/architecture/diagrams/dark/containers.svg)

The diagram shows what the repository implements. The CDN, the replicas and the sharding from section 4 are not in it because they are evolution. All [three levels of the C4 model](https://github.com/poschuler/url-shortener/blob/v1.0.0/docs/architecture.md) are in the repository.
