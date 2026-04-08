import os
import csv
import datetime
import pickle
import string
import re
import urllib.parse
import uvicorn

import nltk
from nltk.corpus import stopwords
from nltk.stem.porter import PorterStemmer
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- Download NLTK data on startup ---
nltk.download('punkt',      quiet=True)
nltk.download('punkt_tab',  quiet=True)
nltk.download('stopwords',  quiet=True)

# --- Initialize App ---
app = FastAPI(
    title="Spam Sentinel API",
    description="Real-time spam and phishing detection with Explainable AI",
    version="2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- NLP Pipeline (MUST match training notebook exactly) ---
ps = PorterStemmer()
STOP_WORDS = set(stopwords.words('english'))

def transform_text(text: str) -> str:
    text = text.lower()
    tokens = nltk.word_tokenize(text)
    tokens = [t for t in tokens if t.isalnum()]
    tokens = [t for t in tokens if t not in STOP_WORDS and t not in string.punctuation]
    tokens = [ps.stem(t) for t in tokens]
    return " ".join(tokens)

# --- Load ML Models ---
try:
    with open('vectorizer.pkl', 'rb') as f:
        vectorizer = pickle.load(f)
    with open('model.pkl', 'rb') as f:
        model = pickle.load(f)
    print("✅ Models loaded successfully.")
except Exception as e:
    print(f"❌ Error loading models: {e}")
    vectorizer = None
    model = None

# --- Data Models ---
class TextRequest(BaseModel):
    text: str

class FeedbackRequest(BaseModel):
    text: str
    predicted_label: str
    correct_label: str

class URLRequest(BaseModel):
    urls: list[str]

# ── HEALTH CHECK ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "model_loaded": model is not None,
        "vectorizer_loaded": vectorizer is not None,
        "timestamp": datetime.datetime.now().isoformat()
    }

# ── 1. PREDICT ────────────────────────────────────────────────────────────────
@app.post("/predict")
async def predict_spam(request: TextRequest):
    if model is None or vectorizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    input_text = request.text.strip()
    if not input_text:
        return {"is_spam": False, "confidence": 100.0,
                "prediction_label": "safe", "suspicious_words": [], "processed_text": ""}

    if len(input_text) > 10000:
        input_text = input_text[:10000]

    processed_text = transform_text(input_text)

    vectorized = vectorizer.transform([processed_text])
    prediction  = model.predict(vectorized)[0]
    is_spam     = bool(prediction == 1 or str(prediction).lower() == "spam")
    label       = "spam" if is_spam else "safe"

    # Confidence score
    confidence = 100.0
    if hasattr(model, "predict_proba"):
        probs      = model.predict_proba(vectorized)[0]
        confidence = float(round(max(probs) * 100, 2))

    # ── Explainable AI ──────────────────────────
    suspicious_words = []
    original_suspicious_words = []

    if is_spam and hasattr(model, "feature_log_prob_"):
        feature_names    = vectorizer.get_feature_names_out()
        non_zero_indices = vectorized.nonzero()[1]
        spam_log_prob    = model.feature_log_prob_[1]
        safe_log_prob    = model.feature_log_prob_[0]
        log_odds         = spam_log_prob - safe_log_prob

        word_scores = [(feature_names[i], log_odds[i]) for i in non_zero_indices]
        word_scores.sort(key=lambda x: x[1], reverse=True)

        suspicious_words = [w for w, s in word_scores if s > 0.5][:8]

        original_input_tokens = [t.lower() for t in nltk.word_tokenize(input_text) if t.isalnum()]
        stemmed_to_original   = {}
        for token in original_input_tokens:
            stemmed = ps.stem(token)
            if stemmed not in stemmed_to_original:
                stemmed_to_original[stemmed] = token

        original_suspicious_words = [
            stemmed_to_original.get(w, w) for w in suspicious_words
        ]

    # ── Logging ───────────────────────────────────────────────────────────────
    try:
        log_file   = 'scan_logs.csv'
        file_exists = os.path.isfile(log_file)
        with open(log_file, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(['timestamp', 'prediction', 'confidence', 'text_snippet'])
            snippet = input_text[:40].replace('\n', ' ') + "..."
            writer.writerow([datetime.datetime.now().isoformat(), label, confidence, snippet])
    except Exception as log_err:
        print(f"Log Error: {log_err}")

    return {
        "is_spam":                   is_spam,
        "confidence":                confidence,
        "prediction_label":          label,
        "suspicious_words":          suspicious_words,           
        "original_suspicious_words": original_suspicious_words,  
        "processed_text":            processed_text
    }

# ── 2. SCAN LINKS ─────────────────────────────────────────────────────────────
@app.post("/scan-links")
async def scan_links(request: URLRequest):
    SUSPICIOUS_TLDS  = ['.xyz', '.top', '.club', '.online', '.tk', '.ml', '.ga', '.cf']
    URL_SHORTENERS   = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'rb.gy', 'cutt.ly']
    SUSPICIOUS_WORDS = ['login', 'verify', 'account', 'update', 'secure', 'banking', 'confirm']

    dangerous_links = []
    for url in request.urls:
        try:
            parsed = urllib.parse.urlparse(url)
            domain = parsed.netloc.lower()
            path   = parsed.path.lower()
            flags  = []

            if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", domain):
                flags.append("IP address routing")
            if any(domain.endswith(t) for t in SUSPICIOUS_TLDS):
                flags.append("suspicious TLD")
            if any(s in domain for s in URL_SHORTENERS):
                flags.append("URL shortener")
            if any(w in path for w in SUSPICIOUS_WORDS):
                flags.append("suspicious path keywords")
            if url.count('http') > 1:
                flags.append("URL redirection")

            if flags:
                dangerous_links.append({"url": url, "reasons": flags})
        except Exception:
            continue

    return {
        "total_scanned":  len(request.urls),
        "dangerous_count": len(dangerous_links),
        "dangerous_links": dangerous_links,
        "is_safe":        len(dangerous_links) == 0
    }

# ── 3. FEEDBACK ───────────────────────────────────────────────────────────────
@app.post("/feedback")
async def submit_feedback(feedback: FeedbackRequest):
    try:
        file_name   = 'retraining_data.csv'
        file_exists = os.path.isfile(file_name)
        with open(file_name, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(['text', 'predicted_label', 'correct_label', 'timestamp'])
            writer.writerow([
                feedback.text, feedback.predicted_label,
                feedback.correct_label, datetime.datetime.now().isoformat()
            ])
        return {"message": "Feedback logged. Thank you for improving the model!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── 4. STATS ──────────────────────────────────────────────────────────────────
@app.get("/stats")
async def get_stats():
    stats = {
        "total_scans": 0, "spam_blocked": 0, "safe_messages": 0,
        "pending_corrections": 0, "spam_rate": 0.0,
        "recent_threats": [], "hourly_activity": []
    }

    if os.path.isfile('scan_logs.csv'):
        with open('scan_logs.csv', mode='r', encoding='utf-8') as f:
            logs = list(csv.DictReader(f))

        stats["total_scans"]   = len(logs)
        stats["spam_blocked"]  = sum(1 for r in logs if r['prediction'] == 'spam')
        stats["safe_messages"] = sum(1 for r in logs if r['prediction'] == 'safe')

        if stats["total_scans"] > 0:
            stats["spam_rate"] = round(stats["spam_blocked"] / stats["total_scans"] * 100, 1)

        spam_logs = [r for r in logs if r['prediction'] == 'spam']
        stats["recent_threats"] = list(reversed(spam_logs[-8:]))

        now    = datetime.datetime.now()
        hourly = {}
        for h in range(11, -1, -1):
            label = (now - datetime.timedelta(hours=h)).strftime("%H:00")
            hourly[label] = {"hour": label, "total": 0, "spam": 0}

        for row in logs:
            try:
                ts   = datetime.datetime.fromisoformat(row['timestamp'])
                key  = ts.strftime("%H:00")
                if key in hourly:
                    hourly[key]["total"] += 1
                    if row['prediction'] == 'spam':
                        hourly[key]["spam"] += 1
            except Exception:
                continue

        stats["hourly_activity"] = list(hourly.values())

    if os.path.isfile('retraining_data.csv'):
        with open('retraining_data.csv', mode='r', encoding='utf-8') as f:
            stats["pending_corrections"] = max(0, len(list(csv.reader(f))) - 1)

    return stats

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)