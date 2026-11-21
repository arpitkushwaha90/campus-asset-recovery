const { compareImageHashes } = require("./imageHasher");

const STOPWORDS = new Set([
    "a", "an", "the", "in", "on", "at", "near", "by", "for", "with", "of",
    "to", "from", "is", "was", "and", "or", "my", "i", "lost", "found", "item"
]);

const KNOWN_COLORS = new Set([
    "black", "dark", "blue", "navy", "red", "maroon", "green", "olive",
    "white", "yellow", "brown", "grey", "gray", "silver", "gold", "golden",
    "pink", "purple", "violet", "orange", "beige"
]);

function tokenize(text) {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

function getCharBigrams(word) {
    const bigrams = new Set();
    for (let i = 0; i < word.length - 1; i++) {
        bigrams.add(word.slice(i, i + 2));
    }
    return bigrams;
}

function wordFuzzyMatch(w1, w2) {
    if (w1 === w2) return 1.0;
    if (w1.length < 3 || w2.length < 3) return 0.0;

    const bg1 = getCharBigrams(w1);
    const bg2 = getCharBigrams(w2);

    let matchCount = 0;
    bg1.forEach(bg => {
        if (bg2.has(bg)) matchCount++;
    });

    const dice = (2.0 * matchCount) / (bg1.size + bg2.size);
    return dice >= 0.65 ? dice : 0.0;
}

function similarityScore(textA, textB) {
    const tokensA = tokenize(textA);
    const tokensB = tokenize(textB);

    if (tokensA.length === 0 || tokensB.length === 0) return 0;

    const colorsA = tokensA.filter(t => KNOWN_COLORS.has(t));
    const colorsB = tokensB.filter(t => KNOWN_COLORS.has(t));

    if (colorsA.length > 0 && colorsB.length > 0) {
        const hasColorOverlap = colorsA.some(cA => colorsB.some(cB => wordFuzzyMatch(cA, cB) > 0.65));
        if (!hasColorOverlap) {
            return 0.05;
        }
    }

    let matchedScoreSum = 0;
    const usedIndicesB = new Set();

    tokensA.forEach(wordA => {
        let bestWordScore = 0;
        let bestIndexB = -1;

        tokensB.forEach((wordB, idxB) => {
            if (!usedIndicesB.has(idxB)) {
                const score = wordFuzzyMatch(wordA, wordB);
                if (score > bestWordScore) {
                    bestWordScore = score;
                    bestIndexB = idxB;
                }
            }
        });

        if (bestWordScore > 0 && bestIndexB !== -1) {
            matchedScoreSum += bestWordScore;
            usedIndicesB.add(bestIndexB);
        }
    });

    const minTokens = Math.min(tokensA.length, tokensB.length);
    if (minTokens === 0) return 0;

    return Math.min(matchedScoreSum / minTokens, 1.0);
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return null;

    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Multimodal Composite Scoring Engine
 * Combines NLP (50%), Geo (20%), Time (10%), Visual (20%)
 */
function computeCompositeScore(itemA, itemB) {
    const textA = `${itemA.title} ${itemA.description || ""}`;
    const textB = `${itemB.title} ${itemB.description || ""}`;

    const nlpScore = similarityScore(textA, textB);

    // Visual Similarity via dHash
    const visualScore = compareImageHashes(itemA.image_hash, itemB.image_hash);

    // Text & Visual gating: Dono unmatched hain toh context boost na mile
    if (nlpScore < 0.20 && (visualScore === null || visualScore < 0.70)) {
        return { total: nlpScore, nlp: nlpScore, geo: 0, time: 0, visual: visualScore || 0 };
    }

    let geoScore = 1.0;
    const distKm = calculateHaversineDistance(
        itemA.latitude, itemA.longitude,
        itemB.latitude, itemB.longitude
    );

    if (distKm !== null) {
        geoScore = Math.exp(-0.5 * Math.pow(distKm / 5.0, 2));
    }

    let timeScore = 1.0;
    if (itemB.created_at) {
        const timeDiffMs = Math.abs(new Date() - new Date(itemB.created_at));
        const diffDays = timeDiffMs / (1000 * 60 * 60 * 24);
        timeScore = Math.exp(-0.05 * diffDays);
    }

    let total = 0;
    if (visualScore !== null) {
        total = (0.50 * nlpScore) + (0.20 * geoScore) + (0.10 * timeScore) + (0.20 * visualScore);
    } else {
        // Fallback: Agar image na ho toh 60% NLP + 25% Geo + 15% Time
        total = (0.60 * nlpScore) + (0.25 * geoScore) + (0.15 * timeScore);
    }

    return {
        total: Math.min(total, 1.0),
        nlp: nlpScore,
        geo: geoScore,
        time: timeScore,
        visual: visualScore !== null ? visualScore : 0
    };
}

module.exports = { similarityScore, computeCompositeScore, calculateHaversineDistance };