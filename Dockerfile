FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ffmpeg ca-certificates curl \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY server ./server
COPY shared ./shared
COPY src ./src
COPY public ./public
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

RUN npm run build

CMD ["npx", "tsx", "server/index.ts"]
