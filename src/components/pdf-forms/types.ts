// Domain types for PDF form templates and fields.

export type FieldType = "text" | "checkbox" | "date" | "number";

export interface FormField {
    id: string;
    name: string;
    description?: string;
    field_type: FieldType;
    required?: boolean;
    page_number: number;
    x: number;
    y: number;
    width: number;
    height: number;
    font_size?: number;
}

export interface FormTemplate {
    id: string;
    name: string;
    description?: string;
    pdf_file_name?: string;
    page_count?: number;
    page_heights?: number[];
    field_count?: number;
    fields?: FormField[];
    created_at?: string;
    updated_at?: string;
}

/** Chat artifact payload of type "form_fill" (rendered in chat and live-agent chips). */
export interface FormFillArtifactData {
    template_id: string;
    template_name?: string;
    field_values: Record<string, string>;
}
