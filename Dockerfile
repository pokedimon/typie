FROM python:3.13-slim

WORKDIR /app_project

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app_project \
    FLASK_RUN_HOST=0.0.0.0 \
    FLASK_RUN_PORT=8081

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8081

CMD ["python", "app/main.py"]