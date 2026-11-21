const Jimp = require("jimp");
const path = require("path");
const fs = require("fs");

/**
 * Computes 64-bit Perceptual Difference Hash (dHash)
 * Handles Base64 strings, file paths, and URLs safely without crashing.
 */
async function computeImageHash(imageInput) {
    if (!imageInput || typeof imageInput !== "string") return null;

    try {
        let buffer;

        // Agar Base64 Data URL ho (e.g. data:image/png;base64,...)
        if (imageInput.startsWith("data:image")) {
            const base64Data = imageInput.split(";base64,").pop();
            buffer = Buffer.from(base64Data, "base64");
        } else if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
            // URL ho toh direct read karega
            buffer = imageInput;
        } else {
            // Local file path ho
            let target = path.resolve(imageInput);
            if (!fs.existsSync(target)) {
                const fallback = path.join(__dirname, "../uploads", path.basename(imageInput));
                if (fs.existsSync(fallback)) target = fallback;
            }
            if (fs.existsSync(target)) {
                buffer = target;
            } else {
                return null;
            }
        }

        const img = await Jimp.read(buffer);
        img.resize(9, 8).greyscale();

        let hash = "";
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const leftPixel = Jimp.intToRGBA(img.getPixelColor(x, y)).r;
                const rightPixel = Jimp.intToRGBA(img.getPixelColor(x + 1, y)).r;
                hash += leftPixel > rightPixel ? "1" : "0";
            }
        }

        return hash;
    } catch (err) {
        console.warn("⚠️ [VISUAL HASH NOTICE] Could not compute hash:", err.message);
        return null; // Crash hone ke bajaye silently null return karega
    }
}

/**
 * Computes Hamming Distance between two 64-bit binary hashes
 * and returns Normalized Visual Similarity (0.0 to 1.0)
 */
function compareImageHashes(hash1, hash2) {
    if (!hash1 || !hash2 || hash1.length !== 64 || hash2.length !== 64) {
        return null;
    }

    let hammingDistance = 0;
    for (let i = 0; i < 64; i++) {
        if (hash1[i] !== hash2[i]) hammingDistance++;
    }

    const similarity = 1.0 - (hammingDistance / 64.0);
    return Math.max(0.0, Math.min(similarity, 1.0));
}

module.exports = { computeImageHash, compareImageHashes };