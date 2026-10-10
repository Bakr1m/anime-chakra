# Chakra Lens lab image: headless OpenCV for train/extract/evaluate/bench.
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /lab
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*
COPY python/ ./python/
COPY spec/ ./spec/
COPY models/ ./models/
RUN pip install --no-cache-dir ./python
COPY models-export/ ./models-export/
ENTRYPOINT ["chakralens"]
CMD ["--help"]
