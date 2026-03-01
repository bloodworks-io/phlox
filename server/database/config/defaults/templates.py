from typing import Any


class DefaultTemplates:
    """Default clinical note templates with mandatory numbered plan."""

    @staticmethod
    def get_plan_field() -> dict[str, Any]:
        """Get the standard numbered plan field configuration."""
        return {
            "field_key": "plan",
            "field_name": "Plan",
            "field_type": "text",
            "persistent": False,
            "required": True,  # Make plan mandatory
            "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract the action items mentioned in the transcript by the doctor.\n2. The plan should include at least 2 actions from the appointment\n3. Only items for actioning are to be included. Do not add extraneous or irrelevant information.\n4. The target audience of the text is medical professionals so use jargon and common medical abbreviations.\n5. If a follow-up appointment or investigation is mentioned, be sure to include it in the plan.",
            "initial_prompt": "Items to be completed:\n1. ",
            "format_schema": {"type": "numbered"},
            "refinement_rules": ["default"],
            "style_example": "1. Check CBC, LFTs, coags in 2 weeks\n2. Refer to dermatology for skin assessment\n3. FU in clinic in 4 weeks with results\n4. Book PET scan to reassess disease status",
        }

    @classmethod
    def get_default_templates(cls) -> list[dict[str, Any]]:
        """Get all default templates."""
        return [
            {
                "template_key": "phlox_01",
                "template_name": "Phlox",
                "fields": [
                    {
                        "field_key": "primary_history",
                        "field_name": "Primary Medical History",
                        "field_type": "text",
                        "persistent": True,
                        "system_prompt": "Extract and summarize the primary medical condition and its history.",
                        "initial_prompt": "# Primary Condition\n-",
                        "style_example": "# Chronic lymphocytic leukemia\n- Diagnosed Aug 2021\n- Initial presentation with lymphocytosis on routine bloods\n- Previously treated with FCR x 6 cycles with good response",
                    },
                    {
                        "field_key": "additional_history",
                        "field_name": "Other Active Problems",
                        "field_type": "text",
                        "persistent": True,
                        "system_prompt": "List other active medical problems.",
                        "initial_prompt": "# Other Active Problems\n-",
                        "style_example": "#Hypertension\n- Controlled on amlodipine 5mg OD\n#Type 2 diabetes - HbA1c 6.8% (Mar 2023)\n# Previous DVT (2019)\n- completed anticoagulation",
                    },
                    {
                        "field_key": "investigations",
                        "field_name": "Investigations",
                        "field_type": "text",
                        "persistent": True,
                        "system_prompt": "Extract and format investigation results in the following format. Only include the most recent investigations:\n<Name of pathology company (eg Dorevitch)> <Date of test DD/MM/YY>:\nFBE Hb/WCC/Plt\n\nUEC Na/K/Cr (eGFR)\n\nOther relevant investigations such as calcium level.\n\nRelevant imaging should appear like so:\n<Type of scan eg CT-Brain> <Imaging Company eg Lumus> <Date of scan DD/MM/YY>\n- <key point from scan report>",
                        "initial_prompt": "Results:\n",
                        "style_example": "Melbourne Pathology 15/06/23:\nFBE Hb 120/WCC 15.2/Plt 145\n\nUEC Na 138/K 4.2/Cr 82 (eGFR >90)\n\nLFTs normal\nCalcium 2.35\n\nPET-CT Melbourne Imaging 28/03/23:\n- No evidence of disease progression\n- No new FDG-avid lesions identified",
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
                        "style_example": "- Presents with a lump in the neck, first noticed approximately 3 weeks prior\n- No significant change in size since then\n- No associated symptoms such as fevers, sweats, or weight loss reported\n- Denies other new lumps or bumps and is otherwise feeling well\n- Lymph node approximately 1 cm in size on examination today\n- No other palpable lymph nodes found. Abdo SNT; no HSM",
                    },
                    {
                        "field_key": "impression",
                        "field_name": "Impression",
                        "field_type": "text",
                        "persistent": True,
                        "system_prompt": "Provide a clinical impression of the current status.",
                        "initial_prompt": "Impression: ",
                        "style_example": "Stable CLL with good response to previous therapy. Recent counts show mild lymphocytosis but no evidence of disease progression. Remains clinically well with no B symptoms.",
                    },
                    cls.get_plan_field(),  # Add standard plan field
                ],
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
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract the patient's reported symptoms, including onset, duration, severity, and any associated features.\n2. Include relevant past medical history and current medications when pertinent to the presenting complaint.\n3. Capture the patient's perspective including their concerns, fears, and expectations.\n4. Note any pertinent negatives from the history taking.\n5. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n6. Try to include at least 4-5 distinct bullet points covering the key elements of the patient's story.",
                        "initial_prompt": "S:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                        "style_example": "- 45yo F presents with 2 week Hx of worsening SOB\n- Reports difficulty climbing stairs and walking >100m\n- Associated with non-productive cough, worse at night\n- No fever, chest pain, or hemoptysis\n- PMHx: Asthma (diagnosed age 12), well controlled until recent exacerbation\n- Meds: Salbutamol PRN (using 6-8 puffs/day recently, up from 2-3/week)",
                    },
                    {
                        "field_key": "objective",
                        "field_name": "Objective",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract all physical examination findings including both normal and abnormal findings.\n2. Include vital signs with specific values when mentioned (HR, BP, Temp, RR, O2 sat, pain score).\n3. Extract relevant investigation results including labs, imaging, and diagnostic tests with specific values when available.\n4. Organize findings by body system or test category for clarity.\n5. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n6. Include specific measurements, values, and timestamps when mentioned in the transcript.",
                        "initial_prompt": "O:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                        "style_example": "- Vitals: HR 92, BP 132/78, T 37.1, RR 20, O2 sat 95% RA\n- Alert, mild respiratory distress with speech\n- Chest: Bilateral expiratory wheeze, prolonged expiratory phase\n- No accessory muscle use, no cyanosis\n- PEFR: 280 L/min (predicted 420 L/min)\n- CXR: Hyperinflation, no infiltrates or consolidation",
                    },
                    {
                        "field_key": "assessment",
                        "field_name": "Assessment",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Synthesize the subjective and objective findings into a coherent clinical assessment.\n2. State the primary diagnosis, problem, or working differential clearly.\n3. Include clinical reasoning connecting the findings to the assessment.\n4. Note the severity, chronicity, and any complicating factors.\n5. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n6. Keep the assessment focused and concise, typically 2-4 bullet points covering the key clinical issues.",
                        "initial_prompt": "A:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                        "style_example": "- Moderate asthma exacerbation\n- Likely triggered by recent respiratory infection\n- Suboptimal control with current medication regimen\n- No signs of pneumonia or other complications at this time",
                    },
                    cls.get_plan_field(),  # Add standard plan field
                ],
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
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract and summarize events, treatments, and changes since the previous encounter.\n2. Include a clear timeline of when events occurred, with specific dates or timeframes when mentioned.\n3. Document any interventions received, including medications, procedures, or therapies.\n4. Note any complications, new symptoms, or adverse events that occurred during the interval.\n5. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n6. Present the information chronologically to show the progression of events since last seen.",
                        "initial_prompt": "Interval History:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                        "style_example": "- Last seen 3 months ago for AML post-induction\n- Completed consolidation cycle 2 weeks ago\n- Initially tolerated well but developed neutropenic fever day +10\n- Admitted for 5 days, treated with IV antibiotics\n- Blood cultures negative, resp viral panel +ve for rhinovirus",
                    },
                    {
                        "field_key": "current_status",
                        "field_name": "Current Status",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Describe the patient's current clinical condition at the time of this encounter.\n2. Include current symptom status, functional status, and quality of life indicators.\n3. Document any active physical examination findings with specific details.\n4. Note any ongoing concerns, residual issues, or problems requiring attention.\n5. Include relevant negative findings when they provide important context.\n6. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n7. Aim for 4-6 bullet points that capture the patient's present state comprehensively.",
                        "initial_prompt": "Current Status:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                        "style_example": "- Now day +21 post-chemo, feeling much improved\n- Ongoing fatigue but able to perform ADLs independently\n- Appetite returning, regained 1kg since discharge\n- No fevers, night sweats, or bleeding\n- Latest FBC shows count recovery with ANC 1.2, Hb 105, Plts 75\n- Examination: No significant findings. ECOG PS 1",
                    },
                    cls.get_plan_field(),  # Add standard plan field
                ],
            },
            {
                "template_key": "procedure_01",
                "template_name": "Procedure Note",
                "fields": [
                    {
                        "field_key": "indication",
                        "field_name": "Indication",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract the clinical indication for why this procedure is being performed.\n2. Include relevant symptoms, findings, or diagnoses that led to the procedure being recommended.\n3. Note any prior treatments that have been tried and failed if mentioned.\n4. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n5. Be concise but complete - 1-3 sentences covering the essential rationale.",
                        "initial_prompt": "Indication: ",
                        "style_example": "Recurrent episodes of diverticulitis over the past 18 months, with 3 acute episodes requiring hospitalization. Failed conservative management with dietary modifications. CT scan confirmed sigmoid diverticulosis with wall thickening and pericolic fat stranding.",
                    },
                    {
                        "field_key": "pre_procedure",
                        "field_name": "Pre-Procedure",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract the pre-procedure assessment including patient preparation and consent status.\n2. Document the type of anesthesia or sedation used (local, conscious sedation, general).\n3. Note any prophylactic medications administered (antibiotics, DVT prophylaxis, etc.).\n4. Include any pre-procedure positioning or monitoring that was set up.\n5. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n6. Present as 2-4 bullet points covering the key pre-procedure elements.",
                        "initial_prompt": "Pre-Procedure:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                        "style_example": "- Consent obtained following discussion of risks and benefits\n- IV conscious sedation with midazolam 2mg and fentanyl 50mcg\n- Prophylactic cefazolin 1g IV administered prior to incision\n- Patient positioned supine, abdominal prep with Betadine",
                    },
                    {
                        "field_key": "procedure_details",
                        "field_name": "Procedure Details",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract a step-by-step description of what was performed during the procedure.\n2. Include specific techniques, instruments used, and key findings encountered.\n3. Document any specimens taken or samples collected.\n4. Note the duration of the procedure if mentioned.\n5. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n6. Use numbered or bulleted format to clearly delineate the procedural steps.",
                        "initial_prompt": "Procedure Details:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                        "style_example": "- Standard colonoscope inserted to cecum without difficulty\n- Mucosal examination revealed multiple diverticula throughout sigmoid colon\n- Areas of inflammation and mucosal edema noted at 25cm and 30cm from anal verge\n- Cold forceps biopsies taken from inflamed segments (x3)\n- Scope withdrawn with careful inspection of entire mucosa\n- Procedure duration: 25 minutes",
                    },
                    {
                        "field_key": "complications",
                        "field_name": "Complications",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract any complications, unexpected events, or adverse occurrences during the procedure.\n2. Note how any complications were managed or resolved.\n3. If no complications were mentioned, explicitly state 'No complications reported.'\n4. Include any immediate post-procedure concerns or observations.\n5. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n6. Be complete and accurate - complications are critical for documentation.",
                        "initial_prompt": "Complications: ",
                        "style_example": "No immediate complications. Patient tolerated procedure well. Vital signs remained stable throughout. No bleeding encountered at biopsy sites.",
                    },
                    cls.get_plan_field(),  # Add standard plan field
                ],
            },
            {
                "template_key": "consult_01",
                "template_name": "Consultation Note",
                "fields": [
                    {
                        "field_key": "reason_for_consult",
                        "field_name": "Reason for Consult",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract the specific reason why the consultation was requested.\n2. Include the referring provider's specific question or concern.\n3. Note any urgency or priority mentioned for the consultation.\n4. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n5. Be concise - 1-2 sentences clearly stating the consult question.",
                        "initial_prompt": "Reason for Consult: ",
                        "style_example": "Cardiology consultation requested for evaluation of newly diagnosed atrial fibrillation. Primary question: regarding appropriateness of rhythm vs. rate control strategy and anticoagulation recommendations.",
                    },
                    {
                        "field_key": "relevant_history",
                        "field_name": "Relevant History",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract history relevant specifically to the consult question, not the entire medical history.\n2. Include pertinent past medical history, current medications, and allergies related to this consultation.\n3. Note any prior tests, treatments, or interventions relevant to the current issue.\n4. Include relevant family or social history when pertinent to the consult question.\n5. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n6. Focus on history that informs the consultant's assessment and recommendations.",
                        "initial_prompt": "Relevant History:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                        "style_example": "- AFib first diagnosed 2 weeks ago on routine ECG\n- PMHx: Hypertension (well controlled on losartan), T2DM (HbA1c 6.9%), OSA (on CPAP)\n- Current medications: Losartan 50mg daily, Metformin 1000mg BD\n- Echo from 1 month ago showed normal LV function, no structural heart disease\n- No prior history of stroke, TIA, or thromboembolism",
                    },
                    {
                        "field_key": "findings",
                        "field_name": "Findings",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract relevant physical examination findings related to the consult question.\n2. Include vital signs and specific examination details relevant to the specialty.\n3. Summarize pertinent investigation results including labs, imaging, or diagnostic tests.\n4. Present both normal and abnormal findings when relevant to the assessment.\n5. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n6. Organize findings clearly - examination findings and investigation results can be separated.",
                        "initial_prompt": "Findings:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                        "style_example": "- VS: BP 128/72, HR 78 (irregularly irregular), RR 16, T 36.8\n- Cardiovascular: Irregularly irregular rhythm, no murmurs, S1/S2 normal, no peripheral edema\n- Respiratory: Clear bilaterally, no wheezes or crackles\n- ECG today: Confirmed AFib, rate 78, no acute ischemic changes, normal intervals\n- TSH normal, electrolytes within normal limits",
                    },
                    {
                        "field_key": "impression",
                        "field_name": "Impression",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Provide a specialist assessment and impression based on the consultation.\n2. Address the specific consult question directly and clearly.\n3. Include relevant differential diagnoses when appropriate.\n4. Note the severity, prognosis, or clinical significance of findings.\n5. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n6. Be focused and authoritative - 2-4 sentences capturing the specialist's opinion.",
                        "initial_prompt": "Impression: ",
                        "style_example": "New-onset atrial fibrillation in a patient with CHA2DS2-VASc score of 3 (age, hypertension, diabetes). No structural heart disease on recent echo. Low risk given short duration and minimal symptoms. Rhythm control with electrical cardioversion is a reasonable option given patient age and preference, though rate control is also appropriate.",
                    },
                    {
                        "field_key": "recommendations",
                        "field_name": "Recommendations",
                        "field_type": "text",
                        "persistent": False,
                        "system_prompt": "You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract specific recommendations for the referring provider to implement.\n2. Include medication recommendations with dosing when specified.\n3. Note any suggested investigations, referrals, or follow-up arrangements.\n4. Include any precautions, warning signs, or reasons to re-consult.\n5. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n6. Present as clear, actionable recommendations - use bullet points or numbered format.",
                        "initial_prompt": "Recommendations:\n-",
                        "format_schema": {
                            "bullet_char": "-",
                            "type": "bullet",
                        },
                        "style_example": "- Start anticoagulation with apixaban 5mg BD (CrCl >30ml/min)\n- Discuss options for rhythm vs. rate control with patient\n- If rhythm control chosen: arrange for electrical cardioversion, consider starting amiodarone or sotalol for rhythm maintenance\n- If rate control chosen: start metoprolol 25mg BD, titrate to HR 60-80\n- Follow-up with cardiology in 4-6 weeks post-cardioversion or once rate controlled\n- Re-consult if any concerning symptoms develop (palpitations, syncope, dyspnea)",
                    },
                    cls.get_plan_field(),  # Add standard plan field
                ],
            },
        ]
