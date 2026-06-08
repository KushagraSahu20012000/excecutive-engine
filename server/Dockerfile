FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 7860
ENV PORT=7860
ENV NODE_ENV=production

CMD ["npm", "run", "start"]
