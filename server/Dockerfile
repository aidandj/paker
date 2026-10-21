# Build from the repo root:  docker compose up -d   (or: docker build -f server/Dockerfile .)

# Both build stages run natively on the build machine ($BUILDPLATFORM) and cross-compile; only the
# final stage is per target architecture. No QEMU emulation, so multi-arch builds stay fast.

# 1. Web app (Expo export) -> /app/dist  (the JS bundle is architecture independent)
FROM --platform=$BUILDPLATFORM node:24-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx expo export --platform web

# 2. Go server, cross-compiled for the target
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS build
ARG TARGETOS TARGETARCH
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags="-s -w" -o /paker .

# 3. Minimal runtime image: the binary and the web build
FROM scratch
LABEL org.opencontainers.image.source="https://github.com/aidandj/paker"
COPY --from=build /paker /paker
COPY --from=web /app/dist /web
# App icon for the SideStore source, plus whatever CI drops in web-extra/ (altstore.json and the .ipa)
COPY assets/icon.png /web/icon.png
COPY web-extra/ /web/
VOLUME /data
EXPOSE 8080 9090
ENTRYPOINT ["/paker"]
