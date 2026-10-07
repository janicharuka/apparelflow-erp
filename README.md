# ApparelFlow ERP

Production Batch Verification & Sewing Queue Gate.

## Current implementation
- Next.js + TypeScript
- Accessible, high-contrast UI
- Recipe seed/reference data for Casual Blouse and Crop Top
- Cutting order view
- Verification terminal with GREEN/YELLOW/RED logic
- Client-side approval hard-stop demonstration
- Relational Prisma schema prepared for PostgreSQL
- AI optimization report

## Required next setup
1. Copy `.env.example` to `.env`.
2. Put a PostgreSQL connection string in `DATABASE_URL`.
3. Run `npm install`.
4. Run `npx prisma generate`.
5. Run the database migration/seed commands added during backend implementation.

## Demo roles
- Cutting Supervisor
- Cutting Verifier
- Sewing Supervisor

## Business rule
A batch must never enter the Sewing Queue unless every required component has been counted and verified GREEN by an authorized Cutting Verifier. Backend enforcement is required for the production version.
