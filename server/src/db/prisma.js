const { PrismaClient } = require('@prisma/client');

let prisma = null;

function getPrisma() {
  if (prisma) return prisma;
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });
  return prisma;
}

module.exports = { getPrisma };
