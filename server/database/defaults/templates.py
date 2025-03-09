from typing import List, Dict, Any

class DefaultTemplates:
    """Default clinical note templates with mandatory numbered plan."""

    @staticmethod
    def get_plan_field() -> Dict[str, Any]:
        """Get the standard numbered plan field configuration."""
        return {
            "field_key": "plan",
            "field_name": "Plan",
            "field_type": "text",
            "persistent": False,
            "required": True,  # Make plan mandatory
            "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract the action items mentioned in the transcript by the doctor.\n2. The plan should include at least 2 actions from the appointment\n3. Only items for actioning are to be included. Do not add extraneous or irrelevant information.\n4. The target audience of the text is medical professionals so use jargon and common medical abbreviations.\n5. If a follow-up appointment or investigation is mentioned, be sure to include it in the plan.",
            "initial_prompt": "Items to be completed:\n1. ",
            "format_schema": {
                "type": "numbered"
            },
            "refinement_rules": ["default"]
        }

    @classmethod
    def get_default_templates(cls) -> List[Dict[str, Any]]:
        """Get all default templates."""
        return [
            {
                "template_key": "phlox_01",
                "template_name": "Phlox Haematology",
                "fields": [
                    {
                        "field_key": "primary_history",
                        "field_name": "Primary Haematological History",
                        "field_type": "text",
                        "persistent": True,
                        "system_prompt": "Extract and summarize the primary haematological condition and its history.",
                        "initial_prompt": "# Primary Condition\n-"
                    },
                    {
                        "field_key": "additional_history",
                        "field_name": "Other Active Problems",
                        "field_type": "text",
                        "persistent": True,
                        "system_prompt": "List other active medical problems.",
                        "initial_prompt": "# Other Active Problems\n-"
                    },
                    {
                        "field_key": "investigations",
                        "field_name": "Investigations",
                        "field_type": "text",
                        "persistent": True,
                        "system_prompt": "Extract and format investigation results.",
                        "initial_prompt": "Results:\n"
                    },
                    {
                        "field_key": "clinical_history",
                        "field_name": "Current History",
                        "field_type": "text",
                        "persistent": False,
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                        "initial_prompt": "Current Status:\n-",
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Summarise and present the key points from the clinical encounter.\n2. Tailor your summary based on the context. If this is a new patient, then focus on the history of the presenting complaint; for returning patients focus on current signs and symptoms.\n3. Report any examination findings (but only if it clear that one was performed).\n4. The target audience of the text is medical professionals so use jargon and common Australian medical abbreviations where appropriate.\n5. Do not include any items regarding the ongoing plan. Only include items regarding to the patient's HOPC and examination.\n6. Try to include at least 5 distinct dot points in the summary. Include more if required. Pay particular attention to discussion regarding constitutional symptoms, pains, and pertinent negatives on questioning."
                    },
                    {
                        "field_key": "impression",
                        "field_name": "Impression",
                        "field_type": "text",
                        "persistent": True,
                        "system_prompt": "Provide a clinical impression of the current status.",
                        "initial_prompt": "Impression: ",
                    },
                    cls.get_plan_field()  # Add standard plan field
                ]
            },
            {
                "template_key": "soap_01",
                "template_name": "SOAP Note",
                "fields": [
                    {
                        "field_key": "subjective",
                        "field_name": "Subjective",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "Extract patient's symptoms, complaints, and reported history.",
                        "initial_prompt": "S:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                    },
                    {
                        "field_key": "objective",
                        "field_name": "Objective",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "Extract physical examination findings and investigation results.",
                        "initial_prompt": "O:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                    },
                    {
                        "field_key": "assessment",
                        "field_name": "Assessment",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "Summarize the assessment and diagnosis.",
                        "initial_prompt": "A:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                    },
                    cls.get_plan_field()  # Add standard plan field
                ]
            },
            {
                "template_key": "progress_01",
                "template_name": "Progress Note",
                "fields": [
                    {
                        "field_key": "interval_history",
                        "field_name": "Interval History",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "Summarize changes since last visit.",
                        "initial_prompt": "Interval History:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                    },
                    {
                        "field_key": "current_status",
                        "field_name": "Current Status",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "Describe current clinical status and any active issues.",
                        "initial_prompt": "Current Status:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                    },
                    cls.get_plan_field()  # Add standard plan field
                ]
            }
        ]
