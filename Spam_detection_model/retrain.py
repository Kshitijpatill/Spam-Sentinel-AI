import os
import pandas as pd
import pickle
import string
import nltk
from nltk.corpus import stopwords
from nltk.stem.porter import PorterStemmer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB

print("--- INITIATING MLOPS RETRAINING PIPELINE ---")

ps = PorterStemmer()
nltk.download('punkt', quiet=True)
nltk.download('stopwords', quiet=True)
STOP_WORDS = set(stopwords.words('english'))

def transform_text(text: str) -> str:
    text = text.lower()
    tokens = nltk.word_tokenize(text)
    tokens = [t for t in tokens if t.isalnum()]
    tokens = [t for t in tokens if t not in STOP_WORDS and t not in string.punctuation]
    tokens = [ps.stem(t) for t in tokens]
    return " ".join(tokens)

# 1. Load original Base Truth data
print("1. Loading base dataset...")
df = pd.read_csv('training/spam.csv', encoding="latin1") # Assumes your original csv is in a 'training' folder
df = df.rename(columns={"v1": "Target", "v2": "Text"})[['Target', 'Text']]
df['Target'] = df['Target'].map({'ham': 0, 'spam': 1})

# 2. Merge Active Learning Feedback
if os.path.exists('retraining_data.csv'):
    print("2. Merging user corrections (retraining_data.csv)...")
    new_df = pd.read_csv('retraining_data.csv')
    new_df['Target'] = new_df['correct_label'].map({'safe': 0, 'spam': 1})
    new_df = new_df.rename(columns={'text': 'Text'})[['Target', 'Text']]
    df = pd.concat([df, new_df], ignore_index=True)
else:
    print("2. No new user corrections found. Training on base dataset only.")
    
# 3. Process & Train
print("3. Processing text (this may take a moment)...")
df['transformed_text'] = df['Text'].apply(transform_text)

print("4. Training new TF-IDF Vectorizer and Naive Bayes Model...")
tfidf = TfidfVectorizer(max_features=3000)
X = tfidf.fit_transform(df['transformed_text']).toarray()
y = df['Target'].values

model = MultinomialNB()
model.fit(X, y)

# 4. Save new weights
pickle.dump(tfidf, open('vectorizer.pkl', 'wb'))
pickle.dump(model, open('model.pkl', 'wb'))

print("✅ SUCCESS! model.pkl and vectorizer.pkl have been updated.")
print("Restart your FastAPI server to load the new ML weights.")