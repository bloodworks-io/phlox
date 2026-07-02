// Canvas-based PDF form field builder.
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Flex, HStack, IconButton, Text, Spinner } from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "../common/icons";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { getPdfJs } from "../../utils/helpers/pdfVisionHelpers";


// Canvas-safe colors mapped from field types (can't use Chakra tokens in canvas)
const FIELD_CANVAS_COLORS = {
    text: {
        stroke: "#3182ce",
        fill: "rgba(49,130,206,0.1)",
        fillSelected: "rgba(49,130,206,0.2)",
    },
    checkbox: {
        stroke: "#38a169",
        fill: "rgba(56,161,105,0.1)",
        fillSelected: "rgba(56,161,105,0.2)",
    },
    date: {
        stroke: "#dd6b20",
        fill: "rgba(221,107,32,0.1)",
        fillSelected: "rgba(221,107,32,0.2)",
    },
    number: {
        stroke: "#805ad5",
        fill: "rgba(128,90,213,0.1)",
        fillSelected: "rgba(128,90,213,0.2)",
    },
};

const FormBuilder = ({
    template,
    fields,
    onFieldsChange,
    selectedFieldId,
    onSelectField,
    onUpdateField,
    isDrawing = false,
    _onToggleDrawing,
    activeFieldType = "text",
    _onFieldTypeChange,
}) => {
    const containerRef = useRef(null);
    const pdfCanvasRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [renderScale, setRenderScale] = useState(1);
    const [rendering, setRendering] = useState(false);
    const [pdfDoc, setPdfDoc] = useState(null);
    const [renderGeneration, setRenderGeneration] = useState(0);

    // Drawing state (controlled by parent via isDrawing prop)
    const [drawStart, setDrawStart] = useState(null);
    const [drawCurrent, setDrawCurrent] = useState(null);

    // Drag state for moving existing fields
    const [isDragging, setIsDragging] = useState(false);
    const [dragFieldId, setDragFieldId] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Resize state for resizing fields via lower-right handle
    const [isResizing, setIsResizing] = useState(false);
    const [resizeFieldId, setResizeFieldId] = useState(null);
    const [resizeOrigin, setResizeOrigin] = useState(null); // { canvasX, canvasY, fieldW, fieldH }

    const overlayBg = "var(--chakra-colors-hover-overlay)";
    const renderTaskRef = useRef(null);
    const isRenderingRef = useRef(false);

    // Load the PDF via pdfjs-dist
    useEffect(() => {
        if (!template?.id) return;

        let cancelled = false;
        const loadPdf = async () => {
            setRendering(true);
            try {
                const pdfData = await pdfFormsApi.fetchTemplatePdf(template.id);
                const pdfjsLib = await getPdfJs();
                const doc = await pdfjsLib.getDocument({ data: pdfData })
                    .promise;
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

    // Coordinate conversion
    const fieldToCanvas = (field) => {
        const pageHeights = template?.page_heights || [];
        const pageHeight = pageHeights[currentPage - 1] || 792;
        return {
            x: field.x * renderScale,
            y: (pageHeight - field.y - field.height) * renderScale,
            width: field.width * renderScale,
            height: field.height * renderScale,
        };
    };

    const canvasToPdf = (canvasX, canvasY, canvasW, canvasH) => {
        const pageHeights = template?.page_heights || [];
        const pageHeight = pageHeights[currentPage - 1] || 792;
        return {
            x: canvasX / renderScale,
            y: pageHeight - (canvasY + canvasH) / renderScale,
            width: canvasW / renderScale,
            height: canvasH / renderScale,
        };
    };

    // Draw all fields on the overlay
    const drawFields = useCallback(() => {
        const overlay = overlayCanvasRef.current;
        if (!overlay) return;
        const ctx = overlay.getContext("2d");
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        const pageFields = fields.filter((f) => f.page_number === currentPage);
        for (const field of pageFields) {
            const rect = fieldToCanvas(field);
            const colors =
                FIELD_CANVAS_COLORS[field.field_type] ||
                FIELD_CANVAS_COLORS.text;

            ctx.strokeStyle = colors.stroke;
            ctx.lineWidth = field.id === selectedFieldId ? 3 : 1.5;
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

            ctx.fillStyle =
                field.id === selectedFieldId
                    ? colors.fillSelected
                    : colors.fill;
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

            if (field.name) {
                ctx.fillStyle = "rgba(0,0,0,0.7)";
                ctx.font = "10px sans-serif";
                ctx.fillText(field.name, rect.x + 2, rect.y - 3);
            }

            // Draw resize handle on the selected field's lower-right corner
            if (field.id === selectedFieldId) {
                const handleSize = 6;
                ctx.fillStyle = colors.stroke;
                ctx.fillRect(
                    rect.x + rect.width - handleSize,
                    rect.y + rect.height - handleSize,
                    handleSize,
                    handleSize,
                );
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fields, currentPage, selectedFieldId, renderScale]);

    // Redraw overlay when fields, selection, or PDF render change
    useEffect(() => {
        if (!pdfDoc || !overlayCanvasRef.current) return;
        drawFields();
    }, [fields, selectedFieldId, drawFields, pdfDoc, renderGeneration]);

    const getCanvasPos = (e) => {
        const overlay = overlayCanvasRef.current;
        const rect = overlay.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const findFieldAtPos = (canvasX, canvasY) => {
        const pageFields = fields.filter((f) => f.page_number === currentPage);
        for (let i = pageFields.length - 1; i >= 0; i--) {
            const field = pageFields[i];
            const rect = fieldToCanvas(field);
            if (
                canvasX >= rect.x &&
                canvasX <= rect.x + rect.width &&
                canvasY >= rect.y &&
                canvasY <= rect.y + rect.height
            ) {
                return field;
            }
        }
        return null;
    };

    const HANDLE_SIZE = 6;
    const isOnResizeHandle = (canvasX, canvasY) => {
        if (!selectedFieldId) return false;
        const field = fields.find(
            (f) => f.id === selectedFieldId && f.page_number === currentPage,
        );
        if (!field) return false;
        const rect = fieldToCanvas(field);
        const hx = rect.x + rect.width - HANDLE_SIZE;
        const hy = rect.y + rect.height - HANDLE_SIZE;
        return (
            canvasX >= hx &&
            canvasX <= hx + HANDLE_SIZE &&
            canvasY >= hy &&
            canvasY <= hy + HANDLE_SIZE
        );
    };

    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        const pos = getCanvasPos(e);

        if (isDrawing) {
            // Drawing mode: start drawing a new field rectangle
            setDrawStart(pos);
            setDrawCurrent(pos);
        } else {
            // Check resize handle first (only on already-selected field)
            if (isOnResizeHandle(pos.x, pos.y)) {
                const field = fields.find((f) => f.id === selectedFieldId);
                const rect = fieldToCanvas(field);
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
                const clickedField = findFieldAtPos(pos.x, pos.y);
                if (clickedField) {
                    onSelectField(clickedField.id);
                    // Start dragging
                    const rect = fieldToCanvas(clickedField);
                    setIsDragging(true);
                    setDragFieldId(clickedField.id);
                    setDragOffset({ x: pos.x - rect.x, y: pos.y - rect.y });
                } else {
                    onSelectField(null);
                }
            }
        }
    };

    const handleMouseMove = (e) => {
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
            const newW = Math.max(10, resizeOrigin.fieldW + dx);
            const newH = Math.max(10, resizeOrigin.fieldH + dy);
            const fieldRect = fieldToCanvas(field);
            const pdfPos = canvasToPdf(fieldRect.x, fieldRect.y, newW, newH);
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
            const rect = fieldToCanvas(field);

            const pdfPos = canvasToPdf(
                newCanvasX,
                newCanvasY,
                rect.width,
                rect.height,
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
                if (isOnResizeHandle(pos.x, pos.y)) {
                    overlay.style.cursor = "nwse-resize";
                } else {
                    const hovered = findFieldAtPos(pos.x, pos.y);
                    overlay.style.cursor = hovered ? "move" : "default";
                }
            }
        }
    };

    const handleMouseUp = (e) => {
        if (isDrawing && drawStart) {
            // Finish drawing a new field
            const pos = getCanvasPos(e);
            const x = Math.min(drawStart.x, pos.x);
            const y = Math.min(drawStart.y, pos.y);
            const width = Math.abs(pos.x - drawStart.x);
            const height = Math.abs(pos.y - drawStart.y);

            if (width >= 10 && height >= 10) {
                const pdfPos = canvasToPdf(x, y, width, height);

                const newField = {
                    id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    name: "",
                    description: "",
                    field_type: activeFieldType,
                    required: false,
                    page_number: currentPage,
                    x: pdfPos.x,
                    y: pdfPos.y,
                    width: pdfPos.width,
                    height: pdfPos.height,
                    font_size: 12,
                };

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

        drawFields();

        const x = Math.min(drawStart.x, drawCurrent.x);
        const y = Math.min(drawStart.y, drawCurrent.y);
        const w = Math.abs(drawCurrent.x - drawStart.x);
        const h = Math.abs(drawCurrent.y - drawStart.y);

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
                            setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage <= 1}
                        aria-label="Previous page"><ChevronLeftIcon /></IconButton>
                    <Text fontSize="sm">
                        {currentPage} / {template?.page_count || 1}
                    </Text>
                    <IconButton
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                            setCurrentPage((p) =>
                                Math.min(template?.page_count || 1, p + 1),
                            )
                        }
                        disabled={currentPage >= (template?.page_count || 1)}
                        aria-label="Next page"><ChevronRightIcon /></IconButton>
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
