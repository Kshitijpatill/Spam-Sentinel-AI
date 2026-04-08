# 🛡️ Spam Sentinel AI – Real-Time Phishing & Spam Detection System

Spam Sentinel AI is a **full-stack Machine Learning system** designed to detect phishing, spam, and malicious content in real-time directly inside your browser.

It combines **NLP, Explainable AI (XAI), FastAPI, and a Chrome Extension** to provide a seamless, production-ready security solution.

---

## 🚀 Overview

* 🧠 Machine Learning-based spam detection (Naive Bayes + TF-IDF)
* ⚡ FastAPI backend for real-time predictions
* 🧩 Chrome Extension for live Gmail/web scanning
* 📊 Analytics dashboard with real-time threat monitoring
* 🔄 Active learning pipeline for continuous model improvement
* 🔍 Explainable AI highlighting *why* content is flagged

---

## 🎥 Demo

> *(Add your screenshots / GIFs here)*

```
![Extension Demo](demo.gif)
![Dashboard](dashboard.png)
![Gmail Detection](gmail.png)
```

---

## 📈 Model Performance

* **Accuracy:** ~97%
* **Precision (Spam):** ~98%
* **Recall:** ~94%
* **F1 Score:** ~96%

**Dataset:** SMS Spam Collection Dataset

---

## 🛠 Tech Stack

**Backend:**

* FastAPI
* Python

**Machine Learning:**

* Scikit-learn
* TF-IDF Vectorizer
* Multinomial Naive Bayes
* SMOTE (Imbalance handling)

**Frontend / UI:**

* HTML, CSS, JavaScript
* Chart.js

**Extension:**

* Chrome Extension APIs (Manifest V3)

---

## ✨ Core Features

### 🧠 Explainable AI (XAI)

* Highlights suspicious words like **“free”, “win”, “offer”**
* Uses model probabilities to explain predictions

### 🔗 Heuristic Link Scanner

* Detects phishing URLs
* Flags:

  * Suspicious TLDs (.xyz, .ru)
  * URL shorteners
  * IP-based links

### 🛡️ Real-Time Chrome Extension

* Works directly on Gmail & websites
* Injects UI safely using CSP bypass techniques
* Displays modern toast notifications

### 🔄 Active Learning System

* Users can report wrong predictions
* Data stored for retraining
* Improves model over time

### 📊 Analytics Dashboard

* Tracks:

  * Total scans
  * Spam blocked
  * Recent threats
* Real-time updates

---

## 📂 Project Structure

```
Spam-Sentinel-AI/
│
├── backend/
│   ├── main.py
│   ├── retrain.py
│   ├── requirements.txt
│   ├── index.html
│   ├── admin.html
│   ├── model.pkl
│   ├── vectorizer.pkl
│   └── training/
│
└── extension/
    ├── manifest.json
    ├── background.js
    ├── content.js
    ├── popup.html
    └── icon.png
```

---

## ⚙️ Installation & Setup

### 1️⃣ Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Server runs at:

```
http://localhost:8000
```

---

### 2️⃣ Chrome Extension Setup

1. Open `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load Unpacked**
4. Select the `extension/` folder
5. Pin the extension

---

## 📖 Usage

### 🖥 Web Interface

* Open `backend/index.html`
* Paste suspicious text
* Click **Analyze**

---

### 📩 Chrome Extension (Gmail)

* Open Gmail
* Highlight text OR scan full email
* Click extension icon
* Get instant spam detection

---

### ⚡ Quick Scan Popup

* Use popup to scan text instantly on any page

---

### 📊 Dashboard

* Open `backend/admin.html`
* View:

  * Threat trends
  * Scan logs
  * Real-time stats

---

## 🔌 API Endpoints

### POST `/predict`

```json
{
  "text": "You won a free lottery!"
}
```

### Response:

```json
{
  "is_spam": true,
  "confidence": 94.5,
  "prediction_label": "spam"
}
```

---

### GET `/stats`

* Returns analytics data

---

### POST `/feedback`

* Logs incorrect predictions for retraining

---

## 🔄 Model Retraining (MLOps)

```bash
cd backend
python retrain.py
```

✔ Merges user feedback
✔ Retrains model
✔ Updates `.pkl` files

---

## 💡 Problem Statement

Phishing and spam attacks are increasing rapidly across emails and web platforms.

This project provides a **real-time, AI-powered defense layer** directly inside the browser, helping users identify threats instantly.

---

## 🚀 Future Improvements

* 🌐 Deploy backend (Render / AWS)
* 🤖 Advanced NLP (transformers)
* 📱 Mobile support
* 🔐 URL reputation APIs integration

---

## 👨‍💻 Team

**Dadasaheb Dhakane**
**Varad Todkar**
**Kshitij Patil**
**Paras Sharma**
**Arpita Sarode**

---

