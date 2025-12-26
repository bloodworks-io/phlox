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
            "refinement_rules": ["default"],
            "style_example": "1. Check CBC, LFTs, coags in 2 weeks\n2. Refer to dermatology for skin assessment\n3. FU in clinic in 4 weeks with results\n4. Book PET scan to reassess disease status"
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
                        "initial_prompt": "# Primary Condition\n-",
                        "style_example": "# Chronic lymphocytic leukemia\n- Diagnosed Aug 2021\n- Initial presentation with lymphocytosis on routine bloods\n- Previously treated with FCR x 6 cycles with good response"
                    },
                    {
                        "field_key": "additional_history",
                        "field_name": "Other Active Problems",
                        "field_type": "text",
                        "persistent": True,
                        "system_prompt": "List other active medical problems.",
                        "initial_prompt": "# Other Active Problems\n-",
                        "style_example": "#Hypertension\n- Controlled on amlodipine 5mg OD\n#Type 2 diabetes - HbA1c 6.8% (Mar 2023)\n# Previous DVT (2019)\n- completed anticoagulation"
                    },
                    {
                        "field_key": "investigations",
                        "field_name": "Investigations",
                        "field_type": "text",
                        "persistent": True,
                        "system_prompt": "Extract and format investigation results in the following format. Only include the most recent investigations:\n<Name of pathology company (eg Dorevitch)> <Date of test DD/MM/YY>:\nFBE Hb/WCC/Plt\n\nUEC Na/K/Cr (eGFR)\n\nOther relevant investigations such as calcium level.\n\nRelevant imaging should appear like so:\n<Type of scan eg CT-Brain> <Imaging Company eg Lumus> <Date of scan DD/MM/YY>\n- <key point from scan report>",
                        "initial_prompt": "Results:\n",
                        "style_example": "Melbourne Pathology 15/06/23:\nFBE Hb 120/WCC 15.2/Plt 145\n\nUEC Na 138/K 4.2/Cr 82 (eGFR >90)\n\nLFTs normal\nCalcium 2.35\n\nPET-CT Melbourne Imaging 28/03/23:\n- No evidence of disease progression\n- No new FDG-avid lesions identified"
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
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Summarise and present the key points from the clinical encounter.\n2. Tailor your summary based on the context. If this is a new patient, then focus on the history of the presenting complaint; for returning patients focus on current signs and symptoms.\n3. Report any examination findings (but only if it clear that one was performed).\n4. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n5. Do not include any items regarding the ongoing plan. Only include items regarding to the patient's HOPC and examination.\n6. Try to include at least 5 distinct dot points in the summary. Include more if required. Pay particular attention to discussion regarding constitutional symptoms, pains, and pertinent negatives on questioning.",
                        "style_example": "- Presents with a lump in the neck, first noticed approximately 3 weeks prior\n- No significant change in size since then\n- No associated symptoms such as fevers, sweats, or weight loss reported\n- Denies other new lumps or bumps and is otherwise feeling well\n- Lymph node approximately 1 cm in size on examination today\n- No other palpable lymph nodes found. Abdo SNT; no HSM"
                    },
                    {
                        "field_key": "impression",
                        "field_name": "Impression",
                        "field_type": "text",
                        "persistent": True,
                        "system_prompt": "Provide a clinical impression of the current status.",
                        "initial_prompt": "Impression: ",
                        "style_example": "Stable CLL with good response to previous therapy. Recent counts show mild lymphocytosis but no evidence of disease progression. Remains clinically well with no B symptoms."
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
                        "style_example": "- 45yo F presents with 2 week Hx of worsening SOB\n- Reports difficulty climbing stairs and walking >100m\n- Associated with non-productive cough, worse at night\n- No fever, chest pain, or hemoptysis\n- PMHx: Asthma (diagnosed age 12), well controlled until recent exacerbation\n- Meds: Salbutamol PRN (using 6-8 puffs/day recently, up from 2-3/week)"
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
                        "style_example": "- Vitals: HR 92, BP 132/78, T 37.1, RR 20, O2 sat 95% RA\n- Alert, mild respiratory distress with speech\n- Chest: Bilateral expiratory wheeze, prolonged expiratory phase\n- No accessory muscle use, no cyanosis\n- PEFR: 280 L/min (predicted 420 L/min)\n- CXR: Hyperinflation, no infiltrates or consolidation"
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
                        "style_example": "- Moderate asthma exacerbation\n- Likely triggered by recent respiratory infection\n- Suboptimal control with current medication regimen\n- No signs of pneumonia or other complications at this time"
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
                        "style_example": "- Last seen 3 months ago for AML post-induction\n- Completed consolidation cycle 2 weeks ago\n- Initially tolerated well but developed neutropenic fever day +10\n- Admitted for 5 days, treated with IV antibiotics\n- Blood cultures negative, resp viral panel +ve for rhinovirus"
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
                        "style_example": "- Now day +21 post-chemo, feeling much improved\n- Ongoing fatigue but able to perform ADLs independently\n- Appetite returning, regained 1kg since discharge\n- No fevers, night sweats, or bleeding\n- Latest FBC shows count recovery with ANC 1.2, Hb 105, Plts 75\n- Examination: No significant findings. ECOG PS 1"
                    },
                    cls.get_plan_field()  # Add standard plan field
                ]
            }
        ]
