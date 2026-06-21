FROM python:3.13-slim

WORKDIR /app_project

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8081

CMD ["python", "app/main.py"]