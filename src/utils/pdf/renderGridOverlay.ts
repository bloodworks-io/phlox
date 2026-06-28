/**
 * Ruler overlay renderer for PDF pages.
 *
 * Used for VLM-based auto field detection. The model reads
 * the ruler labels and returns percentage-based positions.
 *
 * @param {HTMLCanvasElement} pdfCanvas
 * @param {Object} options
 * @param {number} options.step - Percentage step between marks (default 10)
 * @param {string} options.color
 * @param {string} options.tickColor
 * @param {string} options.textColor
 * @param {number} options.pageNumber
 * @returns {string} Base64 data URL of the composite image
 */
export function renderRulerOverlay(pdfCanvas, options: Record<string, any> = {}) {
    const {
        step = 10,
        color = "rgba(0, 0, 255, 0.08)",
        tickColor = "rgba(0, 0, 255, 0.35)",
        textColor = "rgba(0, 0, 255, 0.55)",
        pageNumber,
    } = options;

    const { width, height } = pdfCanvas;

    // Composite canvas
    const composite = document.createElement("canvas");
    composite.width = width;
    composite.height = height;
    const ctx = composite.getContext("2d");

    // Draw the original PDF
    ctx.drawImage(pdfCanvas, 0, 0);

    // Faint full-width/height guide lines at each step
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (let pct = step; pct < 100; pct += step) {
        const x = Math.round((pct / 100) * width);
        const y = Math.round((pct / 100) * height);

        // Vertical guide
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Horizontal guide
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Tick marks and labels along top edge (horizontal ruler)
    ctx.strokeStyle = tickColor;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = textColor;
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";

    for (let pct = 0; pct <= 100; pct += step) {
        const x = Math.round((pct / 100) * width);

        // Tick mark
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, pct % (step * 2) === 0 ? 14 : 9);
        ctx.stroke();

        // Label (only at major marks)
        if (pct % (step * 2) === 0 || pct === 100) {
            ctx.fillText(`${pct}%`, x, 24);
        }
    }

    // Tick marks and labels along left edge (vertical ruler)
    ctx.textAlign = "left";

    for (let pct = 0; pct <= 100; pct += step) {
        const y = Math.round((pct / 100) * height);

        // Tick mark
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(pct % (step * 2) === 0 ? 14 : 9, y);
        ctx.stroke();

        // Label
        if (pct % (step * 2) === 0 || pct === 100) {
            ctx.fillText(`${pct}%`, 3, y - 3);
        }
    }

    // Page number label in top-right corner
    if (pageNumber) {
        const label = `PAGE ${pageNumber}`;
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(0, 0, 255, 0.7)";
        ctx.fillText(label, width - 4, 16);
    }

    return composite.toDataURL("image/png");
}
