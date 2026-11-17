import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fillPdf } from "./fillForm";
import type { FormTemplate } from "../../components/pdf-forms/types";

const templateBase64 =
    "JVBERi0xLjcKJYGBgYEKCjYgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL0xlbmd0aCAxNTEKPj4Kc3RyZWFtCnicjc+xCgJBDATQPl+RWhCze7uTLIigeGBhI+QHRE5RtDgRv19drxIOJO3MPNLTykn4c/cTzTbd9dk9zof9VKVYMlErHCL7kWJi31Ko0cDJWKOw32ieBUETCjJaTVHQImCN3CwX7BfyCbVOO+rHpPIuwWKGjUmwQQKKNihVSVX9W4kiYpKLYVRJg5I1Qr/f/Ky/APdvQoYKZW5kc3RyZWFtCmVuZG9iagoKOCAwIG9iago8PAovRmlsdGVyIC9GbGF0ZURlY29kZQovTGVuZ3RoIDkyCj4+CnN0cmVhbQp4nCvkcgrhMlAAwaJ0Ln2P1Jyy1JLM5ERdS3NTAxMzSyMDcwVDI4WQNC4jE4UQHy5DsFJDBRMLBXMjA4WQXC4bUwMzZzNDM1djRzuFkCyuEC0u1xCuQC4AuCET9gplbmRzdHJlYW0KZW5kb2JqCgo5IDAgb2JqCjw8Ci9GaWx0ZXIgL0ZsYXRlRGVjb2RlCi9UeXBlIC9PYmpTdG0KL04gNgovRmlyc3QgMzIKL0xlbmd0aCA0MDgKPj4Kc3RyZWFtCnic1VPfa9wwDH73X6HH9qFY8cW/xnFwvUs6GKWlLWxs7CFNzJFS7JL4RvffT0quPUoZexh7GEGxpe+TLNlSAQgKNMICXAkl6IUDDUYhWHBaw3Ip5N3PpwDyutmFUchPfTfCN+Ig3BCH/9+F3KR9zKDEaiWOHpsmN49pJ2ZXKJj8wrgeUrdvwwDLuqprRIuIpiQxiGpL64bEkyjSCVOO9iS2PAjZ7AJxsSasnsXY2YfxiasP/hWtxDXM2c7c0s3667l8VjXHUH/Kx6+EvEzdtskBTrYfFCpToNLolS3911O6jiE0Of2/xU359yn+tsI371ynmIW83d/nSWVjIeR5MwZGQH4Mjz9C7ttGyCq2qevjDuTnPq7j2L8Y3kbkhuG2GQL5z30jb8KY9kNLjcS8KTJvXoOfWfSOKrfOUx9PLkfM21IZp7Rx7zF+AYfaO3PAKBX55er+IbTTEaxWz/niNvNtzAa2XYaub87TM00D0mcKBdYrnoZ1jCnzlEyTETNVwZo5TMvfl+rp9UvjFdp/nLI7pvwLZREGcwplbmRzdHJlYW0KZW5kb2JqCgoxMCAwIG9iago8PAovU2l6ZSAxMQovUm9vdCAyIDAgUgovSW5mbyAzIDAgUgovRmlsdGVyIC9GbGF0ZURlY29kZQovVHlwZSAvWFJlZgovTGVuZ3RoIDQ2Ci9XIFsgMSAyIDIgXQovSW5kZXggWyAwIDExIF0KPj4Kc3RyZWFtCnicJcmxEQAgDAOxdwIFHbNzDMoGAR+NGgFVwQAjEyZNE/NHFwek/cgFF4WgBH4KZW5kc3RyZWFtCmVuZG9iagoKc3RhcnR4cmVmCjkxNAolJUVPRg==";

const template = {
    id: "invariance",
    name: "Invariance fixture",
    fields: [
        {
            id: "name",
            name: "Patient name",
            field_type: "text",
            page_number: 1,
            x: 140,
            y: 710,
            width: 320,
            height: 18,
        },
        {
            id: "date",
            name: "Visit date",
            field_type: "date",
            page_number: 1,
            x: 140,
            y: 670,
            width: 120,
            height: 16,
        },
        {
            id: "urgent",
            name: "Urgent",
            field_type: "checkbox",
            page_number: 1,
            x: 100,
            y: 634,
            width: 14,
            height: 14,
        },
        {
            id: "number",
            name: "Follow-up months",
            field_type: "number",
            page_number: 1,
            x: 260,
            y: 634,
            width: 60,
            height: 14,
        },
        {
            id: "plan",
            name: "Plan",
            field_type: "text",
            page_number: 2,
            x: 80,
            y: 640,
            width: 440,
            height: 96,
        },
    ],
} as FormTemplate;

const values = {
    "Patient name": "Ada Lovelace",
    "Visit date": "2026-07-23",
    Urgent: "true",
    "Follow-up months": "3",
    Plan: "1. Repeat full blood examination; 2. Review iron studies; 3. General practice follow-up in three months",
};

const sha256 = (bytes: Uint8Array) =>
    createHash("sha256").update(bytes).digest("hex");

describe("fillPdf invariance", () => {
    it("produces byte-identical output for a fixed template and values", async () => {
        const templateBytes = Uint8Array.from(
            Buffer.from(templateBase64, "base64"),
        );
        const first = await fillPdf(templateBytes, template, values);
        const second = await fillPdf(templateBytes, template, values);

        expect(Buffer.compare(Buffer.from(first), Buffer.from(second))).toBe(0);
        expect(sha256(templateBytes)).toBe(
            "1c3946bfbd40ee97ac61e1900fb374ce2d2ca2c5ef55e525f11194817041bb15",
        );
    });
});
