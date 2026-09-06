FROM node:20-alpine

# ffmpeg powers the MKV/AVI → HLS transcoding feature
RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js .

ENV PORT=5000
EXPOSE 5000

CMD ["node", "server.js"]
