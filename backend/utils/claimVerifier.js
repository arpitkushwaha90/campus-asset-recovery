// Universal Stopwords
const STOPWORDS = new Set([
    "a", "an", "the", "in", "on", "at", "near", "by", "for", "with", "of",
    "to", "from", "is", "was", "and", "or", "my", "it", "has", "have"
]);

function cleanTokens(text) {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 0 && !STOPWORDS.has(w));
}

function getCharBigrams(word) {
    const bigrams = new Set();
    for (let i = 0; i < word.length - 1; i++) {
        bigrams.add(word.slice(i, i + 2));
    }
    return bigrams;
}

function tokenDiceSimilarity(w1, w2) {
    if (w1 === w2) return 1.0;
    if (w1.length < 2 || w2.length < 2) return 0.0;

    const bg1 = getCharBigrams(w1);
    const bg2 = getCharBigrams(w2);

    let common = 0;
    bg1.forEach(bg => {
        if (bg2.has(bg)) common++;
    });

    return (2.0 * common) / (bg1.size + bg2.size);
}

/**
 * Evaluates Claimant Answer against Secret Answer
 * Returns Confidence Percentage (0.0 to 100.0)
 */
function verifyClaimAnswer(expectedAnswer, claimantAnswer) {
    if (!expectedAnswer || !claimantAnswer) return 0.0;

    const expectedTokens = cleanTokens(expectedAnswer);
    const claimantTokens = cleanTokens(claimantAnswer);

    if (expectedTokens.length === 0 || claimantTokens.length === 0) return 0.0;

    let totalMatchScore = 0;
    const matchedClaimantIndices = new Set();

    expectedTokens.forEach(expWord => {
        let bestTokenScore = 0;
        let bestIdx = -1;

        claimantTokens.forEach((clmWord, idx) => {
            if (!matchedClaimantIndices.has(idx)) {
                const score = tokenDiceSimilarity(expWord, clmWord);
                if (score > bestTokenScore) {
                    bestTokenScore = score;
                    bestIdx = idx;
                }
            }
        });

        if (bestTokenScore >= 0.70 && bestIdx !== -1) {
            totalMatchScore += bestTokenScore;
            matchedClaimantIndices.add(bestIdx);
        }
    });

    // Score based on expected criteria coverage
    const confidence = (totalMatchScore / expectedTokens.length) * 100;
    return Number(Math.min(confidence, 100.0).toFixed(1));
}

module.exports = { verifyClaimAnswer };