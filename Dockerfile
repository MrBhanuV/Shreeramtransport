FROM python:3.12-slim

WORKDIR /srv

# PyMySQL is the pure-Python MySQL driver used here, so no libmysqlclient is
# required; build-essential is kept only for bcrypt/cryptography wheels on
# platforms without a matching prebuilt wheel.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

ENTRYPOINT ["/srv/docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
