"""
Synthetic seed data for Medi-IQ (prototype — not real patients).

Each patient is written as a few plain-English clinical notes across different
hospitals and years. Cognee turns these into a knowledge graph. The text is
deliberately explicit (drug names, years, hospitals, doctors, reactions) so the
extracted graph is rich and the Silent Guardian golden path is reliable.

Bump SEED_VERSION whenever the text changes so startup re-ingests.
"""

SEED_VERSION = "v1"

# The hero drug used for the Guardian demo on PT-4821.
HERO_DRUG = "penicillin"

PATIENTS = [
    {
        "code": "PT-4821",
        "name": "Meera Nair",
        "documents": [
            # --- 2021, hero reaction, different hospital + different doctor ---
            "Clinical note. Patient Meera Nair, medical record code PT-4821. "
            "In 2021 at Apollo Hospital, Dr. Sunita Rao treated Meera Nair for a "
            "chest infection and prescribed penicillin. Meera Nair suffered a severe "
            "anaphylactic allergic reaction to penicillin and was admitted to the ICU. "
            "Dr. Sunita Rao recorded a confirmed drug allergy to penicillin and to the "
            "penicillin-class antibiotic amoxicillin. This penicillin allergy is a "
            "life-threatening contraindication for Meera Nair.",
            # --- 2022, different hospital, diabetes ---
            "Clinical note. Patient Meera Nair, code PT-4821. In 2022 at Fortis "
            "Hospital, Dr. Anil Gupta diagnosed Meera Nair with type-2 diabetes after "
            "an HbA1c lab result of 8.1 percent. Dr. Anil Gupta prescribed metformin to "
            "control the type-2 diabetes.",
            # --- 2023, different hospital, hypertension ---
            "Clinical note. Patient Meera Nair, code PT-4821. In 2023 at Max Healthcare, "
            "Dr. Priya Menon diagnosed Meera Nair with hypertension after a blood "
            "pressure reading of 150 over 95. Dr. Priya Menon prescribed amlodipine for "
            "the hypertension.",
            # --- Family history (hereditary pattern) ---
            "Family history for patient Meera Nair, code PT-4821. Meera Nair's father "
            "Rajesh Nair was diagnosed with type-2 diabetes at age 50. Meera Nair's "
            "sister Kavya Nair was diagnosed with type-2 diabetes at age 45. Type-2 "
            "diabetes runs in the Nair family as a hereditary condition, and Meera Nair "
            "herself developed type-2 diabetes at a similar age.",
        ],
    },
    {
        "code": "PT-7003",
        "name": "Arjun Sharma",
        "documents": [
            "Clinical note. Patient Arjun Sharma, code PT-7003. In 2020 at AIIMS Delhi, "
            "Dr. Rekha Iyer diagnosed Arjun Sharma with asthma and prescribed a "
            "salbutamol inhaler for the asthma.",
            "Clinical note. Patient Arjun Sharma, code PT-7003. In 2021 at Medanta "
            "Hospital, Dr. Vikram Bose treated Arjun Sharma for a fractured wrist and "
            "prescribed ibuprofen for pain relief.",
            "Clinical note. Patient Arjun Sharma, code PT-7003. In 2023 at AIIMS Delhi, "
            "Dr. Rekha Iyer diagnosed Arjun Sharma with seasonal allergic rhinitis and "
            "prescribed cetirizine.",
        ],
    },
    {
        "code": "PT-5567",
        "name": "Fatima Khan",
        "documents": [
            "Clinical note. Patient Fatima Khan, code PT-5567. In 2019 at Manipal "
            "Hospital, Dr. Naveen Reddy diagnosed Fatima Khan with chronic migraine and "
            "prescribed sumatriptan.",
            "Clinical note. Patient Fatima Khan, code PT-5567. In 2021 at Narayana "
            "Health, Dr. Shalini Das diagnosed Fatima Khan with hypothyroidism after a "
            "high TSH lab result and prescribed levothyroxine.",
            "Clinical note. Patient Fatima Khan, code PT-5567. In 2022 at Manipal "
            "Hospital, Dr. Naveen Reddy diagnosed Fatima Khan with iron-deficiency "
            "anemia and prescribed ferrous sulfate.",
        ],
    },
    {
        "code": "PT-3120",
        "name": "David Thomas",
        "documents": [
            "Clinical note. Patient David Thomas, code PT-3120. In 2018 at CMC Vellore, "
            "Dr. George Kurian diagnosed David Thomas with high cholesterol after a "
            "lipid panel and prescribed atorvastatin.",
            "Clinical note. Patient David Thomas, code PT-3120. In 2020 at Apollo "
            "Hospital, Dr. Latha Menon diagnosed David Thomas with GERD (acid reflux) "
            "and prescribed omeprazole.",
            "Clinical note. Patient David Thomas, code PT-3120. In 2022 at CMC Vellore, "
            "Dr. George Kurian diagnosed David Thomas with type-2 diabetes after an "
            "HbA1c lab result of 7.6 percent and prescribed metformin.",
        ],
    },
]

# Quick lookups.
PATIENTS_BY_CODE = {p["code"]: p for p in PATIENTS}
PATIENT_CODES = [p["code"] for p in PATIENTS]


def patient_name(code: str) -> str | None:
    p = PATIENTS_BY_CODE.get(code)
    return p["name"] if p else None
