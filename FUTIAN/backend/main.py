# Triggering deployment to fix Railway "Commit not found" error
import os
import json
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Set
import requests
import re
from datetime import datetime
from dotenv import load_dotenv
import math
import time
from collections import Counter

# Load environment variables
load_dotenv()

# --- CONFIGURATION ---
XAI_API_KEY = os.getenv("XAI_API_KEY")
XAI_API_URL = "https://api.x.ai/v1/chat/completions"
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

if not XAI_API_KEY:
    raise ValueError("XAI_API_KEY not found in environment variables. Please check your .env file.")

# Model - xAI's Grok model with reasoning capabilities
MODEL = "grok-4-1-fast-reasoning"

# --- PATHS ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "FUTIA-DATA")
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "front-end")

# --- APP SETUP ---
app = FastAPI(title="FUTIAN AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA LOADING ---
ALL_DATA_TEXT = ""
DATA_CHUNKS: List[Dict] = []
DATA_LAST_LOADED = None
IDF = {}
AVG_DOC_LEN = 1.0

# --- CACHING ---
RESPONSE_CACHE = {}  # { "query_hash": { "response": "text", "timestamp": float } }
CACHE_TTL = 3600  # 1 hour cache validity

def get_cache_key(user_message: str, history: List[Dict]) -> str:
    """Generate a simple cache key for the query + recent history"""
    import hashlib
    # Only use the last 2 history items to allow slightly different early histories to match
    history_str = json.dumps(history[-2:], sort_keys=True)
    combined = user_message.lower().strip() + "|" + history_str
    return hashlib.md5(combined.encode()).hexdigest()

def normalize_text_list(text: str) -> List[str]:
    """Convert text to a list of lowercase words for scoring, preserving frequency."""
    stop_words = {
        "the", "is", "at", "which", "on", "in", "a", "an", "and", "or", "of", "to", "for", 
        "with", "my", "i", "me", "what", "where", "how", "when", "who", "why", "show", 
        "tell", "give", "are", "you", "can", "do", "does", "did", "will", "would", "could",
        "should", "have", "has", "had", "be", "been", "being", "it", "that", "this", "these",
        "those", "there", "here", "please", "help", "about"
    }
    words = re.findall(r'\b[a-z0-9]+\b', text.lower())
    return [w for w in words if w not in stop_words and len(w) > 1]

def normalize_text(text: str) -> Set[str]:
    """Convert text to a set of lowercase words for searching."""
    return set(normalize_text_list(text))

def load_data():
    global ALL_DATA_TEXT, DATA_CHUNKS, DATA_LAST_LOADED, IDF, AVG_DOC_LEN
    print("[LOADING] Loading school data...")
    
    json_files = []
    for root, dirs, files in os.walk(DATA_DIR):
        for file in files:
            if file.endswith(".json"):
                json_files.append(os.path.join(root, file))
    
    loaded_texts = []
    DATA_CHUNKS = []
    doc_freqs = Counter()
    total_len = 0
    
    for file_path in json_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                text_content = json.dumps(data, indent=2)
                loaded_texts.append(text_content)
                
                word_list = normalize_text_list(text_content)
                word_freq = Counter(word_list)
                
                DATA_CHUNKS.append({
                    "source": os.path.basename(file_path),
                    "text": text_content,
                    "words": word_list,
                    "word_freq": word_freq,
                    "doc_len": len(word_list),
                    "keywords": set(word_list),
                    "size": len(text_content)
                })
                
                doc_freqs.update(word_freq.keys())
                total_len += len(word_list)
        except Exception as e:
            print(f"[ERROR] Error loading {file_path}: {e}")
            
    ALL_DATA_TEXT = "\n\n".join(loaded_texts)
    DATA_LAST_LOADED = datetime.now()
    
    N = len(DATA_CHUNKS)
    AVG_DOC_LEN = total_len / max(1, N)
    IDF = {}
    for word, df in doc_freqs.items():
        IDF[word] = math.log((N - df + 0.5) / (df + 0.5) + 1.0)
        
    print(f"[OK] Loaded {len(json_files)} data files at {DATA_LAST_LOADED.strftime('%H:%M:%S')}")
    print(f"[OK] Total data chunks: {len(DATA_CHUNKS)}")

def check_data_freshness():
    """Check if data should be reloaded (every 5 minutes)"""
    global DATA_LAST_LOADED
    if DATA_LAST_LOADED is None:
        return
    
    time_since_load = (datetime.now() - DATA_LAST_LOADED).total_seconds()
    if time_since_load > 3600:  # 1 hour
        print("[TIME] Data is older than 1 hour, reloading...")
        load_data()
        scan_building_images()
        extract_key_entities()

# Extract names and entities from data
KNOWN_NAMES = set()
KNOWN_BUILDINGS = set()
KNOWN_DEPARTMENTS = set()

# Building images dictionary (populated later by scan_building_images)
BUILDING_IMAGES = {}

def extract_key_entities():
    """Extract all names, buildings, and departments from data for typo correction"""
    global KNOWN_NAMES, KNOWN_BUILDINGS, KNOWN_DEPARTMENTS
    KNOWN_NAMES = set()
    KNOWN_BUILDINGS = set()
    KNOWN_DEPARTMENTS = set()
    
    # Common title patterns
    import re
    name_patterns = [
        r'Professor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
        r'Dr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
        r'Mr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
        r'Mrs\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
        r'Miss\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
    ]
    
    building_keywords = ["Block", "Office", "Hall", "Building", "ETEC", "SCIT", "SPAS", "Library"]
    
    for chunk in DATA_CHUNKS:
        text = chunk["text"]
        
        # Extract names
        for pattern in name_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                KNOWN_NAMES.add(match.lower())
                
        # Extract student names if it's a student data file
        if "student" in chunk["source"].lower() and text.strip().startswith("["):
            try:
                data_list = json.loads(text)
                if isinstance(data_list, list):
                    for item in data_list:
                        if isinstance(item, dict):
                            fn = str(item.get("First Name", ""))
                            ln = str(item.get("Last Name", ""))
                            if fn: KNOWN_NAMES.add(fn.lower())
                            if ln: KNOWN_NAMES.add(ln.lower())
                            if fn and ln: KNOWN_NAMES.add(f"{fn.lower()} {ln.lower()}")
            except Exception:
                pass
        
        # Extract buildings
        if "location" in chunk["source"].lower() or "direction" in chunk["source"].lower():
            lines = text.split('\n')
            for line in lines:
                for keyword in building_keywords:
                    if keyword in line:
                        # Simple extraction
                        words = line.split()
                        for i, word in enumerate(words):
                            if keyword in word and i > 0:
                                KNOWN_BUILDINGS.add(words[i-1].lower() + " " + keyword.lower())
        
        # Extract building names from BUILDING_IMAGES
        for building in BUILDING_IMAGES.keys():
            KNOWN_BUILDINGS.add(building.lower())
    
    print(f"[INFO] Extracted {len(KNOWN_NAMES)} known names, {len(KNOWN_BUILDINGS)} buildings")

def simple_fuzzy_match(query_word: str, known_items: set, threshold=0.6):
    """Simple fuzzy matching using character overlap"""
    query_word = query_word.lower().strip()
    if len(query_word) < 3:
        return []
    
    matches = []
    for item in known_items:
        # Calculate similarity (simple character overlap)
        item_lower = item.lower()
        
        # Check if they start with same letter
        if query_word[0] != item_lower[0]:
            continue
        
        # Count matching characters in order
        common_chars = 0
        j = 0
        for char in query_word:
            while j < len(item_lower) and item_lower[j] != char:
                j += 1
            if j < len(item_lower):
                common_chars += 1
                j += 1
        
        similarity = common_chars / max(len(query_word), len(item_lower))
        
        if similarity >= threshold:
            matches.append((item, similarity))
    
    # Return top 3 matches sorted by similarity
    matches.sort(key=lambda x: x[1], reverse=True)
    return [match[0] for match in matches[:3]]

load_data()
extract_key_entities()

# --- STATIC MOUNTS ---
location_data_path = os.path.join(DATA_DIR, "location-data", "LOCATION DATA")
if os.path.exists(location_data_path):
    app.mount("/location-images", StaticFiles(directory=location_data_path), name="location-images")

maps_path = os.path.join(DATA_DIR, "location-data")
if os.path.exists(maps_path):
    app.mount("/maps", StaticFiles(directory=maps_path), name="maps")

if os.path.exists(FRONTEND_DIR):
    app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend_app")

# --- BUILDING IMAGE SCANNER ---

# --- BUILDING ALIAS SYSTEM ---
# Maps common user terms/synonyms to actual image folder names.
# This ensures queries like "vc office", "registrar", "bursar" etc. all resolve correctly.
BUILDING_ALIASES = {
    # VC's Office and related offices inside it
    "vc office": "VC's Office",
    "vc's office": "VC's Office",
    "vcs office": "VC's Office",
    "vice chancellor": "VC's Office",
    "vice chancellor's office": "VC's Office",
    "vice chancellors office": "VC's Office",
    "vc": "VC's Office",
    "registrar": "VC's Office",
    "registrar office": "VC's Office",
    "registrar's office": "VC's Office",
    "registrars office": "VC's Office",
    "bursar": "VC's Office",
    "bursar office": "VC's Office",
    "bursar's office": "VC's Office",
    "bursars office": "VC's Office",
    "senate chamber": "VC's Office",
    "academic affairs": "VC's Office",
    "academic affairs office": "VC's Office",
    "admin building": "VC's Office",
    "administration": "VC's Office",
    "management office": "VC's Office",
    "admission": "VC's Office",
    "admissions": "VC's Office",
    "admission unit": "VC's Office",
    "admissions unit": "VC's Office",
    "admission office": "VC's Office",
    "admissions office": "VC's Office",
    
    # Academic Block
    "academic block": "Academic Block",
    "academic": "Academic Block",
    "student affairs": "Academic Block",
    "student affairs office": "Academic Block",
    "general studies": "Academic Block",
    "general studies office": "Academic Block",
    "bursary unit": "Academic Block",
    "bursary": "Academic Block",
    "health unit": "Academic Block",
    "health center": "Academic Block",
    "hospital": "Academic Block",
    "clinic": "Academic Block",
    "ict": "Academic Block",
    "e-library": "Academic Block",
    "e library": "Academic Block",
    
    # ETEC
    "etec": "ETEC",
    "engineering technology": "ETEC",
    "seet": "ETEC",
    "sest": "ETEC",
    "engineering": "ETEC",
    "civil engineering": "ETEC",
    "mechanical engineering": "ETEC",
    "electrical engineering": "ETEC",
    "aerospace engineering": "ETEC",
    "chemical engineering": "ETEC",
    "petroleum engineering": "ETEC",
    "architecture": "ETEC",
    "building technology": "ETEC",
    "naval architecture": "ETEC",
    "quantity surveying": "ETEC",
    "etec 1": "ETEC",
    "etec 2": "ETEC",
    "etec 3": "ETEC",
    "electrical/electronics engineering": "ETEC",
    "electrical and electronics engineering": "ETEC",
    "petroleum and gas engineering": "ETEC",
    
    # SCIT
    "scit": "SCIT",
    "computing": "SCIT",
    "information technology": "SCIT",
    "computer science": "SCIT",
    "cyber security": "SCIT",
    "software engineering": "SCIT",
    "scag": "SCIT",
    "agriculture": "SCIT",
    "food science": "SCIT",
    "smat": "SCIT",
    "accounting department": "SCIT",
    "business management": "SCIT",
    "library and information technology": "SCIT",
    "tourism and hospitality management": "SCIT",
    "tourism": "SCIT",
    "hospitality": "SCIT",
    "transportation management technology": "SCIT",
    "transportation": "SCIT",
    "scit 1": "SCIT",
    
    # SPAS
    "spas": "SPAS",
    "pure and applied sciences": "SPAS",
    "biochemistry": "SPAS",
    "microbiology": "SPAS",
    "physics department": "SPAS",
    "mathematics department": "SPAS",
    "statistics department": "SPAS",
    "mathematics/statistics": "SPAS",
    "spas 1": "SPAS",
    
    # Library
    "library": "Library",
    "main library": "Library",
    "librarian": "Library",
    "librarian office": "Library",
    
    # Auditorium
    "auditorium": "Auditorium",
    "lecture theater": "Auditorium",
    "lecture theatre": "Auditorium",
    "lecture hall": "Auditorium",
    "sport unit": "Auditorium",
    
    # Pavilion (folder name is "Pavilion")
    "pavilion": "Pavilion",
    "pavillon": "Pavilion",
    "pavillion": "Pavilion",
    "covered stand": "Pavilion",
    
    # School Field
    "school field": "School Field",
    "field": "School Field",
    "football field": "School Field",
    "sports field": "School Field",
    "playground": "School Field",
    
    # School Gate
    "school gate": "School Gate",
    "gate": "School Gate",
    "main gate": "School Gate",
    "entrance": "School Gate",
    "main entrance": "School Gate",
    
    # Security Office
    "security office": "Security Office",
    "security": "Security Office",
    "guards": "Security Office",
    "check point": "Security Office",
    "checkpoint": "Security Office",
    
    # Hostels
    "girl's hostel block a": "Girl's Hostel Block A",
    "girls hostel block a": "Girl's Hostel Block A",
    "girls hostel a": "Girl's Hostel Block A",
    "hostel block a": "Girl's Hostel Block A",
    "hostel a": "Girl's Hostel Block A",
    "girl's hostel block b": "Girl's Hostel Block B",
    "girls hostel block b": "Girl's Hostel Block B",
    "girls hostel b": "Girl's Hostel Block B",
    "hostel block b": "Girl's Hostel Block B",
    "hostel b": "Girl's Hostel Block B",
    "girls hostel": "Girl's Hostel Block A",
    "girl's hostel": "Girl's Hostel Block A",
    "hostel": "Girl's Hostel Block A",
    "female hostel": "Girl's Hostel Block A",
    "accommodation": "Girl's Hostel Block A",
    "dorm": "Girl's Hostel Block A",
    "dormitory": "Girl's Hostel Block A",
    
    # Workshop
    "workshop": "Workshop",
    "engineering workshop": "Workshop",
    
    # Store
    "store": "Store",
    "storage": "Store",
    
    # Toilet
    "toilet": "Toilet",
    "restroom": "Toilet",
    "bathroom": "Toilet",
    "convenience": "Toilet",
    "wc": "Toilet",
    
    # New Uncompleted Administrative Block
    "new admin block": "New Uncompleted Administrative Block",
    "new administrative block": "New Uncompleted Administrative Block",
    "uncompleted block": "New Uncompleted Administrative Block",
    "admin block": "New Uncompleted Administrative Block",
    "new building": "New Uncompleted Administrative Block",
    "construction": "New Uncompleted Administrative Block",
}

def resolve_building_name(query: str) -> Optional[str]:
    """
    Resolve a user query to an actual building image folder name.
    Uses multiple strategies: exact alias match, partial alias match,
    direct folder name match, and fuzzy matching.
    """
    q_lower = query.lower().strip()
    expanded_q = expand_query(query).lower().strip()
    
    # Strategy 1: Exact alias match (longest match first to prefer specific matches)
    sorted_aliases = sorted(BUILDING_ALIASES.keys(), key=len, reverse=True)
    for alias in sorted_aliases:
        if alias in q_lower or alias in expanded_q:
            resolved = BUILDING_ALIASES[alias]
            # Verify the folder actually exists in BUILDING_IMAGES
            if resolved in BUILDING_IMAGES:
                print(f"[RESOLVE] '{query}' -> '{resolved}' (via alias '{alias}')")
                return resolved
            # Try case-insensitive folder match
            for folder_name in BUILDING_IMAGES.keys():
                if folder_name.lower() == resolved.lower():
                    print(f"[RESOLVE] '{query}' -> '{folder_name}' (via alias '{alias}', case-insensitive)")
                    return folder_name
    
    # Strategy 2: Direct folder name match (case-insensitive, with/without special chars)
    for folder_name in BUILDING_IMAGES.keys():
        folder_lower = folder_name.lower()
        # Exact match
        if folder_lower in q_lower or folder_lower in expanded_q:
            print(f"[RESOLVE] '{query}' -> '{folder_name}' (direct match)")
            return folder_name
        # Match without apostrophes and special chars
        folder_clean = re.sub(r"[^a-z0-9 ]", "", folder_lower).strip()
        q_clean = re.sub(r"[^a-z0-9 ]", "", q_lower).strip()
        expanded_clean = re.sub(r"[^a-z0-9 ]", "", expanded_q).strip()
        if folder_clean and (folder_clean in q_clean or folder_clean in expanded_clean):
            print(f"[RESOLVE] '{query}' -> '{folder_name}' (cleaned match)")
            return folder_name
    
    # Strategy 3: Check location-and-venue.json for building context
    location_file = os.path.join(DATA_DIR, "main_school_data", "location-json", "location-and-venue.json")
    if os.path.exists(location_file):
        try:
            with open(location_file, 'r', encoding='utf-8') as f:
                loc_data = json.load(f)
            for loc in loc_data.get("school_map_locations", []):
                loc_name = loc.get("location_name", "").lower()
                full_name = loc.get("full_name", "").lower()
                # Check if query mentions units/offices inside this location
                for office in loc.get("units_and_offices", []):
                    if office.lower() in q_lower or office.lower() in expanded_q:
                        # Find matching image folder
                        for folder_name in BUILDING_IMAGES.keys():
                            if folder_name.lower() == loc_name or loc_name in folder_name.lower() or folder_name.lower() in loc_name:
                                print(f"[RESOLVE] '{query}' -> '{folder_name}' (via office '{office}' in location data)")
                                return folder_name
                # Check departments
                for dept_list in [loc.get("departments", [])]:
                    for dept in dept_list:
                        if dept.lower() in q_lower or dept.lower() in expanded_q:
                            for folder_name in BUILDING_IMAGES.keys():
                                if folder_name.lower() == loc_name or loc_name in folder_name.lower() or folder_name.lower() in loc_name:
                                    print(f"[RESOLVE] '{query}' -> '{folder_name}' (via department '{dept}')")
                                    return folder_name
                # Check schools_housed
                for school in loc.get("schools_housed", []):
                    school_name = school.get("school_name", "").lower()
                    if school_name in q_lower or school_name in expanded_q:
                        for folder_name in BUILDING_IMAGES.keys():
                            if folder_name.lower() == loc_name or loc_name in folder_name.lower() or folder_name.lower() in loc_name:
                                print(f"[RESOLVE] '{query}' -> '{folder_name}' (via school '{school_name}')")
                                return folder_name
                    for dept in school.get("departments", []):
                        if dept.lower() in q_lower or dept.lower() in expanded_q:
                            for folder_name in BUILDING_IMAGES.keys():
                                if folder_name.lower() == loc_name or loc_name in folder_name.lower() or folder_name.lower() in loc_name:
                                    print(f"[RESOLVE] '{query}' -> '{folder_name}' (via dept '{dept}' in school)")
                                    return folder_name
        except Exception as e:
            print(f"[RESOLVE] Error reading location data: {e}")
    
    # Strategy 4: Fuzzy matching on folder names
    folder_names_set = set(name.lower() for name in BUILDING_IMAGES.keys())
    for word in q_lower.split():
        fuzzy_results = simple_fuzzy_match(word, folder_names_set, threshold=0.6)
        if fuzzy_results:
            for result in fuzzy_results:
                for folder_name in BUILDING_IMAGES.keys():
                    if folder_name.lower() == result:
                        print(f"[RESOLVE] '{query}' -> '{folder_name}' (fuzzy match on '{word}')")
                        return folder_name
    
    print(f"[RESOLVE] '{query}' -> No match found")
    return None

def scan_building_images():
    """Scan all building folders and count available images."""
    global BUILDING_IMAGES
    BUILDING_IMAGES = {}
    
    if not os.path.exists(location_data_path):
        print("⚠️ Location data path not found.")
        return
    
    for building_name in os.listdir(location_data_path):
        building_path = os.path.join(location_data_path, building_name)
        if os.path.isdir(building_path):
            images = []
            for file in os.listdir(building_path):
                if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                    images.append(file)
            
            if images:
                images.sort()
                BUILDING_IMAGES[building_name] = images
                print(f"[PHOTO] {building_name}: {len(images)} photos")

scan_building_images()
print(f"[OK] Scanned {len(BUILDING_IMAGES)} buildings with photos")

# --- LOGIC ---

class ChatRequest(BaseModel):
    message: str
    history: List[dict]

def expand_query(query: str) -> str:
    """Expand abbreviations and common shorthand to full terms."""
    query_lower = query.lower()
    
    expansions = {
        r'\bvc\b': 'vice chancellor',
        r'\bvc\'?s\b': 'vice chancellor',
        r'\bhod\b': 'head of department',
        r'\bdr\b': 'doctor',
        r'\bprof\b': 'professor',
        r'\bdean\b': 'dean',
        r'\breg\b': 'registrar',
        r'\bvp\b': 'vice president',
        r'\bceo\b': 'chief executive officer',
        r'\blib\b': 'library',
        r'\blab\b': 'laboratory',
        r'\bcomp\s?sci\b': 'computer science',
        r'\bcsc\b': 'computer science',
        r'\bmech\s?eng\b': 'mechanical engineering',
        r'\bcivil\s?eng\b': 'civil engineering',
        r'\belec\s?eng\b': 'electrical engineering',
        r'\baero\s?eng\b': 'aerospace engineering',
        r'\bchem\s?eng\b': 'chemical engineering',
        r'\bpetro\s?eng\b': 'petroleum engineering',
        r'\bqty\s?surv\b': 'quantity surveying',
        r'\barch\b': 'architecture',
        r'\bbldg\b': 'building',
        r'\badmin\b': 'administrative',
    }
    
    expanded = query_lower
    for abbr, full in expansions.items():
        expanded = re.sub(abbr, full, expanded)
    
    return expanded

def classify_query(query: str) -> str:
    expanded_query = expand_query(query)
    
    triggers = [
        "futia", "school", "university", "campus", "class", "lecture", "student", 
        "hostel", "library", "etec", "scit", "spas", "smat", "seet", "sest", "scag", 
        "timetable", "venue", "map", "location", "office", "vc", 
        "registrar", "bursar", "department", "course", "exam", "semester", 
        "academic", "anthem", "motto", "vision", "mission", "policy", "rule", 
        "regulation", "handbook", "fee", "portal", "wifi", "internet", "lab",
        "workshop", "auditorium", "pavilion", "field", "sport", "clinic", "health",
        "monday", "tuesday", "wednesday", "thursday", "friday", 
        "chancellor", "leo", "daniel", "principal", "officers", "management"
    ]
    
    for t in triggers:
        if t in expanded_query:
            return "CAMPUS"
            
    # Check for known entities (stricter check)
    query_lower = expanded_query.lower()
    
    for name in KNOWN_NAMES:
        if name in query_lower:
            return "CAMPUS"
            
    for building in KNOWN_BUILDINGS:
        if building in query_lower:
            return "CAMPUS"
            
    for dept in KNOWN_DEPARTMENTS:
        if dept in query_lower:
            return "CAMPUS"
            
    return "GENERAL"

def bm25_score(query_words: List[str], chunk: Dict) -> float:
    k1 = 1.5
    b = 0.75
    score = 0.0
    doc_len = chunk["doc_len"]
    word_freq = chunk["word_freq"]
    
    for word in query_words:
        if word in word_freq:
            tf = word_freq[word]
            idf = IDF.get(word, 0)
            # BM25 formula
            score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * doc_len / max(1, AVG_DOC_LEN)))
    return score

def get_smart_context(query: str, max_chars=400000) -> str:
    """
    Intelligently selects data chunks based on relevance score using BM25.
    Increased context size to ensure ALL relevant data is included.
    """
    expanded_query = expand_query(query)
    query_words_list = normalize_text_list(expanded_query)
    
    context = ""
    used_sources = set()
    
    days_of_week = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    lecture_keywords = ["lecture", "timetable", "class", "venue", "schedule", "time"]
    
    is_timetable_query = any(day in expanded_query for day in days_of_week) or \
                         any(keyword in expanded_query for keyword in lecture_keywords)
    
    if is_timetable_query:
        for chunk in DATA_CHUNKS:
            if "timetable" in chunk["source"].lower() or "lecture" in chunk["source"].lower():
                if len(context) + chunk["size"] < max_chars:
                    context += f"--- Source: {chunk['source']} (PRIORITY: Timetable Data) ---\n{chunk['text']}\n\n"
                    used_sources.add(chunk["source"])
                    print(f"[OK] Force-included timetable data: {chunk['source']}")
    
    is_management_query = any(word in expanded_query for word in 
                             ["vice", "chancellor", "registrar", "bursar", "management", "officer", "dean", "head", "hod"])
    
    if is_management_query:
        for chunk in DATA_CHUNKS:
            if any(key in chunk["source"].lower() for key in ["management", "university", "foreword", "officer"]):
                if chunk["source"] not in used_sources and len(context) + chunk["size"] < max_chars:
                    context += f"--- Source: {chunk['source']} (PRIORITY: Management Data) ---\n{chunk['text']}\n\n"
                    used_sources.add(chunk["source"])
    
    is_location_query = any(word in expanded_query for word in 
                           ["where", "location", "direction", "map", "show me", "find"])
    
    if is_location_query:
        for chunk in DATA_CHUNKS:
            if "location" in chunk["source"].lower() or "direction" in chunk["source"].lower():
                if chunk["source"] not in used_sources and len(context) + chunk["size"] < max_chars:
                    context += f"--- Source: {chunk['source']} (PRIORITY: Location Data) ---\n{chunk['text']}\n\n"
                    used_sources.add(chunk["source"])

    # Smart Priority: Handbook & Policies
    is_policy_query = any(word in expanded_query for word in 
                         ["rule", "regulation", "policy", "law", "banned", "allowed", "offence", "punishment", "dress", "code", "handbook", "student", "welfare", "drug"])

    if is_policy_query:
        for chunk in DATA_CHUNKS:
            if any(key in chunk["source"].lower() for key in ["chapter", "policy", "regulation", "handbook", "welfare"]):
                 if chunk["source"] not in used_sources and len(context) + chunk["size"] < max_chars:
                    context += f"--- Source: {chunk['source']} (PRIORITY: Policy/Handbook) ---\n{chunk['text']}\n\n"
                    used_sources.add(chunk["source"])

    # Smart Priority: About/Creators
    is_creator_query = any(word in expanded_query for word in ["who made you", "creator", "developer", "created", "built", "designed", "team", "about"])
    
    if is_creator_query:
        for chunk in DATA_CHUNKS:
             if any(key in chunk["source"].lower() for key in ["creator", "about", "team"]):
                 if chunk["source"] not in used_sources and len(context) + chunk["size"] < max_chars:
                    context += f"--- Source: {chunk['source']} (PRIORITY: Creator Info) ---\n{chunk['text']}\n\n"
                    used_sources.add(chunk["source"])

    # Smart Priority: Student Data - Force include ALL student data for any student query
    student_keywords = ["student", "students", "list", "name", "who", "reg", "registration",
                        "civil", "mechanical", "electrical", "aerospace", "software", "computer",
                        "cyber", "biochemistry", "microbiology", "library", "petroleum",
                        "department", "level", "male", "female", "gender", "enrolled"]
    is_student_query = any(word in expanded_query for word in student_keywords)
    
    # Also check if query mentions any known student name
    query_lower = expanded_query.lower()
    mentions_known_name = any(name in query_lower for name in KNOWN_NAMES if len(name) >= 3)
    
    if is_student_query or mentions_known_name:
        for chunk in DATA_CHUNKS:
            if "student" in chunk["source"].lower():
                if chunk["source"] not in used_sources:
                    context += f"--- Source: {chunk['source']} (PRIORITY: Student Data - COMPLETE LIST) ---\n{chunk['text']}\n\n"
                    used_sources.add(chunk["source"])
                    print(f"[OK] Force-included COMPLETE student data: {chunk['source']}")
    
    if not query_words_list:
        sorted_chunks = sorted(DATA_CHUNKS, key=lambda x: x["source"])
        for chunk in sorted_chunks:
            if chunk["source"] not in used_sources and len(context) + chunk["size"] < max_chars:
                context += chunk["text"] + "\n\n"
                used_sources.add(chunk["source"])
        return context
    
    scored_chunks = []
    for chunk in DATA_CHUNKS:
        if chunk["source"] in used_sources:
            continue
        score = bm25_score(query_words_list, chunk)
        if score > 0:
            scored_chunks.append((score, chunk))
    
    # Sort by BM25 score descending
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    
    for score, chunk in scored_chunks:
        if len(context) + chunk["size"] < max_chars:
            context += f"--- Source: {chunk['source']} ---\n{chunk['text']}\n\n"
            used_sources.add(chunk["source"])
    
    remaining_chunks = [c for c in DATA_CHUNKS if c["source"] not in used_sources]
    remaining_chunks.sort(key=lambda x: x["size"])
    
    for chunk in remaining_chunks:
        if len(context) + chunk["size"] < max_chars:
            context += f"--- Source: {chunk['source']} ---\n{chunk['text']}\n\n"
            used_sources.add(chunk["source"])
    
    if not context:
        return "No specific data found."
    
    print(f"[DATA] Sending {len(used_sources)}/{len(DATA_CHUNKS)} data files to AI ({len(context):,} chars)")
    return context

# --- HELPER FUNCTIONS ---

def clean_response(response: str) -> str:
    """Remove internal source references, metadata, and system instructions from AI responses."""
    if not response:
        return response
    
    cleaned = response
    
    # Remove (Sources: ...) patterns - catches single and multi-source citations
    cleaned = re.sub(r'\(Sources?:\s*[^)]*\)', '', cleaned)
    
    # Remove (Source: ...) patterns
    cleaned = re.sub(r'\(Source:\s*[^)]*\)', '', cleaned)
    
    # Remove *(Source: ...)* patterns (italic markdown)
    cleaned = re.sub(r'\*\(Sources?:\s*[^)]*\)\*', '', cleaned)
    
    # Remove **Source:** or **Sources:** patterns
    cleaned = re.sub(r'\*\*Sources?:\*\*\s*[^\n]*', '', cleaned)
    
    # Remove --- Source: ... --- markers that might leak through
    cleaned = re.sub(r'---\s*Source:\s*[^-]*---', '', cleaned)
    
    # Remove STRICT DATA MODE references
    cleaned = re.sub(r'STRICT DATA MODE[^\n]*', '', cleaned)
    
    # Remove NO_DATA_FOUND / MISSING_INFO markers
    cleaned = re.sub(r'NO_DATA_FOUND', '', cleaned)
    cleaned = re.sub(r'MISSING_INFO', '', cleaned)
    
    # Remove references to .json file names
    cleaned = re.sub(r'[\w-]+\.json', '', cleaned)
    
    # Remove internal instruction leaks
    cleaned = re.sub(r'\(PRIORITY:\s*[^)]*\)', '', cleaned)
    cleaned = re.sub(r'FALLBACK MODE[^\n]*', '', cleaned)
    
    # Remove "No images for this location" type messages
    cleaned = re.sub(r'[\-\–]*\s*No images? for this location[^\n]*', '', cleaned)
    
    # Remove "I don't have images" type phrases but keep the rest of the sentence
    cleaned = re.sub(r'[Uu]nfortunately,?\s*I\s*don\'?t\s*have\s*(an?|any)?\s*images?\s*(of|for)\s*this\s*(location|building|place)[^.]*\.?', '', cleaned)
    
    # Clean up multiple consecutive blank lines
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    
    # Clean up lines that are just whitespace or punctuation after removal
    cleaned = re.sub(r'\n\s*[;,]\s*\n', '\n', cleaned)
    
    # Remove trailing/leading whitespace
    cleaned = cleaned.strip()
    
    return cleaned

def perform_web_search(query: str) -> str:
    """Search futia.edu.ng using DuckDuckGo HTML (no API key required)"""
    print(f"[WEB] Searching online for: {query}")
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        # Search specifically on the school website
        search_term = f"site:futia.edu.ng {query}"
        url = "https://html.duckduckgo.com/html/"
        data = {'q': search_term}
        
        response = requests.post(url, data=data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            # Simple regex to extract snippets
            snippets = re.findall(r'<a class="result__snippet"[^>]*>(.*?)</a>', response.text, re.DOTALL)
            
            cleaned_snippets = []
            for snippet in snippets[:5]:
                text = re.sub(r'<[^>]+>', '', snippet).strip()
                cleaned_snippets.append(text)
            
            if cleaned_snippets:
                return "\n\n".join(cleaned_snippets)
    except Exception as e:
        print(f"[WEB] Search failed: {e}")
    
    return ""

def query_ai_model(messages: List[Dict], temperature: float, max_tokens: int, tools: Optional[List[Dict]] = None) -> Optional[Dict]:
    """Helper to call the AI model chain - Strictly xAI Grok"""
    
    # Strictly use xAI
    api_key = XAI_API_KEY
    api_url = XAI_API_URL
    model_id = MODEL
    
    if not api_key:
        print("[ERROR] XAI_API_KEY not found. Please check your .env file.")
        return None

    max_retries = 3
    base_delay = 1.0

    for attempt in range(max_retries):
        try:
            print(f"[MODEL] Trying model: {model_id} (Attempt {attempt+1}/{max_retries})...")
            payload = {
                "model": model_id,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            
            if tools:
                payload["tools"] = tools
                payload["tool_choice"] = "auto"

            headers = {
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "FUTIAN AI",
                "Content-Type": "application/json"
            }
            
            # Using a slightly longer timeout for robust interactions
            response = requests.post(api_url, json=payload, headers=headers, timeout=60)
            
            if response.status_code == 200:
                result = response.json()
                if 'choices' in result and len(result['choices']) > 0:
                    # Return the full message object to preserve tool_calls
                    return result['choices'][0]['message']
            elif response.status_code == 429: # Rate Limit
                print(f"[ERROR] Rate limit hit ({response.status_code}) from {model_id}.")
            elif response.status_code >= 500: # Server Error
                print(f"[ERROR] Server error ({response.status_code}) from {model_id}.")
            else:
                # Client Error, unlikely to be fixed with a retry
                print(f"[ERROR] Client error {response.status_code} from {model_id}: {response.text}")
                return None
                
        except requests.exceptions.Timeout:
             print(f"[ERROR] Timeout connecting to {model_id}.")
        except Exception as e:
            print(f"[ERROR] Exception with {model_id}: {e}")
            
        # If we reach here, it failed and we need to retry
        if attempt < max_retries - 1:
            delay = base_delay * (2 ** attempt) # Exponential backoff: 1s, 2s, 4s
            print(f"[RETRY] Waiting {delay}s before retrying...")
            time.sleep(delay)
            
    print(f"[ERROR] All {max_retries} attempts to contact {model_id} failed.")
    return None

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    check_data_freshness()
    
    user_message = request.message
    history = request.history
    
    # 0. Check Cache First
    cache_key = get_cache_key(user_message, history)
    cached_data = RESPONSE_CACHE.get(cache_key)
    if cached_data and (time.time() - cached_data["timestamp"]) < CACHE_TTL:
        print("[CACHE] Returning instant cached response!")
        return {"response": cached_data["response"]}
        
    expanded_message = expand_query(user_message)
    # query_type is no longer used for logic gating
    
    now = datetime.now()
    current_time_str = f"Today is {now.strftime('%A, %B %d, %Y at %I:%M %p')}"
    
    # --- PROMPT PREPARATION ---
    
    base_system = f"You are FUTIAN, the AI assistant for Federal University of Technology, Ikot Abasi (FUTIA). {current_time_str}. Use this exact date to correctly determine if school calendar events, tests, or deadlines are in the past, present week, or future relative to today."
    
    # 1. Typo Detection
    typo_text = ""
    query_words = user_message.lower().split()
    typo_suggestions = []
    for word in query_words:
        if len(word) > 3:
            name_matches = simple_fuzzy_match(word, KNOWN_NAMES, threshold=0.7)
            if name_matches:
                typo_suggestions.extend([f"Did you mean '{match.title()}'?" for match in name_matches])
            building_matches = simple_fuzzy_match(word, KNOWN_BUILDINGS, threshold=0.7)
            if building_matches:
                typo_suggestions.extend([f"Did you mean '{match.title()}'?" for match in building_matches])
    
    if typo_suggestions:
        unique_suggestions = list(set(typo_suggestions))[:2]
        typo_text = f"\n**POTENTIAL TYPO**: Possible corrections: {', '.join(unique_suggestions)}."

    # 2. Ambiguity Detection
    ambiguity_text = ""
    ambiguous_terms = {
        "office": ["VC's Office", "Security Office", "Registrar's Office", "Bursar's Office"],
        "block": ["Academic Block", "ETEC", "SCIT", "SPAS"],
        "hall": ["Auditorium", "Pavilion"],
    }
    
    # Do not trigger ambiguity if user is just asking for examples
    if "example" not in user_message.lower():
        for term, options in ambiguous_terms.items():
            if term in user_message.lower() and not any(opt.lower() in user_message.lower() for opt in options):
                ambiguity_text = f"\n**AMBIGUITY**: User asked about '{term}'. Mention options: {', '.join(options)}."
                break

    # 3. Direction & Image Logic
    direction_instruction = ""
    direction_keywords = ["where", "where is", "location", "direction", "directions", "find", "show me", "get to", "how do i get", "how to reach", "how to find", "picture", "photo", "image", "look like", "looks like", "what does", "show", "see"]
    map_only_keywords = ["campus map", "school map", "show me the map", "give me the map", "map of the school", "map of campus"]
    
    # Don't trigger direction search if user is just asking for examples
    is_direction_query = any(keyword in user_message.lower() for keyword in direction_keywords) and "example" not in user_message.lower()
    is_map_only = any(keyword in user_message.lower() for keyword in map_only_keywords) and "example" not in user_message.lower()
    
    if is_map_only:
        direction_instruction = f"\n**MAP REQUEST**: Show the map: ![Campus Map]({BASE_URL}/maps/school-mini-map.jpg)"
    elif is_direction_query:
        # Use the smart resolver instead of rigid exact matching
        building_query_match = resolve_building_name(user_message)

        if building_query_match:
            imgs = BUILDING_IMAGES.get(building_query_match, [])
            img_md = ""
            for img in imgs:
                from urllib.parse import quote
                img_md += f"![{building_query_match}]({BASE_URL}/location-images/{quote(building_query_match)}/{quote(img)}) "
            if img_md: img_md = "\n\n" + img_md

            direction_instruction = (
                f"\n**DIRECTION TASK**: User wants directions or images for '{building_query_match}'.\n"
                "Follow this EXACT structure without fail:\n"
                "1. **Description**: Describe the building and location.\n"
                "2. **Images**: Output exactly this raw markdown to display the images (I HAVE PROVIDED THEM HERE, DO NOT SAY YOU DO NOT HAVE THEM): " + img_md + "\n"
                "3. **Directions**: Provide step-by-step directions from the gate. DO NOT tell the distance. DO NOT tell how long (time) it takes. DO NOT use map directions like North, South. Use natural language.\n"
                f"4. **Map**: Show map: ![Campus Mini Map]({BASE_URL}/maps/school-mini-map.jpg)\n"
                "5. **Follow-up**: Ask a relevant question based purely on LOCAL DATA.\n"
            )
        else:
            # Build a list of available buildings for the AI to suggest
            available_buildings = ', '.join(sorted(BUILDING_IMAGES.keys()))
            direction_instruction = f"\n**DIRECTION**: specific location unclear or not found. Tell the user you don't have images for that specific query, but explicitly list the buildings you DO have photos for: {available_buildings}. Ask them to state which one they'd like to see."
    else:
        # If they didn't explicitly ask for an image, check if they mentioned a building we have images of
        building_query_match = resolve_building_name(user_message)
        if building_query_match and BUILDING_IMAGES.get(building_query_match):
            direction_instruction = f"\n**PROACTIVE NOTIFICATION**: We have HD photos of '{building_query_match}'. In your response, feel free to proactively ask the user: 'Would you like me to show you a picture of it?'."

    # --- PIPELINE START ---
    user_content_payload = user_message
    if direction_instruction and "DIRECTION TASK" in direction_instruction:
        try:
            import base64
            map_path = os.path.join(DATA_DIR, "location-data", "school-mini-map.jpg")
            if os.path.exists(map_path):
                with open(map_path, "rb") as map_file:
                    map_b64 = base64.b64encode(map_file.read()).decode('utf-8')
                user_content_payload = [
                    {"type": "text", "text": user_message},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{map_b64}"}}
                ]
        except Exception as e:
            print(f"Vision load error: {e}")

    print("[FLOW] Starting Smart Agent Pipeline...")
    local_context = get_smart_context(user_message)
    
    # Setup Tools
    tools = [
        {
            "type": "function",
            "function": {
                "name": "perform_web_search",
                "description": "Searches the official Federal University of Technology Ikot Abasi (FUTIA) website (futia.edu.ng) for recent news, admissions, or information NOT found in the local data.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query to look up on the website."
                        }
                    },
                    "required": ["query"]
                }
            }
        }
    ]

    # Detect student-related queries for special handling
    student_list_keywords = ["list", "all", "students", "student", "how many", "who", "name"]
    is_student_list_query = sum(1 for kw in student_list_keywords if kw in expanded_message) >= 2
    mentions_known_student = any(name in expanded_message.lower() for name in KNOWN_NAMES if len(name) >= 3)
    
    student_instruction = ""
    if is_student_list_query:
        student_instruction = (
            "\n**CRITICAL STUDENT DATA RULE**: When listing students (e.g., 'list all civil engineering students'), "
            "you MUST list EVERY SINGLE student from the data without exception. Do NOT skip, truncate, "
            "or summarize the list. List ALL of them with their full names and registration numbers. "
            "The user expects the COMPLETE list. If there are 42 students, list all 42.\n"
        )
    elif mentions_known_student:
        student_instruction = (
            "\n**STUDENT LOOKUP RULE**: The student data provided contains the COMPLETE list of FUTIA pioneer students (2023-2024 set). "
            "When asked if someone is a student, carefully search through ALL the student records in the data. "
            "Match by first name, last name, or both. If you find a match, confirm they ARE a student and provide their details "
            "(full name, registration number, department, gender, state). NEVER say you can't confirm if a student exists "
            "when their name is in the data.\n"
        )

    agent_system_prompt = (
        f"{base_system}\n"
        f"{typo_text}\n{ambiguity_text}\n{direction_instruction}\n{student_instruction}\n"
        "**YOUR INSTRUCTIONS**:\n"
        "1. Answer the user's query using the LOCAL SCHOOL DATA below if possible.\n"
        "2. If the answer is NOT in the local data, you MUST use the `perform_web_search` tool to search the internet (specifically the school's website).\n"
        "3. If you STILL cannot find the answer after searching the web, clearly state that the information isn't available right now. Then, you may proactively ask the user a relevant question to keep the conversation engaging, BUT this question MUST be strictly based on the provided LOCAL SCHOOL DATA. Do NOT invent, assume, or make up facts (e.g., about new buildings or lectures) that are not explicitly in your local data.\n"
        "4. NEVER mention source file names, JSON files, data origins, or internal modes. Answer naturally as FUTIAN.\n"
    )

    if local_context and "No specific data found" not in local_context:
        agent_system_prompt += f"\n--- LOCAL SCHOOL DATA ---\n{local_context}\n-------------------------\n"

    messages = [{"role": "system", "content": agent_system_prompt}]
    for msg in history[-6:]:
        role = "assistant" if msg["role"] == "bot" else msg["role"]
        messages.append({"role": role, "content": msg["text"]})
    messages.append({"role": "user", "content": user_content_payload})

    # Initial Agent Call
    # Use higher token limit for student listing queries to ensure complete lists
    response_max_tokens = 4096 if (is_student_list_query or mentions_known_student) else 1500
    ai_message = query_ai_model(messages, temperature=0.2, max_tokens=response_max_tokens, tools=tools)

    if not ai_message:
        return {"response": "I'm having trouble connecting to my brain right now."}

    # Handle Tool Call
    if ai_message.get("tool_calls"):
        print("[FLOW] AI decided to use the web search tool!")
        messages.append(ai_message)  # Add the assistant's tool call message
        
        for tool_call in ai_message["tool_calls"]:
            if tool_call["function"]["name"] == "perform_web_search":
                try:
                    import json
                    args = json.loads(tool_call["function"]["arguments"])
                    search_query = args.get("query", user_message)
                except Exception:
                    search_query = user_message
                
                print(f"[TOOL START] Executing perform_web_search for: {search_query}")
                web_result = perform_web_search(search_query)
                
                if not web_result:
                    web_result = "No web search results found for this query on futia.edu.ng. Acknowledge the information is missing. If you ask a follow-up question, ensure it is STRICTLY based on the LOCAL SCHOOL DATA. Do not hallucinate."
                    print("[TOOL END] No results found.")
                else:
                    print(f"[TOOL END] Found results ({len(web_result)} chars).")
                
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "name": "perform_web_search",
                    "content": web_result
                })
        
        print("[FLOW] Sending web results back to AI generation...")
        final_message = query_ai_model(messages, temperature=0.3, max_tokens=1500)
        if final_message and final_message.get("content"):
            final_resp = clean_response(final_message["content"])
            RESPONSE_CACHE[cache_key] = {"response": final_resp, "timestamp": time.time()}
            return {"response": final_resp}

    if ai_message.get("content"):
        final_resp = clean_response(ai_message["content"])
        RESPONSE_CACHE[cache_key] = {"response": final_resp, "timestamp": time.time()}
        return {"response": final_resp}

    return {"response": "I generated a response but it was empty."}

@app.get("/generate-questions")
async def generate_questions():
    return {
        "questions": [
            "Where is the Library?",
            "Show me the Academic Block",
            "What is the school anthem?",
            "Who is the Vice Chancellor?",
            "How do I get to ETEC?",
            "What courses are in the timetable for Monday?",
            "Tell me about the history of FUTIA",
            "Where is the School Gate?",
            "What is the motto of FUTIA?",
            "Show me the campus map"
        ]
    }

@app.get("/")
async def root():
    return {"status": "FUTIAN AI Backend is Running", "docs": "/docs"}

if __name__ == "__main__":
    print(f"[START] Starting FUTIAN AI Backend on {HOST}:{PORT}")
    print(f"[URL] Base URL: {BASE_URL}")
    uvicorn.run(app, host=HOST, port=PORT)
