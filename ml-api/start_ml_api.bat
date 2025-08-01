@echo off
cd /d "C:\Users\Shivang Devina\civic-hazard-app\ml-api"
python -m uvicorn app:app --host 0.0.0.0 --port 8000
