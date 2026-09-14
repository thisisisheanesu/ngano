/**
 * Test fixtures. Every record here is copied verbatim from the real data files, so the
 * renderers are exercised against the awkward shapes the catalogue actually contains:
 * a self-reported size, a record with no stated hours, a record with no repository,
 * a record whose source describes its coverage in prose and so carries no language
 * tags at all, a regional variety tag, angle brackets inside a note, and island states
 * with no polygon.
 *
 * The language records are complete, and the registry is cut to the tags these
 * datasets use. Nothing else is altered.
 *
 * The geometry is the real GeoJSON with its rings decimated, so the projection and the
 * map_name join are exercised without carrying 80 KB of coordinates into the test run.
 */

import type { Country, Credits, Dataset, Language, LanguageCodes } from '../types';
import type { SnippetSet } from './context';

export const DATASETS = [
  {
    "id": "fleurs-few-shot-learning-evaluation-of-universal-representations",
    "name": "FLEURS (Few-shot Learning Evaluation of Universal Representations of Speech)",
    "task": "ASR",
    "variety": "Indigenous",
    "languages": [
      "Afrikaans",
      "Amharic",
      "Fula",
      "Hausa",
      "Igbo",
      "Kamba",
      "Luganda",
      "Lingala",
      "Dholuo (Luo)",
      "Northern Sotho",
      "Nyanja (Chichewa)",
      "Oromo",
      "Shona",
      "Somali",
      "Swahili",
      "Umbundu",
      "Wolof",
      "Xhosa",
      "Yoruba",
      "Zulu",
      "Egyptian Arabic",
      "Nyanja",
      "Cape Verdean Creole (Kabuverdianu)",
      "isiXhosa",
      "isiZulu",
      "Sepedi (Northern Sotho)",
      "Luo"
    ],
    "languages_clean": [
      "Afrikaans",
      "Amharic",
      "Fula",
      "Hausa",
      "Igbo",
      "Kamba (Kenya)",
      "Luganda",
      "Lingala",
      "Dholuo",
      "Sepedi",
      "Chichewa",
      "Oromo",
      "Shona",
      "Somali",
      "Swahili",
      "Umbundu",
      "Wolof",
      "isiXhosa",
      "Yoruba",
      "isiZulu",
      "Egyptian Arabic",
      "Kabuverdianu"
    ],
    "iso": [
      "afr",
      "amh",
      "ful",
      "hau",
      "ibo",
      "kam",
      "lug",
      "lin",
      "luo",
      "nso",
      "nya",
      "gaz",
      "sna",
      "som",
      "swh",
      "umb",
      "wol",
      "xho",
      "yor",
      "zul",
      "arz",
      "kea"
    ],
    "countries": [
      "Pan-African",
      "Nigeria",
      "Zimbabwe",
      "Malawi",
      "Angola",
      "Cabo Verde",
      "South Africa",
      "Senegal",
      "Niger",
      "Kenya",
      "Uganda",
      "Tanzania",
      "Ethiopia",
      "Somalia",
      "Democratic Republic of the Congo"
    ],
    "country_codes": [
      "NG",
      "ZW",
      "MW",
      "AO",
      "CV",
      "ZA",
      "SN",
      "NE",
      "KE",
      "UG",
      "TZ",
      "ET",
      "SO",
      "CD"
    ],
    "regions": [
      "Central Africa",
      "East Africa",
      "Horn of Africa",
      "Southern Africa",
      "West Africa"
    ],
    "hours": "~12 per language (~250 for the African subset)",
    "hours_num": 12.0,
    "speakers": null,
    "recording_type": "read",
    "quality": "Unstated",
    "labelled": "Transcribed",
    "domain": "General / unstated",
    "licence": "CC-BY-4.0",
    "licence_class": "Attribution (CC-BY)",
    "commercial": "Yes",
    "access": "Open",
    "host": "HuggingFace",
    "url": "https://huggingface.co/datasets/google/fleurs",
    "hf_repo": "google/fleurs",
    "year": "2022",
    "notes": "102-language n-way parallel read corpus built on FLORES-101 text; ~10 h train + dev/test per language. The de facto evaluation set for African languages in Whisper, MMS, SeamlessM4T and USM papers. Small per-language volume means it is an eval set, not a training corpus.",
    "unverified_size": false,
    "language_tags": [
      "afr",
      "amh",
      "ful",
      "hau",
      "ibo",
      "kam",
      "lug",
      "lin",
      "luo",
      "nso",
      "nya",
      "gaz",
      "sna",
      "som",
      "swh",
      "umb",
      "wol",
      "xho",
      "yor",
      "zul",
      "arz",
      "kea"
    ],
    "language_codes": [
      "afr",
      "amh",
      "ful",
      "hau",
      "ibo",
      "kam",
      "lug",
      "lin",
      "luo",
      "nso",
      "nya",
      "gaz",
      "sna",
      "som",
      "swh",
      "umb",
      "wol",
      "xho",
      "yor",
      "zul",
      "arz",
      "kea"
    ]
  },
  {
    "id": "swahili-call-center-audio-dataset-single-channel",
    "name": "Swahili Call Center Audio Dataset (single channel)",
    "task": "ASR",
    "variety": "Indigenous",
    "languages": [
      "Swahili"
    ],
    "languages_clean": [
      "Swahili"
    ],
    "iso": [
      "swh"
    ],
    "countries": [
      "Tanzania",
      "Kenya",
      "Uganda"
    ],
    "country_codes": [
      "TZ",
      "KE",
      "UG"
    ],
    "regions": [
      "East Africa"
    ],
    "hours": "194331",
    "hours_num": 194331.0,
    "speakers": null,
    "recording_type": "telephone",
    "quality": "Narrowband (8 kHz)",
    "labelled": "Transcribed",
    "domain": "Call centre / telephony",
    "licence": "CC-BY-4.0",
    "licence_class": "Attribution (CC-BY)",
    "commercial": "Yes",
    "access": "Open",
    "host": "HuggingFace",
    "url": "https://huggingface.co/datasets/InfoBayAI/Swahili-Call-Center-Audio-Dataset-Single-Channel",
    "hf_repo": "InfoBayAI/Swahili-Call-Center-Audio-Dataset-Single-Channel",
    "year": "2024",
    "notes": "Vendor-scale 8 kHz call-centre audio claimed at 194k hrs split by locale (sw 77.8k, KE 111.2k, UG 5.3k) with PII muting; the hour claim is very large and unverified - treat with caution, but it is the only telephone-domain Swahili corpus at scale.",
    "unverified_size": true,
    "language_tags": [
      "swh"
    ],
    "language_codes": [
      "swh"
    ]
  },
  {
    "id": "afrivoice-swahili-digital-umuganda",
    "name": "Afrivoice_Swahili (Digital Umuganda)",
    "task": "ASR",
    "variety": "Indigenous",
    "languages": [
      "Swahili"
    ],
    "languages_clean": [
      "Swahili"
    ],
    "iso": [
      "swh"
    ],
    "countries": [
      "Kenya",
      "Tanzania"
    ],
    "country_codes": [
      "KE",
      "TZ"
    ],
    "regions": [
      "East Africa"
    ],
    "hours": "3217.56 collected / 3096.87 transcribed",
    "hours_num": 3217.56,
    "speakers": null,
    "recording_type": "spontaneous",
    "quality": "Unstated",
    "labelled": "Transcribed",
    "domain": "Parliament / government",
    "licence": "CC-BY-4.0",
    "licence_class": "Attribution (CC-BY)",
    "commercial": "Yes",
    "access": "Open",
    "host": "HuggingFace",
    "url": "https://huggingface.co/datasets/DigitalUmuganda/Afrivoice_Swahili",
    "hf_repo": "DigitalUmuganda/Afrivoice_Swahili",
    "year": "2025",
    "notes": "Largest open transcribed corpus for any African language: 561,139 clips, ~249 GB, image-prompted speech across agriculture (744 h), health (618 h), finance (606 h), government (579 h) and education (550 h), locale sw_KE. CC-BY-4.0. Apparently the Swahili node of African Next Voices.",
    "unverified_size": false,
    "language_tags": [
      "swh"
    ],
    "language_codes": [
      "swh"
    ]
  },
  {
    "id": "orinode-nigerian-speech-corpus",
    "name": "Orinode Nigerian speech corpus",
    "task": "ASR+TTS",
    "variety": "Code-switch",
    "languages": [
      "Nigerian English",
      "Hausa",
      "Yoruba",
      "Igbo",
      "Nigerian Pidgin"
    ],
    "languages_clean": [
      "English (Nigeria)",
      "Hausa",
      "Yoruba",
      "Igbo",
      "Nigerian Pidgin"
    ],
    "iso": [
      "eng",
      "hau",
      "yor",
      "ibo",
      "pcm"
    ],
    "countries": [
      "Nigeria"
    ],
    "country_codes": [
      "NG"
    ],
    "regions": [
      "West Africa"
    ],
    "hours": "1500",
    "hours_num": 1500.0,
    "speakers": null,
    "recording_type": "mixed",
    "quality": "Crowdsourced / web",
    "labelled": "Transcribed",
    "domain": "General / unstated",
    "licence": "commercial/paid",
    "licence_class": "Commercial (purchase)",
    "commercial": "Yes, if purchased",
    "access": "Paid",
    "host": "vendor site",
    "url": "https://orinode.ai/",
    "hf_repo": null,
    "year": "2026",
    "notes": "1,500+ h of crowdsourced, commercially-consented Nigerian speech including deliberate code-switching; corpus is proprietary, though a 15,000-sentence code-switch text corpus is open-sourced. Contributors paid above local rates.",
    "unverified_size": false,
    "language_tags": [
      "eng-NG",
      "hau",
      "yor",
      "ibo",
      "pcm"
    ],
    "language_codes": [
      "eng",
      "hau",
      "yor",
      "ibo",
      "pcm"
    ]
  },
  {
    "id": "meta-mms-lab-massively-multilingual-speech-labelled",
    "name": "Meta MMS-lab (Massively Multilingual Speech, labelled)",
    "task": "ASR+TTS",
    "variety": "Indigenous",
    "languages": [
      "~340 African languages (New Testament readings)",
      "Lingala",
      "Sango",
      "Fang",
      "Basaa",
      "Ewondo",
      "Kikongo",
      "Tshiluba",
      "Congolese Swahili",
      "~1,500+ African languages/dialects",
      "~400+ African languages"
    ],
    "languages_clean": [
      "Lingala",
      "Sango",
      "Fang (Equatorial Guinea)",
      "Basaa",
      "Ewondo",
      "Kikongo",
      "Tshiluba",
      "Congolese Swahili"
    ],
    "iso": [
      "lin",
      "sag",
      "fan",
      "bas",
      "ewo",
      "kng",
      "lua",
      "swc"
    ],
    "countries": [
      "Pan-African"
    ],
    "country_codes": [],
    "regions": [],
    "hours": "44,700 (1,107 languages; ~32 h/language)",
    "hours_num": 44700.0,
    "speakers": "~1 per language",
    "recording_type": "read",
    "quality": "Narrowband (8 kHz)",
    "labelled": "Unlabelled",
    "domain": "Religious / scripture",
    "licence": "unclear",
    "licence_class": "Unstated",
    "commercial": "Unstated",
    "access": "Request",
    "host": "Meta / fairseq",
    "url": "https://arxiv.org/abs/2305.13516",
    "hf_repo": null,
    "year": "2023",
    "notes": "Aligned single-speaker New Testament readings in 1,107 languages, 36.8k h train / 3.5k dev / 4.4k test. Africa is the largest single region: the released ASR model covers 363 African languages and 91% of them reach CER<=5%. The audio itself is NOT openly redistributed (third-party scripture copyright) - only the models are; practitioners must re-derive alignments from the source Bible audio.",
    "unverified_size": true,
    "language_tags": [
      "lin",
      "sag",
      "fan",
      "bas",
      "ewo",
      "kon",
      "lua",
      "swc"
    ],
    "language_codes": [
      "lin",
      "sag",
      "fan",
      "bas",
      "ewo",
      "kon",
      "lua",
      "swc"
    ]
  },
  {
    "id": "global-recordings-network-grn-audio-library",
    "name": "Global Recordings Network (GRN) audio library",
    "task": "Raw source",
    "variety": "Indigenous",
    "languages": [
      "Thousands of African languages and dialects",
      "many African languages, creoles and pidgins"
    ],
    "languages_clean": [],
    "iso": [],
    "countries": [
      "Pan-African"
    ],
    "country_codes": [],
    "regions": [],
    "hours": "~9,345 harvested worldwide (MMS crawl)",
    "hours_num": 9345.0,
    "speakers": null,
    "recording_type": "read",
    "quality": "Unstated",
    "labelled": "Unlabelled",
    "domain": "Religious / scripture",
    "licence": "unclear",
    "licence_class": "Unstated",
    "commercial": "Unstated",
    "access": "Scrape required",
    "host": "Global Recordings Network",
    "url": "https://globalrecordings.net/en/languages",
    "hf_repo": null,
    "year": null,
    "notes": "Gospel-message and Bible-story audio in more than 6,000 languages and dialects - by far the widest language coverage of any African audio source, including many languages with no other recordings. Short programmes, variable recording quality, language labels only (no transcripts). This is exactly the corpus Meta crawled to build MMS-unlab (3,809 usable languages).",
    "unverified_size": false,
    "language_tags": [],
    "language_codes": [],
    "language_note": "This source describes its coverage in prose rather than naming individual languages, so it carries no ISO 639-3 codes. The source's own wording is kept in `languages`."
  },
  {
    "id": "1rsh-speech-qa-bhojpuri-hi-karya",
    "name": "1rsh/speech-qa-bhojpuri-hi-karya",
    "task": "ASR",
    "variety": "Indigenous",
    "languages": [
      "Bhojpuri",
      "Hindi"
    ],
    "languages_clean": [
      "Bhojpuri",
      "Hindi"
    ],
    "iso": [
      "bho",
      "hin"
    ],
    "countries": [
      "Mauritius"
    ],
    "country_codes": [
      "MU"
    ],
    "regions": [
      "Island states"
    ],
    "hours": null,
    "hours_num": null,
    "speakers": null,
    "recording_type": "spontaneous",
    "quality": "Unstated",
    "labelled": "Transcribed",
    "domain": "General / unstated",
    "licence": "unclear",
    "licence_class": "Unstated",
    "commercial": "Unstated",
    "access": "Open",
    "host": "HuggingFace",
    "url": "https://huggingface.co/datasets/1rsh/speech-qa-bhojpuri-hi-karya",
    "hf_repo": "1rsh/speech-qa-bhojpuri-hi-karya",
    "year": "2024",
    "notes": "ADJACENT (Indian Bhojpuri): Karya-collected spoken question-answering audio in Bhojpuri/Hindi; multi-purpose but usable as ASR material for Bhojpuri transfer.",
    "unverified_size": false,
    "language_tags": [
      "bho",
      "hin"
    ],
    "language_codes": [
      "bho",
      "hin"
    ]
  },
  {
    "id": "worldspeech-disco-eth",
    "name": "WorldSpeech (disco-eth)",
    "task": "ASR+TTS",
    "variety": "Indigenous",
    "languages": [
      "Amharic",
      "Tigrinya",
      "Oromo"
    ],
    "languages_clean": [
      "Amharic",
      "Tigrinya",
      "Oromo"
    ],
    "iso": [
      "amh",
      "tir",
      "gaz"
    ],
    "countries": [
      "Ethiopia",
      "Eritrea"
    ],
    "country_codes": [
      "ET",
      "ER"
    ],
    "regions": [
      "Horn of Africa"
    ],
    "hours": "65072 total (all 88 languages)",
    "hours_num": 65072.0,
    "speakers": null,
    "recording_type": "broadcast",
    "quality": "Broadcast",
    "labelled": "Transcribed",
    "domain": "Broadcast news",
    "licence": "CC-BY-NC-4.0",
    "licence_class": "NonCommercial",
    "commercial": "No",
    "access": "Open",
    "host": "HuggingFace",
    "url": "https://huggingface.co/datasets/disco-eth/WorldSpeech",
    "hf_repo": "disco-eth/WorldSpeech",
    "year": "2026",
    "notes": "24 kHz corpus mined from national parliaments, public broadcasters, public-domain audiobooks and international institutions, with CER/SNR/DNSMOS quality scores; Horn languages are tagged but hour shares are small.",
    "unverified_size": true,
    "language_tags": [
      "amh",
      "tir",
      "gaz"
    ],
    "language_codes": [
      "amh",
      "tir",
      "gaz"
    ]
  },
  {
    "id": "lugandasolospeech-1k",
    "name": "LugandaSoloSpeech_1K",
    "task": "Raw source",
    "variety": "Indigenous",
    "languages": [
      "Luganda"
    ],
    "languages_clean": [
      "Luganda"
    ],
    "iso": [
      "lug"
    ],
    "countries": [
      "Uganda"
    ],
    "country_codes": [
      "UG"
    ],
    "regions": [
      "East Africa"
    ],
    "hours": "1000",
    "hours_num": 1000.0,
    "speakers": null,
    "recording_type": "broadcast",
    "quality": "Standard (16 kHz)",
    "labelled": "Unlabelled",
    "domain": "Broadcast news",
    "licence": "unclear",
    "licence_class": "Unstated",
    "commercial": "Unstated",
    "access": "Open",
    "host": "HuggingFace",
    "url": "https://huggingface.co/datasets/allandclive/LugandaSoloSpeech_1K",
    "hf_repo": "allandclive/LugandaSoloSpeech_1K",
    "year": null,
    "notes": "~1,000 hrs of UNLABELLED Luganda audio scraped from radio shows and YouTube (43.8 GB MP3, 16 kHz); for self-supervised pretraining, quality varies from clean to music-over-speech.",
    "unverified_size": false,
    "language_tags": [
      "lug"
    ],
    "language_codes": [
      "lug"
    ]
  },
  {
    "id": "bibletts",
    "name": "BibleTTS",
    "task": "TTS",
    "variety": "Indigenous",
    "languages": [
      "Asante Twi",
      "Akuapem Twi",
      "Ewe",
      "Hausa",
      "Lingala",
      "Yoruba",
      "Akan"
    ],
    "languages_clean": [
      "Twi",
      "Ewe",
      "Hausa",
      "Lingala",
      "Yoruba",
      "Akan"
    ],
    "iso": [
      "aka",
      "ewe",
      "hau",
      "lin",
      "yor",
      "twi"
    ],
    "countries": [
      "Ghana",
      "Nigeria",
      "Togo",
      "Democratic Republic of the Congo",
      "Pan-African",
      "Niger",
      "Benin",
      "Republic of the Congo"
    ],
    "country_codes": [
      "GH",
      "NG",
      "TG",
      "CD",
      "NE",
      "BJ",
      "CG"
    ],
    "regions": [
      "Central Africa",
      "West Africa"
    ],
    "hours": "up to 80 per language (~480 aligned)",
    "hours_num": 80.0,
    "speakers": "1 per language",
    "recording_type": "studio-TTS",
    "quality": "Studio (44.1–48 kHz)",
    "labelled": "Transcribed",
    "domain": "Religious / scripture",
    "licence": "CC-BY-SA-4.0",
    "licence_class": "Attribution + ShareAlike",
    "commercial": "Yes",
    "access": "Open",
    "host": "OpenSLR",
    "url": "https://www.openslr.org/129/",
    "hf_repo": null,
    "year": "2022",
    "notes": "Highest-quality open African TTS corpus: single-speaker, studio, 48 kHz, verse-aligned, commercial-friendly licence. Six aligned languages plus four further unaligned languages. Produced by Biblica/Open.Bible with Masakhane and CMU collaborators (Interspeech 2022).",
    "unverified_size": false,
    "language_tags": [
      "twi",
      "ewe",
      "hau",
      "lin",
      "yor",
      "aka"
    ],
    "language_codes": [
      "twi",
      "ewe",
      "hau",
      "lin",
      "yor",
      "aka"
    ]
  },
  {
    "id": "niger-mali-audio-collection-studio-kalangou-studio-tamani",
    "name": "Niger-Mali Audio Collection (Studio Kalangou / Studio Tamani)",
    "task": "Raw source",
    "variety": "Indigenous",
    "languages": [
      "Tamasheq",
      "French",
      "Fulfulde",
      "Hausa",
      "Zarma"
    ],
    "languages_clean": [
      "Tamasheq",
      "French",
      "Fula",
      "Hausa",
      "Zarma"
    ],
    "iso": [
      "taq",
      "fra",
      "ful",
      "hau",
      "dje"
    ],
    "countries": [
      "Niger",
      "Mali"
    ],
    "country_codes": [
      "NE",
      "ML"
    ],
    "regions": [
      "West Africa"
    ],
    "hours": "671",
    "hours_num": 671.0,
    "speakers": null,
    "recording_type": "broadcast",
    "quality": "Studio (44.1–48 kHz)",
    "labelled": "Unlabelled",
    "domain": "Broadcast news",
    "licence": "CC-BY-NC-ND-3.0",
    "licence_class": "NonCommercial + NoDerivatives",
    "commercial": "No",
    "access": "Open",
    "host": "LIA Avignon",
    "url": "https://demo-lia.univ-avignon.fr/studios-tamani-kalangou/",
    "hf_repo": null,
    "year": "2022",
    "notes": "671 h raw / 641 h auto-segmented radio audio including 224 h of Tamasheq and 111 h of Nigerien French - unlabelled, intended for self-supervised pre-training; the largest Tuareg audio pool in existence and also a source of West/North African accented French.",
    "unverified_size": false,
    "language_tags": [
      "taq",
      "fra",
      "ful",
      "hau",
      "dje"
    ],
    "language_codes": [
      "taq",
      "fra",
      "ful",
      "hau",
      "dje"
    ]
  },
  {
    "id": "mozilla-common-voice-v26-0-scripted-speech-african-languages",
    "name": "Mozilla Common Voice v26.0 (Scripted Speech) - African languages",
    "task": "ASR+TTS",
    "variety": "Indigenous",
    "languages": [
      "Kinyarwanda",
      "Swahili",
      "Kabyle",
      "Luganda",
      "Arabic",
      "Dholuo (Luo)",
      "Kalenjin",
      "Taita (Dawida)",
      "Igbo",
      "Oromo",
      "Dagbani",
      "Yoruba",
      "Hausa",
      "Nigerian Pidgin",
      "Ibibio",
      "Amharic",
      "Afrikaans",
      "Tswana",
      "Twi",
      "Dyula",
      "Tigre",
      "Standard Moroccan Tamazight",
      "Zulu",
      "Xhosa",
      "Northern Sotho",
      "Southern Sotho",
      "Swati",
      "Venda",
      "Tsonga",
      "Southern Ndebele",
      "Tigrinya",
      "Basaa",
      "Duala",
      "Ewondo",
      "Ghomala",
      "Medumba",
      "Ngiemboon",
      "Bafia",
      "Bamun",
      "Fe'fe'",
      "Kom",
      "Bafut",
      "Bulu",
      "Eton",
      "Mundang",
      "Tupuri",
      "Mada",
      "Kwasio",
      "Mungaka",
      "Tunen",
      "Cameroon Pidgin",
      "Chokwe",
      "Luba-Kasai",
      "Hemba",
      "Nyungwe",
      "Baoule",
      "Aja",
      "Gen",
      "Nawdm",
      "Tem",
      "Baatonum",
      "Ebrie",
      "Adamawa Fulfulde",
      "Borgu Fulfulde",
      "Fang",
      "Koti",
      "Rombo",
      "Musey",
      "Gidar",
      "South Giziga",
      "Northwest Gbaya",
      "Masana",
      "Mpiemo",
      "Mbum",
      "Mpumpong",
      "Bankon",
      "Batanga",
      "Bakoko",
      "Mokpwe",
      "Bebele",
      "Bamenyam",
      "Tuki",
      "Ngombale",
      "Yangben",
      "Wuzlam",
      "Musgu",
      "Ngomba",
      "Mbo",
      "Akan",
      "French"
    ],
    "languages_clean": [
      "Kinyarwanda",
      "Swahili",
      "Kabyle",
      "Luganda",
      "Arabic",
      "Dholuo",
      "Kalenjin",
      "Taita",
      "Igbo",
      "Oromo",
      "Dagbani",
      "Yoruba",
      "Hausa",
      "Nigerian Pidgin",
      "Ibibio",
      "Amharic",
      "Afrikaans",
      "Setswana",
      "Twi",
      "Dioula",
      "Tigre",
      "Standard Moroccan Tamazight",
      "isiZulu",
      "isiXhosa",
      "Sepedi",
      "Sesotho",
      "siSwati",
      "Tshivenda",
      "Xitsonga",
      "isiNdebele",
      "Tigrinya",
      "Basaa",
      "Duala",
      "Ewondo",
      "Ghomala",
      "Medumba",
      "Ngiemboon",
      "Bafia",
      "Bamun",
      "Fe'fe'",
      "Kom (Cameroon)",
      "Bafut",
      "Bulu",
      "Eton (Cameroon)",
      "Mundang",
      "Tupuri",
      "Mada (Cameroon)",
      "Kwasio",
      "Mungaka",
      "Tunen",
      "Cameroonian Pidgin",
      "Chokwe",
      "Tshiluba",
      "Hemba",
      "Nyungwe",
      "Baoule",
      "Aja (Benin)",
      "Gen",
      "Nawdm",
      "Tem",
      "Baatonum",
      "Ebrié",
      "Adamawa Fulfulde",
      "Borgu Fulfulde",
      "Fang (Equatorial Guinea)",
      "Koti",
      "Rombo",
      "Musey",
      "Gidar",
      "South Giziga",
      "Northwest Gbaya",
      "Masana",
      "Mpiemo",
      "Mbum",
      "Mpumpong",
      "Bankon",
      "Batanga",
      "Bakoko",
      "Mokpwe",
      "Bebele",
      "Bamenyam",
      "Tuki",
      "Ngombale",
      "Yangben",
      "Wuzlam",
      "Musgu",
      "Ngomba",
      "Mbo (Cameroon)",
      "Akan",
      "French"
    ],
    "iso": [
      "kin",
      "swh",
      "kab",
      "lug",
      "ara",
      "luo",
      "kln",
      "dav",
      "ibo",
      "gaz",
      "dag",
      "yor",
      "hau",
      "pcm",
      "ibb",
      "amh",
      "afr",
      "tsn",
      "twi",
      "dyu",
      "tig",
      "zgh",
      "zul",
      "xho",
      "nso",
      "sot",
      "ssw",
      "ven",
      "tso",
      "nbl",
      "arb",
      "aka",
      "fra"
    ],
    "countries": [
      "Pan-African",
      "Algeria",
      "Egypt",
      "Sudan",
      "Morocco",
      "Tunisia",
      "Libya",
      "Mauritania",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Nigeria",
      "Benin"
    ],
    "country_codes": [
      "DZ",
      "EG",
      "SD",
      "MA",
      "TN",
      "LY",
      "MR",
      "ER",
      "ET",
      "GH",
      "NG",
      "BJ"
    ],
    "regions": [
      "Horn of Africa",
      "North Africa",
      "West Africa"
    ],
    "hours": "~5,700 (African subset of 42,388 total)",
    "hours_num": 5700.0,
    "speakers": "1607",
    "recording_type": "read",
    "quality": "Crowdsourced / web",
    "labelled": "Transcribed",
    "domain": "Read / prompted",
    "licence": "CC0",
    "licence_class": "Public domain / CC0",
    "commercial": "Yes",
    "access": "Open",
    "host": "Mozilla / Common Voice",
    "url": "https://commonvoice.mozilla.org/en/languages",
    "hf_repo": null,
    "year": "2026",
    "notes": "Largest single open multilingual African speech resource: ~85 African languages in v26.0. Verified per-language total hours: Kinyarwanda 2384, Swahili 1065, Kabyle 694, Luganda 561, Arabic 158, Dholuo 112, Kalenjin 88, Taita 56, Oromo 26, Dagbani 28, Igbo 19, Ibibio 18, Nigerian Pidgin 15, Baatonum 14, Baoule 14, Hausa 13, Aja 13, Yoruba 8, Amharic 3, Afrikaans 1.7, Tswana 4.9, Twi 1.4; plus a large 2024-26 Cameroon/Central-Africa expansion of ~45 languages at roughly 10-19 h each (Basaa, Duala, Ewondo, Ghomala, Medumba, Bafut, Kom, Bamun, Fe'fe', Bulu, Eton, Mundang, Tupuri, Mada, Kwasio, Tunen, Cameroon Pidgin, Chokwe, Luba-Kasai, Hemba, Nyungwe, Koti, Rombo, Tem, Nawdm, Gen, Fang, etc.). Validated hours are typically 60-90% of total; South African languages (Zulu, Xhosa, Venda, Tsonga, Ndebele, Sotho) are near-empty (<5 h).",
    "unverified_size": false,
    "language_tags": [
      "kin",
      "swh",
      "kab",
      "lug",
      "ara",
      "luo",
      "kln",
      "dav",
      "ibo",
      "gaz",
      "dag",
      "yor",
      "hau",
      "pcm",
      "ibb",
      "amh",
      "afr",
      "tsn",
      "twi",
      "dyu",
      "tig",
      "zgh",
      "zul",
      "xho",
      "nso",
      "sot",
      "ssw",
      "ven",
      "tso",
      "nbl",
      "tir",
      "bas",
      "dua",
      "ewo",
      "bbj",
      "byv",
      "nnh",
      "ksf",
      "bax",
      "fmp",
      "bkm",
      "bfd",
      "bum",
      "eto",
      "mua",
      "tui",
      "mxu",
      "nmg",
      "mhk",
      "tvu",
      "wes",
      "cjk",
      "lua",
      "hem",
      "nyu",
      "bci",
      "ajg",
      "gej",
      "nmz",
      "kdh",
      "bba",
      "ebr",
      "fub",
      "fue",
      "fan",
      "eko",
      "rof",
      "mse",
      "gid",
      "giz",
      "gya",
      "mcn",
      "mcx",
      "mdd",
      "mgg",
      "abb",
      "bnm",
      "bkh",
      "bri",
      "beb",
      "bce",
      "bag",
      "nla",
      "yav",
      "udl",
      "mug",
      "jgo",
      "mbo",
      "aka",
      "fra"
    ],
    "language_codes": [
      "kin",
      "swh",
      "kab",
      "lug",
      "ara",
      "luo",
      "kln",
      "dav",
      "ibo",
      "gaz",
      "dag",
      "yor",
      "hau",
      "pcm",
      "ibb",
      "amh",
      "afr",
      "tsn",
      "twi",
      "dyu",
      "tig",
      "zgh",
      "zul",
      "xho",
      "nso",
      "sot",
      "ssw",
      "ven",
      "tso",
      "nbl",
      "tir",
      "bas",
      "dua",
      "ewo",
      "bbj",
      "byv",
      "nnh",
      "ksf",
      "bax",
      "fmp",
      "bkm",
      "bfd",
      "bum",
      "eto",
      "mua",
      "tui",
      "mxu",
      "nmg",
      "mhk",
      "tvu",
      "wes",
      "cjk",
      "lua",
      "hem",
      "nyu",
      "bci",
      "ajg",
      "gej",
      "nmz",
      "kdh",
      "bba",
      "ebr",
      "fub",
      "fue",
      "fan",
      "eko",
      "rof",
      "mse",
      "gid",
      "giz",
      "gya",
      "mcn",
      "mcx",
      "mdd",
      "mgg",
      "abb",
      "bnm",
      "bkh",
      "bri",
      "beb",
      "bce",
      "bag",
      "nla",
      "yav",
      "udl",
      "mug",
      "jgo",
      "mbo",
      "aka",
      "fra"
    ]
  },
  {
    "id": "afrivoice-digital-umuganda-v1",
    "name": "Afrivoice (Digital Umuganda, v1)",
    "task": "ASR",
    "variety": "Indigenous",
    "languages": [
      "Shona",
      "Lingala",
      "Fulani (Pulaar)",
      "Malagasy",
      "Wolof",
      "Somali",
      "Fulani"
    ],
    "languages_clean": [
      "Shona",
      "Lingala",
      "Pulaar",
      "Malagasy",
      "Wolof",
      "Somali",
      "Fula"
    ],
    "iso": [
      "sna",
      "lin",
      "fuc",
      "plt",
      "wol",
      "som"
    ],
    "countries": [
      "Zimbabwe",
      "Democratic Republic of the Congo",
      "Senegal",
      "Madagascar",
      "Somalia",
      "Pan-African"
    ],
    "country_codes": [
      "ZW",
      "CD",
      "SN",
      "MG",
      "SO"
    ],
    "regions": [
      "Central Africa",
      "Horn of Africa",
      "Island states",
      "Southern Africa",
      "West Africa"
    ],
    "hours": "3201 collected / ~613 transcribed",
    "hours_num": 3201.0,
    "speakers": null,
    "recording_type": "spontaneous",
    "quality": "Unstated",
    "labelled": "Unlabelled",
    "domain": "Read / prompted",
    "licence": "CC-BY-4.0",
    "licence_class": "Attribution (CC-BY)",
    "commercial": "Yes",
    "access": "Open",
    "host": "HuggingFace",
    "url": "https://huggingface.co/datasets/DigitalUmuganda/Afrivoice",
    "hf_repo": "DigitalUmuganda/Afrivoice",
    "year": "2023",
    "notes": "Image-prompted triples (JPEG image + WAV description + transcript where available), ~1.21 TB. Per language: Shona 574 h (100 transcribed), Fulani 527 h (102), Wolof 531 h (103), Somali 536 h (105), Malagasy 516 h (102), Lingala 517 h (101). The transcribed slice is only ~100 h/language but the raw audio is enormous.",
    "unverified_size": false,
    "language_tags": [
      "sna",
      "lin",
      "fuc",
      "plt",
      "wol",
      "som",
      "ful"
    ],
    "language_codes": [
      "sna",
      "lin",
      "fuc",
      "plt",
      "wol",
      "som",
      "ful"
    ]
  },

  {
    "id": "shona-test-5hr",
    "name": "Shona_test_5hr",
    "task": "ASR",
    "variety": "Indigenous",
    "languages": [
      "Shona"
    ],
    "languages_clean": [
      "Shona"
    ],
    "iso": [
      "sna"
    ],
    "countries": [
      "Zimbabwe"
    ],
    "country_codes": [
      "ZW"
    ],
    "regions": [
      "Southern Africa"
    ],
    "hours": "5",
    "hours_num": 5.0,
    "speakers": null,
    "recording_type": "mixed",
    "quality": "Unstated",
    "labelled": "Transcribed",
    "domain": "General / unstated",
    "licence": "Unclear",
    "licence_class": "Unstated",
    "commercial": "Unstated",
    "access": "Open",
    "host": "HuggingFace",
    "url": "https://huggingface.co/datasets/Beijuka/Shona_test_5hr",
    "hf_repo": "Beijuka/Shona_test_5hr",
    "year": null,
    "notes": "Held-out 5-hour Shona evaluation split used in ASR-Africa benchmarking; handy for comparable WER reporting.",
    "unverified_size": false,
    "language_tags": [
      "sna"
    ],
    "language_codes": [
      "sna"
    ]
  }
] as unknown as Dataset[];

export const LANGUAGES = [
  {
    "tag": "afr",
    "iso639_3": "afr",
    "region": null,
    "name": "Afrikaans",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Afrikaans"
    ],
    "slug": "afr",
    "datasets": 31,
    "hours": 339.0,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Comoros",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Libya",
      "Madagascar",
      "Malawi",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Mayotte",
      "Morocco",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Rwanda",
      "Réunion",
      "Senegal",
      "Seychelles",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Tanzania",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "KM",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "LY",
      "MG",
      "MW",
      "ML",
      "MR",
      "MU",
      "YT",
      "MA",
      "MZ",
      "NA",
      "NE",
      "NG",
      "CG",
      "RW",
      "RE",
      "SN",
      "SC",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TZ",
      "TG",
      "TN",
      "UG",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "amh",
    "iso639_3": "amh",
    "region": null,
    "name": "Amharic",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Amharic"
    ],
    "slug": "amh",
    "datasets": 44,
    "hours": 1967.7,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Comoros",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Liberia",
      "Libya",
      "Madagascar",
      "Malawi",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Morocco",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Rwanda",
      "Senegal",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Tanzania",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "KM",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "LR",
      "LY",
      "MG",
      "MW",
      "ML",
      "MR",
      "MU",
      "MA",
      "MZ",
      "NA",
      "NE",
      "NG",
      "CG",
      "RW",
      "SN",
      "SL",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TZ",
      "TG",
      "TN",
      "UG",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "ful",
    "iso639_3": "ful",
    "region": null,
    "name": "Fula",
    "scope": "M",
    "type": "L",
    "aliases": [
      "Fula",
      "Fulani",
      "Fulfulde"
    ],
    "slug": "ful",
    "datasets": 21,
    "hours": 1445.4,
    "countries": [
      "Angola",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Burundi",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Madagascar",
      "Malawi",
      "Mali",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "São Tomé and Príncipe",
      "Tanzania",
      "Togo",
      "Uganda",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "AO",
      "BJ",
      "BW",
      "BF",
      "BI",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "MG",
      "MW",
      "ML",
      "MZ",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SL",
      "SO",
      "ZA",
      "ST",
      "TZ",
      "TG",
      "UG",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "hau",
    "iso639_3": "hau",
    "region": null,
    "name": "Hausa",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Hausa"
    ],
    "slug": "hau",
    "datasets": 47,
    "hours": 4165.1,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Liberia",
      "Libya",
      "Madagascar",
      "Malawi",
      "Mali",
      "Mauritania",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Rwanda",
      "Senegal",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Tanzania",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "LR",
      "LY",
      "MG",
      "MW",
      "ML",
      "MR",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "RW",
      "SN",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TZ",
      "TG",
      "TN",
      "UG",
      "ZW"
    ]
  },
  {
    "tag": "ibo",
    "iso639_3": "ibo",
    "region": null,
    "name": "Igbo",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Ehugbo Igbo",
      "Igbo"
    ],
    "slug": "ibo",
    "datasets": 26,
    "hours": 2657.4,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Liberia",
      "Libya",
      "Malawi",
      "Mali",
      "Mauritania",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Rwanda",
      "Senegal",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Tanzania",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "LR",
      "LY",
      "MW",
      "ML",
      "MR",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "RW",
      "SN",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TZ",
      "TG",
      "TN",
      "UG",
      "ZW"
    ]
  },
  {
    "tag": "kam",
    "iso639_3": "kam",
    "region": null,
    "name": "Kamba (Kenya)",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Kamba"
    ],
    "slug": "kam",
    "datasets": 4,
    "hours": 1.1,
    "countries": [
      "Angola",
      "Cabo Verde",
      "Democratic Republic of the Congo",
      "Ethiopia",
      "Kenya",
      "Malawi",
      "Niger",
      "Nigeria",
      "Rwanda",
      "Senegal",
      "Somalia",
      "South Africa",
      "Tanzania",
      "Uganda",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "TTS"
    ],
    "country_codes": [
      "AO",
      "CV",
      "CD",
      "ET",
      "KE",
      "MW",
      "NE",
      "NG",
      "RW",
      "SN",
      "SO",
      "ZA",
      "TZ",
      "UG",
      "ZW"
    ]
  },
  {
    "tag": "lug",
    "iso639_3": "lug",
    "region": null,
    "name": "Luganda",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Luganda"
    ],
    "slug": "lug",
    "datasets": 27,
    "hours": 1610.3,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Botswana",
      "Cabo Verde",
      "Democratic Republic of the Congo",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Kenya",
      "Libya",
      "Malawi",
      "Mauritania",
      "Morocco",
      "Mozambique",
      "Niger",
      "Nigeria",
      "Rwanda",
      "Senegal",
      "Somalia",
      "South Africa",
      "Sudan",
      "Tanzania",
      "Tunisia",
      "Uganda",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "BW",
      "CV",
      "CD",
      "EG",
      "ER",
      "ET",
      "GH",
      "KE",
      "LY",
      "MW",
      "MR",
      "MA",
      "MZ",
      "NE",
      "NG",
      "RW",
      "SN",
      "SO",
      "ZA",
      "SD",
      "TZ",
      "TN",
      "UG",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "lin",
    "iso639_3": "lin",
    "region": null,
    "name": "Lingala",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Lingala"
    ],
    "slug": "lin",
    "datasets": 44,
    "hours": 2247.7,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Burundi",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Liberia",
      "Madagascar",
      "Malawi",
      "Mali",
      "Mauritius",
      "Morocco",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Seychelles",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "São Tomé and Príncipe",
      "Tanzania",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "BW",
      "BF",
      "BI",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "LR",
      "MG",
      "MW",
      "ML",
      "MU",
      "MA",
      "MZ",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SC",
      "SL",
      "SO",
      "ZA",
      "ST",
      "TZ",
      "TG",
      "TN",
      "UG",
      "ZW"
    ]
  },
  {
    "tag": "luo",
    "iso639_3": "luo",
    "region": null,
    "name": "Dholuo",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Dholuo",
      "Dholuo (Luo)",
      "Luo"
    ],
    "slug": "luo",
    "datasets": 15,
    "hours": 1727.0,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Cabo Verde",
      "Democratic Republic of the Congo",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Kenya",
      "Libya",
      "Malawi",
      "Mauritania",
      "Morocco",
      "Mozambique",
      "Niger",
      "Nigeria",
      "Rwanda",
      "Senegal",
      "Somalia",
      "South Africa",
      "Sudan",
      "Tanzania",
      "Tunisia",
      "Uganda",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "CV",
      "CD",
      "EG",
      "ER",
      "ET",
      "GH",
      "KE",
      "LY",
      "MW",
      "MR",
      "MA",
      "MZ",
      "NE",
      "NG",
      "RW",
      "SN",
      "SO",
      "ZA",
      "SD",
      "TZ",
      "TN",
      "UG",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "nso",
    "iso639_3": "nso",
    "region": null,
    "name": "Sepedi",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Northern Sotho",
      "Sepedi",
      "Sepedi (Northern Sotho)"
    ],
    "slug": "nso",
    "datasets": 16,
    "hours": 255.2,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Comoros",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Libya",
      "Madagascar",
      "Malawi",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Mayotte",
      "Morocco",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Réunion",
      "Senegal",
      "Seychelles",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Tanzania",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "KM",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "LY",
      "MG",
      "MW",
      "ML",
      "MR",
      "MU",
      "YT",
      "MA",
      "MZ",
      "NA",
      "NE",
      "NG",
      "CG",
      "RE",
      "SN",
      "SC",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TZ",
      "TG",
      "TN",
      "UG",
      "ZW"
    ]
  },
  {
    "tag": "nya",
    "iso639_3": "nya",
    "region": null,
    "name": "Chichewa",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Chichewa",
      "Nyanja",
      "Nyanja (Chichewa)"
    ],
    "slug": "nya",
    "datasets": 20,
    "hours": 779.3,
    "countries": [
      "Angola",
      "Cabo Verde",
      "Comoros",
      "Democratic Republic of the Congo",
      "Ethiopia",
      "Kenya",
      "Malawi",
      "Mauritius",
      "Mozambique",
      "Niger",
      "Nigeria",
      "Rwanda",
      "Senegal",
      "Somalia",
      "South Africa",
      "Tanzania",
      "Uganda",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "AO",
      "CV",
      "KM",
      "CD",
      "ET",
      "KE",
      "MW",
      "MU",
      "MZ",
      "NE",
      "NG",
      "RW",
      "SN",
      "SO",
      "ZA",
      "TZ",
      "UG",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "gaz",
    "iso639_3": "gaz",
    "region": null,
    "name": "Oromo",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Oromo"
    ],
    "slug": "gaz",
    "datasets": 35,
    "hours": 1546.1,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Liberia",
      "Libya",
      "Malawi",
      "Mali",
      "Mauritania",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Rwanda",
      "Senegal",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Tanzania",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "LR",
      "LY",
      "MW",
      "ML",
      "MR",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "RW",
      "SN",
      "SL",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TZ",
      "TG",
      "TN",
      "UG",
      "ZW"
    ]
  },
  {
    "tag": "sna",
    "iso639_3": "sna",
    "region": null,
    "name": "Shona",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Shona"
    ],
    "slug": "sna",
    "datasets": 23,
    "hours": 1996.6,
    "countries": [
      "Angola",
      "Botswana",
      "Burundi",
      "Cabo Verde",
      "Democratic Republic of the Congo",
      "Ethiopia",
      "Ghana",
      "Kenya",
      "Madagascar",
      "Malawi",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Rwanda",
      "Senegal",
      "Somalia",
      "South Africa",
      "Tanzania",
      "Uganda",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "AO",
      "BW",
      "BI",
      "CV",
      "CD",
      "ET",
      "GH",
      "KE",
      "MG",
      "MW",
      "MZ",
      "NA",
      "NE",
      "NG",
      "RW",
      "SN",
      "SO",
      "ZA",
      "TZ",
      "UG",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "som",
    "iso639_3": "som",
    "region": null,
    "name": "Somali",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Somali"
    ],
    "slug": "som",
    "datasets": 31,
    "hours": 2013.9,
    "countries": [
      "Angola",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Burundi",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Liberia",
      "Madagascar",
      "Malawi",
      "Mali",
      "Morocco",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Rwanda",
      "Senegal",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "São Tomé and Príncipe",
      "Tanzania",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "AO",
      "BJ",
      "BW",
      "BF",
      "BI",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "LR",
      "MG",
      "MW",
      "ML",
      "MA",
      "MZ",
      "NA",
      "NE",
      "NG",
      "CG",
      "RW",
      "SN",
      "SL",
      "SO",
      "ZA",
      "ST",
      "TZ",
      "TG",
      "TN",
      "UG",
      "ZW"
    ]
  },
  {
    "tag": "swh",
    "iso639_3": "swh",
    "region": null,
    "name": "Swahili",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Swahili"
    ],
    "slug": "swh",
    "datasets": 44,
    "hours": 4938.4,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Botswana",
      "Cabo Verde",
      "Cameroon",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Kenya",
      "Libya",
      "Madagascar",
      "Malawi",
      "Mauritania",
      "Morocco",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Rwanda",
      "Senegal",
      "Somalia",
      "South Africa",
      "Sudan",
      "Tanzania",
      "Tunisia",
      "Uganda",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "BW",
      "CV",
      "CM",
      "CI",
      "CD",
      "EG",
      "ER",
      "ET",
      "GH",
      "KE",
      "LY",
      "MG",
      "MW",
      "MR",
      "MA",
      "MZ",
      "NA",
      "NE",
      "NG",
      "RW",
      "SN",
      "SO",
      "ZA",
      "SD",
      "TZ",
      "TN",
      "UG",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "umb",
    "iso639_3": "umb",
    "region": null,
    "name": "Umbundu",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Umbundu"
    ],
    "slug": "umb",
    "datasets": 4,
    "hours": 1.1,
    "countries": [
      "Angola",
      "Cabo Verde",
      "Democratic Republic of the Congo",
      "Ethiopia",
      "Kenya",
      "Malawi",
      "Mozambique",
      "Niger",
      "Nigeria",
      "Senegal",
      "Somalia",
      "South Africa",
      "Tanzania",
      "Uganda",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "AO",
      "CV",
      "CD",
      "ET",
      "KE",
      "MW",
      "MZ",
      "NE",
      "NG",
      "SN",
      "SO",
      "ZA",
      "TZ",
      "UG",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "wol",
    "iso639_3": "wol",
    "region": null,
    "name": "Wolof",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Wolof"
    ],
    "slug": "wol",
    "datasets": 30,
    "hours": 1316.2,
    "countries": [
      "Angola",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Burundi",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Madagascar",
      "Malawi",
      "Mali",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Somalia",
      "South Africa",
      "São Tomé and Príncipe",
      "Tanzania",
      "Togo",
      "Uganda",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "AO",
      "BJ",
      "BW",
      "BF",
      "BI",
      "CV",
      "CM",
      "CF",
      "TD",
      "CD",
      "DJ",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "MG",
      "MW",
      "ML",
      "MZ",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SO",
      "ZA",
      "ST",
      "TZ",
      "TG",
      "UG",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "xho",
    "iso639_3": "xho",
    "region": null,
    "name": "isiXhosa",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Xhosa",
      "isiXhosa"
    ],
    "slug": "xho",
    "datasets": 23,
    "hours": 716.3,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Comoros",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Libya",
      "Madagascar",
      "Malawi",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Mayotte",
      "Morocco",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Réunion",
      "Senegal",
      "Seychelles",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Tanzania",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "KM",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "LY",
      "MG",
      "MW",
      "ML",
      "MR",
      "MU",
      "YT",
      "MA",
      "MZ",
      "NA",
      "NE",
      "NG",
      "CG",
      "RE",
      "SN",
      "SC",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TZ",
      "TG",
      "TN",
      "UG",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "yor",
    "iso639_3": "yor",
    "region": null,
    "name": "Yoruba",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Ifè Yoruba",
      "Standard Yoruba",
      "Yoruba",
      "Ìjèbú Yoruba",
      "Ìlàje Yoruba"
    ],
    "slug": "yor",
    "datasets": 34,
    "hours": 2713.7,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Comoros",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Liberia",
      "Libya",
      "Madagascar",
      "Malawi",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Mayotte",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Rwanda",
      "Réunion",
      "Senegal",
      "Seychelles",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Tanzania",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "KM",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "LR",
      "LY",
      "MG",
      "MW",
      "ML",
      "MR",
      "MU",
      "YT",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "RW",
      "RE",
      "SN",
      "SC",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TZ",
      "TG",
      "TN",
      "UG",
      "ZW"
    ]
  },
  {
    "tag": "zul",
    "iso639_3": "zul",
    "region": null,
    "name": "isiZulu",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Zulu",
      "isiZulu"
    ],
    "slug": "zul",
    "datasets": 28,
    "hours": 789.1,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Comoros",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Libya",
      "Madagascar",
      "Malawi",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Mayotte",
      "Morocco",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Rwanda",
      "Réunion",
      "Senegal",
      "Seychelles",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Tanzania",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "KM",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "LY",
      "MG",
      "MW",
      "ML",
      "MR",
      "MU",
      "YT",
      "MA",
      "MZ",
      "NA",
      "NE",
      "NG",
      "CG",
      "RW",
      "RE",
      "SN",
      "SC",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TZ",
      "TG",
      "TN",
      "UG",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "arz",
    "iso639_3": "arz",
    "region": null,
    "name": "Egyptian Arabic",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Cairene Arabic",
      "Egyptian Arabic"
    ],
    "slug": "arz",
    "datasets": 23,
    "hours": 2483.5,
    "countries": [
      "Algeria",
      "Angola",
      "Cabo Verde",
      "Chad",
      "Democratic Republic of the Congo",
      "Egypt",
      "Ethiopia",
      "Ghana",
      "Kenya",
      "Liberia",
      "Libya",
      "Malawi",
      "Mauritania",
      "Morocco",
      "Niger",
      "Nigeria",
      "Senegal",
      "Somalia",
      "South Africa",
      "Sudan",
      "Tanzania",
      "Tunisia",
      "Uganda",
      "Western Sahara",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "CV",
      "TD",
      "CD",
      "EG",
      "ET",
      "GH",
      "KE",
      "LR",
      "LY",
      "MW",
      "MR",
      "MA",
      "NE",
      "NG",
      "SN",
      "SO",
      "ZA",
      "SD",
      "TZ",
      "TN",
      "UG",
      "EH",
      "ZW"
    ]
  },
  {
    "tag": "kea",
    "iso639_3": "kea",
    "region": null,
    "name": "Kabuverdianu",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Cape Verdean Creole",
      "Cape Verdean Creole (Barlavento)",
      "Cape Verdean Creole (Kabuverdianu)",
      "Kabuverdianu"
    ],
    "slug": "kea",
    "datasets": 10,
    "hours": 495.9,
    "countries": [
      "Angola",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Equatorial Guinea",
      "Eritrea",
      "Ethiopia",
      "Gabon",
      "Kenya",
      "Liberia",
      "Madagascar",
      "Malawi",
      "Mauritius",
      "Mozambique",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Seychelles",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "Tanzania",
      "Uganda",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source"
    ],
    "country_codes": [
      "AO",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "GQ",
      "ER",
      "ET",
      "GA",
      "KE",
      "LR",
      "MG",
      "MW",
      "MU",
      "MZ",
      "NE",
      "NG",
      "CG",
      "SN",
      "SC",
      "SL",
      "SO",
      "ZA",
      "TZ",
      "UG",
      "ZW"
    ]
  },
  {
    "tag": "eng-NG",
    "iso639_3": "eng",
    "region": "NG",
    "name": "English (Nigeria)",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Ebira-accented English",
      "English (Nigeria)",
      "English (Nigerian)",
      "Hausa-accented English",
      "Idoma-accented English",
      "Igala-accented English",
      "Igbo-accented English",
      "Ijaw-accented English",
      "Isoko-accented English",
      "Nigerian English",
      "Urhobo-accented English",
      "Yoruba-accented English"
    ],
    "slug": "eng-ng",
    "datasets": 15,
    "hours": 1164.7,
    "countries": [
      "Algeria",
      "Botswana",
      "Cabo Verde",
      "Cameroon",
      "Comoros",
      "Democratic Republic of the Congo",
      "Egypt",
      "Gabon",
      "Ghana",
      "Kenya",
      "Lesotho",
      "Liberia",
      "Madagascar",
      "Malawi",
      "Mauritius",
      "Mayotte",
      "Mozambique",
      "Namibia",
      "Nigeria",
      "Rwanda",
      "Réunion",
      "Seychelles",
      "South Africa",
      "Tanzania",
      "Uganda",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BW",
      "CV",
      "CM",
      "KM",
      "CD",
      "EG",
      "GA",
      "GH",
      "KE",
      "LS",
      "LR",
      "MG",
      "MW",
      "MU",
      "YT",
      "MZ",
      "NA",
      "NG",
      "RW",
      "RE",
      "SC",
      "ZA",
      "TZ",
      "UG",
      "ZW"
    ]
  },
  {
    "tag": "pcm",
    "iso639_3": "pcm",
    "region": null,
    "name": "Nigerian Pidgin",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Nigerian Pidgin",
      "West African Pidgin English"
    ],
    "slug": "pcm",
    "datasets": 16,
    "hours": 836.9,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Libya",
      "Mali",
      "Mauritania",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Rwanda",
      "Senegal",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CM",
      "CF",
      "TD",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "LY",
      "ML",
      "MR",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "RW",
      "SN",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN",
      "UG",
      "ZW"
    ]
  },
  {
    "tag": "sag",
    "iso639_3": "sag",
    "region": null,
    "name": "Sango",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Sango"
    ],
    "slug": "sag",
    "datasets": 4,
    "hours": 837.5,
    "countries": [
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Mali",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Somalia",
      "South Africa",
      "São Tomé and Príncipe",
      "Togo"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source"
    ],
    "country_codes": [
      "BJ",
      "BW",
      "BF",
      "CM",
      "CF",
      "TD",
      "CD",
      "DJ",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "ML",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SO",
      "ZA",
      "ST",
      "TG"
    ]
  },
  {
    "tag": "fan",
    "iso639_3": "fan",
    "region": null,
    "name": "Fang (Equatorial Guinea)",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Fang"
    ],
    "slug": "fan",
    "datasets": 9,
    "hours": 961.5,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Liberia",
      "Libya",
      "Madagascar",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Seychelles",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LR",
      "LY",
      "MG",
      "ML",
      "MR",
      "MU",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SC",
      "SL",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN"
    ]
  },
  {
    "tag": "bas",
    "iso639_3": "bas",
    "region": null,
    "name": "Basaa",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Basaa"
    ],
    "slug": "bas",
    "datasets": 10,
    "hours": 152.9,
    "countries": [
      "Algeria",
      "Benin",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Ethiopia",
      "Gabon",
      "Ghana",
      "Liberia",
      "Libya",
      "Madagascar",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Morocco",
      "Nigeria",
      "Republic of the Congo",
      "Seychelles",
      "Sierra Leone",
      "Somalia",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "ET",
      "GA",
      "GH",
      "LR",
      "LY",
      "MG",
      "ML",
      "MR",
      "MU",
      "MA",
      "NG",
      "CG",
      "SC",
      "SL",
      "SO",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "ewo",
    "iso639_3": "ewo",
    "region": null,
    "name": "Ewondo",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Ewondo"
    ],
    "slug": "ewo",
    "datasets": 6,
    "hours": 119.0,
    "countries": [
      "Algeria",
      "Benin",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Ethiopia",
      "Gabon",
      "Ghana",
      "Liberia",
      "Libya",
      "Madagascar",
      "Mauritania",
      "Mauritius",
      "Morocco",
      "Nigeria",
      "Republic of the Congo",
      "Seychelles",
      "Sierra Leone",
      "Somalia",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "ET",
      "GA",
      "GH",
      "LR",
      "LY",
      "MG",
      "MR",
      "MU",
      "MA",
      "NG",
      "CG",
      "SC",
      "SL",
      "SO",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "kon",
    "iso639_3": "kon",
    "region": null,
    "name": "Kikongo",
    "scope": "M",
    "type": "L",
    "aliases": [
      "Kikongo"
    ],
    "slug": "kon",
    "datasets": 12,
    "hours": 471.1,
    "countries": [
      "Angola",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Equatorial Guinea",
      "Eritrea",
      "Ethiopia",
      "Gabon",
      "Liberia",
      "Madagascar",
      "Malawi",
      "Mauritius",
      "Mozambique",
      "Republic of the Congo",
      "Seychelles",
      "Sierra Leone",
      "Somalia",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source"
    ],
    "country_codes": [
      "AO",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "GQ",
      "ER",
      "ET",
      "GA",
      "LR",
      "MG",
      "MW",
      "MU",
      "MZ",
      "CG",
      "SC",
      "SL",
      "SO",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "lua",
    "iso639_3": "lua",
    "region": null,
    "name": "Tshiluba",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Luba-Kasai",
      "Tshiluba"
    ],
    "slug": "lua",
    "datasets": 10,
    "hours": 534.4,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Liberia",
      "Libya",
      "Madagascar",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Seychelles",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LR",
      "LY",
      "MG",
      "ML",
      "MR",
      "MU",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SC",
      "SL",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN"
    ]
  },
  {
    "tag": "swc",
    "iso639_3": "swc",
    "region": null,
    "name": "Congolese Swahili",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Congolese Swahili"
    ],
    "slug": "swc",
    "datasets": 8,
    "hours": 240.9,
    "countries": [
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Liberia",
      "Madagascar",
      "Mali",
      "Mauritius",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Seychelles",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "São Tomé and Príncipe",
      "Togo"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source"
    ],
    "country_codes": [
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LR",
      "MG",
      "ML",
      "MU",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SC",
      "SL",
      "SO",
      "ZA",
      "ST",
      "TG"
    ]
  },
  {
    "tag": "bho",
    "iso639_3": "bho",
    "region": null,
    "name": "Bhojpuri",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Bhojpuri"
    ],
    "slug": "bho",
    "datasets": 5,
    "hours": 23.8,
    "countries": [
      "Botswana",
      "Comoros",
      "Eswatini",
      "Lesotho",
      "Madagascar",
      "Mauritius",
      "Mayotte",
      "Namibia",
      "Réunion",
      "Seychelles",
      "South Africa"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source"
    ],
    "country_codes": [
      "BW",
      "KM",
      "SZ",
      "LS",
      "MG",
      "MU",
      "YT",
      "NA",
      "RE",
      "SC",
      "ZA"
    ]
  },
  {
    "tag": "hin",
    "iso639_3": "hin",
    "region": null,
    "name": "Hindi",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Hindi"
    ],
    "slug": "hin",
    "datasets": 1,
    "hours": 0.0,
    "countries": [
      "Mauritius"
    ],
    "tasks": [
      "ASR"
    ],
    "country_codes": [
      "MU"
    ]
  },
  {
    "tag": "tir",
    "iso639_3": "tir",
    "region": null,
    "name": "Tigrinya",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Tigrinya"
    ],
    "slug": "tir",
    "datasets": 21,
    "hours": 1192.0,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Liberia",
      "Libya",
      "Mali",
      "Mauritania",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LR",
      "LY",
      "ML",
      "MR",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SL",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN",
      "ZW"
    ]
  },
  {
    "tag": "twi",
    "iso639_3": "twi",
    "region": null,
    "name": "Twi",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Akuapem Twi",
      "Asante Twi",
      "Twi"
    ],
    "slug": "twi",
    "datasets": 16,
    "hours": 387.4,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Libya",
      "Mali",
      "Mauritania",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CM",
      "CF",
      "TD",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LY",
      "ML",
      "MR",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN"
    ]
  },
  {
    "tag": "ewe",
    "iso639_3": "ewe",
    "region": null,
    "name": "Ewe",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Ewe"
    ],
    "slug": "ewe",
    "datasets": 17,
    "hours": 2582.6,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Liberia",
      "Mali",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Somalia",
      "South Africa",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CM",
      "CF",
      "TD",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LR",
      "ML",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SO",
      "ZA",
      "ST",
      "TG",
      "TN",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "aka",
    "iso639_3": "aka",
    "region": null,
    "name": "Akan",
    "scope": "M",
    "type": "L",
    "aliases": [
      "Akan"
    ],
    "slug": "aka",
    "datasets": 18,
    "hours": 2884.5,
    "countries": [
      "Algeria",
      "Benin",
      "Chad",
      "Democratic Republic of the Congo",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Liberia",
      "Libya",
      "Mauritania",
      "Morocco",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Sudan",
      "Togo",
      "Tunisia",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "TD",
      "CD",
      "EG",
      "ER",
      "ET",
      "GH",
      "LR",
      "LY",
      "MR",
      "MA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SD",
      "TG",
      "TN",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "taq",
    "iso639_3": "taq",
    "region": null,
    "name": "Tamasheq",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Tamasheq"
    ],
    "slug": "taq",
    "datasets": 5,
    "hours": 387.6,
    "countries": [
      "Mali",
      "Niger"
    ],
    "tasks": [
      "ASR",
      "Raw source"
    ],
    "country_codes": [
      "ML",
      "NE"
    ]
  },
  {
    "tag": "fra",
    "iso639_3": "fra",
    "region": null,
    "name": "French",
    "scope": "I",
    "type": "L",
    "aliases": [
      "French",
      "French (African-accented)",
      "French (Central Africa)",
      "French (North Africa)",
      "French (West/Central African accents)"
    ],
    "slug": "fra",
    "datasets": 44,
    "hours": 1035.0,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Chad",
      "Comoros",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Gabon",
      "Ghana",
      "Guinea",
      "Kenya",
      "Liberia",
      "Libya",
      "Madagascar",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Mayotte",
      "Morocco",
      "Mozambique",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Rwanda",
      "Réunion",
      "Senegal",
      "Seychelles",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "Sudan",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "TD",
      "KM",
      "CI",
      "CD",
      "EG",
      "ER",
      "ET",
      "GA",
      "GH",
      "GN",
      "KE",
      "LR",
      "LY",
      "MG",
      "ML",
      "MR",
      "MU",
      "YT",
      "MA",
      "MZ",
      "NE",
      "NG",
      "CG",
      "RW",
      "RE",
      "SN",
      "SC",
      "SL",
      "SO",
      "ZA",
      "SD",
      "TG",
      "TN",
      "UG",
      "ZW"
    ]
  },
  {
    "tag": "dje",
    "iso639_3": "dje",
    "region": null,
    "name": "Zarma",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Zarma"
    ],
    "slug": "dje",
    "datasets": 7,
    "hours": 388.4,
    "countries": [
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Mali",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Somalia",
      "South Africa",
      "São Tomé and Príncipe",
      "Togo"
    ],
    "tasks": [
      "ASR",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "BJ",
      "BW",
      "BF",
      "CM",
      "CF",
      "TD",
      "CD",
      "DJ",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "ML",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SO",
      "ZA",
      "ST",
      "TG"
    ]
  },
  {
    "tag": "kin",
    "iso639_3": "kin",
    "region": null,
    "name": "Kinyarwanda",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Kinyarwanda"
    ],
    "slug": "kin",
    "datasets": 17,
    "hours": 2737.3,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Kenya",
      "Libya",
      "Malawi",
      "Mauritania",
      "Morocco",
      "Mozambique",
      "Nigeria",
      "Rwanda",
      "South Africa",
      "Sudan",
      "Tanzania",
      "Tunisia",
      "Uganda",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "EG",
      "ER",
      "ET",
      "GH",
      "KE",
      "LY",
      "MW",
      "MR",
      "MA",
      "MZ",
      "NG",
      "RW",
      "ZA",
      "SD",
      "TZ",
      "TN",
      "UG",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "kab",
    "iso639_3": "kab",
    "region": null,
    "name": "Kabyle",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Bougiote (Bejaia Kabyle)",
      "Kabyle",
      "Tasahlite (Eastern Kabyle)"
    ],
    "slug": "kab",
    "datasets": 8,
    "hours": 63.8,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Rwanda",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "RW",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "ara",
    "iso639_3": "ara",
    "region": null,
    "name": "Arabic",
    "scope": "M",
    "type": "L",
    "aliases": [
      "Arabic",
      "Arabic dialects"
    ],
    "slug": "ara",
    "datasets": 19,
    "hours": 506.3,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Djibouti",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Madagascar",
      "Mauritania",
      "Morocco",
      "Namibia",
      "Nigeria",
      "South Africa",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "DJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MG",
      "MR",
      "MA",
      "NA",
      "NG",
      "ZA",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "kln",
    "iso639_3": "kln",
    "region": null,
    "name": "Kalenjin",
    "scope": "M",
    "type": "L",
    "aliases": [
      "Kalenjin"
    ],
    "slug": "kln",
    "datasets": 6,
    "hours": 1365.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Kenya",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "KE",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "dav",
    "iso639_3": "dav",
    "region": null,
    "name": "Taita",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Taita (Dawida)"
    ],
    "slug": "dav",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "dag",
    "iso639_3": "dag",
    "region": null,
    "name": "Dagbani",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Dagbani"
    ],
    "slug": "dag",
    "datasets": 10,
    "hours": 2163.3,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Libya",
      "Mali",
      "Mauritania",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CM",
      "CF",
      "TD",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LY",
      "ML",
      "MR",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN"
    ]
  },
  {
    "tag": "ibb",
    "iso639_3": "ibb",
    "region": null,
    "name": "Ibibio",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Ibibio"
    ],
    "slug": "ibb",
    "datasets": 2,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "tsn",
    "iso639_3": "tsn",
    "region": null,
    "name": "Setswana",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Setswana",
      "Tswana"
    ],
    "slug": "tsn",
    "datasets": 23,
    "hours": 691.5,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Comoros",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Kenya",
      "Lesotho",
      "Libya",
      "Madagascar",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Mayotte",
      "Morocco",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Rwanda",
      "Réunion",
      "Senegal",
      "Seychelles",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CM",
      "CF",
      "TD",
      "KM",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "LY",
      "MG",
      "ML",
      "MR",
      "MU",
      "YT",
      "MA",
      "MZ",
      "NA",
      "NE",
      "NG",
      "CG",
      "RW",
      "RE",
      "SN",
      "SC",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN",
      "UG",
      "ZW"
    ]
  },
  {
    "tag": "dyu",
    "iso639_3": "dyu",
    "region": null,
    "name": "Dioula",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Dioula",
      "Dioula/Jula",
      "Dyula"
    ],
    "slug": "dyu",
    "datasets": 16,
    "hours": 82.7,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Liberia",
      "Libya",
      "Mali",
      "Mauritania",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LR",
      "LY",
      "ML",
      "MR",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SL",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN"
    ]
  },
  {
    "tag": "tig",
    "iso639_3": "tig",
    "region": null,
    "name": "Tigre",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Tigre"
    ],
    "slug": "tig",
    "datasets": 5,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Liberia",
      "Libya",
      "Mali",
      "Mauritania",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LR",
      "LY",
      "ML",
      "MR",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SL",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN"
    ]
  },
  {
    "tag": "zgh",
    "iso639_3": "zgh",
    "region": null,
    "name": "Standard Moroccan Tamazight",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Standard Moroccan Tamazight"
    ],
    "slug": "zgh",
    "datasets": 4,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "sot",
    "iso639_3": "sot",
    "region": null,
    "name": "Sesotho",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Sesotho",
      "Southern Sotho"
    ],
    "slug": "sot",
    "datasets": 23,
    "hours": 688.4,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Comoros",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Libya",
      "Madagascar",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Mayotte",
      "Morocco",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Réunion",
      "Senegal",
      "Seychelles",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CM",
      "CF",
      "TD",
      "KM",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LY",
      "MG",
      "ML",
      "MR",
      "MU",
      "YT",
      "MA",
      "MZ",
      "NA",
      "NE",
      "NG",
      "CG",
      "RE",
      "SN",
      "SC",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN",
      "ZW"
    ]
  },
  {
    "tag": "ssw",
    "iso639_3": "ssw",
    "region": null,
    "name": "siSwati",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Swati",
      "siSwati"
    ],
    "slug": "ssw",
    "datasets": 13,
    "hours": 254.1,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Comoros",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Libya",
      "Madagascar",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Mayotte",
      "Morocco",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Réunion",
      "Senegal",
      "Seychelles",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CM",
      "CF",
      "TD",
      "KM",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LY",
      "MG",
      "ML",
      "MR",
      "MU",
      "YT",
      "MA",
      "MZ",
      "NA",
      "NE",
      "NG",
      "CG",
      "RE",
      "SN",
      "SC",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN",
      "ZW"
    ]
  },
  {
    "tag": "ven",
    "iso639_3": "ven",
    "region": null,
    "name": "Tshivenda",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Tshivenda",
      "Venda"
    ],
    "slug": "ven",
    "datasets": 14,
    "hours": 682.7,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Comoros",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Libya",
      "Madagascar",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Mayotte",
      "Morocco",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Réunion",
      "Senegal",
      "Seychelles",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CM",
      "CF",
      "TD",
      "KM",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LY",
      "MG",
      "ML",
      "MR",
      "MU",
      "YT",
      "MA",
      "MZ",
      "NA",
      "NE",
      "NG",
      "CG",
      "RE",
      "SN",
      "SC",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN",
      "ZW"
    ]
  },
  {
    "tag": "tso",
    "iso639_3": "tso",
    "region": null,
    "name": "Xitsonga",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Changana",
      "Shangani",
      "Tsonga",
      "Xitsonga"
    ],
    "slug": "tso",
    "datasets": 17,
    "hours": 682.7,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Comoros",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Libya",
      "Madagascar",
      "Malawi",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Mayotte",
      "Morocco",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Réunion",
      "Senegal",
      "Seychelles",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "BW",
      "BF",
      "CM",
      "CF",
      "TD",
      "KM",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LY",
      "MG",
      "MW",
      "ML",
      "MR",
      "MU",
      "YT",
      "MA",
      "MZ",
      "NA",
      "NE",
      "NG",
      "CG",
      "RE",
      "SN",
      "SC",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "nbl",
    "iso639_3": "nbl",
    "region": null,
    "name": "isiNdebele",
    "scope": "I",
    "type": "L",
    "aliases": [
      "South Ndebele",
      "Southern Ndebele",
      "isiNdebele"
    ],
    "slug": "nbl",
    "datasets": 11,
    "hours": 682.7,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Mozambique",
      "Nigeria",
      "South Africa",
      "Sudan",
      "Tunisia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "MZ",
      "NG",
      "ZA",
      "SD",
      "TN",
      "ZW"
    ]
  },
  {
    "tag": "dua",
    "iso639_3": "dua",
    "region": null,
    "name": "Duala",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Duala"
    ],
    "slug": "dua",
    "datasets": 5,
    "hours": 119.0,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Liberia",
      "Libya",
      "Madagascar",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Seychelles",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LR",
      "LY",
      "MG",
      "ML",
      "MR",
      "MU",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SC",
      "SL",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN"
    ]
  },
  {
    "tag": "bbj",
    "iso639_3": "bbj",
    "region": null,
    "name": "Ghomala",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Ghomala",
      "Ghomala'"
    ],
    "slug": "bbj",
    "datasets": 3,
    "hours": 83.1,
    "countries": [
      "Algeria",
      "Benin",
      "Cameroon",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS",
      "Other"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "CM",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "byv",
    "iso639_3": "byv",
    "region": null,
    "name": "Medumba",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Medumba"
    ],
    "slug": "byv",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "nnh",
    "iso639_3": "nnh",
    "region": null,
    "name": "Ngiemboon",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Ngiemboon"
    ],
    "slug": "nnh",
    "datasets": 2,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Cameroon",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "CM",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "ksf",
    "iso639_3": "ksf",
    "region": null,
    "name": "Bafia",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Bafia"
    ],
    "slug": "ksf",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "bax",
    "iso639_3": "bax",
    "region": null,
    "name": "Bamun",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Bamun"
    ],
    "slug": "bax",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "fmp",
    "iso639_3": "fmp",
    "region": null,
    "name": "Fe'fe'",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Fe'fe'"
    ],
    "slug": "fmp",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "bkm",
    "iso639_3": "bkm",
    "region": null,
    "name": "Kom (Cameroon)",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Kom"
    ],
    "slug": "bkm",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "bfd",
    "iso639_3": "bfd",
    "region": null,
    "name": "Bafut",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Bafut"
    ],
    "slug": "bfd",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "bum",
    "iso639_3": "bum",
    "region": null,
    "name": "Bulu",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Bulu"
    ],
    "slug": "bum",
    "datasets": 6,
    "hours": 119.0,
    "countries": [
      "Algeria",
      "Benin",
      "Botswana",
      "Burkina Faso",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Gambia",
      "Ghana",
      "Guinea",
      "Guinea-Bissau",
      "Lesotho",
      "Liberia",
      "Libya",
      "Madagascar",
      "Mali",
      "Mauritania",
      "Mauritius",
      "Morocco",
      "Namibia",
      "Niger",
      "Nigeria",
      "Republic of the Congo",
      "Senegal",
      "Seychelles",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "Sudan",
      "São Tomé and Príncipe",
      "Togo",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "BW",
      "BF",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "LS",
      "LR",
      "LY",
      "MG",
      "ML",
      "MR",
      "MU",
      "MA",
      "NA",
      "NE",
      "NG",
      "CG",
      "SN",
      "SC",
      "SL",
      "SO",
      "ZA",
      "SD",
      "ST",
      "TG",
      "TN"
    ]
  },
  {
    "tag": "eto",
    "iso639_3": "eto",
    "region": null,
    "name": "Eton (Cameroon)",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Eton"
    ],
    "slug": "eto",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "mua",
    "iso639_3": "mua",
    "region": null,
    "name": "Mundang",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Mundang"
    ],
    "slug": "mua",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "tui",
    "iso639_3": "tui",
    "region": null,
    "name": "Tupuri",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Tupuri"
    ],
    "slug": "tui",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "mxu",
    "iso639_3": "mxu",
    "region": null,
    "name": "Mada (Cameroon)",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Mada"
    ],
    "slug": "mxu",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "nmg",
    "iso639_3": "nmg",
    "region": null,
    "name": "Kwasio",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Kwasio"
    ],
    "slug": "nmg",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "mhk",
    "iso639_3": "mhk",
    "region": null,
    "name": "Mungaka",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Mungaka"
    ],
    "slug": "mhk",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "tvu",
    "iso639_3": "tvu",
    "region": null,
    "name": "Tunen",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Tunen"
    ],
    "slug": "tvu",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "wes",
    "iso639_3": "wes",
    "region": null,
    "name": "Cameroonian Pidgin",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Cameroon Pidgin",
      "Cameroonian Pidgin English"
    ],
    "slug": "wes",
    "datasets": 4,
    "hours": 119.0,
    "countries": [
      "Algeria",
      "Benin",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Ethiopia",
      "Gabon",
      "Ghana",
      "Liberia",
      "Libya",
      "Madagascar",
      "Mauritania",
      "Mauritius",
      "Morocco",
      "Nigeria",
      "Republic of the Congo",
      "Seychelles",
      "Sierra Leone",
      "Somalia",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "ET",
      "GA",
      "GH",
      "LR",
      "LY",
      "MG",
      "MR",
      "MU",
      "MA",
      "NG",
      "CG",
      "SC",
      "SL",
      "SO",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "cjk",
    "iso639_3": "cjk",
    "region": null,
    "name": "Chokwe",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Chokwe"
    ],
    "slug": "cjk",
    "datasets": 3,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Angola",
      "Benin",
      "Comoros",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Malawi",
      "Mauritania",
      "Mauritius",
      "Morocco",
      "Mozambique",
      "Nigeria",
      "Sudan",
      "Tunisia",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR+TTS",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "AO",
      "BJ",
      "KM",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MW",
      "MR",
      "MU",
      "MA",
      "MZ",
      "NG",
      "SD",
      "TN",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "hem",
    "iso639_3": "hem",
    "region": null,
    "name": "Hemba",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Hemba"
    ],
    "slug": "hem",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "nyu",
    "iso639_3": "nyu",
    "region": null,
    "name": "Nyungwe",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Nyungwe"
    ],
    "slug": "nyu",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "bci",
    "iso639_3": "bci",
    "region": null,
    "name": "Baoule",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Baoule",
      "Baoulé"
    ],
    "slug": "bci",
    "datasets": 5,
    "hours": 119.0,
    "countries": [
      "Algeria",
      "Benin",
      "Cabo Verde",
      "Cameroon",
      "Central African Republic",
      "Chad",
      "Côte d'Ivoire",
      "Democratic Republic of the Congo",
      "Djibouti",
      "Egypt",
      "Equatorial Guinea",
      "Eritrea",
      "Ethiopia",
      "Gabon",
      "Ghana",
      "Liberia",
      "Libya",
      "Madagascar",
      "Mauritania",
      "Mauritius",
      "Morocco",
      "Nigeria",
      "Republic of the Congo",
      "Seychelles",
      "Sierra Leone",
      "Somalia",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "CV",
      "CM",
      "CF",
      "TD",
      "CI",
      "CD",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "ET",
      "GA",
      "GH",
      "LR",
      "LY",
      "MG",
      "MR",
      "MU",
      "MA",
      "NG",
      "CG",
      "SC",
      "SL",
      "SO",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "ajg",
    "iso639_3": "ajg",
    "region": null,
    "name": "Aja (Benin)",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Aja"
    ],
    "slug": "ajg",
    "datasets": 3,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Togo",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TG",
      "TN"
    ]
  },
  {
    "tag": "gej",
    "iso639_3": "gej",
    "region": null,
    "name": "Gen",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Gen",
      "Gen/Mina"
    ],
    "slug": "gej",
    "datasets": 3,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Togo",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TG",
      "TN"
    ]
  },
  {
    "tag": "nmz",
    "iso639_3": "nmz",
    "region": null,
    "name": "Nawdm",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Nawdm"
    ],
    "slug": "nmz",
    "datasets": 3,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Togo",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TG",
      "TN"
    ]
  },
  {
    "tag": "kdh",
    "iso639_3": "kdh",
    "region": null,
    "name": "Tem",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Tem"
    ],
    "slug": "kdh",
    "datasets": 3,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Togo",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TG",
      "TN"
    ]
  },
  {
    "tag": "bba",
    "iso639_3": "bba",
    "region": null,
    "name": "Baatonum",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Baatonum"
    ],
    "slug": "bba",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "ebr",
    "iso639_3": "ebr",
    "region": null,
    "name": "Ebrié",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Ebrie"
    ],
    "slug": "ebr",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "fub",
    "iso639_3": "fub",
    "region": null,
    "name": "Adamawa Fulfulde",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Adamawa Fulfulde"
    ],
    "slug": "fub",
    "datasets": 3,
    "hours": 66.8,
    "countries": [
      "Algeria",
      "Benin",
      "Cameroon",
      "Chad",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "CM",
      "TD",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "fue",
    "iso639_3": "fue",
    "region": null,
    "name": "Borgu Fulfulde",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Borgu Fulfulde"
    ],
    "slug": "fue",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "eko",
    "iso639_3": "eko",
    "region": null,
    "name": "Koti",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Koti"
    ],
    "slug": "eko",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "rof",
    "iso639_3": "rof",
    "region": null,
    "name": "Rombo",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Rombo"
    ],
    "slug": "rof",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "mse",
    "iso639_3": "mse",
    "region": null,
    "name": "Musey",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Musey"
    ],
    "slug": "mse",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "gid",
    "iso639_3": "gid",
    "region": null,
    "name": "Gidar",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Gidar"
    ],
    "slug": "gid",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "giz",
    "iso639_3": "giz",
    "region": null,
    "name": "South Giziga",
    "scope": "I",
    "type": "L",
    "aliases": [
      "South Giziga"
    ],
    "slug": "giz",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "gya",
    "iso639_3": "gya",
    "region": null,
    "name": "Northwest Gbaya",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Northwest Gbaya"
    ],
    "slug": "gya",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "mcn",
    "iso639_3": "mcn",
    "region": null,
    "name": "Masana",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Masana"
    ],
    "slug": "mcn",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "mcx",
    "iso639_3": "mcx",
    "region": null,
    "name": "Mpiemo",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Mpiemo"
    ],
    "slug": "mcx",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "mdd",
    "iso639_3": "mdd",
    "region": null,
    "name": "Mbum",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Mbum"
    ],
    "slug": "mdd",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "mgg",
    "iso639_3": "mgg",
    "region": null,
    "name": "Mpumpong",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Mpumpong"
    ],
    "slug": "mgg",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "abb",
    "iso639_3": "abb",
    "region": null,
    "name": "Bankon",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Bankon"
    ],
    "slug": "abb",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "bnm",
    "iso639_3": "bnm",
    "region": null,
    "name": "Batanga",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Batanga"
    ],
    "slug": "bnm",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "bkh",
    "iso639_3": "bkh",
    "region": null,
    "name": "Bakoko",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Bakoko"
    ],
    "slug": "bkh",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "bri",
    "iso639_3": "bri",
    "region": null,
    "name": "Mokpwe",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Mokpwe"
    ],
    "slug": "bri",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "beb",
    "iso639_3": "beb",
    "region": null,
    "name": "Bebele",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Bebele"
    ],
    "slug": "beb",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "bce",
    "iso639_3": "bce",
    "region": null,
    "name": "Bamenyam",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Bamenyam"
    ],
    "slug": "bce",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "bag",
    "iso639_3": "bag",
    "region": null,
    "name": "Tuki",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Tuki"
    ],
    "slug": "bag",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "nla",
    "iso639_3": "nla",
    "region": null,
    "name": "Ngombale",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Ngombale"
    ],
    "slug": "nla",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "yav",
    "iso639_3": "yav",
    "region": null,
    "name": "Yangben",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Yangben"
    ],
    "slug": "yav",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "udl",
    "iso639_3": "udl",
    "region": null,
    "name": "Wuzlam",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Wuzlam"
    ],
    "slug": "udl",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "mug",
    "iso639_3": "mug",
    "region": null,
    "name": "Musgu",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Musgu"
    ],
    "slug": "mug",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "jgo",
    "iso639_3": "jgo",
    "region": null,
    "name": "Ngomba",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Ngomba"
    ],
    "slug": "jgo",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "mbo",
    "iso639_3": "mbo",
    "region": null,
    "name": "Mbo (Cameroon)",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Mbo"
    ],
    "slug": "mbo",
    "datasets": 1,
    "hours": 63.3,
    "countries": [
      "Algeria",
      "Benin",
      "Egypt",
      "Eritrea",
      "Ethiopia",
      "Ghana",
      "Libya",
      "Mauritania",
      "Morocco",
      "Nigeria",
      "Sudan",
      "Tunisia"
    ],
    "tasks": [
      "ASR+TTS"
    ],
    "country_codes": [
      "DZ",
      "BJ",
      "EG",
      "ER",
      "ET",
      "GH",
      "LY",
      "MR",
      "MA",
      "NG",
      "SD",
      "TN"
    ]
  },
  {
    "tag": "fuc",
    "iso639_3": "fuc",
    "region": null,
    "name": "Pulaar",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Fulani (Pulaar)",
      "Pulaar"
    ],
    "slug": "fuc",
    "datasets": 7,
    "hours": 540.6,
    "countries": [
      "Democratic Republic of the Congo",
      "Guinea",
      "Madagascar",
      "Mali",
      "Senegal",
      "Somalia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "TTS"
    ],
    "country_codes": [
      "CD",
      "GN",
      "MG",
      "ML",
      "SN",
      "SO",
      "ZW"
    ]
  },
  {
    "tag": "plt",
    "iso639_3": "plt",
    "region": null,
    "name": "Malagasy",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Malagasy",
      "Malagasy (Merina/Plateau)"
    ],
    "slug": "plt",
    "datasets": 17,
    "hours": 746.5,
    "countries": [
      "Angola",
      "Botswana",
      "Burundi",
      "Cameroon",
      "Comoros",
      "Democratic Republic of the Congo",
      "Egypt",
      "Eswatini",
      "Ethiopia",
      "Gabon",
      "Ghana",
      "Lesotho",
      "Madagascar",
      "Mauritius",
      "Mayotte",
      "Mozambique",
      "Namibia",
      "Niger",
      "Nigeria",
      "Réunion",
      "Senegal",
      "Seychelles",
      "Somalia",
      "South Africa",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "AO",
      "BW",
      "BI",
      "CM",
      "KM",
      "CD",
      "EG",
      "SZ",
      "ET",
      "GA",
      "GH",
      "LS",
      "MG",
      "MU",
      "YT",
      "MZ",
      "NA",
      "NE",
      "NG",
      "RE",
      "SN",
      "SC",
      "SO",
      "ZA",
      "ZW"
    ]
  },
  {
    "tag": "eng",
    "iso639_3": "eng",
    "region": null,
    "name": "English",
    "scope": "I",
    "type": "L",
    "aliases": [
      "African-accented English",
      "English",
      "English (African-accented)",
      "English (Arabic/Berber-accented)",
      "English (East Africa)",
      "English (East African)",
      "English (Southern Africa)",
      "English (accented)",
      "English (accented, L1 and L2)"
    ],
    "slug": "eng",
    "datasets": 42,
    "hours": 999.4,
    "countries": [
      "Algeria",
      "Botswana",
      "Cabo Verde",
      "Democratic Republic of the Congo",
      "Egypt",
      "Ethiopia",
      "Ghana",
      "Kenya",
      "Lesotho",
      "Liberia",
      "Libya",
      "Malawi",
      "Mauritania",
      "Mauritius",
      "Morocco",
      "Mozambique",
      "Namibia",
      "Nigeria",
      "Rwanda",
      "Seychelles",
      "Sierra Leone",
      "Somalia",
      "South Africa",
      "South Sudan",
      "Sudan",
      "Tanzania",
      "Togo",
      "Tunisia",
      "Uganda",
      "Zambia",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "ASR+TTS",
      "Other",
      "Raw source"
    ],
    "country_codes": [
      "DZ",
      "BW",
      "CV",
      "CD",
      "EG",
      "ET",
      "GH",
      "KE",
      "LS",
      "LR",
      "LY",
      "MW",
      "MR",
      "MU",
      "MA",
      "MZ",
      "NA",
      "NG",
      "RW",
      "SC",
      "SL",
      "SO",
      "ZA",
      "SS",
      "SD",
      "TZ",
      "TG",
      "TN",
      "UG",
      "ZM",
      "ZW"
    ]
  },
  {
    "tag": "eng-ZA",
    "iso639_3": "eng",
    "region": "ZA",
    "name": "English (South Africa)",
    "scope": "I",
    "type": "L",
    "aliases": [
      "English (South African)",
      "South African English",
      "South African English (Black South African English)",
      "South African English (Coloured/Cape Flats variety)"
    ],
    "slug": "eng-za",
    "datasets": 29,
    "hours": 623.2,
    "countries": [
      "Botswana",
      "Ghana",
      "Kenya",
      "Lesotho",
      "Malawi",
      "Mozambique",
      "Nigeria",
      "Rwanda",
      "South Africa",
      "Tanzania",
      "Uganda",
      "Zimbabwe"
    ],
    "tasks": [
      "ASR",
      "Other",
      "Raw source",
      "TTS"
    ],
    "country_codes": [
      "BW",
      "GH",
      "KE",
      "LS",
      "MW",
      "MZ",
      "NG",
      "RW",
      "ZA",
      "TZ",
      "UG",
      "ZW"
    ]
  },
  {
    "tag": "por-MZ",
    "iso639_3": "por",
    "region": "MZ",
    "name": "Portuguese (Mozambique)",
    "scope": "I",
    "type": "L",
    "aliases": [
      "Mozambican Portuguese",
      "Portuguese (Mozambique)"
    ],
    "slug": "por-mz",
    "datasets": 3,
    "hours": 439.7,
    "countries": [
      "Cabo Verde",
      "Liberia",
      "Mozambique",
      "Nigeria",
      "South Africa"
    ],
    "tasks": [
      "ASR+TTS",
      "Other",
      "Raw source"
    ],
    "country_codes": [
      "CV",
      "LR",
      "MZ",
      "NG",
      "ZA"
    ]
  }
] as unknown as Language[];

/** The ISO 639-3 registry, cut to the tags the fixture datasets carry. */
export const LANGUAGE_CODES = {
  "version": 1,
  "codes": {
    "abb": {
      "tag": "abb",
      "iso639_3": "abb",
      "region": null,
      "name": "Bankon",
      "aliases": [
        "Bankon"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "afr": {
      "tag": "afr",
      "iso639_3": "afr",
      "region": null,
      "name": "Afrikaans",
      "aliases": [
        "Afrikaans"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "ajg": {
      "tag": "ajg",
      "iso639_3": "ajg",
      "region": null,
      "name": "Aja (Benin)",
      "aliases": [
        "Aja"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "aka": {
      "tag": "aka",
      "iso639_3": "aka",
      "region": null,
      "name": "Akan",
      "aliases": [
        "Akan"
      ],
      "resolution": "curated",
      "scope": "M",
      "type": "L"
    },
    "amh": {
      "tag": "amh",
      "iso639_3": "amh",
      "region": null,
      "name": "Amharic",
      "aliases": [
        "Amharic"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "ara": {
      "tag": "ara",
      "iso639_3": "ara",
      "region": null,
      "name": "Arabic",
      "aliases": [
        "Arabic",
        "Arabic dialects"
      ],
      "resolution": "iso-registry",
      "scope": "M",
      "type": "L"
    },
    "arz": {
      "tag": "arz",
      "iso639_3": "arz",
      "region": null,
      "name": "Egyptian Arabic",
      "aliases": [
        "Cairene Arabic",
        "Egyptian Arabic"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "bag": {
      "tag": "bag",
      "iso639_3": "bag",
      "region": null,
      "name": "Tuki",
      "aliases": [
        "Tuki"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "bas": {
      "tag": "bas",
      "iso639_3": "bas",
      "region": null,
      "name": "Basaa",
      "aliases": [
        "Basaa"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "bax": {
      "tag": "bax",
      "iso639_3": "bax",
      "region": null,
      "name": "Bamun",
      "aliases": [
        "Bamun"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "bba": {
      "tag": "bba",
      "iso639_3": "bba",
      "region": null,
      "name": "Baatonum",
      "aliases": [
        "Baatonum"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "bbj": {
      "tag": "bbj",
      "iso639_3": "bbj",
      "region": null,
      "name": "Ghomala",
      "aliases": [
        "Ghomala",
        "Ghomala'"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "bce": {
      "tag": "bce",
      "iso639_3": "bce",
      "region": null,
      "name": "Bamenyam",
      "aliases": [
        "Bamenyam"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "bci": {
      "tag": "bci",
      "iso639_3": "bci",
      "region": null,
      "name": "Baoule",
      "aliases": [
        "Baoule",
        "Baoulé"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "beb": {
      "tag": "beb",
      "iso639_3": "beb",
      "region": null,
      "name": "Bebele",
      "aliases": [
        "Bebele"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "bfd": {
      "tag": "bfd",
      "iso639_3": "bfd",
      "region": null,
      "name": "Bafut",
      "aliases": [
        "Bafut"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "bho": {
      "tag": "bho",
      "iso639_3": "bho",
      "region": null,
      "name": "Bhojpuri",
      "aliases": [
        "Bhojpuri"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "bkh": {
      "tag": "bkh",
      "iso639_3": "bkh",
      "region": null,
      "name": "Bakoko",
      "aliases": [
        "Bakoko"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "bkm": {
      "tag": "bkm",
      "iso639_3": "bkm",
      "region": null,
      "name": "Kom (Cameroon)",
      "aliases": [
        "Kom"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "bnm": {
      "tag": "bnm",
      "iso639_3": "bnm",
      "region": null,
      "name": "Batanga",
      "aliases": [
        "Batanga"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "bri": {
      "tag": "bri",
      "iso639_3": "bri",
      "region": null,
      "name": "Mokpwe",
      "aliases": [
        "Mokpwe"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "bum": {
      "tag": "bum",
      "iso639_3": "bum",
      "region": null,
      "name": "Bulu",
      "aliases": [
        "Bulu"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "byv": {
      "tag": "byv",
      "iso639_3": "byv",
      "region": null,
      "name": "Medumba",
      "aliases": [
        "Medumba"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "cjk": {
      "tag": "cjk",
      "iso639_3": "cjk",
      "region": null,
      "name": "Chokwe",
      "aliases": [
        "Chokwe"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "dag": {
      "tag": "dag",
      "iso639_3": "dag",
      "region": null,
      "name": "Dagbani",
      "aliases": [
        "Dagbani"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "dav": {
      "tag": "dav",
      "iso639_3": "dav",
      "region": null,
      "name": "Taita",
      "aliases": [
        "Taita (Dawida)"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "dje": {
      "tag": "dje",
      "iso639_3": "dje",
      "region": null,
      "name": "Zarma",
      "aliases": [
        "Zarma"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "dua": {
      "tag": "dua",
      "iso639_3": "dua",
      "region": null,
      "name": "Duala",
      "aliases": [
        "Duala"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "dyu": {
      "tag": "dyu",
      "iso639_3": "dyu",
      "region": null,
      "name": "Dioula",
      "aliases": [
        "Dioula",
        "Dioula/Jula",
        "Dyula"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "ebr": {
      "tag": "ebr",
      "iso639_3": "ebr",
      "region": null,
      "name": "Ebrié",
      "aliases": [
        "Ebrie"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "eko": {
      "tag": "eko",
      "iso639_3": "eko",
      "region": null,
      "name": "Koti",
      "aliases": [
        "Koti"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "eng": {
      "tag": "eng",
      "iso639_3": "eng",
      "region": null,
      "name": "English",
      "aliases": [
        "African-accented English",
        "English",
        "English (African-accented)",
        "English (Arabic/Berber-accented)",
        "English (East Africa)",
        "English (East African)",
        "English (Southern Africa)",
        "English (accented)",
        "English (accented, L1 and L2)"
      ],
      "resolution": "group",
      "scope": "I",
      "type": "L"
    },
    "eng-NG": {
      "tag": "eng-NG",
      "iso639_3": "eng",
      "region": "NG",
      "name": "English (Nigeria)",
      "aliases": [
        "Ebira-accented English",
        "English (Nigeria)",
        "English (Nigerian)",
        "Hausa-accented English",
        "Idoma-accented English",
        "Igala-accented English",
        "Igbo-accented English",
        "Ijaw-accented English",
        "Isoko-accented English",
        "Nigerian English",
        "Urhobo-accented English",
        "Yoruba-accented English"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "eng-ZA": {
      "tag": "eng-ZA",
      "iso639_3": "eng",
      "region": "ZA",
      "name": "English (South Africa)",
      "aliases": [
        "English (South African)",
        "South African English",
        "South African English (Black South African English)",
        "South African English (Coloured/Cape Flats variety)"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "eto": {
      "tag": "eto",
      "iso639_3": "eto",
      "region": null,
      "name": "Eton (Cameroon)",
      "aliases": [
        "Eton"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "ewe": {
      "tag": "ewe",
      "iso639_3": "ewe",
      "region": null,
      "name": "Ewe",
      "aliases": [
        "Ewe"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "ewo": {
      "tag": "ewo",
      "iso639_3": "ewo",
      "region": null,
      "name": "Ewondo",
      "aliases": [
        "Ewondo"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "fan": {
      "tag": "fan",
      "iso639_3": "fan",
      "region": null,
      "name": "Fang (Equatorial Guinea)",
      "aliases": [
        "Fang"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "fmp": {
      "tag": "fmp",
      "iso639_3": "fmp",
      "region": null,
      "name": "Fe'fe'",
      "aliases": [
        "Fe'fe'"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "fra": {
      "tag": "fra",
      "iso639_3": "fra",
      "region": null,
      "name": "French",
      "aliases": [
        "French",
        "French (African-accented)",
        "French (Central Africa)",
        "French (North Africa)",
        "French (West/Central African accents)"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "fub": {
      "tag": "fub",
      "iso639_3": "fub",
      "region": null,
      "name": "Adamawa Fulfulde",
      "aliases": [
        "Adamawa Fulfulde"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "fuc": {
      "tag": "fuc",
      "iso639_3": "fuc",
      "region": null,
      "name": "Pulaar",
      "aliases": [
        "Fulani (Pulaar)",
        "Pulaar"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "fue": {
      "tag": "fue",
      "iso639_3": "fue",
      "region": null,
      "name": "Borgu Fulfulde",
      "aliases": [
        "Borgu Fulfulde"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "ful": {
      "tag": "ful",
      "iso639_3": "ful",
      "region": null,
      "name": "Fula",
      "aliases": [
        "Fula",
        "Fulani",
        "Fulfulde"
      ],
      "resolution": "curated",
      "scope": "M",
      "type": "L"
    },
    "gaz": {
      "tag": "gaz",
      "iso639_3": "gaz",
      "region": null,
      "name": "Oromo",
      "aliases": [
        "Oromo"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "gej": {
      "tag": "gej",
      "iso639_3": "gej",
      "region": null,
      "name": "Gen",
      "aliases": [
        "Gen",
        "Gen/Mina"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "gid": {
      "tag": "gid",
      "iso639_3": "gid",
      "region": null,
      "name": "Gidar",
      "aliases": [
        "Gidar"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "giz": {
      "tag": "giz",
      "iso639_3": "giz",
      "region": null,
      "name": "South Giziga",
      "aliases": [
        "South Giziga"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "gya": {
      "tag": "gya",
      "iso639_3": "gya",
      "region": null,
      "name": "Northwest Gbaya",
      "aliases": [
        "Northwest Gbaya"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "hau": {
      "tag": "hau",
      "iso639_3": "hau",
      "region": null,
      "name": "Hausa",
      "aliases": [
        "Hausa"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "hem": {
      "tag": "hem",
      "iso639_3": "hem",
      "region": null,
      "name": "Hemba",
      "aliases": [
        "Hemba"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "hin": {
      "tag": "hin",
      "iso639_3": "hin",
      "region": null,
      "name": "Hindi",
      "aliases": [
        "Hindi"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "ibb": {
      "tag": "ibb",
      "iso639_3": "ibb",
      "region": null,
      "name": "Ibibio",
      "aliases": [
        "Ibibio"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "ibo": {
      "tag": "ibo",
      "iso639_3": "ibo",
      "region": null,
      "name": "Igbo",
      "aliases": [
        "Ehugbo Igbo",
        "Igbo"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "jgo": {
      "tag": "jgo",
      "iso639_3": "jgo",
      "region": null,
      "name": "Ngomba",
      "aliases": [
        "Ngomba"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "kab": {
      "tag": "kab",
      "iso639_3": "kab",
      "region": null,
      "name": "Kabyle",
      "aliases": [
        "Bougiote (Bejaia Kabyle)",
        "Kabyle",
        "Tasahlite (Eastern Kabyle)"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "kam": {
      "tag": "kam",
      "iso639_3": "kam",
      "region": null,
      "name": "Kamba (Kenya)",
      "aliases": [
        "Kamba"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "kdh": {
      "tag": "kdh",
      "iso639_3": "kdh",
      "region": null,
      "name": "Tem",
      "aliases": [
        "Tem"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "kea": {
      "tag": "kea",
      "iso639_3": "kea",
      "region": null,
      "name": "Kabuverdianu",
      "aliases": [
        "Cape Verdean Creole",
        "Cape Verdean Creole (Barlavento)",
        "Cape Verdean Creole (Kabuverdianu)",
        "Kabuverdianu"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "kin": {
      "tag": "kin",
      "iso639_3": "kin",
      "region": null,
      "name": "Kinyarwanda",
      "aliases": [
        "Kinyarwanda"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "kln": {
      "tag": "kln",
      "iso639_3": "kln",
      "region": null,
      "name": "Kalenjin",
      "aliases": [
        "Kalenjin"
      ],
      "resolution": "curated",
      "scope": "M",
      "type": "L"
    },
    "kon": {
      "tag": "kon",
      "iso639_3": "kon",
      "region": null,
      "name": "Kikongo",
      "aliases": [
        "Kikongo"
      ],
      "resolution": "curated",
      "scope": "M",
      "type": "L"
    },
    "ksf": {
      "tag": "ksf",
      "iso639_3": "ksf",
      "region": null,
      "name": "Bafia",
      "aliases": [
        "Bafia"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "lin": {
      "tag": "lin",
      "iso639_3": "lin",
      "region": null,
      "name": "Lingala",
      "aliases": [
        "Lingala"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "lua": {
      "tag": "lua",
      "iso639_3": "lua",
      "region": null,
      "name": "Tshiluba",
      "aliases": [
        "Luba-Kasai",
        "Tshiluba"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "lug": {
      "tag": "lug",
      "iso639_3": "lug",
      "region": null,
      "name": "Luganda",
      "aliases": [
        "Luganda"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "luo": {
      "tag": "luo",
      "iso639_3": "luo",
      "region": null,
      "name": "Dholuo",
      "aliases": [
        "Dholuo",
        "Dholuo (Luo)",
        "Luo"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "mbo": {
      "tag": "mbo",
      "iso639_3": "mbo",
      "region": null,
      "name": "Mbo (Cameroon)",
      "aliases": [
        "Mbo"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "mcn": {
      "tag": "mcn",
      "iso639_3": "mcn",
      "region": null,
      "name": "Masana",
      "aliases": [
        "Masana"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "mcx": {
      "tag": "mcx",
      "iso639_3": "mcx",
      "region": null,
      "name": "Mpiemo",
      "aliases": [
        "Mpiemo"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "mdd": {
      "tag": "mdd",
      "iso639_3": "mdd",
      "region": null,
      "name": "Mbum",
      "aliases": [
        "Mbum"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "mgg": {
      "tag": "mgg",
      "iso639_3": "mgg",
      "region": null,
      "name": "Mpumpong",
      "aliases": [
        "Mpumpong"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "mhk": {
      "tag": "mhk",
      "iso639_3": "mhk",
      "region": null,
      "name": "Mungaka",
      "aliases": [
        "Mungaka"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "mse": {
      "tag": "mse",
      "iso639_3": "mse",
      "region": null,
      "name": "Musey",
      "aliases": [
        "Musey"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "mua": {
      "tag": "mua",
      "iso639_3": "mua",
      "region": null,
      "name": "Mundang",
      "aliases": [
        "Mundang"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "mug": {
      "tag": "mug",
      "iso639_3": "mug",
      "region": null,
      "name": "Musgu",
      "aliases": [
        "Musgu"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "mxu": {
      "tag": "mxu",
      "iso639_3": "mxu",
      "region": null,
      "name": "Mada (Cameroon)",
      "aliases": [
        "Mada"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "nbl": {
      "tag": "nbl",
      "iso639_3": "nbl",
      "region": null,
      "name": "isiNdebele",
      "aliases": [
        "South Ndebele",
        "Southern Ndebele",
        "isiNdebele"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "nla": {
      "tag": "nla",
      "iso639_3": "nla",
      "region": null,
      "name": "Ngombale",
      "aliases": [
        "Ngombale"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "nmg": {
      "tag": "nmg",
      "iso639_3": "nmg",
      "region": null,
      "name": "Kwasio",
      "aliases": [
        "Kwasio"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "nmz": {
      "tag": "nmz",
      "iso639_3": "nmz",
      "region": null,
      "name": "Nawdm",
      "aliases": [
        "Nawdm"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "nnh": {
      "tag": "nnh",
      "iso639_3": "nnh",
      "region": null,
      "name": "Ngiemboon",
      "aliases": [
        "Ngiemboon"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "nso": {
      "tag": "nso",
      "iso639_3": "nso",
      "region": null,
      "name": "Sepedi",
      "aliases": [
        "Northern Sotho",
        "Sepedi",
        "Sepedi (Northern Sotho)"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "nya": {
      "tag": "nya",
      "iso639_3": "nya",
      "region": null,
      "name": "Chichewa",
      "aliases": [
        "Chichewa",
        "Nyanja",
        "Nyanja (Chichewa)"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "nyu": {
      "tag": "nyu",
      "iso639_3": "nyu",
      "region": null,
      "name": "Nyungwe",
      "aliases": [
        "Nyungwe"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "pcm": {
      "tag": "pcm",
      "iso639_3": "pcm",
      "region": null,
      "name": "Nigerian Pidgin",
      "aliases": [
        "Nigerian Pidgin",
        "West African Pidgin English"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "plt": {
      "tag": "plt",
      "iso639_3": "plt",
      "region": null,
      "name": "Malagasy",
      "aliases": [
        "Malagasy",
        "Malagasy (Merina/Plateau)"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "por-MZ": {
      "tag": "por-MZ",
      "iso639_3": "por",
      "region": "MZ",
      "name": "Portuguese (Mozambique)",
      "aliases": [
        "Mozambican Portuguese",
        "Portuguese (Mozambique)"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "rof": {
      "tag": "rof",
      "iso639_3": "rof",
      "region": null,
      "name": "Rombo",
      "aliases": [
        "Rombo"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "sag": {
      "tag": "sag",
      "iso639_3": "sag",
      "region": null,
      "name": "Sango",
      "aliases": [
        "Sango"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "sna": {
      "tag": "sna",
      "iso639_3": "sna",
      "region": null,
      "name": "Shona",
      "aliases": [
        "Shona"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "som": {
      "tag": "som",
      "iso639_3": "som",
      "region": null,
      "name": "Somali",
      "aliases": [
        "Somali"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "sot": {
      "tag": "sot",
      "iso639_3": "sot",
      "region": null,
      "name": "Sesotho",
      "aliases": [
        "Sesotho",
        "Southern Sotho"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "ssw": {
      "tag": "ssw",
      "iso639_3": "ssw",
      "region": null,
      "name": "siSwati",
      "aliases": [
        "Swati",
        "siSwati"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "swc": {
      "tag": "swc",
      "iso639_3": "swc",
      "region": null,
      "name": "Congolese Swahili",
      "aliases": [
        "Congolese Swahili"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "swh": {
      "tag": "swh",
      "iso639_3": "swh",
      "region": null,
      "name": "Swahili",
      "aliases": [
        "Swahili"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "taq": {
      "tag": "taq",
      "iso639_3": "taq",
      "region": null,
      "name": "Tamasheq",
      "aliases": [
        "Tamasheq"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "tig": {
      "tag": "tig",
      "iso639_3": "tig",
      "region": null,
      "name": "Tigre",
      "aliases": [
        "Tigre"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "tir": {
      "tag": "tir",
      "iso639_3": "tir",
      "region": null,
      "name": "Tigrinya",
      "aliases": [
        "Tigrinya"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "tsn": {
      "tag": "tsn",
      "iso639_3": "tsn",
      "region": null,
      "name": "Setswana",
      "aliases": [
        "Setswana",
        "Tswana"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "tso": {
      "tag": "tso",
      "iso639_3": "tso",
      "region": null,
      "name": "Xitsonga",
      "aliases": [
        "Changana",
        "Shangani",
        "Tsonga",
        "Xitsonga"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "tui": {
      "tag": "tui",
      "iso639_3": "tui",
      "region": null,
      "name": "Tupuri",
      "aliases": [
        "Tupuri"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "tvu": {
      "tag": "tvu",
      "iso639_3": "tvu",
      "region": null,
      "name": "Tunen",
      "aliases": [
        "Tunen"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "twi": {
      "tag": "twi",
      "iso639_3": "twi",
      "region": null,
      "name": "Twi",
      "aliases": [
        "Akuapem Twi",
        "Asante Twi",
        "Twi"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "udl": {
      "tag": "udl",
      "iso639_3": "udl",
      "region": null,
      "name": "Wuzlam",
      "aliases": [
        "Wuzlam"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "umb": {
      "tag": "umb",
      "iso639_3": "umb",
      "region": null,
      "name": "Umbundu",
      "aliases": [
        "Umbundu"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "ven": {
      "tag": "ven",
      "iso639_3": "ven",
      "region": null,
      "name": "Tshivenda",
      "aliases": [
        "Tshivenda",
        "Venda"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "wes": {
      "tag": "wes",
      "iso639_3": "wes",
      "region": null,
      "name": "Cameroonian Pidgin",
      "aliases": [
        "Cameroon Pidgin",
        "Cameroonian Pidgin English"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "wol": {
      "tag": "wol",
      "iso639_3": "wol",
      "region": null,
      "name": "Wolof",
      "aliases": [
        "Wolof"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "xho": {
      "tag": "xho",
      "iso639_3": "xho",
      "region": null,
      "name": "isiXhosa",
      "aliases": [
        "Xhosa",
        "isiXhosa"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "yav": {
      "tag": "yav",
      "iso639_3": "yav",
      "region": null,
      "name": "Yangben",
      "aliases": [
        "Yangben"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "yor": {
      "tag": "yor",
      "iso639_3": "yor",
      "region": null,
      "name": "Yoruba",
      "aliases": [
        "Ifè Yoruba",
        "Standard Yoruba",
        "Yoruba",
        "Ìjèbú Yoruba",
        "Ìlàje Yoruba"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    },
    "zgh": {
      "tag": "zgh",
      "iso639_3": "zgh",
      "region": null,
      "name": "Standard Moroccan Tamazight",
      "aliases": [
        "Standard Moroccan Tamazight"
      ],
      "resolution": "curated",
      "scope": "I",
      "type": "L"
    },
    "zul": {
      "tag": "zul",
      "iso639_3": "zul",
      "region": null,
      "name": "isiZulu",
      "aliases": [
        "Zulu",
        "isiZulu"
      ],
      "resolution": "iso-registry",
      "scope": "I",
      "type": "L"
    }
  },
  "name_to_tag": {
    "Swahili": "swh",
    "Amharic": "amh",
    "Tigrinya": "tir",
    "Oromo": "gaz",
    "Lingala": "lin",
    "Sango": "sag",
    "Fang": "fan",
    "Basaa": "bas",
    "Ewondo": "ewo",
    "Kikongo": "kon",
    "Tshiluba": "lua",
    "Congolese Swahili": "swc",
    "Kinyarwanda": "kin",
    "Kabyle": "kab",
    "Luganda": "lug",
    "Arabic": "ara",
    "Dholuo (Luo)": "luo",
    "Kalenjin": "kln",
    "Taita (Dawida)": "dav",
    "Igbo": "ibo",
    "Dagbani": "dag",
    "Yoruba": "yor",
    "Hausa": "hau",
    "Nigerian Pidgin": "pcm",
    "Ibibio": "ibb",
    "Afrikaans": "afr",
    "Tswana": "tsn",
    "Twi": "twi",
    "Dyula": "dyu",
    "Tigre": "tig",
    "Standard Moroccan Tamazight": "zgh",
    "Zulu": "zul",
    "Xhosa": "xho",
    "Northern Sotho": "nso",
    "Southern Sotho": "sot",
    "Swati": "ssw",
    "Venda": "ven",
    "Tsonga": "tso",
    "Southern Ndebele": "nbl",
    "Duala": "dua",
    "Ghomala": "bbj",
    "Medumba": "byv",
    "Ngiemboon": "nnh",
    "Bafia": "ksf",
    "Bamun": "bax",
    "Fe'fe'": "fmp",
    "Kom": "bkm",
    "Bafut": "bfd",
    "Bulu": "bum",
    "Eton": "eto",
    "Mundang": "mua",
    "Tupuri": "tui",
    "Mada": "mxu",
    "Kwasio": "nmg",
    "Mungaka": "mhk",
    "Tunen": "tvu",
    "Cameroon Pidgin": "wes",
    "Chokwe": "cjk",
    "Luba-Kasai": "lua",
    "Hemba": "hem",
    "Nyungwe": "nyu",
    "Baoule": "bci",
    "Aja": "ajg",
    "Gen": "gej",
    "Nawdm": "nmz",
    "Tem": "kdh",
    "Baatonum": "bba",
    "Ebrie": "ebr",
    "Adamawa Fulfulde": "fub",
    "Borgu Fulfulde": "fue",
    "Koti": "eko",
    "Rombo": "rof",
    "Musey": "mse",
    "Gidar": "gid",
    "South Giziga": "giz",
    "Northwest Gbaya": "gya",
    "Masana": "mcn",
    "Mpiemo": "mcx",
    "Mbum": "mdd",
    "Mpumpong": "mgg",
    "Bankon": "abb",
    "Batanga": "bnm",
    "Bakoko": "bkh",
    "Mokpwe": "bri",
    "Bebele": "beb",
    "Bamenyam": "bce",
    "Tuki": "bag",
    "Ngombale": "nla",
    "Yangben": "yav",
    "Wuzlam": "udl",
    "Musgu": "mug",
    "Ngomba": "jgo",
    "Mbo": "mbo",
    "Akan": "aka",
    "French": "fra",
    "Ewe": "ewe",
    "Shona": "sna",
    "Fulani (Pulaar)": "fuc",
    "Malagasy": "plt",
    "Wolof": "wol",
    "Somali": "som",
    "Fulani": "ful",
    "Cape Verdean Creole": "kea",
    "Portuguese (Mozambique)": "por-MZ",
    "English (Nigeria)": "eng-NG",
    "English (Southern Africa)": "eng",
    "English (East Africa)": "eng",
    "French (North Africa)": "fra",
    "French (Central Africa)": "fra",
    "Egyptian Arabic": "arz",
    "Dholuo": "luo",
    "isiZulu": "zul",
    "isiXhosa": "xho",
    "Sesotho": "sot",
    "Setswana": "tsn",
    "Xitsonga": "tso",
    "Tshivenda": "ven",
    "isiNdebele": "nbl",
    "Fula": "ful",
    "Zarma": "dje",
    "Tamasheq": "taq",
    "Fulfulde": "ful",
    "Nigerian English": "eng-NG",
    "South African English": "eng-ZA",
    "Sepedi (Northern Sotho)": "nso",
    "siSwati": "ssw",
    "Luo": "luo",
    "Baoulé": "bci",
    "Kabuverdianu": "kea",
    "Cameroonian Pidgin English": "wes",
    "Arabic dialects": "ara",
    "Chichewa": "nya",
    "English": "eng",
    "English (South African)": "eng-ZA",
    "Nyanja": "nya",
    "African-accented English": "eng",
    "English (African-accented)": "eng",
    "Akuapem Twi": "twi",
    "Asante Twi": "twi",
    "Pulaar": "fuc",
    "English (Nigerian)": "eng-NG",
    "Bhojpuri": "bho",
    "French (African-accented)": "fra",
    "French (West/Central African accents)": "fra",
    "Ghomala'": "bbj",
    "Dioula/Jula": "dyu",
    "Dioula": "dyu",
    "Kamba": "kam",
    "Nyanja (Chichewa)": "nya",
    "Umbundu": "umb",
    "Cape Verdean Creole (Kabuverdianu)": "kea",
    "Standard Yoruba": "yor",
    "Ifè Yoruba": "yor",
    "Ìlàje Yoruba": "yor",
    "Ìjèbú Yoruba": "yor",
    "Hausa-accented English": "eng-NG",
    "Yoruba-accented English": "eng-NG",
    "Igbo-accented English": "eng-NG",
    "Idoma-accented English": "eng-NG",
    "Urhobo-accented English": "eng-NG",
    "Ijaw-accented English": "eng-NG",
    "Igala-accented English": "eng-NG",
    "Isoko-accented English": "eng-NG",
    "Ebira-accented English": "eng-NG",
    "Ehugbo Igbo": "ibo",
    "Hindi": "hin",
    "South African English (Black South African English)": "eng-ZA",
    "South African English (Coloured/Cape Flats variety)": "eng-ZA",
    "West African Pidgin English": "pcm",
    "English (accented)": "eng",
    "Mozambican Portuguese": "por-MZ",
    "Gen/Mina": "gej",
    "Cairene Arabic": "arz",
    "Cape Verdean Creole (Barlavento)": "kea",
    "Malagasy (Merina/Plateau)": "plt",
    "English (East African)": "eng",
    "Changana": "tso",
    "South Ndebele": "nbl",
    "Sepedi": "nso",
    "Shangani": "tso",
    "Bougiote (Bejaia Kabyle)": "kab",
    "Tasahlite (Eastern Kabyle)": "kab",
    "English (Arabic/Berber-accented)": "eng",
    "English (accented, L1 and L2)": "eng",
    "~340 African languages (New Testament readings)": "",
    "~1,500+ African languages/dialects": "",
    "~400+ African languages": ""
  },
  "not_a_language": {
    "multiple": "placeholder used by a source instead of naming its languages",
    "various": "placeholder used by a source instead of naming its languages",
    "commissioned per project": "a collection arrangement, not a language"
  },
  "descriptive": [
    "11 African languages",
    "142 subsets incl. Mauritian Creole, Seychellois Creole, Malagasy, Lingala, Kirundi",
    "18 African languages (7 South African confirmed; Kenyan and Nigerian nodes additional)",
    "19 African languages",
    "African languages",
    "African-accented English (11 accents incl. Hausa, Yoruba, Igbo, Swahili, Sesotho L1)"
  ]
} as unknown as LanguageCodes;

export const COUNTRIES = [
  {
    "name": "Algeria",
    "iso2": "DZ",
    "iso3": "DZA",
    "map_name": "Algeria",
    "lat": 28.0,
    "lon": 3.0,
    "region": "North Africa",
    "slug": "dz"
  },
  {
    "name": "Angola",
    "iso2": "AO",
    "iso3": "AGO",
    "map_name": "Angola",
    "lat": -12.3,
    "lon": 17.9,
    "region": "Southern Africa",
    "slug": "ao"
  },
  {
    "name": "Benin",
    "iso2": "BJ",
    "iso3": "BEN",
    "map_name": "Benin",
    "lat": 9.6,
    "lon": 2.3,
    "region": "West Africa",
    "slug": "bj"
  },
  {
    "name": "Botswana",
    "iso2": "BW",
    "iso3": "BWA",
    "map_name": "Botswana",
    "lat": -22.2,
    "lon": 23.8,
    "region": "Southern Africa",
    "slug": "bw"
  },
  {
    "name": "Burkina Faso",
    "iso2": "BF",
    "iso3": "BFA",
    "map_name": "Burkina Faso",
    "lat": 12.3,
    "lon": -1.6,
    "region": "West Africa",
    "slug": "bf"
  },
  {
    "name": "Burundi",
    "iso2": "BI",
    "iso3": "BDI",
    "map_name": "Burundi",
    "lat": -3.4,
    "lon": 29.9,
    "region": "East Africa",
    "slug": "bi"
  },
  {
    "name": "Cabo Verde",
    "iso2": "CV",
    "iso3": "CPV",
    "map_name": null,
    "lat": 16.0,
    "lon": -24.0,
    "region": "West Africa",
    "slug": "cv"
  },
  {
    "name": "Cameroon",
    "iso2": "CM",
    "iso3": "CMR",
    "map_name": "Cameroon",
    "lat": 5.7,
    "lon": 12.7,
    "region": "Central Africa",
    "slug": "cm"
  },
  {
    "name": "Central African Republic",
    "iso2": "CF",
    "iso3": "CAF",
    "map_name": "Central African Rep.",
    "lat": 6.6,
    "lon": 20.9,
    "region": "Central Africa",
    "slug": "cf"
  },
  {
    "name": "Chad",
    "iso2": "TD",
    "iso3": "TCD",
    "map_name": "Chad",
    "lat": 15.4,
    "lon": 18.7,
    "region": "Central Africa",
    "slug": "td"
  },
  {
    "name": "Comoros",
    "iso2": "KM",
    "iso3": "COM",
    "map_name": null,
    "lat": -11.87,
    "lon": 43.35,
    "region": "Island states",
    "slug": "km"
  },
  {
    "name": "Democratic Republic of the Congo",
    "iso2": "CD",
    "iso3": "COD",
    "map_name": "Dem. Rep. Congo",
    "lat": -2.9,
    "lon": 23.6,
    "region": "Central Africa",
    "slug": "cd"
  },
  {
    "name": "Republic of the Congo",
    "iso2": "CG",
    "iso3": "COG",
    "map_name": "Congo",
    "lat": -0.8,
    "lon": 15.2,
    "region": "Central Africa",
    "slug": "cg"
  },
  {
    "name": "Côte d'Ivoire",
    "iso2": "CI",
    "iso3": "CIV",
    "map_name": "Côte d'Ivoire",
    "lat": 7.5,
    "lon": -5.5,
    "region": "West Africa",
    "slug": "ci"
  },
  {
    "name": "Djibouti",
    "iso2": "DJ",
    "iso3": "DJI",
    "map_name": "Djibouti",
    "lat": 11.8,
    "lon": 42.6,
    "region": "Horn of Africa",
    "slug": "dj"
  },
  {
    "name": "Egypt",
    "iso2": "EG",
    "iso3": "EGY",
    "map_name": "Egypt",
    "lat": 26.8,
    "lon": 30.8,
    "region": "North Africa",
    "slug": "eg"
  },
  {
    "name": "Equatorial Guinea",
    "iso2": "GQ",
    "iso3": "GNQ",
    "map_name": "Eq. Guinea",
    "lat": 1.6,
    "lon": 10.3,
    "region": "Central Africa",
    "slug": "gq"
  },
  {
    "name": "Eritrea",
    "iso2": "ER",
    "iso3": "ERI",
    "map_name": "Eritrea",
    "lat": 15.2,
    "lon": 39.8,
    "region": "Horn of Africa",
    "slug": "er"
  },
  {
    "name": "Eswatini",
    "iso2": "SZ",
    "iso3": "SWZ",
    "map_name": "eSwatini",
    "lat": -26.5,
    "lon": 31.5,
    "region": "Southern Africa",
    "slug": "sz"
  },
  {
    "name": "Ethiopia",
    "iso2": "ET",
    "iso3": "ETH",
    "map_name": "Ethiopia",
    "lat": 9.1,
    "lon": 40.5,
    "region": "Horn of Africa",
    "slug": "et"
  },
  {
    "name": "Gabon",
    "iso2": "GA",
    "iso3": "GAB",
    "map_name": "Gabon",
    "lat": -0.8,
    "lon": 11.6,
    "region": "Central Africa",
    "slug": "ga"
  },
  {
    "name": "Gambia",
    "iso2": "GM",
    "iso3": "GMB",
    "map_name": "Gambia",
    "lat": 13.4,
    "lon": -15.3,
    "region": "West Africa",
    "slug": "gm"
  },
  {
    "name": "Ghana",
    "iso2": "GH",
    "iso3": "GHA",
    "map_name": "Ghana",
    "lat": 7.9,
    "lon": -1.0,
    "region": "West Africa",
    "slug": "gh"
  },
  {
    "name": "Guinea",
    "iso2": "GN",
    "iso3": "GIN",
    "map_name": "Guinea",
    "lat": 9.9,
    "lon": -9.7,
    "region": "West Africa",
    "slug": "gn"
  },
  {
    "name": "Guinea-Bissau",
    "iso2": "GW",
    "iso3": "GNB",
    "map_name": "Guinea-Bissau",
    "lat": 11.8,
    "lon": -15.2,
    "region": "West Africa",
    "slug": "gw"
  },
  {
    "name": "Kenya",
    "iso2": "KE",
    "iso3": "KEN",
    "map_name": "Kenya",
    "lat": 0.2,
    "lon": 37.9,
    "region": "East Africa",
    "slug": "ke"
  },
  {
    "name": "Lesotho",
    "iso2": "LS",
    "iso3": "LSO",
    "map_name": "Lesotho",
    "lat": -29.6,
    "lon": 28.2,
    "region": "Southern Africa",
    "slug": "ls"
  },
  {
    "name": "Liberia",
    "iso2": "LR",
    "iso3": "LBR",
    "map_name": "Liberia",
    "lat": 6.4,
    "lon": -9.4,
    "region": "West Africa",
    "slug": "lr"
  },
  {
    "name": "Libya",
    "iso2": "LY",
    "iso3": "LBY",
    "map_name": "Libya",
    "lat": 26.3,
    "lon": 17.2,
    "region": "North Africa",
    "slug": "ly"
  },
  {
    "name": "Madagascar",
    "iso2": "MG",
    "iso3": "MDG",
    "map_name": "Madagascar",
    "lat": -18.8,
    "lon": 46.9,
    "region": "Island states",
    "slug": "mg"
  },
  {
    "name": "Malawi",
    "iso2": "MW",
    "iso3": "MWI",
    "map_name": "Malawi",
    "lat": -13.3,
    "lon": 34.3,
    "region": "Southern Africa",
    "slug": "mw"
  },
  {
    "name": "Mali",
    "iso2": "ML",
    "iso3": "MLI",
    "map_name": "Mali",
    "lat": 17.6,
    "lon": -4.0,
    "region": "West Africa",
    "slug": "ml"
  },
  {
    "name": "Mauritania",
    "iso2": "MR",
    "iso3": "MRT",
    "map_name": "Mauritania",
    "lat": 21.0,
    "lon": -10.9,
    "region": "West Africa",
    "slug": "mr"
  },
  {
    "name": "Mauritius",
    "iso2": "MU",
    "iso3": "MUS",
    "map_name": null,
    "lat": -20.2,
    "lon": 57.5,
    "region": "Island states",
    "slug": "mu"
  },
  {
    "name": "Mayotte",
    "iso2": "YT",
    "iso3": "MYT",
    "map_name": null,
    "lat": -12.83,
    "lon": 45.17,
    "region": "Island states",
    "slug": "yt"
  },
  {
    "name": "Morocco",
    "iso2": "MA",
    "iso3": "MAR",
    "map_name": "Morocco",
    "lat": 31.8,
    "lon": -7.1,
    "region": "North Africa",
    "slug": "ma"
  },
  {
    "name": "Mozambique",
    "iso2": "MZ",
    "iso3": "MOZ",
    "map_name": "Mozambique",
    "lat": -18.7,
    "lon": 35.5,
    "region": "Southern Africa",
    "slug": "mz"
  },
  {
    "name": "Namibia",
    "iso2": "NA",
    "iso3": "NAM",
    "map_name": "Namibia",
    "lat": -22.6,
    "lon": 18.5,
    "region": "Southern Africa",
    "slug": "na"
  },
  {
    "name": "Niger",
    "iso2": "NE",
    "iso3": "NER",
    "map_name": "Niger",
    "lat": 17.6,
    "lon": 8.1,
    "region": "West Africa",
    "slug": "ne"
  },
  {
    "name": "Nigeria",
    "iso2": "NG",
    "iso3": "NGA",
    "map_name": "Nigeria",
    "lat": 9.1,
    "lon": 8.7,
    "region": "West Africa",
    "slug": "ng"
  },
  {
    "name": "Réunion",
    "iso2": "RE",
    "iso3": "REU",
    "map_name": null,
    "lat": -21.11,
    "lon": 55.54,
    "region": "Island states",
    "slug": "re"
  },
  {
    "name": "Rwanda",
    "iso2": "RW",
    "iso3": "RWA",
    "map_name": "Rwanda",
    "lat": -1.9,
    "lon": 29.9,
    "region": "East Africa",
    "slug": "rw"
  },
  {
    "name": "São Tomé and Príncipe",
    "iso2": "ST",
    "iso3": "STP",
    "map_name": null,
    "lat": 0.33,
    "lon": 6.73,
    "region": "Central Africa",
    "slug": "st"
  },
  {
    "name": "Senegal",
    "iso2": "SN",
    "iso3": "SEN",
    "map_name": "Senegal",
    "lat": 14.5,
    "lon": -14.5,
    "region": "West Africa",
    "slug": "sn"
  },
  {
    "name": "Seychelles",
    "iso2": "SC",
    "iso3": "SYC",
    "map_name": null,
    "lat": -4.6,
    "lon": 55.5,
    "region": "Island states",
    "slug": "sc"
  },
  {
    "name": "Sierra Leone",
    "iso2": "SL",
    "iso3": "SLE",
    "map_name": "Sierra Leone",
    "lat": 8.5,
    "lon": -11.8,
    "region": "West Africa",
    "slug": "sl"
  },
  {
    "name": "Somalia",
    "iso2": "SO",
    "iso3": "SOM",
    "map_name": "Somalia",
    "lat": 5.2,
    "lon": 46.2,
    "region": "Horn of Africa",
    "slug": "so"
  },
  {
    "name": "Somaliland",
    "iso2": "XS",
    "iso3": "XSL",
    "map_name": "Somaliland",
    "lat": 9.6,
    "lon": 46.0,
    "region": "Horn of Africa",
    "slug": "xs"
  },
  {
    "name": "South Africa",
    "iso2": "ZA",
    "iso3": "ZAF",
    "map_name": "South Africa",
    "lat": -30.6,
    "lon": 22.9,
    "region": "Southern Africa",
    "slug": "za"
  },
  {
    "name": "South Sudan",
    "iso2": "SS",
    "iso3": "SSD",
    "map_name": "S. Sudan",
    "lat": 7.9,
    "lon": 30.2,
    "region": "East Africa",
    "slug": "ss"
  },
  {
    "name": "Sudan",
    "iso2": "SD",
    "iso3": "SDN",
    "map_name": "Sudan",
    "lat": 15.6,
    "lon": 30.2,
    "region": "North Africa",
    "slug": "sd"
  },
  {
    "name": "Tanzania",
    "iso2": "TZ",
    "iso3": "TZA",
    "map_name": "Tanzania",
    "lat": -6.4,
    "lon": 34.9,
    "region": "East Africa",
    "slug": "tz"
  },
  {
    "name": "Togo",
    "iso2": "TG",
    "iso3": "TGO",
    "map_name": "Togo",
    "lat": 8.6,
    "lon": 0.8,
    "region": "West Africa",
    "slug": "tg"
  },
  {
    "name": "Tunisia",
    "iso2": "TN",
    "iso3": "TUN",
    "map_name": "Tunisia",
    "lat": 33.9,
    "lon": 9.5,
    "region": "North Africa",
    "slug": "tn"
  },
  {
    "name": "Uganda",
    "iso2": "UG",
    "iso3": "UGA",
    "map_name": "Uganda",
    "lat": 1.4,
    "lon": 32.3,
    "region": "East Africa",
    "slug": "ug"
  },
  {
    "name": "Western Sahara",
    "iso2": "EH",
    "iso3": "ESH",
    "map_name": "W. Sahara",
    "lat": 24.2,
    "lon": -12.9,
    "region": "North Africa",
    "slug": "eh"
  },
  {
    "name": "Zambia",
    "iso2": "ZM",
    "iso3": "ZMB",
    "map_name": "Zambia",
    "lat": -13.1,
    "lon": 27.8,
    "region": "Southern Africa",
    "slug": "zm"
  },
  {
    "name": "Zimbabwe",
    "iso2": "ZW",
    "iso3": "ZWE",
    "map_name": "Zimbabwe",
    "lat": -19.0,
    "lon": 29.2,
    "region": "Southern Africa",
    "slug": "zw"
  }
] as unknown as Country[];

export const CREDITS = {
  "author": {
    "name": "Isheanesu Nigel Misi",
    "short_name": "Ishe Misi",
    "tagline": "Building African language AI.",
    "bio": "Co-founder and CTO of Vambo AI, working on speech and language models for African languages. ngano grew out of the search for training data that this catalogue documents.",
    "email": null
  },
  "links": [
    {
      "label": "GitHub",
      "handle": "PLACEHOLDER",
      "url": "https://github.com/PLACEHOLDER",
      "icon": "github"
    },
    {
      "label": "LinkedIn",
      "handle": "PLACEHOLDER",
      "url": "https://www.linkedin.com/in/PLACEHOLDER",
      "icon": "linkedin"
    },
    {
      "label": "X",
      "handle": "PLACEHOLDER",
      "url": "https://x.com/PLACEHOLDER",
      "icon": "x"
    },
    {
      "label": "Hugging Face",
      "handle": "PLACEHOLDER",
      "url": "https://huggingface.co/PLACEHOLDER",
      "icon": "huggingface"
    },
    {
      "label": "Website",
      "handle": "PLACEHOLDER",
      "url": "https://PLACEHOLDER",
      "icon": "globe"
    }
  ],
  "project": {
    "name": "ngano",
    "meaning": "Shona for folk stories, the oral tradition told aloud and later written down.",
    "domain": "https://ngano.dev",
    "repo": "https://github.com/PLACEHOLDER/ngano",
    "code_licence": "MIT",
    "data_licence": "CC-BY-4.0",
    "citation": {
      "type": "software",
      "title": "ngano: a catalogue and unified loader for African-language speech datasets",
      "year": 2026
    }
  },
  "acknowledgements": [
    "Every dataset in this catalogue belongs to the teams who collected it. ngano only points at their work and records what they published about it.",
    "Digital Umuganda, Masakhane, Lacuna Fund, Mozilla Common Voice, SADiLaR, Makerere AI Lab, Sunbird AI, Intron Health, RobotsMali, Ghana NLP and the University of Zambia carry a disproportionate share of what exists."
  ]
} as unknown as Credits;

export const FIELD_MAP: unknown = {
  "$comment": "Maps heterogeneous Hugging Face audio-dataset columns onto ngano's canonical schema. Heuristic aliases are applied to every dataset; repo overrides win where present. Runtime feature inspection always takes precedence over guesswork, so an unknown dataset still loads.",
  "version": 1,
  "canonical": {
    "audio": "Audio handle. Lazy by default: {url, path, bytes, sampling_rate}. Never decoded unless the caller asks.",
    "transcript": "Reference text for the utterance.",
    "language": "Language name as the source labels it.",
    "language_iso": "ISO 639-1/3 code where the source provides one.",
    "country": "ISO 3166-1 alpha-2, from the source row or the catalogue entry.",
    "speaker_id": "Stable speaker identifier within the dataset.",
    "gender": "Speaker gender as stated by the source. Never inferred.",
    "age": "Speaker age or age band as stated by the source.",
    "duration_s": "Utterance duration in seconds.",
    "sampling_rate": "Sample rate in Hz.",
    "domain": "Recording domain, e.g. read, broadcast, clinical.",
    "split": "Source split name.",
    "dataset_id": "ngano catalogue id.",
    "hf_repo": "Hugging Face repo id.",
    "licence": "Licence string from the catalogue.",
    "source_url": "Canonical URL for the dataset."
  },
  "aliases": {
    "transcript": [
      "sentence",
      "text",
      "transcription",
      "transcript",
      "normalized_text",
      "normalised_text",
      "sentence_norm",
      "raw_transcription",
      "utterance",
      "utt",
      "transcript_text",
      "orthographic",
      "orthographic_transcription",
      "target_text",
      "target",
      "label_text",
      "ref",
      "reference",
      "content",
      "phrase",
      "words"
    ],
    "audio": [
      "audio",
      "speech",
      "wav",
      "path",
      "file",
      "audio_filepath",
      "audio_path",
      "file_name",
      "filename",
      "filepath",
      "audio_file",
      "waveform",
      "input_values"
    ],
    "language": [
      "language",
      "locale",
      "lang",
      "language_name",
      "lang_id",
      "locale_id",
      "language_code",
      "lang_code",
      "langid",
      "iso_language"
    ],
    "language_iso": [
      "language_iso",
      "iso_639_3",
      "iso639_3",
      "iso_code",
      "lang_iso"
    ],
    "speaker_id": [
      "client_id",
      "speaker_id",
      "speaker",
      "spk_id",
      "speakerid",
      "spkid",
      "user_id",
      "voice_id",
      "narrator",
      "speaker_name"
    ],
    "gender": [
      "gender",
      "sex",
      "speaker_gender"
    ],
    "age": [
      "age",
      "age_group",
      "speaker_age",
      "age_band"
    ],
    "duration_s": [
      "duration",
      "duration_s",
      "duration_sec",
      "duration_seconds",
      "length",
      "audio_duration",
      "dur",
      "seconds"
    ],
    "duration_ms": [
      "duration_ms",
      "duration_millis",
      "length_ms"
    ],
    "sampling_rate": [
      "sampling_rate",
      "sample_rate",
      "sr",
      "samplerate",
      "frequency"
    ],
    "country": [
      "country",
      "accent_country",
      "nationality",
      "country_code",
      "region_country"
    ],
    "domain": [
      "domain",
      "topic",
      "category",
      "genre",
      "style",
      "subject"
    ],
    "split": [
      "split",
      "subset",
      "partition"
    ]
  },
  "drop": [
    "up_votes",
    "down_votes",
    "accent",
    "variant",
    "segment",
    "__index_level_0__",
    "audio_id",
    "id",
    "idx",
    "index",
    "path_orig",
    "is_gold_transcript",
    "num_samples"
  ],
  "unit_hints": {
    "duration_ms": {
      "canonical": "duration_s",
      "multiply": 0.001
    },
    "duration_frames_16k": {
      "canonical": "duration_s",
      "multiply": 6.25e-05
    }
  },
  "overrides": {
    "mozilla-foundation/common_voice_17_0": {
      "transcript": "sentence",
      "speaker_id": "client_id",
      "language": "locale",
      "audio": "audio",
      "verified": true
    },
    "mozilla-foundation/common_voice_16_1": {
      "transcript": "sentence",
      "speaker_id": "client_id",
      "language": "locale",
      "audio": "audio",
      "verified": true
    },
    "mozilla-foundation/common_voice_13_0": {
      "transcript": "sentence",
      "speaker_id": "client_id",
      "language": "locale",
      "audio": "audio",
      "verified": true
    },
    "mozilla-foundation/common_voice_11_0": {
      "transcript": "sentence",
      "speaker_id": "client_id",
      "language": "locale",
      "audio": "audio",
      "verified": true
    },
    "google/fleurs": {
      "transcript": "transcription",
      "language": "language",
      "language_iso": "lang_id",
      "audio": "audio",
      "gender": "gender",
      "verified": true
    },
    "google/xtreme_s": {
      "transcript": "transcription",
      "language": "lang_id",
      "audio": "audio",
      "verified": true
    },
    "intronhealth/afrispeech-200": {
      "transcript": "transcript",
      "speaker_id": "speaker_id",
      "audio": "audio",
      "age": "age_group",
      "gender": "gender",
      "domain": "domain",
      "verified": true
    }
  }
};

export const GEO: unknown = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Tanzania",
        "iso_a3": "TZA"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              33.904,
              -0.95
            ],
            [
              39.44,
              -6.84
            ],
            [
              40.317,
              -10.317
            ],
            [
              36.514,
              -11.721
            ],
            [
              32.192,
              -8.93
            ],
            [
              29.52,
              -5.42
            ],
            [
              30.47,
              -2.414
            ],
            [
              33.904,
              -0.95
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "W. Sahara",
        "iso_a3": "ESH"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -8.666,
              27.656
            ],
            [
              -12.929,
              21.327
            ],
            [
              -14.221,
              22.31
            ],
            [
              -10.551,
              26.991
            ],
            [
              -8.666,
              27.656
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Dem. Rep. Congo",
        "iso_a3": "COD"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              29.34,
              -4.5
            ],
            [
              30.346,
              -8.238
            ],
            [
              29.342,
              -12.361
            ],
            [
              27.164,
              -11.609
            ],
            [
              23.457,
              -10.868
            ],
            [
              21.746,
              -7.92
            ],
            [
              19.418,
              -7.155
            ],
            [
              16.327,
              -5.877
            ],
            [
              12.632,
              -4.991
            ],
            [
              14.583,
              -4.97
            ],
            [
              17.639,
              -0.425
            ],
            [
              18.394,
              2.9
            ],
            [
              22.704,
              4.633
            ],
            [
              25.279,
              5.17
            ],
            [
              28.697,
              4.455
            ],
            [
              31.174,
              2.204
            ],
            [
              29.292,
              -1.62
            ],
            [
              29.34,
              -4.5
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Somalia",
        "iso_a3": "SOM"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              41.585,
              -1.683
            ],
            [
              44.964,
              5.002
            ],
            [
              51.111,
              12.025
            ],
            [
              46.565,
              2.855
            ],
            [
              41.585,
              -1.683
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Kenya",
        "iso_a3": "KEN"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              39.202,
              -4.677
            ],
            [
              35.036,
              1.906
            ],
            [
              36.159,
              4.448
            ],
            [
              39.855,
              3.839
            ],
            [
              41.585,
              -1.683
            ],
            [
              39.605,
              -4.347
            ],
            [
              39.202,
              -4.677
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Sudan",
        "iso_a3": "SDN"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              24.567,
              8.229
            ],
            [
              22.978,
              10.714
            ],
            [
              22.038,
              12.955
            ],
            [
              23.887,
              15.611
            ],
            [
              36.969,
              20.837
            ],
            [
              36.853,
              16.957
            ],
            [
              35.26,
              12.083
            ],
            [
              33.963,
              9.464
            ],
            [
              33.207,
              12.179
            ],
            [
              31.851,
              10.531
            ],
            [
              29.001,
              9.604
            ],
            [
              26.477,
              9.553
            ],
            [
              24.567,
              8.229
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Chad",
        "iso_a3": "TCD"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              23.838,
              19.58
            ],
            [
              22.297,
              13.372
            ],
            [
              22.876,
              11.385
            ],
            [
              19.094,
              9.075
            ],
            [
              16.291,
              7.754
            ],
            [
              13.954,
              9.549
            ],
            [
              14.496,
              12.859
            ],
            [
              15.248,
              16.627
            ],
            [
              15.097,
              21.309
            ],
            [
              23.838,
              19.58
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "South Africa",
        "iso_a3": "ZAF"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              16.345,
              -28.577
            ],
            [
              19.895,
              -28.461
            ],
            [
              21.606,
              -26.727
            ],
            [
              25.025,
              -25.72
            ],
            [
              28.017,
              -22.828
            ],
            [
              31.931,
              -24.369
            ],
            [
              30.686,
              -26.744
            ],
            [
              32.462,
              -28.301
            ],
            [
              26.419,
              -33.615
            ],
            [
              22.988,
              -33.916
            ],
            [
              19.193,
              -34.463
            ],
            [
              17.925,
              -32.611
            ],
            [
              16.345,
              -28.577
            ]
          ],
          [
            [
              29.325,
              -29.257
            ],
            [
              28.542,
              -28.648
            ],
            [
              28.074,
              -28.851
            ],
            [
              27.533,
              -29.243
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Lesotho",
        "iso_a3": "LSO"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              28.542,
              -28.648
            ],
            [
              29.325,
              -29.257
            ],
            [
              28.848,
              -30.07
            ],
            [
              28.291,
              -30.226
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Zimbabwe",
        "iso_a3": "ZWE"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              31.191,
              -22.252
            ],
            [
              28.021,
              -21.486
            ],
            [
              25.649,
              -18.536
            ],
            [
              28.826,
              -16.39
            ],
            [
              31.636,
              -16.072
            ],
            [
              32.612,
              -19.419
            ],
            [
              31.191,
              -22.252
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Botswana",
        "iso_a3": "BWA"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              29.432,
              -22.091
            ],
            [
              25.665,
              -25.487
            ],
            [
              22.58,
              -25.979
            ],
            [
              19.896,
              -24.768
            ],
            [
              23.579,
              -18.281
            ],
            [
              25.85,
              -18.714
            ],
            [
              28.795,
              -21.639
            ],
            [
              29.432,
              -22.091
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Namibia",
        "iso_a3": "NAM"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              19.895,
              -21.849
            ],
            [
              16.824,
              -28.082
            ],
            [
              14.258,
              -22.111
            ],
            [
              12.814,
              -16.941
            ],
            [
              21.377,
              -17.931
            ],
            [
              24.217,
              -17.889
            ],
            [
              19.895,
              -21.849
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Senegal",
        "iso_a3": "SEN"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -16.714,
              13.595
            ],
            [
              -15.624,
              16.369
            ],
            [
              -11.928,
              13.422
            ],
            [
              -12.279,
              12.354
            ],
            [
              -15.931,
              13.13
            ],
            [
              -14.377,
              13.626
            ],
            [
              -16.714,
              13.595
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Mali",
        "iso_a3": "MLI"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -11.456,
              12.077
            ],
            [
              -11.834,
              14.799
            ],
            [
              -9.55,
              15.486
            ],
            [
              1.823,
              20.611
            ],
            [
              3.723,
              16.184
            ],
            [
              -0.516,
              15.116
            ],
            [
              -3.523,
              13.338
            ],
            [
              -5.471,
              10.951
            ],
            [
              -7.623,
              10.147
            ],
            [
              -8.62,
              10.811
            ],
            [
              -10.593,
              11.924
            ],
            [
              -11.456,
              12.077
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Mauritania",
        "iso_a3": "MRT"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -17.063,
              21.0
            ],
            [
              -11.969,
              25.933
            ],
            [
              -5.315,
              16.202
            ],
            [
              -11.349,
              15.411
            ],
            [
              -15.136,
              16.587
            ],
            [
              -16.146,
              18.108
            ],
            [
              -17.063,
              21.0
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Benin",
        "iso_a3": "BEN"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              2.692,
              6.259
            ],
            [
              0.772,
              10.471
            ],
            [
              2.849,
              12.236
            ],
            [
              2.912,
              9.138
            ],
            [
              2.692,
              6.259
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Niger",
        "iso_a3": "NER"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              14.851,
              22.863
            ],
            [
              15.3,
              17.928
            ],
            [
              14.596,
              13.33
            ],
            [
              13.084,
              13.596
            ],
            [
              9.525,
              12.851
            ],
            [
              5.443,
              13.866
            ],
            [
              2.849,
              12.236
            ],
            [
              0.43,
              13.989
            ],
            [
              3.638,
              15.568
            ],
            [
              12.0,
              23.472
            ],
            [
              14.851,
              22.863
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Nigeria",
        "iso_a3": "NGA"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              2.692,
              6.259
            ],
            [
              3.572,
              11.328
            ],
            [
              6.445,
              13.493
            ],
            [
              10.115,
              13.277
            ],
            [
              13.319,
              13.556
            ],
            [
              13.168,
              9.641
            ],
            [
              10.497,
              7.055
            ],
            [
              7.083,
              4.465
            ],
            [
              2.692,
              6.259
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Cameroon",
        "iso_a3": "CMR"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              14.496,
              12.859
            ],
            [
              13.954,
              9.549
            ],
            [
              14.459,
              5.452
            ],
            [
              15.863,
              3.014
            ],
            [
              11.752,
              2.327
            ],
            [
              8.489,
              4.496
            ],
            [
              10.497,
              7.055
            ],
            [
              13.168,
              9.641
            ],
            [
              14.496,
              12.859
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Togo",
        "iso_a3": "TGO"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              0.9,
              10.997
            ],
            [
              1.865,
              6.142
            ],
            [
              0.368,
              10.191
            ],
            [
              0.9,
              10.997
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Ghana",
        "iso_a3": "GHA"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              0.024,
              11.019
            ],
            [
              0.57,
              6.914
            ],
            [
              -2.811,
              5.389
            ],
            [
              -1.203,
              11.01
            ],
            [
              0.024,
              11.019
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Côte d'Ivoire",
        "iso_a3": "CIV"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -8.229,
              10.129
            ],
            [
              -6.05,
              10.096
            ],
            [
              -3.512,
              9.9
            ],
            [
              -2.856,
              4.994
            ],
            [
              -7.712,
              4.365
            ],
            [
              -8.603,
              6.468
            ],
            [
              -8.299,
              8.316
            ],
            [
              -8.229,
              10.129
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Guinea",
        "iso_a3": "GIN"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -13.7,
              12.586
            ],
            [
              -11.514,
              12.443
            ],
            [
              -9.328,
              12.334
            ],
            [
              -8.282,
              10.793
            ],
            [
              -7.832,
              8.576
            ],
            [
              -8.926,
              7.309
            ],
            [
              -10.494,
              8.716
            ],
            [
              -12.426,
              9.836
            ],
            [
              -15.13,
              11.04
            ],
            [
              -13.7,
              12.586
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Guinea-Bissau",
        "iso_a3": "GNB"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -16.677,
              12.385
            ],
            [
              -14.382,
              11.509
            ],
            [
              -16.309,
              11.959
            ],
            [
              -16.677,
              12.385
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Liberia",
        "iso_a3": "LBR"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -8.439,
              7.686
            ],
            [
              -7.57,
              5.707
            ],
            [
              -9.913,
              5.594
            ],
            [
              -9.755,
              8.541
            ],
            [
              -8.439,
              7.686
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Sierra Leone",
        "iso_a3": "SLE"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -13.247,
              8.903
            ],
            [
              -10.622,
              9.268
            ],
            [
              -11.2,
              7.106
            ],
            [
              -13.247,
              8.903
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Burkina Faso",
        "iso_a3": "BFA"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -5.404,
              10.371
            ],
            [
              -4.006,
              13.472
            ],
            [
              -1.066,
              14.974
            ],
            [
              0.993,
              13.336
            ],
            [
              1.243,
              11.111
            ],
            [
              -2.964,
              10.395
            ],
            [
              -4.955,
              10.153
            ],
            [
              -5.404,
              10.371
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Central African Rep.",
        "iso_a3": "CAF"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              27.374,
              5.234
            ],
            [
              24.411,
              5.109
            ],
            [
              19.468,
              5.032
            ],
            [
              16.013,
              2.268
            ],
            [
              14.559,
              5.031
            ],
            [
              16.291,
              7.754
            ],
            [
              19.094,
              9.075
            ],
            [
              22.978,
              10.714
            ],
            [
              25.124,
              7.5
            ],
            [
              27.374,
              5.234
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Congo",
        "iso_a3": "COG"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              18.453,
              3.504
            ],
            [
              17.664,
              -0.058
            ],
            [
              16.006,
              -3.535
            ],
            [
              12.996,
              -4.781
            ],
            [
              11.478,
              -2.766
            ],
            [
              14.299,
              -1.998
            ],
            [
              13.283,
              1.314
            ],
            [
              16.537,
              3.198
            ],
            [
              18.453,
              3.504
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Gabon",
        "iso_a3": "GAB"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              11.276,
              2.261
            ],
            [
              13.283,
              1.314
            ],
            [
              14.299,
              -1.998
            ],
            [
              11.478,
              -2.766
            ],
            [
              8.83,
              -0.779
            ],
            [
              11.276,
              2.261
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Eq. Guinea",
        "iso_a3": "GNQ"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              9.649,
              2.284
            ],
            [
              11.276,
              2.261
            ],
            [
              11.285,
              1.058
            ],
            [
              9.493,
              1.01
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Zambia",
        "iso_a3": "ZMB"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              30.74,
              -8.34
            ],
            [
              33.315,
              -10.797
            ],
            [
              30.179,
              -14.796
            ],
            [
              27.044,
              -17.938
            ],
            [
              23.215,
              -17.523
            ],
            [
              23.904,
              -11.722
            ],
            [
              25.752,
              -11.785
            ],
            [
              29.7,
              -13.257
            ],
            [
              28.735,
              -8.527
            ],
            [
              30.74,
              -8.34
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Malawi",
        "iso_a3": "MWI"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              32.759,
              -9.231
            ],
            [
              34.907,
              -13.565
            ],
            [
              34.381,
              -16.184
            ],
            [
              33.214,
              -13.972
            ],
            [
              33.486,
              -10.526
            ],
            [
              32.759,
              -9.231
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Mozambique",
        "iso_a3": "MOZ"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              34.56,
              -11.52
            ],
            [
              38.428,
              -11.285
            ],
            [
              40.6,
              -14.202
            ],
            [
              35.896,
              -18.842
            ],
            [
              35.563,
              -22.09
            ],
            [
              33.013,
              -25.358
            ],
            [
              31.752,
              -25.484
            ],
            [
              32.773,
              -19.716
            ],
            [
              31.852,
              -16.319
            ],
            [
              33.79,
              -14.452
            ],
            [
              35.034,
              -16.801
            ],
            [
              34.56,
              -13.58
            ],
            [
              34.56,
              -11.52
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "eSwatini",
        "iso_a3": "SWZ"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              32.072,
              -26.734
            ],
            [
              31.868,
              -27.178
            ],
            [
              31.283,
              -27.286
            ],
            [
              30.686,
              -26.744
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Angola",
        "iso_a3": "AGO"
      },
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [
          [
            [
              [
                12.996,
                -4.781
              ],
              [
                12.632,
                -4.991
              ],
              [
                12.468,
                -5.248
              ],
              [
                12.437,
                -5.684
              ]
            ]
          ],
          [
            [
              [
                12.322,
                -6.1
              ],
              [
                18.464,
                -7.847
              ],
              [
                20.515,
                -7.3
              ],
              [
                22.209,
                -9.895
              ],
              [
                24.08,
                -12.191
              ],
              [
                21.377,
                -17.931
              ],
              [
                12.814,
                -16.941
              ],
              [
                12.738,
                -13.138
              ],
              [
                12.929,
                -8.959
              ],
              [
                12.322,
                -6.1
              ]
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Burundi",
        "iso_a3": "BDI"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              30.47,
              -2.414
            ],
            [
              30.528,
              -2.808
            ],
            [
              30.743,
              -3.034
            ],
            [
              30.752,
              -3.359
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Madagascar",
        "iso_a3": "MDG"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              49.544,
              -12.47
            ],
            [
              49.861,
              -15.414
            ],
            [
              47.931,
              -22.392
            ],
            [
              43.764,
              -24.461
            ],
            [
              43.896,
              -20.83
            ],
            [
              44.447,
              -16.216
            ],
            [
              48.005,
              -14.091
            ],
            [
              49.544,
              -12.47
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Gambia",
        "iso_a3": "GMB"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -16.714,
              13.595
            ],
            [
              -14.047,
              13.794
            ],
            [
              -16.842,
              13.151
            ],
            [
              -16.714,
              13.595
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Tunisia",
        "iso_a3": "TUN"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              9.482,
              30.308
            ],
            [
              8.141,
              34.655
            ],
            [
              10.181,
              36.724
            ],
            [
              10.808,
              34.834
            ],
            [
              11.432,
              32.369
            ],
            [
              9.482,
              30.308
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Algeria",
        "iso_a3": "DZA"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -8.684,
              27.396
            ],
            [
              -3.69,
              30.897
            ],
            [
              -1.388,
              32.864
            ],
            [
              0.504,
              36.301
            ],
            [
              7.737,
              36.886
            ],
            [
              7.613,
              33.344
            ],
            [
              9.86,
              28.96
            ],
            [
              9.911,
              25.365
            ],
            [
              8.573,
              21.566
            ],
            [
              1.823,
              20.611
            ],
            [
              -8.684,
              27.396
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Eritrea",
        "iso_a3": "ERI"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              36.43,
              14.422
            ],
            [
              38.41,
              17.998
            ],
            [
              43.081,
              12.7
            ],
            [
              40.026,
              14.52
            ],
            [
              36.43,
              14.422
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Morocco",
        "iso_a3": "MAR"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -2.17,
              35.168
            ],
            [
              -2.617,
              32.094
            ],
            [
              -6.061,
              29.732
            ],
            [
              -9.413,
              27.088
            ],
            [
              -12.031,
              26.031
            ],
            [
              -17.02,
              21.422
            ],
            [
              -15.426,
              24.359
            ],
            [
              -13.14,
              27.64
            ],
            [
              -9.815,
              31.178
            ],
            [
              -4.591,
              35.331
            ],
            [
              -2.17,
              35.168
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Egypt",
        "iso_a3": "EGY"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              36.866,
              22.0
            ],
            [
              25.165,
              31.569
            ],
            [
              31.688,
              31.43
            ],
            [
              34.923,
              29.501
            ],
            [
              32.423,
              29.851
            ],
            [
              35.692,
              23.927
            ],
            [
              36.866,
              22.0
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Libya",
        "iso_a3": "LBY"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              25.0,
              29.239
            ],
            [
              13.581,
              23.041
            ],
            [
              9.911,
              25.365
            ],
            [
              9.86,
              28.96
            ],
            [
              10.637,
              31.761
            ],
            [
              13.919,
              32.712
            ],
            [
              20.053,
              30.986
            ],
            [
              23.237,
              32.191
            ],
            [
              25.0,
              29.239
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Ethiopia",
        "iso_a3": "ETH"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              47.789,
              8.003
            ],
            [
              41.172,
              3.919
            ],
            [
              38.121,
              3.599
            ],
            [
              34.707,
              6.594
            ],
            [
              33.826,
              8.379
            ],
            [
              35.26,
              12.083
            ],
            [
              38.513,
              14.505
            ],
            [
              41.599,
              13.452
            ],
            [
              42.559,
              10.573
            ],
            [
              47.789,
              8.003
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Djibouti",
        "iso_a3": "DJI"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              42.352,
              12.542
            ],
            [
              42.78,
              12.455
            ],
            [
              43.081,
              12.7
            ],
            [
              43.318,
              12.39
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Somaliland",
        "iso_a3": "SOL"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              48.948,
              11.411
            ],
            [
              42.559,
              10.573
            ],
            [
              45.557,
              10.698
            ],
            [
              48.948,
              11.411
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Uganda",
        "iso_a3": "UGA"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              33.904,
              -0.95
            ],
            [
              29.876,
              0.597
            ],
            [
              31.881,
              3.558
            ],
            [
              34.672,
              1.177
            ],
            [
              33.904,
              -0.95
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Rwanda",
        "iso_a3": "RWA"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              30.419,
              -1.135
            ],
            [
              30.816,
              -1.699
            ],
            [
              30.758,
              -2.287
            ],
            [
              30.47,
              -2.414
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "S. Sudan",
        "iso_a3": "SSD"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              30.834,
              3.509
            ],
            [
              27.98,
              4.408
            ],
            [
              23.887,
              8.62
            ],
            [
              26.752,
              9.467
            ],
            [
              29.516,
              9.793
            ],
            [
              32.4,
              11.081
            ],
            [
              33.087,
              11.441
            ],
            [
              33.975,
              8.685
            ],
            [
              34.25,
              6.826
            ],
            [
              31.881,
              3.558
            ],
            [
              30.834,
              3.509
            ]
          ]
        ]
      }
    }
  ]
};

/** data/snippets.json verbatim, so substitution is tested against the real templates. */
export const SNIPPETS = {
  "$comment": "Generated by scripts/merge_snippets.py. Each SDK owns and tests its own snippets; this file is the merged copy the website and MCP server serve. Do not edit by hand.",
  "version": 1,
  "placeholders": [
    "{{CONFIG}}",
    "{{COUNTRY_ISO2}}",
    "{{COUNTRY_NAME}}",
    "{{DATASET_ID}}",
    "{{HF_REPO}}",
    "{{LANGUAGE}}",
    "{{TASK}}"
  ],
  "languages": {
    "python": {
      "language": "python",
      "install": "pip install ngano",
      "install_audio": "pip install 'ngano[audio]'",
      "package": "ngano",
      "shell_snippets": [
        "cli"
      ],
      "snippets": {
        "catalogue_filter": "from ngano import Catalogue\n\ncat = Catalogue()  # bundled snapshot, offline, no token needed\n\nrecords = cat.datasets(\n    language=\"{{LANGUAGE}}\",\n    country=\"{{COUNTRY_ISO2}}\",\n    task=\"{{TASK}}\",\n    commercial=True,          # only datasets whose commercial field is \"Yes\"\n    hf_only=True,             # only datasets that can be streamed\n    sort=\"-hours\",\n)\n\nfor record in records:\n    hours = record.hours_num if record.hours_num is not None else 0.0\n    flag = \" (unverified)\" if record.unverified_size else \"\"\n    print(f\"{record.id}  {hours:,.0f} h{flag}  {record.hf_repo}\")\n",
        "stream_filter": "from ngano import load\n\nstream = load(\n    language=\"{{LANGUAGE}}\",\n    country=\"{{COUNTRY_ISO2}}\",\n    task=\"{{TASK}}\",\n    commercial=True,\n    split=\"train\",\n    limit=100,\n    interleave=\"round_robin\",   # or \"sequential\", or \"weighted_by_hours\"\n)\n\nprint(f\"{stream.matched} datasets matched, {stream.loadable} can be streamed\")\n\nfor index, row in enumerate(stream):\n    print(row.language, row.duration_s, repr(row.transcript))\n    if index >= 9:\n        break  # nothing further is fetched\n",
        "single_dataset": "from ngano import load_dataset\n\nstream = load_dataset(\"{{HF_REPO}}\", config=\"{{CONFIG}}\", split=\"train\", limit=5)\n\nfor row in stream:\n    print(row.language_iso, repr(row.transcript))\n    if row.audio is not None:\n        print(\"  \", row.audio.url or row.audio.path, row.audio.sampling_rate)\n        # audio_bytes = row.audio.read()        # fetched only when you ask\n        # array, sr = row.audio.decode()        # needs pip install \"ngano[audio]\"\n",
        "language_page": "from ngano import Catalogue, load\n\ncat = Catalogue()\n\nlanguage = cat.language(\"{{LANGUAGE}}\")\nprint(f\"{language.name}: {language.datasets} datasets, {language.hours:,.0f} hours\")\n\nfor record in cat.datasets(language=\"{{LANGUAGE}}\", sort=\"-hours\"):\n    print(record.id, record.task, record.licence, record.hf_repo or \"not on Hugging Face\")\n\n# Stream every {{LANGUAGE}} dataset that is on Hugging Face, as one row stream.\nstream = load(language=\"{{LANGUAGE}}\", limit=50)\nfor row in stream:\n    print(row.transcript)\n",
        "country_page": "from ngano import Catalogue\n\ncat = Catalogue()\n\nprint(\"Speech datasets recorded in {{COUNTRY_NAME}}\")\ncountry = cat.country(\"{{COUNTRY_ISO2}}\")\nprint(f\"{country.name}: {country.datasets} datasets, {country.hours:,.0f} hours, \"\n      f\"{country.languages} languages\")\n\nfor record in cat.datasets(country=\"{{COUNTRY_ISO2}}\", sort=\"-hours\"):\n    languages = \", \".join(record.languages_clean or record.languages)\n    print(f\"{record.id}  {languages}  {record.access}\")\n",
        "dataset_page": "from ngano import Catalogue, load_dataset\n\ncat = Catalogue()\nrecord = cat.get(\"{{DATASET_ID}}\")\n\nprint(record.name)\nprint(record.languages_clean or record.languages, record.countries)\nprint(record.task, record.licence, record.access, record.commercial)\nprint(record.hours_num, \"hours as published\", \"(unverified)\" if record.unverified_size else \"\")\nprint(record.url)\n\nif record.hf_repo:\n    for row in load_dataset(record.hf_repo, limit=3):\n        print(repr(row.transcript))\n",
        "cli": "pip install ngano\n\nngano search {{LANGUAGE}} --limit 5\nngano search --language {{LANGUAGE}} --task {{TASK}} --commercial --json\nngano show {{DATASET_ID}}\nngano countries --json\nngano languages --min-datasets 10\nngano stats\nngano load --language {{LANGUAGE}} --country {{COUNTRY_ISO2}} --hf-only --limit 20 --out rows.jsonl\n"
      }
    },
    "javascript": {
      "language": "javascript",
      "install": "npm install ngano",
      "install_audio": null,
      "package": "ngano",
      "shell_snippets": [
        "cli"
      ],
      "snippets": {
        "catalogue_filter": "import { Catalogue } from \"ngano\";\n\n// The catalogue ships inside the package, so this needs no network.\nconst cat = new Catalogue();\n\nconst datasets = cat.datasets({\n  language: \"{{LANGUAGE}}\",\n  country: \"{{COUNTRY_ISO2}}\",\n  task: \"{{TASK}}\",\n  commercial: true,\n  hfOnly: true,\n});\n\nfor (const dataset of datasets) {\n  console.log(dataset.id, dataset.hoursNum, dataset.licence, dataset.hfRepo);\n}\n",
        "stream_filter": "import { load } from \"ngano\";\n\nconst stream = load({\n  language: \"{{LANGUAGE}}\",\n  country: \"{{COUNTRY_ISO2}}\",\n  commercial: true,\n  split: \"train\",\n  interleave: \"round_robin\",\n  limit: 1000,\n  hfToken: process.env.HF_TOKEN,\n});\n\n// Counts are known before the first request is made.\nconsole.log(stream.matched + \" datasets matched, \" + stream.loadable + \" can be streamed\");\n\nfor await (const row of stream) {\n  console.log(row.transcript, row.language, row.durationS);\n  // Audio stays lazy until you ask for the bytes.\n  // const bytes = await row.audio?.read();\n}\n\nfor (const failure of stream.errors) {\n  console.warn(\"skipped \" + failure.source.hfRepo);\n}\n",
        "single_dataset": "import { loadDataset } from \"ngano\";\n\nlet count = 0;\n\nfor await (const row of loadDataset(\"{{HF_REPO}}\", {\n  config: \"{{CONFIG}}\",\n  split: \"train\",\n  hfToken: process.env.HF_TOKEN,\n})) {\n  console.log(row.transcript, row.audio?.url);\n  count += 1;\n  if (count >= 100) break; // breaking stops every request in flight\n}\n",
        "language_page": "import { Catalogue, load } from \"ngano\";\n\nconst cat = new Catalogue();\n\n// Every dataset covering the language, with hours excluding unverified figures.\nconst summary = cat.languages().find((entry) => entry.name === \"{{LANGUAGE}}\");\nconsole.log(summary?.datasets, summary?.hours, summary?.countries);\n\nconst stream = load({ language: \"{{LANGUAGE}}\", split: \"train\", limit: 200 });\nfor await (const row of stream) {\n  console.log(row.transcript);\n}\n",
        "country_page": "import { Catalogue } from \"ngano\";\n\nconst cat = new Catalogue();\n\nconst country = cat.countries().find((entry) => entry.iso2 === \"{{COUNTRY_ISO2}}\");\nconsole.log(\"{{COUNTRY_NAME}}\", country?.datasets, country?.hours, country?.languages);\n\nfor (const dataset of cat.datasets({ country: \"{{COUNTRY_ISO2}}\", hfOnly: true })) {\n  console.log(dataset.id, dataset.task, dataset.hfRepo);\n}\n",
        "dataset_page": "import { Catalogue, loadDataset } from \"ngano\";\n\nconst cat = new Catalogue();\nconst dataset = cat.get(\"{{DATASET_ID}}\");\n\nconsole.log(dataset?.name, dataset?.licence, dataset?.access, dataset?.hfRepo);\nif (dataset?.unverifiedSize) {\n  console.log(\"Size is self-reported and excluded from hours totals.\");\n}\n\nif (dataset?.hfRepo) {\n  for await (const row of loadDataset(dataset.hfRepo, { split: \"train\", limit: 10 })) {\n    console.log(row.transcript, row.durationS);\n  }\n}\n",
        "cli": "npm install -g ngano\n\nngano search \"{{LANGUAGE}}\" --task {{TASK}} --commercial --limit 10\nngano show {{DATASET_ID}}\nngano countries --language \"{{LANGUAGE}}\"\nngano languages --limit 20\nngano stats --json\nngano load --language \"{{LANGUAGE}}\" --country {{COUNTRY_ISO2}} --commercial \\\n  --split train --limit 500 --out rows.jsonl\n"
      }
    },
    "rust": {
      "language": "rust",
      "install": "cargo add ngano",
      "install_audio": null,
      "package": "ngano",
      "shell_snippets": [
        "cli"
      ],
      "snippets": {
        "catalogue_filter": "use ngano::{Catalogue, Filter};\n\n/// Datasets for {{LANGUAGE}}, read from the snapshot built into the crate.\n/// This function never touches the network.\npub fn ngano_catalogue() -> Result<(), ngano::NganoError> {\n    let cat = Catalogue::bundled()?;\n\n    let hits = cat.datasets(\n        &Filter::new()\n            .language(\"{{LANGUAGE}}\")\n            .task(\"{{TASK}}\")\n            .commercial(true),\n    );\n\n    for d in &hits {\n        println!(\"{} ({}, {})\", d.name, d.licence, d.access);\n    }\n\n    let stats = cat.stats_for(hits);\n    println!(\"{} datasets, {:.0} counted hours\", stats.datasets, stats.hours);\n    Ok(())\n}\n",
        "stream_filter": "use futures::TryStreamExt;\nuse ngano::{Filter, Loader};\n\n/// Stream {{LANGUAGE}} rows, one page at a time, and read the audio lazily.\npub async fn ngano_stream() -> Result<(), ngano::NganoError> {\n    let mut stream = Loader::new()\n        .filter(Filter::new().language(\"{{LANGUAGE}}\").commercial(true))\n        .split(\"train\")\n        .hf_token(std::env::var(\"HF_TOKEN\").ok())\n        .limit(Some(1000))\n        .stream()\n        .await?;\n\n    while let Some(row) = stream.try_next().await? {\n        println!(\"{:?}\", row.transcript.as_deref());\n\n        if let Some(audio) = &row.audio {\n            let bytes = audio.read().await?;\n            println!(\"{} bytes\", bytes.len());\n        }\n    }\n    Ok(())\n}\n",
        "single_dataset": "use futures::TryStreamExt;\nuse ngano::Loader;\n\n/// Stream the {{CONFIG}} config of {{HF_REPO}} directly, whether or not the\n/// catalogue lists that repo.\npub async fn ngano_repo() -> Result<(), ngano::NganoError> {\n    let mut stream = Loader::new()\n        .repo(\"{{HF_REPO}}\")\n        .config(\"{{CONFIG}}\")\n        .split(\"train\")\n        .hf_token(std::env::var(\"HF_TOKEN\").ok())\n        .limit(Some(100))\n        .stream()\n        .await?;\n\n    while let Some(row) = stream.try_next().await? {\n        println!(\n            \"{:?} {:?}\",\n            row.language.as_deref(),\n            row.transcript.as_deref()\n        );\n    }\n    Ok(())\n}\n",
        "language_page": "use futures::TryStreamExt;\nuse ngano::{Catalogue, Filter, Loader};\n\n/// What ngano holds for {{LANGUAGE}}: the catalogue first, then the rows.\npub async fn ngano_language() -> Result<(), ngano::NganoError> {\n    let cat = Catalogue::bundled()?;\n    let filter = Filter::new().language(\"{{LANGUAGE}}\");\n\n    let stats = cat.stats_for(cat.datasets(&filter));\n    println!(\n        \"{{LANGUAGE}}: {} datasets, {:.0} counted hours\",\n        stats.datasets, stats.hours\n    );\n\n    let mut stream = Loader::new()\n        .catalogue(cat)\n        .filter(filter)\n        .split(\"train\")\n        .limit(Some(500))\n        .stream()\n        .await?;\n\n    while let Some(row) = stream.try_next().await? {\n        println!(\"{:?}\", row.transcript.as_deref());\n    }\n    Ok(())\n}\n",
        "country_page": "use futures::TryStreamExt;\nuse ngano::{Catalogue, Filter, Loader};\n\n/// Speech data recorded in {{COUNTRY_NAME}}, selected by its ISO code.\npub async fn ngano_country() -> Result<(), ngano::NganoError> {\n    let cat = Catalogue::bundled()?;\n    let filter = Filter::new().country(\"{{COUNTRY_ISO2}}\").hf_only(true);\n\n    println!(\"{{COUNTRY_NAME}}\");\n    for d in cat.datasets(&filter) {\n        println!(\"  {} ({})\", d.name, d.languages_clean.join(\", \"));\n    }\n\n    let mut stream = Loader::new()\n        .catalogue(cat)\n        .filter(filter)\n        .limit(Some(200))\n        .stream()\n        .await?;\n\n    while let Some(row) = stream.try_next().await? {\n        println!(\"{:?}\", row.transcript.as_deref());\n    }\n    Ok(())\n}\n",
        "dataset_page": "use futures::TryStreamExt;\nuse ngano::{Catalogue, Loader};\n\n/// The catalogue record for {{DATASET_ID}}, then its rows.\npub async fn ngano_dataset() -> Result<(), ngano::NganoError> {\n    let cat = Catalogue::bundled()?;\n\n    let d = cat.require(\"{{DATASET_ID}}\")?;\n    println!(\"{} ({}, {})\", d.name, d.licence, d.access);\n    println!(\"{}\", d.notes);\n\n    let mut stream = Loader::new()\n        .catalogue(cat.clone())\n        .dataset(\"{{DATASET_ID}}\")\n        .split(\"train\")\n        .hf_token(std::env::var(\"HF_TOKEN\").ok())\n        .limit(Some(100))\n        .stream()\n        .await?;\n\n    while let Some(row) = stream.try_next().await? {\n        println!(\"{:?}\", row.transcript.as_deref());\n    }\n    Ok(())\n}\n",
        "cli": "cargo install ngano --features cli\n\nngano search --language {{LANGUAGE}} --task {{TASK}} --commercial\nngano show {{DATASET_ID}}\nngano stats --json\nngano load --language {{LANGUAGE}} --country {{COUNTRY_ISO2}} --split train --limit 500 --out rows.jsonl\nngano load --repo {{HF_REPO}} --config {{CONFIG}} --limit 100 --out rows.jsonl\n"
      }
    }
  }
} as unknown as SnippetSet;
