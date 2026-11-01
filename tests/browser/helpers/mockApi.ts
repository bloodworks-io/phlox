import type { Page, Route } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
    basicPatients,
    detailedPatients,
    outstandingPatients,
    PREVIOUS_DATE,
    SEED_DATE,
    seedGlobalConfig,
    seedLetterTemplates,
    seedOptions,
    seedPatient,
    seedPdfFormTemplate,
    seedPrompts,
    seedRagCollectionFiles,
    seedRagCollections,
    seedTemplate,
    seedTodos,
    seedUserSettings,
    seedUsers,
} from "../fixtures/seed";

export type SeedVariant = {
    auth?: "ready" | "setup" | "login";
    onboarding?: boolean;
    patients?: "populated" | "empty";
    patient?: "populated" | "ungenerated";
    todos?: "populated" | "empty";
    rag?: "populated" | "empty";
};

export type ApiMockController = {
    unmatchedRequests: string[];
};

const jsonResponse = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
    });

const eventStream = (route: Route, events: unknown[]) =>
    route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    });

let seedFormPdfCache: Buffer | null = null;

/**
 * Deterministic one-page letter PDF for the seed form template. Dates are
 * pinned so repeated runs produce identical bytes.
 */
export async function buildSeedFormPdf(): Promise<Buffer> {
    if (seedFormPdfCache) return seedFormPdfCache;
    const doc = await PDFDocument.create();
    doc.setCreator("Phlox browser seed");
    doc.setProducer("Phlox browser seed");
    doc.setTitle("Specialist referral");
    doc.setCreationDate(new Date(`${PREVIOUS_DATE}T09:00:00Z`));
    doc.setModificationDate(new Date(`${PREVIOUS_DATE}T09:00:00Z`));
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([612, 792]);
    page.drawText("Specialist referral", { x: 72, y: 720, size: 16, font });
    page.drawText("Patient name", { x: 72, y: 646, size: 10, font });
    page.drawText("Urgent", { x: 92, y: 503, size: 10, font });
    seedFormPdfCache = Buffer.from(await doc.save());
    return seedFormPdfCache;
}

const pdfResponse = async (route: Route) =>
    route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: await buildSeedFormPdf(),
    });

const seedPatientForVariant = (variant: SeedVariant) => {
    if (variant.patient !== "ungenerated") {
        return seedPatient;
    }

    return {
        ...seedPatient,
        template_data: {},
        note_citations: null,
        reasoning_output: null,
    };
};

export async function installApiMocks(
    page: Page,
    variant: SeedVariant = {},
): Promise<ApiMockController> {
    const unmatchedRequests: string[] = [];
    const authMode = variant.auth ?? "ready";

    await page.route(
        (url) => new URL(url).pathname.startsWith("/api/"),
        async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname;
        const method = request.method();

        if (method === "GET" && path === "/api/config/status") {
            if (authMode === "ready") {
                return jsonResponse(route, { llm: true, whisper: true, embedding: null });
            }
            return jsonResponse(route, { detail: "Authentication required" }, 401);
        }

        if (method === "GET" && path === "/api/auth/status") {
            return jsonResponse(route, { needs_setup: authMode === "setup" });
        }

        if (method === "GET" && path === "/api/auth/me") {
            return jsonResponse(route, { id: 1, username: "seed", role: "admin", disabled: false });
        }

        if (method === "GET" && path === "/api/auth/users") {
            return jsonResponse(route, seedUsers);
        }

        if (method === "GET" && path === "/api/config/user") {
            return jsonResponse(route, {
                ...seedUserSettings,
                has_completed_splash_screen: !variant.onboarding,
            });
        }

        if (method === "GET" && path === "/api/config/global") {
            return jsonResponse(route, seedGlobalConfig);
        }

        if (method === "GET" && path === "/api/config/options") {
            return jsonResponse(route, seedOptions);
        }

        if (method === "GET" && path === "/api/config/prompts") {
            return jsonResponse(route, seedPrompts);
        }

        if (method === "GET" && path === "/api/config/capabilities") {
            return jsonResponse(route, { stt_mode: "remote", stt_languages: ["*"] });
        }

        if (method === "GET" && path === "/api/config/validate-url") {
            return jsonResponse(route, { valid: true });
        }

        if (method === "GET" && path === "/api/config/llm/models") {
            return jsonResponse(route, { models: [seedGlobalConfig.PRIMARY_MODEL] });
        }

        if (method === "GET" && path === "/api/config/whisper/models") {
            return jsonResponse(route, {
                models: [seedGlobalConfig.WHISPER_MODEL],
                listAvailable: true,
            });
        }

        if (method === "GET" && path === "/api/config/local/status") {
            return jsonResponse(route, {
                available: false,
                llama_server_running: false,
                models: [],
                models_count: 0,
                selected_model_id: null,
                is_docker: true,
                reason: "Local models are only available in Tauri builds",
            });
        }

        if (method === "GET" && path === "/api/config/mcp") {
            return jsonResponse(route, { servers: [] });
        }

        if (method === "GET" && path === "/api/templates") {
            return jsonResponse(route, [seedTemplate]);
        }

        if (method === "GET" && path === "/api/templates/default") {
            return jsonResponse(route, { template_key: seedTemplate.template_key });
        }

        if (method === "GET" && path === `/api/templates/${seedTemplate.template_key}`) {
            return jsonResponse(route, seedTemplate);
        }

        if (method === "GET" && path === "/api/letter/templates") {
            return jsonResponse(route, seedLetterTemplates);
        }

        if (method === "GET" && path === "/api/letter/fetch-letter") {
            return jsonResponse(route, { letter: seedPatient.final_letter });
        }

        if (method === "GET" && path === "/api/note/list") {
            const detailed = url.searchParams.get("detailed") === "true";
            if (variant.patients === "empty") {
                return jsonResponse(route, []);
            }
            return jsonResponse(route, detailed ? detailedPatients : basicPatients);
        }

        if (method === "GET" && path === "/api/note/id/1") {
            return jsonResponse(route, seedPatientForVariant(variant));
        }

        if (method === "GET" && path === "/api/note/consent") {
            return jsonResponse(route, {
                scribe_consent_at: `${seedPatient.encounter_date}T09:00:00`,
                scribe_consent_declined_at: null,
            });
        }

        if (method === "GET" && path === "/api/note/incomplete-jobs-count") {
            return jsonResponse(route, { incomplete_jobs_count: 2 });
        }

        if (method === "GET" && path === "/api/note/outstanding-jobs") {
            return jsonResponse(route, variant.patients === "empty" ? [] : outstandingPatients);
        }

        if (method === "GET" && path === "/api/note/search") {
            return jsonResponse(route, [
                {
                    id: seedPatient.id,
                    name: seedPatient.name,
                    ur_number: seedPatient.ur_number,
                    dob: seedPatient.dob,
                },
            ]);
        }

        if (method === "GET" && path === "/api/note/summary/1") {
            return jsonResponse(route, {
                summary: seedPatient.encounter_summary,
            });
        }

        if (method === "GET" && path === "/api/dashboard/todos") {
            return jsonResponse(
                route,
                { todos: variant.todos === "empty" ? [] : seedTodos },
            );
        }

        if (method === "GET" && path === "/api/chat/vision-capability/current") {
            return jsonResponse(route, { vision_capable: false });
        }

        if (method === "GET" && path === "/api/companion/status") {
            return jsonResponse(route, { enabled: false, host_running: false });
        }

        if (method === "GET" && path === "/api/rag/files") {
            return jsonResponse(
                route,
                variant.rag === "empty" ? { files: [] } : seedRagCollections,
            );
        }

        if (
            method === "GET" &&
            decodeURIComponent(path) ===
                "/api/rag/collection_files/Clinical Guidelines"
        ) {
            return jsonResponse(route, seedRagCollectionFiles);
        }

        if (method === "PATCH" && path === "/api/rag/update-document-metadata") {
            return jsonResponse(route, {});
        }

        if (method === "DELETE" && path === "/api/rag/delete-file") {
            return jsonResponse(route, {});
        }

        if (
            method === "DELETE" &&
            decodeURIComponent(path).startsWith("/api/rag/delete-collection/")
        ) {
            return jsonResponse(route, {});
        }

        if (method === "GET" && path.startsWith("/api/rag/download-pdf/")) {
            return pdfResponse(route);
        }

        if (method === "GET" && path === "/api/pdf-forms/templates") {
            return jsonResponse(route, [seedPdfFormTemplate]);
        }

        if (method === "GET" && path === "/api/pdf-forms/templates/seed-form") {
            return jsonResponse(route, seedPdfFormTemplate);
        }

        if (
            method === "GET" &&
            path.startsWith("/api/pdf-forms/templates/") &&
            path.endsWith("/pdf")
        ) {
            return pdfResponse(route);
        }

        if (method === "POST" && path === "/api/pdf-forms/templates") {
            return jsonResponse(route, {
                id: "uploaded-form",
                name: "Uploaded form",
                pdf_file_name: "uploaded.pdf",
                page_count: 1,
                page_heights: [792],
                created_at: `${SEED_DATE}T10:00:00`,
                updated_at: `${SEED_DATE}T10:00:00`,
                fields: [],
            });
        }

        if (method === "PUT" && path === "/api/pdf-forms/templates/seed-form/pdf") {
            return jsonResponse(route, {
                ...seedPdfFormTemplate,
                pdf_file_name: "replacement.pdf",
                updated_at: `${SEED_DATE}T10:00:00`,
            });
        }

        if (method === "PUT" && path === "/api/pdf-forms/templates/seed-form/fields") {
            return jsonResponse(route, {
                ...seedPdfFormTemplate,
                updated_at: `${SEED_DATE}T10:00:00`,
            });
        }

        if (method === "POST" && path === "/api/chat") {
            return eventStream(route, [
                { type: "chunk", content: "The haemoglobin trend is improving." },
                { type: "status", message: "Calling tool: review note" },
                { type: "end", function_response: { citations: [] } },
            ]);
        }

        if (method === "POST" && path === "/api/note/1/reasoning/stream") {
            return eventStream(route, [
                { type: "status", message: "Analysing note" },
                { type: "result", data: seedPatient.reasoning_output },
            ]);
        }

        if (method === "POST" && path === "/api/note/save") {
            return jsonResponse(route, { id: seedPatient.id });
        }

        if (method === "POST" && path === "/api/note/update-jobs-list") {
            return jsonResponse(route, { id: seedPatient.id });
        }

        if (method === "POST" && path === "/api/note/extract-jobs") {
            return jsonResponse(route, {
                action_items: [
                    {
                        text: "Repeat FBE in three months",
                        category: "action",
                        rationale: null,
                    },
                ],
                excluded: [],
                fallback: null,
            });
        }

        unmatchedRequests.push(`${method} ${path}${url.search}`);
        return jsonResponse(route, { detail: `Unhandled API request: ${path}` }, 404);
        },
    );

    return { unmatchedRequests };
}
