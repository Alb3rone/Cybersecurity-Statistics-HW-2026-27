# Statistics in Cybersecurity – Homework 2026/27

Homework for the *Statistics* course, MSc in Cybersecurity, Sapienza University of Rome.
Plain HTML, CSS and JavaScript. No libraries and no build step: open `index.html` in a browser,
or visit the GitHub Pages site.

| # | Homework | Page |
|---|---|---|
| 1 | Private key → public key: elliptic-curve scalar multiplication | [hw1.html](hw1.html) |
| 2 | From wallet seed to Ethereum address | coming soon |

## HMWK 1 – Private key → public key

Toy curve `y² = x³ + 7 (mod 17)`, base point `G = (1, 5)`, private key `k = 6`.
The page computes `G, 2G, …, kG` with the point-addition formulas, prints the final
point as the **toy public key**, animates the algorithm step by step and explores the
statistical properties of `kG` over all `k`.

## Structure

```
index.html        list of homeworks
hw1.html          HMWK 1
css/style.css     shared styles
js/hw1/           scripts for HMWK 1
```
