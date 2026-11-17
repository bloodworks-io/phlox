export interface DiffLine {
    type: "same" | "add" | "remove";
    text: string;
}

/**
 * Line-level diff (longest-common-subsequence) between two field contents.
 * Fields are line-oriented (lists, numbered items), so a unified +/- view
 * reads naturally. An empty string means "no lines"; removals are emitted
 * before additions within each changed hunk.
 */
export const lineDiff = (before: string, after: string): DiffLine[] => {
    const a = before === "" ? [] : before.split("\n");
    const b = after === "" ? [] : after.split("\n");

    // lcs[i][j] = LCS length of a[i:] and b[j:]
    const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
        new Array<number>(b.length + 1).fill(0),
    );
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            lcs[i][j] =
                a[i] === b[j]
                    ? lcs[i + 1][j + 1] + 1
                    : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
        }
    }

    const out: DiffLine[] = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            out.push({ type: "same", text: a[i] });
            i++;
            j++;
        } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
            out.push({ type: "remove", text: a[i] });
            i++;
        } else {
            out.push({ type: "add", text: b[j] });
            j++;
        }
    }
    while (i < a.length) {
        out.push({ type: "remove", text: a[i] });
        i++;
    }
    while (j < b.length) {
        out.push({ type: "add", text: b[j] });
        j++;
    }
    return out;
};
