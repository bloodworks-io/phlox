// Canvas-based PDF form field builder.
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Flex, HStack, IconButton, Text, Spinner } from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "../common/icons";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { loadPdfDocument } from "../../utils/helpers/pdfVisionHelpers";
import { getHelveticaMeasure } from "../../utils/pdf/fieldLayout";
import {
    FIELD_CANVAS_COLORS,
    MIN_FIELD_SIZE,
    canvasToPdf,
    createFieldDraft,
    drawFieldOverlays,
    fieldToCanvas,
    findFieldAtPos,
    isOnResizeHandle,
    normalizeRect,
} from "./formBuilderUtils";
import type { CoordContext } from "./formBuilderUtils";
import { useTranslation } from "react-i18next";
import type { Measure } from "../../utils/pdf/fieldLayout";
import type { FieldType, FormField, FormTemplate } from "./types";

interface PdfViewport {
    width: number;
    height: number;
}
interface PdfRenderTask {
    promise: Promise<void>;
    cancel: () => void;
}
interface PdfPageProxy {
    getViewport: (params: { scale: number }) => PdfViewport;
    render: (params: {
        canvasContext: CanvasRenderingContext2D;
        viewport: PdfViewport;
    }) => PdfRenderTask;
}
interface PdfDocProxy {
    getPage: (pageNumber: number) => Promise<PdfPageProxy>;
}

interface CanvasPoint {
    x: number;
    y: number;
}
interface ResizeOrigin {
    canvasX: number;
    canvasY: number;
    fieldW: number;
    fieldH: number;
}

interface FormBuilderProps {
    template: FormTemplate;
    fields: FormField[];
    onFieldsChange: (fields: FormField[]) => void;
    selectedFieldId: string | null;
    onSelectField: (id: string | null) => void;
    onUpdateField: (field: FormField) => void;
    isDrawing?: boolean;
    activeFieldType?: FieldType;
    previewOn?: boolean;
    previewValues?: Record<string, string>;
    currentPage?: number;
    onCurrentPageChange?: (page: number) => void;
}

const FormBuilder = ({
    template,
    fields,
    onFieldsChange,
    selectedFieldId,
    onSelectField,
    onUpdateField,
    isDrawing = false,
    activeFieldType = "text",
    previewOn = false,
    previewValues = {},
    currentPage = 1,
    onCurrentPageChange = () => {},
}: FormBuilderProps) => {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const [renderScale, setRenderScale] = useState(1);
    const [rendering, setRendering] = useState(false);
    const [pdfDoc, setPdfDoc] = useState<PdfDocProxy | null>(null);
    const [renderGeneration, setRenderGeneration] = useState(0);

    // Helvetica metrics matching fillPdf exactly (for WYSIWYG text preview)
    const measureRef = useRef<Measure | null>(null);
    const [measureReady, setMeasureReady] = useState(false);
    useEffect(() => {
        let cancelled = false;
        getHelveticaMeasure().then((m) => {
            if (cancelled) return;
            measureRef.current = m;
            setMeasureReady(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    // Drawing state (controlled by parent via isDrawing prop)
    const [drawStart, setDrawStart] = useState<CanvasPoint | null>(null);
    const [drawCurrent, setDrawCurrent] = useState<CanvasPoint | null>(null);

    // Drag state for moving existing fields
    const [isDragging, setIsDragging] = useState(false);
    const [dragFieldId, setDragFieldId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState<CanvasPoint>({ x: 0, y: 0 });

    // Resize state for resizing fields via lower-right handle
    const [isResizing, setIsResizing] = useState(false);
    const [resizeFieldId, setResizeFieldId] = useState<string | null>(null);
    const [resizeOrigin, setResizeOrigin] = useState<ResizeOrigin | null>(null);

    const overlayBg = "var(--chakra-colors-hover-overlay)";
    const renderTaskRef = useRef<PdfRenderTask | null>(null);
    const isRenderingRef = useRef(false);

    const coord: CoordContext = {
        pageHeights: template?.page_heights || [],
        currentPage,
        renderScale,
    };

    // Load the PDF via pdfjs-dist
    useEffect(() => {
        if (!template?.id) return;

        let cancelled = false;
        const loadPdf = async () => {
            setRendering(true);
            try {
                const pdfData = await pdfFormsApi.fetchTemplatePdf(template.id);
                const doc = await loadPdfDocument({ data: pdfData });
                if (!cancelled) {
                    setPdfDoc(doc);
                }
            } catch (err) {
                console.error("Failed to load PDF:", err);
            } finally {
                if (!cancelled) setRendering(false);
            }
        };
        loadPdf();
        return () => {
            cancelled = true;
        };
    }, [template?.id]);

    // Render current page (only re-renders when doc or page changes)
    const renderPage = useCallback(async () => {
        if (!pdfDoc || !pdfCanvasRef.current || !overlayCanvasRef.current)
            return;

        // Cancel any in-progress render and wait for the canvas to be released
        if (renderTaskRef.current) {
            try {
                renderTaskRef.current.cancel();
            } catch {
                /* already finished */
            }
            try {
                await renderTaskRef.current.promise;
            } catch {
                /* RenderingCancelledException */
            }
            renderTaskRef.current = null;
        }

        // Bail if another render started while we were awaiting cancellation
        if (isRenderingRef.current) return;
        isRenderingRef.current = true;

        setRendering(true);
        try {
            const page = await pdfDoc.getPage(currentPage);

            const parentEl = containerRef.current?.parentElement;
            const availableWidth = parentEl?.clientWidth || 600;

            const viewport = page.getViewport({ scale: 1 });
            const scale = Math.min((availableWidth - 40) / viewport.width, 1.5);
            setRenderScale(scale);
            const scaledViewport = page.getViewport({ scale });

            const pdfCanvas = pdfCanvasRef.current;
            pdfCanvas.width = scaledViewport.width;
            pdfCanvas.height = scaledViewport.height;
            const ctx = pdfCanvas.getContext("2d");

            const task = page.render({
                canvasContext: ctx,
                viewport: scaledViewport,
            });
            renderTaskRef.current = task;
            await task.promise;
            renderTaskRef.current = null;

            const overlay = overlayCanvasRef.current;
            overlay.width = scaledViewport.width;
            overlay.height = scaledViewport.height;

            // Trigger overlay redraw via generation bump (avoids stale drawFields closure)
            setRenderGeneration((g) => g + 1);
        } catch (err) {
            if (err?.name !== "RenderingCancelledException") {
                console.error("Failed to render page:", err);
            }
        } finally {
            isRenderingRef.current = false;
            setRendering(false);
        }

    }, [pdfDoc, currentPage]);

    useEffect(() => {
        renderPage();
    }, [renderPage]);

    // Draw all fields on the overlay
    const drawFields = useCallback(() => {
        const overlay = overlayCanvasRef.current;
        if (!overlay) return;
        const ctx = overlay.getContext("2d");
        if (!ctx) return;
        drawFieldOverlays(ctx, {
            fields,
            coord,
            selectedFieldId,
            previewOn,
            previewValues,
            measure: measureRef.current,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        fields,
        currentPage,
        selectedFieldId,
        renderScale,
        previewOn,
        previewValues,
        measureReady,
        template,
    ]);

    // Redraw overlay when fields, selection, or PDF render change
    useEffect(() => {
        if (!pdfDoc || !overlayCanvasRef.current) return;
        drawFields();
    }, [fields, selectedFieldId, drawFields, pdfDoc, renderGeneration]);

    const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>): CanvasPoint => {
        const overlay = overlayCanvasRef.current;
        const rect = overlay.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.button !== 0) return;
        const pos = getCanvasPos(e);

        if (isDrawing) {
            // Drawing mode: start drawing a new field rectangle
            setDrawStart(pos);
            setDrawCurrent(pos);
        } else {
            // Check resize handle first (only on already-selected field)
            if (isOnResizeHandle(fields, selectedFieldId, pos.x, pos.y, coord)) {
                const field = fields.find((f) => f.id === selectedFieldId);
                const rect = fieldToCanvas(field, coord);
                setIsResizing(true);
                setResizeFieldId(selectedFieldId);
                setResizeOrigin({
                    canvasX: pos.x,
                    canvasY: pos.y,
                    fieldW: rect.width,
                    fieldH: rect.height,
                });
            } else {
                // Select/move mode
                const clickedField = findFieldAtPos(fields, pos.x, pos.y, coord);
                if (clickedField) {
                    onSelectField(clickedField.id);
                    // Start dragging
                    const rect = fieldToCanvas(clickedField, coord);
                    setIsDragging(true);
                    setDragFieldId(clickedField.id);
                    setDragOffset({ x: pos.x - rect.x, y: pos.y - rect.y });
                } else {
                    onSelectField(null);
                }
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = getCanvasPos(e);

        if (isDrawing && drawStart) {
            // Drawing: update the rectangle preview
            setDrawCurrent(pos);
        } else if (isResizing && resizeFieldId) {
            // Resizing: update field dimensions
            const field = fields.find((f) => f.id === resizeFieldId);
            if (!field || !resizeOrigin) return;

            const dx = pos.x - resizeOrigin.canvasX;
            const dy = pos.y - resizeOrigin.canvasY;
            const newW = Math.max(MIN_FIELD_SIZE, resizeOrigin.fieldW + dx);
            const newH = Math.max(MIN_FIELD_SIZE, resizeOrigin.fieldH + dy);
            const fieldRect = fieldToCanvas(field, coord);
            const pdfPos = canvasToPdf(fieldRect.x, fieldRect.y, newW, newH, coord);
            onUpdateField({
                ...field,
                x: pdfPos.x,
                y: pdfPos.y,
                width: pdfPos.width,
                height: pdfPos.height,
            });
        } else if (isDragging && dragFieldId) {
            // Dragging: move the field
            const field = fields.find((f) => f.id === dragFieldId);
            if (!field) return;

            const newCanvasX = pos.x - dragOffset.x;
            const newCanvasY = pos.y - dragOffset.y;
            const rect = fieldToCanvas(field, coord);

            const pdfPos = canvasToPdf(
                newCanvasX,
                newCanvasY,
                rect.width,
                rect.height,
                coord,
            );
            onUpdateField({
                ...field,
                x: pdfPos.x,
                y: pdfPos.y,
            });
        } else if (!isDrawing) {
            // Hover: change cursor based on what's under the mouse
            const overlay = overlayCanvasRef.current;
            if (overlay) {
                if (isOnResizeHandle(fields, selectedFieldId, pos.x, pos.y, coord)) {
                    overlay.style.cursor = "nwse-resize";
                } else {
                    const hovered = findFieldAtPos(fields, pos.x, pos.y, coord);
                    overlay.style.cursor = hovered ? "move" : "default";
                }
            }
        }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isDrawing && drawStart) {
            // Finish drawing a new field
            const pos = getCanvasPos(e);
            const { x, y, width, height } = normalizeRect(drawStart, pos);

            if (width >= MIN_FIELD_SIZE && height >= MIN_FIELD_SIZE) {
                const pdfPos = canvasToPdf(x, y, width, height, coord);

                const newField = createFieldDraft(
                    pdfPos,
                    activeFieldType,
                    currentPage,
                );

                onFieldsChange([...fields, newField]);
                onSelectField(newField.id);
            }

            setDrawStart(null);
            setDrawCurrent(null);
            // Stay in drawing mode so user can draw multiple fields
        }

        if (isDragging) {
            setIsDragging(false);
            setDragFieldId(null);
        }

        if (isResizing) {
            setIsResizing(false);
            setResizeFieldId(null);
            setResizeOrigin(null);
        }
    };

    const handleMouseLeave = () => {
        if (isDragging) {
            setIsDragging(false);
            setDragFieldId(null);
        }
        if (isResizing) {
            setIsResizing(false);
            setResizeFieldId(null);
            setResizeOrigin(null);
        }
        if (drawStart) {
            setDrawStart(null);
            setDrawCurrent(null);
        }
    };

    useEffect(() => {
        if (!isDrawing || !drawStart || !drawCurrent) return;
        const overlay = overlayCanvasRef.current;
        if (!overlay) return;
        const ctx = overlay.getContext("2d");
        if (!ctx) return;

        drawFields();

        const { x, y, width: w, height: h } = normalizeRect(drawStart, drawCurrent);

        const colors =
            FIELD_CANVAS_COLORS[activeFieldType] || FIELD_CANVAS_COLORS.text;
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
    }, [isDrawing, drawStart, drawCurrent, activeFieldType, drawFields]);

    // ── Render ─────────────────────────────────────────────────

    return (
        <Box>
            {/* Toolbar — just page navigation */}
            <HStack gap="2" mb="2" justify="flex-end">
                <HStack gap="1">
                    <IconButton
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                            onCurrentPageChange(Math.max(1, currentPage - 1))
                        }
                        disabled={currentPage <= 1}
                        aria-label={t("forms.previousPage")}><ChevronLeftIcon /></IconButton>
                    <Text fontSize="sm">
                        {currentPage} / {template?.page_count || 1}
                    </Text>
                    <IconButton
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                            onCurrentPageChange(
                                Math.min(template?.page_count || 1, currentPage + 1),
                            )
                        }
                        disabled={currentPage >= (template?.page_count || 1)}
                        aria-label={t("forms.nextPage")}><ChevronRightIcon /></IconButton>
                </HStack>
            </HStack>
            {/* Canvas area */}
            <Flex justify="center">
                <Box
                    ref={containerRef}
                    position="relative"
                    borderRadius="sm"
                    overflow="hidden"
                    cursor={isDrawing ? "crosshair" : "default"}
                >
                    {rendering && (
                        <Flex
                            position="absolute"
                            top="0"
                            left="0"
                            right="0"
                            bottom="0"
                            align="center"
                            justify="center"
                            zIndex="10"
                            bg={overlayBg}
                        >
                            <Spinner size="sm" />
                        </Flex>
                    )}
                    <canvas ref={pdfCanvasRef} style={{ display: "block" }} />
                    <canvas
                        ref={overlayCanvasRef}
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            display: "block",
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                    />
                </Box>
            </Flex>
        </Box>
    );
};

export default FormBuilder;
