FROM node:20-alpine AS build
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
COPY extensions ./extensions

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY extensions ./extensions

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/build ./build
COPY prisma ./prisma

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "docker-start"]
