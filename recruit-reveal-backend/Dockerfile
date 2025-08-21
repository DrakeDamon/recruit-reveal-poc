# recruit-reveal-backend/Dockerfile
FROM node:18-bullseye-slim

WORKDIR /app

# Install system deps for any native builds just in case
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]