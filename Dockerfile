FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    curl \
    git \
    nano \
    python3 \
    util-linux \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./
RUN npm install --omit=dev --no-audit --no-fund --registry=https://registry.npmjs.org/

COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
