# Build from the repo root:  docker compose up -d   (or: docker build -f server/Dockerfile .)

# 1. Web app (Expo export) -> /app/dist
FROM node:24-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx expo export --platform web

# 2. Go server
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /paker .

# 3. Minimal runtime image: the binary and the web build
FROM scratch
COPY --from=build /paker /paker
COPY --from=web /app/dist /web
VOLUME /data
EXPOSE 8080 9090
ENTRYPOINT ["/paker"]
