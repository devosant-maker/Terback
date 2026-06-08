FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    curl \
    git \
    nano \
    util-linux \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV TERMINAL_USE_SCRIPT=true

EXPOSE 3000

CMD ["npm", "start"]
