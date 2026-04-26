import os
from pathlib import Path
from dotenv import load_dotenv
import json

# Carica .env se esiste (sviluppo locale)
load_dotenv(Path(__file__).parent / '.env')

TELEGRAM_TOKEN = os.environ['TELEGRAM_TOKEN']
CHAT_ID = int(os.environ['CHAT_ID'])
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']  # service role key
ANTHROPIC_API_KEY = os.environ['ANTHROPIC_API_KEY']

# Piano corrente ricavato dal manifest
_manifest_path = Path(__file__).parent.parent / 'data' / 'plans.json'
_manifest = json.loads(_manifest_path.read_text(encoding='utf-8'))
_current = next(p for p in _manifest if p['current'])

PLAN_JSON_PATH = Path(__file__).parent.parent / 'data' / _current['file']
PLAN_GARA = _current['gara']

PAGE_URL = 'https://fabiogomiero.github.io/ai-weekly-workout/'
