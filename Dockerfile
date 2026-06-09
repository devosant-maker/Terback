FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    curl \
    ca-certificates \
    git \
    openssh-client \
    nano \
    python3 \
    util-linux \
    ripgrep \
    unzip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev --no-audit --no-fund --registry=https://registry.npmjs.org/

RUN npm install -g freebuff --no-audit --no-fund --registry=https://registry.npmjs.org/

COPY . .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
