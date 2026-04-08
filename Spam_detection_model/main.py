import os
import csv
import datetime
import pickle
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- Initialize App & CORS ---
app = FastAPI(title="Spam Sentinel API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Data Models ---
class TextRequest(BaseModel):
    text: str

class FeedbackRequest(BaseModel):
    text: str
    predicted_label: str
    correct_label: str

# --- Load ML Models ---
try:
    with open('vectorizer.pkl', 'rb') as f:
        vectorizer = pickle.load(f)
    with open('model.pkl', 'rb') as f:
        model = pickle.load(f)
    print("✅ Models loaded successfully into memory.")
except Exception as e:
    print(f"❌ Error loading models: {e}")

# --- 1. PREDICTION ENDPOINT ---
# --- 1. PREDICTION ENDPOINT ---
@app.post("/predict")
async def predict_spam(request: TextRequest):
    try:
        input_text = request.text
        if not input_text or len(input_text.strip()) == 0:
            return {"is_spam": False, "confidence": 100.0, "prediction_label": "safe"}

        # ML Prediction
        vectorized_text = vectorizer.transform([input_text])
        prediction = model.predict(vectorized_text)[0]
        
        confidence = 100.0
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(vectorized_text)[0]
            # FIX 1: Wrap in float() to convert numpy.float64 to standard Python float
            confidence = float(round(max(probabilities) * 100, 2))

        # FIX 2: Wrap in bool() to convert numpy.bool_ to standard Python boolean
        is_spam = bool(str(prediction).lower() == "spam" or prediction == 1)
        label = "spam" if is_spam else "safe"

        # Threat Logging (For Dashboard)
        try:
            log_file = 'scan_logs.csv'
            file_exists = os.path.isfile(log_file)
            with open(log_file, mode='a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                if not file_exists:
                    writer.writerow(['timestamp', 'prediction', 'confidence', 'text_snippet'])
                
                snippet = input_text[:40].replace('\n', ' ') + "..."
                writer.writerow([datetime.datetime.now().isoformat(), label, confidence, snippet])
        except Exception as log_error:
            print(f"Log Error: {log_error}")

        return {
            "is_spam": is_spam,
            "confidence": confidence,
            "prediction_label": label
        }
    except Exception as e:
        print(f"Backend Error: {str(e)}") # Added a print statement to help debug future errors
        raise HTTPException(status_code=500, detail=str(e))
# --- 2. ACTIVE LEARNING ENDPOINT ---
@app.post("/feedback")
async def submit_feedback(feedback: FeedbackRequest):
    try:
        file_name = 'retraining_data.csv'
        file_exists = os.path.isfile(file_name)
        
        with open(file_name, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(['text', 'predicted_label', 'correct_label'])
            writer.writerow([feedback.text, feedback.predicted_label, feedback.correct_label])
            
        return {"message": "Feedback successfully logged!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 3. ANALYTICS ENDPOINT ---
@app.get("/stats")
async def get_stats():
    stats = {
        "total_scans": 0, "spam_blocked": 0, "safe_messages": 0,
        "pending_corrections": 0, "recent_threats": []
    }
    
    # Read Traffic Logs
    if os.path.isfile('scan_logs.csv'):
        with open('scan_logs.csv', mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            logs = list(reader)
            stats["total_scans"] = len(logs)
            for row in logs:
                if row['prediction'] == 'spam':
                    stats["spam_blocked"] += 1
                else:
                    stats["safe_messages"] += 1
            
            spam_logs = [row for row in logs if row['prediction'] == 'spam']
            stats["recent_threats"] = spam_logs[-6:]
            stats["recent_threats"].reverse() 

    # Read Active Learning Backlog
    if os.path.isfile('retraining_data.csv'):
        with open('retraining_data.csv', mode='r', encoding='utf-8') as f:
            reader = csv.reader(f)
            stats["pending_corrections"] = max(0, len(list(reader)) - 1)

    return stats

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)