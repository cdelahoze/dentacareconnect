# dentacareconnect
DentaCare Connect is an automated patient tracking and smart appointment management platform for dental clinics. It automatically schedules follow-up controls, triggers multi-channel reminders (Email, WhatsApp, SMS), and features a patient self-service portal to reduce post-procedure drop-off rates.

## Team

• Amando Evangelista Santos Filho
• Bryan Wesley Santana
• Cristian Moisés De La Hoz Escorcia
• Heewoong Kim

## Favorite quotes

Each team member adds one favorite quote here.

> 11 And again I say unto you as I have said before, that as ye have come to the knowledge of the glory of God, or if ye have known of his goodness and have tasted of his love, and have received a remission of your sins, which causeth such exceedingly great joy in your souls, even so I would that ye should remember, and always retain in remembrance, the greatness of God, and your own nothingness, and his goodness and long-suffering towards you, unworthy creatures, and humble yourselves even in the depths of humility, calling on the name of the Lord daily, and standing steadfastly in the faith of that which is to come, which was spoken by the mouth of the angel.

> Mosiah 4:11, chose by Cristian De La Hoz



# 1. Install Prisma Client

>If running `npm install prisma @prisma/client` resulted in the installation of Prisma version 7 or higher (which changed how `PrismaClient` is exported or requires a `prisma.config.ts` file), please install a stable version 5 or 6 that matches your `package.json`:

npm install prisma@^5.22.0 @prisma/client@^5.22.0


# 2. Install Prisma CLI, Nodemon, and ts-node as development dependencies
npm install -D prisma nodemon ts-node

# 3. Initialize Prisma
npx prisma init

# 4. Important note if you installed Prisma 7+

If you have installed Prisma 7 or higher, you may encounter changes in how `PrismaClient` is exported or the requirement of a `prisma.config.ts` file. To avoid compatibility issues, it is recommended to use Prisma version 5 or 6 as specified above.

npx prisma generate