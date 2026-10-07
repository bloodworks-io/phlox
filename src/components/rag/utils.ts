/** Keep only files that look like PDFs (by MIME type or .pdf extension). */
export function filterPdfFiles(files: File[]): File[] {
    return files.filter(
        (f) =>
            f.type === "application/pdf" ||
            f.name.toLowerCase().endsWith(".pdf"),
    );
}
